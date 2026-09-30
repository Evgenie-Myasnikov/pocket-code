import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './security.js';
import { validateHostAsset, type HostAsset } from './host-package.js';

const execute = promisify(execFile);
export type Update = { version: string; versionCode: number; sha256: string; size: number; apk: string; releaseId: number; tag: string };
export function validateUpdate(raw: any, release: any): Update {
  if (release.draft || release.prerelease || !Number.isSafeInteger(release.id) || release.id < 1 || raw.applicationId !== 'app.pocketcode.mobile' || !/^\d+\.\d+\.\d+$/.test(raw.version) || release.tag_name !== `v${raw.version}` || !Number.isSafeInteger(raw.versionCode) || raw.versionCode < 1 || !/^[a-f0-9]{64}$/.test(raw.sha256) || raw.apk !== `Pocket-Code-${raw.version}.apk` || !Number.isSafeInteger(raw.size) || raw.size < 1 || raw.size > 200_000_000) throw new Error('Invalid update manifest');
  const asset = release.assets?.find((a: any) => a.name === raw.apk);
  if (!asset || asset.size !== raw.size || asset.state !== 'uploaded' || (asset.digest && asset.digest !== `sha256:${raw.sha256}`)) throw new Error('Update asset does not match its manifest');
  return { version: raw.version, versionCode: raw.versionCode, sha256: raw.sha256, size: raw.size, apk: raw.apk, releaseId: release.id, tag: release.tag_name };
}
export class ReleaseUpdater {
  private cached?: { at: number; update: Update };
  private checking?: Promise<Update>;
  private downloads = new Map<string, Promise<string>>();
  constructor(private repo: string | undefined, private directory: string) {
    if (repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid update repository');
  }
  get enabled() { return !!this.repo; }
  async hostRelease(version: string): Promise<HostAsset> {
    if (!this.repo || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) throw new Error('PC updates are unavailable.');
    const release = JSON.parse(await this.gh(['api', `repos/${this.repo}/releases/tags/v${version}`]));
    const asset = release.assets?.find((a: any) => a.name === 'update.json');
    if (!asset || !Number.isSafeInteger(asset.id) || asset.size > 10000) throw new Error('Missing PC release manifest.');
    const manifest = JSON.parse(await this.gh(['api', `repos/${this.repo}/releases/assets/${asset.id}`, '-H', 'Accept: application/octet-stream'], 10000));
    return validateHostAsset(manifest, release);
  }
  async downloadHost(release: HostAsset): Promise<Buffer> {
    if (!this.repo) throw new Error('PC updates are unavailable.');
    await mkdir(this.directory, { recursive: true });
    const temporary = await mkdtemp(path.join(this.directory, 'host-download-'));
    try {
      await this.gh(['release', 'download', `v${release.version}`, '--repo', this.repo, '--pattern', release.asset, '--dir', temporary]);
      const file = path.join(temporary, release.asset);
      if ((await stat(file)).size !== release.size) throw new Error('Unexpected PC bundle size.');
      return await readFile(file);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
  private async gh(args: string[], maxBuffer = 2_000_000) {
    const result = await execute('gh', args, { windowsHide: true, timeout: 180000, maxBuffer }); return result.stdout;
  }
  async latest(): Promise<{ enabled: boolean; update?: Update }> {
    if (!this.repo) return { enabled: false };
    if (this.cached && Date.now() - this.cached.at < 300000) return { enabled: true, update: this.cached.update };
    this.checking ||= (async () => {
      const release = JSON.parse(await this.gh(['api', `repos/${this.repo}/releases/latest`]));
      const manifest = release.assets?.find((a: any) => a.name === 'update.json');
      if (!manifest || !Number.isSafeInteger(manifest.id) || manifest.size > 10000) throw new Error('Missing update manifest');
      const raw = JSON.parse(await this.gh(['api', `repos/${this.repo}/releases/assets/${manifest.id}`, '-H', 'Accept: application/octet-stream'], 10000));
      const update = validateUpdate(raw, release); this.cached = { at: Date.now(), update }; return update;
    })().finally(() => { this.checking = undefined; });
    try { return { enabled: true, update: await this.checking }; }
    catch { throw new HttpError(502, 'Could not check GitHub releases. Check GitHub access on the PC and try again.'); }
  }
  async download(releaseId: number): Promise<string> {
    const { update } = await this.latest();
    if (!update || update.releaseId !== releaseId) throw new HttpError(409, 'The release changed. Check for updates again.');
    const key = update.sha256;
    const pending = this.downloads.get(key); if (pending) return pending;
    const action = (async () => {
      await mkdir(this.directory, {recursive:true});
      const destination = path.join(this.directory, key + '.apk');
      const valid = async (file: string) => { try { return (await stat(file)).size === update.size && createHash('sha256').update(await readFile(file)).digest('hex') === key; } catch { return false; } };
      if (await valid(destination)) return destination;
      const temp = await mkdtemp(path.join(this.directory, 'download-'));
      try {
        await this.gh(['release', 'download', update.tag, '--repo', this.repo!, '--pattern', update.apk, '--dir', temp]);
        const downloaded = path.join(temp, update.apk);
        if (!await valid(downloaded)) throw new Error('APK checksum mismatch');
        await rename(downloaded, destination); return destination;
      } finally { await rm(temp, {recursive:true,force:true}); }
    })().catch(() => { throw new HttpError(502, 'Could not download and verify the update from GitHub.'); }).finally(() => this.downloads.delete(key));
    this.downloads.set(key, action); return action;
  }
}
