import { readFile, writeFile, readdir, lstat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function buildHostBundle(root) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const files = [];
  async function add(name) {
    if (name.split('/').some(part => part.startsWith('.')) || /\.(?:pem|key|p12|pfx|jks|keystore|log)$/i.test(name)) throw new Error('Private files cannot be packaged');
    const file = path.join(root, name), info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error('Host packages cannot contain symlinks');
    if (info.isDirectory()) { for (const entry of (await readdir(file)).sort()) await add(name + '/' + entry); return; }
    if (!info.isFile() || info.size > 20_000_000) throw new Error('Invalid host file');
    const bytes = await readFile(file); files.push({ path: name, content: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json', 'project-boards', 'server', 'src', 'dist', 'scripts/host-update-worker.mjs', 'scripts/board-cli.mjs', 'scripts/miro-cli.mjs']) await add(name);
  const asset = `Pocket-Code-Host-${pkg.version}.json.gz`;
  const bytes = gzipSync(Buffer.from(JSON.stringify({ format: 1, version: pkg.version, files })));
  return { asset, bytes, fileCount: files.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { asset, bytes, fileCount } = await buildHostBundle(root);
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', asset), bytes);
  console.log(`PC update bundle created (${fileCount} files, ${bytes.length} bytes).`);
}
