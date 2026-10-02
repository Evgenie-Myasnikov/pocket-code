import {CopilotService} from './copilot.js';
import { randomBytes } from 'node:crypto';
import { hostname, homedir, networkInterfaces } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { writePairingPage } from './pairing.js';
import { spawn, execFile } from 'node:child_process';
import { HostUpdater } from './host-update.js';
import packageJson from '../package.json';
import { startInternetTunnel } from './tunnel.js';
import { AtlassianJira } from './jira.js';
import { ReleaseUpdater } from './updates.js';
import { CodexJiraTools } from './jira-codex.js';
import { ExistingClaudeJira } from './jira-existing.js';
import { WindowsJiraStore } from './jira-vault.js';
import { EngineUpdates } from './engine-updates.js';
import { CodexService } from './codex.js';
import {JiraConnection} from './jira-connection.js';
import {JiraLogin} from './jira-login.js';

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
const codexJiraTools = new CodexJiraTools(roots[0]);
const codexJira = process.env.POCKET_JIRA_MODE === 'oauth' ? jira : new ExistingClaudeJira(path.join(local, 'jira-existing-codex.json'), codexJiraTools.call, codexJiraTools.call, 'codex');
const jiraConnection=new JiraConnection(path.join(local,'jira-connection.json'),{claude:jira,codex:codexJira});
await jiraConnection.ready;
const jiraSetupKey=randomBytes(32).toString('base64url');
const jiraLogin=new JiraLogin(async()=>Boolean((await jiraConnection.verify('codex')).connected));
const codex = new CodexService(roots, { attachmentRoots: [path.join(local, 'uploads')],allProjectHistory:true });
const copilot=new CopilotService(roots);
let internetAddress: string | undefined;
let runtimeReady = false;
const hostUpdater = new HostUpdater(updater, { version: packageJson.version, directory: local, previousDir: process.cwd(), roots, port, host, isBusy: () => !runtimeReady || isBusy(), tunnel: () => ({ publicUrl: internetAddress, tunnelPid: tunnel?.pid, tunnelExecutable: tunnel?.executable }), shutdown: () => shutdown(true) });
const { app, jobs, terminals, queue, codexQueue, copilotQueue, workflow, isBusy, maintainEngines } = await createApp({ copilot,pcJira:{key:jiraSetupKey,connection:jiraConnection,login:jiraLogin}, engineUpdates: new EngineUpdates(path.join(local, 'engine-updates.json')), runtime: { internet: () => Boolean(internetAddress && tunnel && !tunnel.isStopped()), stop: () => shutdown() }, hostUpdater, codex, updater, roots, token, hostName: hostname(), uploads: path.join(local, 'uploads'), webDir: path.resolve('dist'), jira:jiraConnection.service, jiraForProvider: () => jiraConnection.service });
runtimeReady = true;
const engineTimer=setInterval(()=>void maintainEngines().catch(()=>{}),30000);engineTimer.unref();
void maintainEngines().catch(()=>{});
const workflowTimer = setInterval(() => void workflow?.sync().catch(() => {}), 2000); workflowTimer.unref();
let tunnel: Awaited<ReturnType<typeof startInternetTunnel>> | undefined;
let closing = false;
async function showPairing() {
  let internetUrl: string | undefined;
  const inheritedUrl = process.env.POCKET_EXISTING_TUNNEL_URL, inheritedPid = Number(process.env.POCKET_EXISTING_TUNNEL_PID);
  if (inheritedUrl && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(inheritedUrl) && Number.isSafeInteger(inheritedPid) && inheritedPid > 0 && process.env.POCKET_TUNNEL_EXE) {
    process.kill(inheritedPid, 0); internetUrl = inheritedUrl;
    const executable = process.env.POCKET_TUNNEL_EXE;
    let inheritedStopped = false;
    tunnel = { pid: inheritedPid, executable, ready: Promise.resolve(internetUrl), isStopped: () => inheritedStopped, diagnostics: () => '', close: () => new Promise<void>(resolve => {
      // Validate the inherited tunnel's executable before ending it; never kill a reused arbitrary PID.
      const quoted = executable.replace(/'/g, "''");
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${inheritedPid}'; if($p.ExecutablePath -eq '${quoted}'){$p|Invoke-CimMethod -MethodName Terminate|Out-Null}`], { windowsHide: true, timeout: 5000 }, () => { inheritedStopped = true; resolve(); });
    }) };
  } else if (process.env.POCKET_INTERNET === '1') {
    if (!process.env.POCKET_TUNNEL_EXE) throw new Error('Запустите сервер через Start Pocket Code Internet.cmd');
    console.log('Открываем HTTPS-туннель. QR появится после подготовки интернет-адреса…');
    tunnel = await startInternetTunnel(process.env.POCKET_TUNNEL_EXE, port, local);
    if (closing) { tunnel.close(); return; }
    internetUrl = await tunnel.ready;
    console.log(`Адрес для мобильного интернета: ${internetUrl}`);
  }
  internetAddress = internetUrl;
  if (closing) return;
  const file = await writePairingPage(local, token!, host, port, internetUrl,jiraSetupKey);
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
let shutdownPromise: Promise<void> | undefined;
function shutdown(preserveTunnel = false): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  closing = true; runtimeReady = false; hostUpdater.close(); clearInterval(workflowTimer); clearInterval(engineTimer);
  app.locals.providerConnections?.close();
  const stopped = new Promise<void>(resolve => server.close(() => resolve()));
  const queues = [queue?.close(), codexQueue?.close(),copilotQueue?.close(),copilot.close()];
  jiraLogin.close(); codexJiraTools.close(); codex.close(); jobs.close(); terminals.close();
  // Keep shutdown bounded if a network client fails to finish closing, but let
  // local workflow writes and owned tunnel termination settle before exit.
  const fallback = setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 10000); fallback.unref();
  shutdownPromise = Promise.allSettled([stopped, ...queues, workflow?.sync(), jira.close(), preserveTunnel ? undefined : tunnel?.close()]).then(() => {
    clearTimeout(fallback); process.exit(0);
  });
  return shutdownPromise;
}
process.on('SIGINT', () => { void shutdown(); }); process.on('SIGTERM', () => { void shutdown(); });
