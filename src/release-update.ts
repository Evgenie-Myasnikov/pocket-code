// Shared by the PC host and the phone, so both accept exactly the same published APK releases.
export const releaseRepository = 'Evgenie-Myasnikov/pocket-code';
export type Update = { version: string; versionCode: number; sha256: string; size: number; apk: string; releaseId: number; tag: string };
export function validateUpdate(raw: any, release: any): Update {
  if (release.draft || release.prerelease || !Number.isSafeInteger(release.id) || release.id < 1 || raw.applicationId !== 'app.pocketcode.mobile' || !/^\d+\.\d+\.\d+$/.test(raw.version) || release.tag_name !== `v${raw.version}` || !Number.isSafeInteger(raw.versionCode) || raw.versionCode < 1 || !/^[a-f0-9]{64}$/.test(raw.sha256) || raw.apk !== `Pocket-Code-${raw.version}.apk` || !Number.isSafeInteger(raw.size) || raw.size < 1 || raw.size > 200_000_000) throw new Error('Invalid update manifest');
  const asset = release.assets?.find((a: any) => a.name === raw.apk);
  if (!asset || asset.size !== raw.size || asset.state !== 'uploaded' || (asset.digest && asset.digest !== `sha256:${raw.sha256}`)) throw new Error('Update asset does not match its manifest');
  return { version: raw.version, versionCode: raw.versionCode, sha256: raw.sha256, size: raw.size, apk: raw.apk, releaseId: release.id, tag: release.tag_name };
}
/** Reads the latest public release directly, for phones without a reachable PC. */
export async function latestPublishedUpdate(getJson: (url: string) => Promise<any>): Promise<Update> {
  const release = await getJson(`https://api.github.com/repos/${releaseRepository}/releases/latest`);
  if (!release || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('Invalid release tag');
  const manifest = release.assets?.find((a: any) => a.name === 'update.json');
  if (!manifest || !Number.isSafeInteger(manifest.size) || manifest.size > 10000 || manifest.state !== 'uploaded') throw new Error('Missing update manifest');
  return validateUpdate(await getJson(`https://github.com/${releaseRepository}/releases/download/${release.tag_name}/update.json`), release);
}
