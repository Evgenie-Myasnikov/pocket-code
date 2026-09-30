import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Record = { processId: number; port: number };
type OwnerRecord = { processId: number; activeCount: number; members: { old?: boolean; detached?: boolean; replacement?: boolean } };

async function eventually<T>(read: () => Promise<T | null | false>, label: string, timeout = 8000): Promise<T> {
  const until = Date.now() + timeout;
  do { try { const result = await read(); if (result) return result; } catch {} await pause(60); } while (Date.now() < until);
  throw new Error(`Timed out: ${label}`);
}
async function json<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, 'utf8')); }
async function health(record: Record, role: string) {
  const response = await fetch(`http://127.0.0.1:${record.port}/health`, { signal: AbortSignal.timeout(600) });
  const body = await response.json();
  return body.processId === record.processId && body.role === role;
}
async function portReleased(port: number) {
  const server = createServer();
  return new Promise<boolean>(resolve => {
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
function exitOf(child: ChildProcess) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', () => resolve({ code: -1, signal: null }));
  });
}

const syntheticSource = `
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const [role,directory,targetPort]=process.argv.slice(2);
function child(name,port){
 const processHandle=spawn(process.execPath,[process.argv[1],name,directory,String(port||0)],{windowsHide:true,detached:true,stdio:'ignore'});
 processHandle.unref();
}
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.url==='/replace'&&req.method==='POST'&&role==='old'){
   res.end('{}');
   setTimeout(()=>{server.closeAllConnections();server.close(()=>{child('replacement',serverPort);setTimeout(()=>process.exit(0),30);});},20);
 }else res.end(JSON.stringify({role,processId:process.pid}));
});
await new Promise(resolve=>server.listen(Number(targetPort)||0,'127.0.0.1',resolve));
const serverPort=server.address().port;
await writeFile(path.join(directory,role+'.json'),JSON.stringify({processId:process.pid,port:serverPort}));
if(role==='old')child('detached');
`;

// Cleanup uses a retained process handle and checks the unique fixture command line;
// PID reuse can never cause another application's process to be terminated.
const inspectSource = `param([string]$FixtureDirectory,[switch]$Stop)
$ErrorActionPreference='Stop'
$remaining=@()
foreach($name in @('old','detached','replacement','unrelated')){
 $file=Join-Path $FixtureDirectory ($name+'.json')
 if(-not (Test-Path -LiteralPath $file)){continue}
 $record=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
 $owned=Get-Process -Id $record.processId -ErrorAction SilentlyContinue
 if(-not $owned){continue}
 $null=$owned.Handle
 $actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$record.processId)
 if(-not $actual -or -not $actual.CommandLine.Contains((Join-Path $FixtureDirectory 'synthetic-host.mjs'))){continue}
 $remaining+=$name
 if($Stop){$owned.Kill();if(-not $owned.WaitForExit(5000)){throw 'Owned fixture process did not exit'}}
}
ConvertTo-Json -InputObject @($remaining) -Compress
`;

for (const ending of ['dispose', 'abrupt'] as const) {
  test(`Windows owned host ${ending} closes detached descendants after replacement and leaves unrelated processes alive`, { skip: process.platform !== 'win32', timeout: 35000 }, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'pocket owned-host '));
    const script = path.join(directory, 'synthetic-host.mjs');
    const inspector = path.join(directory, 'inspect-owned.ps1');
    await writeFile(script, syntheticSource);
    await writeFile(inspector, inspectSource);
    let owner: ChildProcess | undefined, unrelated: ChildProcess | undefined;
    let ownerExit: ReturnType<typeof exitOf> | undefined, unrelatedExit: ReturnType<typeof exitOf> | undefined;
    let ownerErrors = '';
    async function inspect(stop = false): Promise<string[]> {
      const args = ['-NoProfile', '-NonInteractive', '-File', inspector, '-FixtureDirectory', directory];
      if (stop) args.push('-Stop');
      const { stdout } = await execute('powershell.exe', args, { windowsHide: true, timeout: 10000 });
      return JSON.parse(stdout.trim());
    }
    t.after(async () => {
      if (owner && owner.exitCode === null && owner.signalCode === null) { owner.kill('SIGKILL'); await ownerExit; }
      if (unrelated && unrelated.exitCode === null && unrelated.signalCode === null) { unrelated.kill('SIGKILL'); await unrelatedExit; }
      await inspect(true);
      assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
      await rm(directory, { recursive: true, force: true });
    });
    unrelated = spawn(process.execPath, [script, 'unrelated', directory], { windowsHide: true, stdio: 'ignore' });
    unrelatedExit = exitOf(unrelated);
    const outsider = await eventually(() => json<Record>(path.join(directory, 'unrelated.json')), 'unrelated synthetic listener');
    owner = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(project, 'tests/fixtures/owned-host-owner.ps1'), '-SourcePath', path.join(project, 'scripts/OwnedHost.cs'), '-NodePath', process.execPath, '-FixtureDirectory', directory], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    ownerExit = exitOf(owner);
    owner.stderr!.on('data', chunk => { ownerErrors += chunk.toString(); });
    const old = await eventually(() => json<Record>(path.join(directory, 'old.json')), 'C#-started original host');
    const detached = await eventually(() => json<Record>(path.join(directory, 'detached.json')), 'detached descendant');
    await eventually(async () => {
      const state = await json<OwnerRecord>(path.join(directory, 'owner.json'));
      return state.processId === old.processId && state.activeCount === 2 && state.members.old && state.members.detached;
    }, 'original and detached process are assigned to the job');
    assert.ok(await health(old, 'old'));
    assert.ok(await health(detached, 'detached'));
    assert.ok((await fetch(`http://127.0.0.1:${old.port}/replace`, { method: 'POST', signal: AbortSignal.timeout(1500) })).ok);
    const replacement = await eventually(() => json<Record>(path.join(directory, 'replacement.json')), 'replacement host');
    assert.equal(replacement.port, old.port);
    assert.notEqual(replacement.processId, old.processId);
    await eventually(async () => {
      const state = await json<OwnerRecord>(path.join(directory, 'owner.json'));
      return state.activeCount === 2 && state.members.old === false && state.members.detached && state.members.replacement;
    }, 'replacement remains owned after original host exits');
    await pause(250);
    assert.ok(await health(replacement, 'replacement'));
    assert.ok(await health(detached, 'detached'));
    assert.ok(await health(outsider, 'unrelated'));
    if (ending === 'dispose') await writeFile(path.join(directory, 'dispose'), '1');
    else assert.ok(owner.kill('SIGKILL'));
    const exit = await ownerExit;
    if (ending === 'dispose') assert.equal(exit.code, 0, ownerErrors);
    await eventually(async () => await portReleased(replacement.port) && await portReleased(detached.port), 'both owned ports released after owner exit');
    const remaining = await inspect();
    assert.deepEqual(remaining, ['unrelated'], 'every owned descendant exits, while unrelated process survives');
    assert.ok(await health(outsider, 'unrelated'));
  });
}
