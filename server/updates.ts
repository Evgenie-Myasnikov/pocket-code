import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './security.js';
import { validateHostAsset, type HostAsset } from './host-package.js';

export type Update = { version: string; versionCode: number; sha256: string; size: number; apk: string; releaseId: number; tag: string };
export function validateUpdate(raw: any, release: any): Update {
  if (release.draft || release.prerelease || !Number.isSafeInteger(release.id) || release.id < 1 || raw.applicationId !== 'app.pocketcode.mobile' || !/^\d+\.\d+\.\d+$/.test(raw.version) || release.tag_name !== `v${raw.version}` || !Number.isSafeInteger(raw.versionCode) || raw.versionCode < 1 || !/^[a-f0-9]{64}$/.test(raw.sha256) || raw.apk !== `Pocket-Code-${raw.version}.apk` || !Number.isSafeInteger(raw.size) || raw.size < 1 || raw.size > 200_000_000) throw new Error('Invalid update manifest');
  const asset = release.assets?.find((a: any) => a.name === raw.apk);
  if (!asset || asset.size !== raw.size || asset.state !== 'uploaded' || (asset.digest && asset.digest !== `sha256:${raw.sha256}`)) throw new Error('Update asset does not match its manifest');
  return { version: raw.version, versionCode: raw.versionCode, sha256: raw.sha256, size: raw.size, apk: raw.apk, releaseId: release.id, tag: release.tag_name };
}
export class ReleaseUpdater {
  private preparation?:Promise<void>;
  private timer?:ReturnType<typeof setInterval>;
  private initial?:ReturnType<typeof setTimeout>;
  private closed=false;
  private state:'idle'|'checking'|'downloading'|'ready'|'error'='idle';
  private prepared?:Update;
  private checkedAt=0;
  desktopCheckRequestedAt=0;
  status(){return {enabled:this.enabled,state:this.state,checkedAt:this.checkedAt,...(this.state==='ready'&&this.prepared?{update:this.prepared}:{})};}
  start(){if(this.timer||this.closed||!this.enabled)return;this.initial=setTimeout(()=>void this.prepare(),2000);this.initial.unref();this.timer=setInterval(()=>void this.prepare(),6*60*60*1000);this.timer.unref();}
  close(){this.closed=true;clearInterval(this.timer);clearTimeout(this.initial);}
  check(){this.desktopCheckRequestedAt=Date.now();void this.prepare(true);return this.status();}
  async prepare(force=false){
    if(this.closed||!this.enabled)return;if(this.preparation)return this.preparation;
    if(force)this.cached=undefined;this.state='checking';
    this.preparation=(async()=>{try{const {update}=await this.latest();if(this.closed||!update)return;this.state='downloading';await this.download(update.releaseId);if(this.closed)return;this.prepared=update;this.checkedAt=Date.now();this.state='ready';}catch{if(!this.closed)this.state='error';}})().finally(()=>{this.preparation=undefined;});
    return this.preparation;
  }
  private cached?: { at: number; update: Update };
  private checking?: Promise<Update>;
  private downloads = new Map<string, Promise<string>>();
  constructor(private repo: string | undefined, private directory: string) {
    if (repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid update repository');
  }
  get enabled() { return !!this.repo; }
  async hostRelease(version: string): Promise<HostAsset> {
    if (!this.repo || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version)) throw new Error('PC updates are unavailable.');
    const release = JSON.parse((await this.publicGet(`https://api.github.com/repos/${this.repo}/releases/tags/v${version}`,2_000_000)).toString());
    const asset = release.assets?.find((a: any) => a.name === 'update.json');
    if (!asset || !Number.isSafeInteger(asset.id) || asset.size > 10000) throw new Error('Missing PC release manifest.');
    const manifest = JSON.parse((await this.publicGet(`https://github.com/${this.repo}/releases/download/v${version}/update.json`,10000)).toString());
    return validateHostAsset(manifest, release);
  }
  async downloadHost(release: HostAsset): Promise<Buffer> {
    if (!this.repo) throw new Error('PC updates are unavailable.');
    const bytes=await this.publicGet(`https://github.com/${this.repo}/releases/download/v${release.version}/${encodeURIComponent(release.asset)}`,release.size);
    if(bytes.length!==release.size)throw new Error('Unexpected PC bundle size.');return bytes;
  }
  private async publicGet(url:string,limit:number):Promise<Buffer>{
    const response=await fetch(url,{headers:{'User-Agent':'Pocket-Code-Updater'},signal:AbortSignal.timeout(180000)});
    if(!response.ok||!response.body)throw Error('Release download unavailable');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>limit)throw Error('Release exceeds size limit');chunks.push(next.value);}}finally{await reader.cancel().catch(()=>{});}
    return Buffer.concat(chunks);
  }
  async latest(): Promise<{ enabled: boolean; update?: Update }> {
    if (!this.repo) return { enabled: false };
    if (this.cached && Date.now() - this.cached.at < 300000) return { enabled: true, update: this.cached.update };
    this.checking ||= (async () => {
      const release = JSON.parse((await this.publicGet(`https://api.github.com/repos/${this.repo}/releases/latest`,2_000_000)).toString());
      if(!/^v\d+\.\d+\.\d+$/.test(release.tag_name))throw Error('Invalid release tag');
      const manifest = release.assets?.find((a: any) => a.name === 'update.json');
      if (!manifest || !Number.isSafeInteger(manifest.id) || manifest.size > 10000) throw new Error('Missing update manifest');
      const raw = JSON.parse((await this.publicGet(`https://github.com/${this.repo}/releases/download/${release.tag_name}/update.json`,10000)).toString());
      const update = validateUpdate(raw, release); this.cached = { at: Date.now(), update }; return update;
    })().finally(() => { this.checking = undefined; });
    try { return { enabled: true, update: await this.checking }; }
    catch { throw new HttpError(502, 'Could not check GitHub releases. Check GitHub access on the PC and try again.'); }
  }
  async download(releaseId: number): Promise<string> {
    const update=this.prepared?.releaseId===releaseId?this.prepared:(await this.latest()).update;
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
        const downloaded = path.join(temp, update.apk);
        await writeFile(downloaded,await this.publicGet(`https://github.com/${this.repo}/releases/download/${update.tag}/${update.apk}`,update.size));
        if (!await valid(downloaded)) throw new Error('APK checksum mismatch');
        await rename(downloaded, destination); return destination;
      } finally { await rm(temp, {recursive:true,force:true}); }
    })().catch(() => { throw new HttpError(502, 'Could not download and verify the update from GitHub.'); }).finally(() => this.downloads.delete(key));
    this.downloads.set(key, action); return action;
  }
}
