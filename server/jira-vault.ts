import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export interface JiraStore { load(): Promise<any>; save(data: any): Promise<void> }
function protect(value: string, decrypt: boolean): Promise<string> {
  const script = `$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); $null=[Reflection.Assembly]::LoadWithPartialName('System.Security'); $value=[Console]::In.ReadToEnd(); ` + (decrypt
    ? `[Console]::Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))`
    : `[Console]::Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($value),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))`);
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let result = ''; const timer = setTimeout(() => child.kill(), 10000);
    child.stdout.on('data', chunk => result += chunk.toString());
    child.on('error', () => { clearTimeout(timer); reject(new Error('Jira credential vault unavailable')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(result) : reject(new Error('Jira credential vault unavailable')); });
    child.stdin.on('error', () => {}); child.stdin.end(value);
  });
}
export class WindowsJiraStore implements JiraStore {
  constructor(private file: string) {}
  async load() {
    try { return JSON.parse(await protect(await readFile(this.file, 'utf8'), true)); }
    catch (error: any) { if (error.code === 'ENOENT') return {}; throw error; }
  }
  async save(data: any) {
    await mkdir(path.dirname(this.file), { recursive: true });
    const encrypted = await protect(JSON.stringify(data), false);
    await writeFile(this.file + '.tmp', encrypted, { mode: 0o600 }); await rename(this.file + '.tmp', this.file);
  }
}
