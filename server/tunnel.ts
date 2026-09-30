import { spawn } from 'node:child_process';
import { mkdir, writeFile, open, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export function tunnelAddress(log: string): string | null {
  return log.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com(?![a-z0-9.-])/i)?.[0] || null;
}

export async function startInternetTunnel(executable: string, port: number, directory: string) {
  // An explicit empty config avoids inheriting unrelated named tunnel settings.
  const configDir = path.join(directory, 'tunnel'); await mkdir(configDir, { recursive: true });
  const configFile = path.join(configDir, 'empty.yml'); await writeFile(configFile, '{}\n');
  // File-backed stdio lets the authenticated updater keep this tunnel alive during host handoff.
  const logFile = path.join(configDir, `connection-${randomUUID()}.log`), log = await open(logFile, 'wx', 0o600);
  const child = spawn(executable, ['tunnel', '--config', configFile, '--no-autoupdate', '--protocol', 'http2', '--url', `http://127.0.0.1:${port}`], { windowsHide: true, detached: true, stdio: ['ignore', log.fd, log.fd] });
  void log.close().catch(() => {}); child.unref();
  const close = () => { if (child.exitCode === null) child.kill(); };
  let stopped = false;
  let diagnostic = '';
  child.on('exit', () => { stopped = true; });
  const ready = new Promise<string>((resolve, reject) => {
    let buffer = '', resolved = false, allocatedUrl: string | null = null;
    const cleanup = () => { clearTimeout(timer); clearInterval(poll); };
    const timer = setTimeout(() => { cleanup(); close(); reject(new Error('HTTPS-туннель не открылся за 90 секунд. Проверьте интернет или ограничения VPN на ПК.')); }, 90000);
    const fail = () => { cleanup(); if (!resolved) reject(new Error('Не удалось запустить HTTPS-туннель. Проверьте соединение ПК с интернетом.')); };
    child.once('error', fail); child.once('exit', fail);
    const receive = (chunk: Buffer) => {
      buffer = (buffer + chunk.toString('utf8')).slice(-12000);
      diagnostic = buffer.slice(-3500);
      allocatedUrl ||= tunnelAddress(buffer);
      if (allocatedUrl && /Registered tunnel connection/.test(buffer) && !resolved) { resolved = true; cleanup(); resolve(allocatedUrl); }
    };
    const poll = setInterval(() => { void readFile(logFile).then(receive).catch(fail); }, 200);
  });
  return { ready, close, pid: child.pid, executable, isStopped: () => stopped, diagnostics: () => diagnostic };
}
