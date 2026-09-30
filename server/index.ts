import { randomBytes } from 'node:crypto';
import { hostname, homedir, networkInterfaces } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { writePairingPage } from './pairing.js';
import { spawn } from 'node:child_process';
import { startInternetTunnel } from './tunnel.js';
import { AtlassianJira } from './jira.js';
import { ReleaseUpdater } from './updates.js';
import { ExistingClaudeJira } from './jira-existing.js';
import { WindowsJiraStore } from './jira-vault.js';
import { CodexService } from './codex.js';

const local = path.resolve(process.env.POCKET_DATA_DIR || path.join(homedir(), '.pocket-code'));
await mkdir(local, { recursive: true });
const keyFile = path.join(local, 'connection-key.txt');
let token = process.env.POCKET_TOKEN;
if (!token) {
  try { token = (await readFile(keyFile, 'utf8')).trim(); }
  catch (error: any) { if (error.code !== 'ENOENT') throw error; token = randomBytes(32).toString('base64url'); await writeFile(keyFile, token, { mode: 0o600, flag: 'wx' }); }
}
if (token.length < 32) throw new Error('Ключ подключения должен содержать не менее 32 символов');
const roots: string[] = process.env.POCKET_ROOTS ? JSON.parse(process.env.POCKET_ROOTS) : [process.cwd()];
const host = process.env.POCKET_HOST || '127.0.0.1', port = Number(process.env.POCKET_PORT || 4318);
const jira = process.env.POCKET_JIRA_MODE === 'oauth' ? new AtlassianJira(new WindowsJiraStore(path.join(local, 'jira-auth.dat'))) : new ExistingClaudeJira(path.join(local, 'jira-existing.json'));
let updateRepo = process.env.POCKET_UPDATE_REPO;
if (!updateRepo) { try { updateRepo = JSON.parse(await readFile(path.join(local, 'updates.json'), 'utf8')).repository; } catch {} }
const updater = new ReleaseUpdater(updateRepo, path.join(local, 'updates'));
const codex = new CodexService(roots, { attachmentRoots: [path.join(local, 'uploads')] });
const { app, jobs, terminals, queue, codexQueue, workflow } = await createApp({ codex, updater, roots, token, hostName: hostname(), uploads: path.join(local, 'uploads'), webDir: path.resolve('dist'), jira });
const workflowTimer = setInterval(() => void workflow?.sync().catch(() => {}), 2000); workflowTimer.unref();
let tunnel: Awaited<ReturnType<typeof startInternetTunnel>> | undefined;
let closing = false;
async function showPairing() {
  let internetUrl: string | undefined;
  if (process.env.POCKET_INTERNET === '1') {
    if (!process.env.POCKET_TUNNEL_EXE) throw new Error('Запустите сервер через Start Pocket Code Internet.cmd');
    console.log('Открываем HTTPS-туннель. QR появится после подготовки интернет-адреса…');
    tunnel = await startInternetTunnel(process.env.POCKET_TUNNEL_EXE, port, local);
    if (closing) { tunnel.close(); return; }
    internetUrl = await tunnel.ready;
    console.log(`Адрес для мобильного интернета: ${internetUrl}`);
  }
  if (closing) return;
  const file = await writePairingPage(local, token!, host, port, internetUrl);
  console.log(`QR-код подключения: ${file}`);
  if (process.env.POCKET_OPEN_PAIRING === '1' && process.platform === 'win32') {
    const child = spawn('explorer.exe', [file], { windowsHide: true, detached: true, stdio: 'ignore' });
    child.on('error', () => console.log('Откройте файл pairing.html вручную.')); child.unref();
  }
}
const server = app.listen(port, host, () => {
  console.log(`\nPocket Code • http://${host}:${port}\nПапки: ${roots.join(', ')}\nКлюч подключения: ${keyFile}\n`);
  if (host !== '127.0.0.1') for (const addresses of Object.values(networkInterfaces())) for (const a of addresses || [])
    if (a.family === 'IPv4' && !a.internal) console.log(`Адрес для телефона: http://${a.address}:${port}`);
  void showPairing().catch(error => console.error(error.message || 'Не удалось создать QR-код.'));
});
function shutdown() { closing = true; clearInterval(workflowTimer); void workflow?.sync().catch(() => {}); queue?.close(); codexQueue?.close(); codex.close(); void jira.close(); tunnel?.close(); jobs.close(); terminals.close(); server.close(); setTimeout(() => process.exit(0), 2000).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
