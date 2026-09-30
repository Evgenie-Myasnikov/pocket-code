import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, rename, access, open } from 'node:fs/promises';
import { compareVersions, unpackHost, versionPattern } from './host-package.js';
import { HttpError } from './security.js';
import type { ReleaseUpdater } from './updates.js';
const execute = promisify(execFile);
export type HostUpdateStatus = { supported: boolean; currentVersion: string; targetVersion?: string; state: 'idle' | 'checking' | 'downloading' | 'installing' | 'waiting' | 'restarting' | 'updated' | 'failed'; message?: string };
type Options = { version: string; directory: string; previousDir: string; roots: string[]; port: number; host: string; isBusy(): boolean; tunnel(): { publicUrl?: string; tunnelPid?: number; tunnelExecutable?: string }; shutdown(): void };
export class HostUpdater {
  draining = false;
  private value: HostUpdateStatus;
  private timer?: ReturnType<typeof setInterval>;
  private active = false;
  private prepared?: { version: string; stagedDir: string };
  private workerRunning = false;
  private file: string;
  constructor(private releases: ReleaseUpdater, private options: Options) {
    this.file = path.join(options.directory, 'host', 'status.json');
    this.value = { supported: process.platform === 'win32' && releases.enabled, currentVersion: options.version, state: 'idle' };
    this.timer = setInterval(() => { void this.launch().catch(() => this.fail()); }, 5000); this.timer.unref();
  }
  async status(): Promise<HostUpdateStatus> {
    if (!this.active || this.prepared && !this.workerRunning) {
      try {
        const saved = JSON.parse(await readFile(this.file, 'utf8'));
        if (['updated', 'failed', 'waiting'].includes(saved.state) && (!saved.targetVersion || versionPattern.test(saved.targetVersion))) {
          this.value = { ...this.value, state: saved.state, targetVersion: saved.targetVersion, ...(saved.state === 'failed' ? { message: 'PC update failed. The previous version was restored when possible. Retry from Settings.' } : {}) };
        }
      } catch {}
    }
    return { ...this.value, currentVersion: this.options.version };
  }
  private async save(state: HostUpdateStatus['state'], message?: string) {
    this.value = { supported: this.value.supported, currentVersion: this.options.version, ...(this.value.targetVersion ? { targetVersion: this.value.targetVersion } : {}), state, ...(message ? { message } : {}) };
    await mkdir(path.dirname(this.file), { recursive: true });
    await writeFile(this.file + '.tmp', JSON.stringify(this.value), { mode: 0o600 }); await rename(this.file + '.tmp', this.file);
  }
  private async fail() { this.active = false; this.prepared = undefined; await this.save('failed', 'Could not update the PC. The current version is still available. Retry from Settings.'); }
  async check(appVersion: string) {
    if (!versionPattern.test(appVersion)) throw new HttpError(400, 'Invalid app version.');
    if (!this.value.supported || this.active || compareVersions(appVersion, this.options.version) <= 0) return this.status();
    this.active = true; this.value.targetVersion = appVersion; await this.save('checking');
    void this.prepare(appVersion).catch(() => this.fail());
    return this.status();
  }
  private async prepare(version: string) {
    const release = await this.releases.hostRelease(version);
    if (release.version !== version || compareVersions(release.version, this.options.version) <= 0) throw new Error('Unexpected PC release');
    await this.save('downloading');
    const bytes = await this.releases.downloadHost(release);
    const stagedDir = await unpackHost(bytes, release, path.join(this.options.directory, 'host', 'versions'));
    await this.save('installing');
    const npm = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'); await access(npm);
    await execute(process.execPath, [npm, 'ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: stagedDir, windowsHide: true, timeout: 600000, maxBuffer: 4_000_000, env: { ...process.env, npm_config_update_notifier: 'false' } });
    // A broken install is rejected while the running host is still untouched.
    await execute(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./server/app.ts'); await import('node-pty');"], { cwd: stagedDir, windowsHide: true, timeout: 30000, maxBuffer: 100000 });
    this.prepared = { version, stagedDir }; await this.save('waiting'); await this.launch();
  }
  private async launch() {
    if (!this.prepared || this.workerRunning || this.draining || this.options.isBusy()) return;
    this.workerRunning = true;
    try {
      const config = { ...this.prepared, previousDir: this.options.previousDir, nodeExecutable: process.execPath, dataDir: this.options.directory, port: this.options.port, host: this.options.host, roots: this.options.roots, oldPid: process.pid, statusFile: this.file, ...this.options.tunnel() };
      const configFile = path.join(this.options.directory, 'host', 'pending.json');
      await writeFile(configFile, JSON.stringify(config), { mode: 0o600 }); await this.save('restarting');
      const log = await open(path.join(this.options.directory, 'host', 'worker.log'), 'a');
      try {
        const child = spawn(process.execPath, [path.join(this.options.previousDir, 'scripts', 'host-update-worker.mjs'), configFile], { cwd: this.options.previousDir, env: process.env, detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd] });
        child.once('error', () => { this.workerRunning = false; void this.fail(); });
        child.once('exit', () => { this.workerRunning = false; if (!this.draining) void this.status().then(s => { if(s.state !== 'waiting')void this.fail(); }); }); child.unref();
      } finally { await log.close(); }
    } catch (error) { this.workerRunning = false; throw error; }
  }
  handoff(version: string, expectedPid: number) {
    if (this.draining || !this.prepared || version !== this.prepared.version || expectedPid !== process.pid || !this.workerRunning) throw new HttpError(409, 'PC update changed.');
    if (this.options.isBusy()) throw new HttpError(409, 'PC is busy. Waiting for work to finish.');
    this.draining = true;
  }
  finishHandoff() { setTimeout(() => this.options.shutdown(), 150).unref(); }
  close() { if (this.timer) clearInterval(this.timer); }
}
