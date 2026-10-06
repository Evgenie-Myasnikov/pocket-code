import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';

export const versionPattern = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export function compareVersions(a: string, b: string) {
  if (!versionPattern.test(a) || !versionPattern.test(b)) throw new Error('Invalid version');
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
export type HostAsset = { version: string; asset: string; size: number; sha256: string; releaseId: number; protocol: number };
export function validateHostAsset(raw: any, release: any): HostAsset {
  const h = raw?.host;
  if (release?.draft || release?.prerelease || !Number.isSafeInteger(release?.id) || release.id < 1 || raw?.applicationId !== 'app.pocketcode.mobile' || !versionPattern.test(raw.version) || release.tag_name !== `v${raw.version}` || h?.protocol !== 1 || h.asset !== `Pocket-Code-Host-${raw.version}.json.gz` || !Number.isSafeInteger(h.size) || h.size < 1 || h.size > 30_000_000 || !/^[a-f0-9]{64}$/.test(h.sha256)) throw new Error('This release has no compatible PC update.');
  const asset = release.assets?.find((a: any) => a.name === h.asset);
  if (!asset || asset.size !== h.size || asset.state !== 'uploaded' || (asset.digest && asset.digest !== `sha256:${h.sha256}`)) throw new Error('PC release verification failed.');
  return { version: raw.version, asset: h.asset, size: h.size, sha256: h.sha256, protocol: h.protocol, releaseId: release.id };
}
export async function unpackHost(bytes: Buffer, release: HostAsset, directory: string) {
  if (bytes.length !== release.size || createHash('sha256').update(bytes).digest('hex') !== release.sha256) throw new Error('PC update checksum verification failed.');
  const bundle = JSON.parse(gunzipSync(bytes, { maxOutputLength: 60_000_000 }).toString('utf8'));
  if (bundle.format !== 1 || bundle.version !== release.version || !Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 1500) throw new Error('Invalid PC bundle.');
  const names = new Set<string>(); let total = 0;
  const entries: { name: string; bytes: Buffer }[] = [];
  for (const file of bundle.files) {
    const name = file.path;
    if (typeof name !== 'string' || name.length > 240 || !/^(?:package(?:-lock)?\.json|tsconfig\.json|(?:server|src|dist|scripts)\/[A-Za-z0-9_./@-]+|project-boards\/(?:README\.md|board-[A-Za-z0-9-]+\.json|assets\/[a-f0-9]{64}\.(?:png|jpe?g|webp)))$/.test(name) || name.split('/').some((p: string) => !p || p === '.' || p === '..' || p.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) || names.has(name.toLowerCase()) || typeof file.content !== 'string' || file.content.length > 30_000_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new Error('Invalid PC bundle path or content.');
    const content = Buffer.from(file.content, 'base64'); total += content.length;
    if (total > 45_000_000 || createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error('Invalid PC bundle checksum.');
    names.add(name.toLowerCase()); entries.push({ name, bytes: content });
  }
  for (const name of ['package.json', 'package-lock.json', 'server/index.ts', 'scripts/host-update-worker.mjs', 'dist/index.html']) if (!names.has(name)) throw new Error('Incomplete PC bundle.');
  const pkg = JSON.parse(entries.find(e => e.name === 'package.json')!.bytes.toString('utf8'));
  if (pkg.name !== 'pocket-code' || pkg.version !== release.version) throw new Error('Wrong PC package version.');
  await mkdir(directory, { recursive: true });
  const stage = await mkdtemp(path.join(directory, release.version + '-'));
  const destination = path.join(stage, 'app'); await mkdir(destination);
  for (const entry of entries) { const target = path.join(destination, entry.name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, entry.bytes, { flag: 'wx' }); }
  return destination;
}
