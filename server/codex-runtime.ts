import { execFile } from 'node:child_process';
import { access, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

/**
 * Private, self-updating Codex CLI. The provider serves its model catalog per
 * client version, so an outdated desktop build hides newer models. Pocket Code
 * keeps the newest official `@openai/codex` npm release under
 * %LOCALAPPDATA%/Pocket Code/runtime/codex/<version>; discovery then prefers the
 * newest installed Codex. Disable with POCKET_CODEX_AUTO_UPDATE=0.
 */
const PACKAGE = '@openai/codex';
const versionPattern = /^\d+\.\d+\.\d+$/;

export function privateCodexRoot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return process.platform === 'win32' && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Pocket Code', 'runtime', 'codex') : undefined;
}

function nativeArch() { return process.arch === 'arm64' ? { arch: 'aarch64-pc-windows-msvc', platform: 'codex-win32-arm64' } : { arch: 'x86_64-pc-windows-msvc', platform: 'codex-win32-x64' }; }

/** Native executables inside one private version folder, newest npm layout first. */
export function privateCodexExecutables(versionDir: string): string[] {
  const { arch, platform } = nativeArch(), modules = path.join(versionDir, 'node_modules', '@openai');
  return [path.join(modules, platform, 'vendor', arch, 'bin', 'codex.exe'), path.join(modules, platform, 'vendor', arch, 'codex', 'codex.exe'),
    path.join(modules, 'codex', 'vendor', arch, 'bin', 'codex.exe'), path.join(modules, 'codex', 'vendor', arch, 'codex', 'codex.exe')];
}

export async function privateCodexCandidates(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const root = privateCodexRoot(env); if (!root) return [];
  try {
    return (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && versionPattern.test(entry.name))
      .sort((a, b) => compareCodexVersions(b.name, a.name)).flatMap(entry => privateCodexExecutables(path.join(root, entry.name)));
  } catch { return []; }
}

export function compareCodexVersions(a: string, b: string) {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return (left[index] || 0) - (right[index] || 0);
  return 0;
}

type Run = (file: string, args: string[], options: { cwd?: string; timeout: number }) => Promise<string>;
const run: Run = (file, args, options) => new Promise((resolve, reject) => execFile(file, args, { ...options, windowsHide: true, maxBuffer: 1 << 20 },
  (error, stdout) => error ? reject(new Error('Command failed')) : resolve(String(stdout))));

export type CodexRuntimeOptions = { env?: NodeJS.ProcessEnv; run?: Run; npmCli?: string; node?: string; latest?: () => Promise<string> };
export type CodexRuntimeResult = { state: 'disabled' | 'current' | 'installed' | 'failed'; version?: string };

export class CodexRuntime {
  private running?: Promise<CodexRuntimeResult>;
  private checkedAt = 0;
  constructor(private options: CodexRuntimeOptions = {}) {}
  private get env() { return this.options.env || process.env; }
  get enabled() { return Boolean(privateCodexRoot(this.env)) && this.env.POCKET_CODEX_AUTO_UPDATE !== '0'; }
  private npm() {
    const node = this.options.node || process.execPath;
    return { node, cli: this.options.npmCli || path.join(path.dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js') };
  }
  private async latest(): Promise<string> {
    if (this.options.latest) return this.options.latest();
    const { node, cli } = this.npm();
    const value = (await (this.options.run || run)(node, [cli, 'view', PACKAGE + '@latest', 'version', '--silent'], { timeout: 60000 })).trim();
    if (!versionPattern.test(value)) throw new Error('Invalid Codex version metadata.');
    return value;
  }
  /** Checks at most every `intervalMs`; concurrent callers share one update. */
  update(intervalMs = 6 * 60 * 60 * 1000): Promise<CodexRuntimeResult> {
    if (!this.enabled) return Promise.resolve({ state: 'disabled' });
    if (this.running) return this.running;
    if (Date.now() - this.checkedAt < intervalMs) return Promise.resolve({ state: 'current' });
    this.running = this.install().finally(() => { this.running = undefined; this.checkedAt = Date.now(); });
    return this.running;
  }
  private async install(): Promise<CodexRuntimeResult> {
    const root = privateCodexRoot(this.env)!;
    try {
      const version = await this.latest();
      const target = path.join(root, version);
      for (const file of privateCodexExecutables(target)) { try { await access(file); await this.prune(root, version); return { state: 'current', version }; } catch { /* Not installed yet. */ } }
      const stage = path.join(root, '.install-' + process.pid + '-' + Date.now());
      await mkdir(stage, { recursive: true });
      try {
        const { node, cli } = this.npm();
        await (this.options.run || run)(node, [cli, 'install', '--prefix', stage, PACKAGE + '@' + version, '--no-audit', '--no-fund', '--no-save', '--loglevel=error'], { cwd: stage, timeout: 300000 });
        let found = false;
        for (const file of privateCodexExecutables(stage)) { try { await access(file); found = true; break; } catch { /* Try next layout. */ } }
        if (!found) throw new Error('Codex package has no native executable.');
        await rename(stage, target);
      } finally { await rm(stage, { recursive: true, force: true }).catch(() => {}); }
      await this.prune(root, version);
      return { state: 'installed', version };
    } catch { return { state: 'failed' }; }
  }
  /** Keeps the newest two versions; a folder whose codex.exe is still running cannot be removed and stays. */
  private async prune(root: string, keep: string) {
    try {
      const versions = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && versionPattern.test(entry.name)).map(entry => entry.name)
        .sort((a, b) => compareCodexVersions(b, a));
      for (const version of versions.slice(2)) if (version !== keep) await rm(path.join(root, version), { recursive: true, force: true }).catch(() => {});
    } catch { /* Cleanup is best effort. */ }
  }
}
