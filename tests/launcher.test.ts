import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {spawn,execFile,type ChildProcess} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import os from 'node:os';
import path from 'node:path';

const run=promisify(execFile),windows={skip:process.platform!=='win32',timeout:30000};
const syntheticKey='launcher-synthetic-key-'.repeat(3);
const listenerCode=`
import http from 'node:http';
const server=http.createServer((req,res)=>{
  process.send({request:{method:req.method,path:req.url,authorization:req.headers.authorization}});
  res.setHeader('Content-Type','application/json');
  if(req.url==='/ping'){res.end(JSON.stringify({alive:true}));return;}
  const authorized=process.env.TEST_MODE!=='unauthorized'&&req.headers.authorization==='Bearer '+process.env.TEST_KEY;
  if(!authorized){res.writeHead(401);res.end(JSON.stringify({error:'Synthetic unauthorized'}));return;}
  const pocket=process.env.TEST_MODE==='pocket';
  if(req.url==='/api/health'){res.end(JSON.stringify(pocket?{protocol:1,processId:process.pid,version:'1.2.3'}:{service:'unrelated'}));return;}
  if(req.url==='/api/runtime'){res.end(JSON.stringify({applicationId:pocket?'app.pocketcode.host':'unrelated.test.service',processId:process.pid,version:'1.2.3',busy:false,internet:false}));return;}
  if(req.url==='/api/runtime/stop'&&req.method==='POST'&&pocket){res.once('finish',()=>server.close(()=>process.exit(0)));res.end(JSON.stringify({accepted:true}));return;}
  res.writeHead(404);res.end('{}');
});
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
`;
async function fixture(t:any){
  const directory=await mkdtemp(path.join(os.tmpdir(),'pocket-launcher-test-'));
  for(const sub of ['scripts','data','bin','dist','node_modules'])await mkdir(path.join(directory,sub));
  for(const script of ['start.ps1','stop.ps1'])await writeFile(path.join(directory,'scripts',script),await readFile(new URL(`../scripts/${script}`,import.meta.url)));
  await writeFile(path.join(directory,'data','connection-key.txt'),syntheticKey);
  // If port recognition regresses, fail closed without starting a real host,
  // installing packages, opening pairing UI or invoking the actual CLI.
  await writeFile(path.join(directory,'scripts','run-host.ps1'),"Set-Content -LiteralPath (Join-Path $env:POCKET_DATA_DIR 'unexpected-launch') -Value 'blocked'; throw 'Unexpected host launch in isolated test'");
  await writeFile(path.join(directory,'dist','index.html'),'<!-- Synthetic test only. -->');
  await writeFile(path.join(directory,'bin','claude.cmd'),'@exit /b 86\r\n');
  await writeFile(path.join(directory,'bin','npm.cmd'),'@exit /b 87\r\n');
  const children:ChildProcess[]=[];
  t.after(async()=>{
    for(const child of children)if(child.exitCode===null&&child.signalCode===null){const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));child.kill();await exited;}
    const resolved=path.resolve(directory),tempRoot=path.resolve(os.tmpdir())+path.sep;
    assert.ok(resolved.startsWith(tempRoot)&&path.basename(resolved).startsWith('pocket-launcher-test-'));
    await rm(resolved,{recursive:true,force:true});
  });
  return{
    directory,
    async listener(mode:'pocket'|'unrelated'|'unauthorized'){
      const requests:{method:string;path:string;authorization:string}[]=[];
      const child=spawn(process.execPath,['--input-type=module','-e',listenerCode],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,TEST_MODE:mode,TEST_KEY:syntheticKey}});children.push(child);
      child.on('message',(message:any)=>{if(message.request)requests.push(message.request);});
      const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
      const port=await new Promise<number>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Synthetic listener did not start')),5000);
        child.once('error',error=>{clearTimeout(timer);reject(error);});
        child.on('message',(message:any)=>{if(message.port){clearTimeout(timer);resolve(message.port);}});
      });
      assert.notEqual(port,4318);return{port,child,requests,exited};
    },
    async launch(script:'start'|'stop',port:number){
      assert.ok(port>0&&port!==4318);
      const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
      try{
        const result=await run(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(directory,'scripts',`${script}.ps1`),'-Port',String(port),...(script==='start'?['-ProjectPath',directory]:[])],{windowsHide:true,timeout:15000,maxBuffer:200000,env:{...process.env,POCKET_TOKEN:'',POCKET_DATA_DIR:path.join(directory,'data'),PATH:[path.join(directory,'bin'),path.dirname(process.execPath),process.env.PATH].join(path.delimiter)}});
        return{code:0,output:result.stdout+result.stderr};
      }catch(error:any){return{code:error.code,output:String(error.stdout||'')+String(error.stderr||''),killed:error.killed};}
    },
    async noHostWasStarted(){await assert.rejects(access(path.join(directory,'data','unexpected-launch')));},
  };
}

test('launcher recognizes its authenticated occupied port and starts no second host',windows,async t=>{
  const f=await fixture(t),listener=await f.listener('pocket');
  const result=await f.launch('start',listener.port);
  assert.equal(result.code,0,result.output);assert.match(result.output,/already running/i);await f.noHostWasStarted();
  assert.ok(listener.requests.some(request=>request.path==='/api/health'||request.path==='/api/runtime'));
  assert.ok(listener.requests.every(request=>request.method==='GET'&&request.authorization===`Bearer ${syntheticKey}`));
  assert.equal(listener.child.exitCode,null);assert.deepEqual(await(await fetch(`http://127.0.0.1:${listener.port}/ping`)).json(),{alive:true});
});
for(const mode of ['unrelated','unauthorized'] as const)test(`launcher leaves a ${mode} listener alone and exits with failure`,windows,async t=>{
  const f=await fixture(t),listener=await f.listener(mode),result=await f.launch('start',listener.port);
  assert.equal(result.code,1,result.output);assert.match(result.output,/another process.*No process was stopped/i);await f.noHostWasStarted();
  assert.ok(listener.requests.length>0);assert.ok(listener.requests.every(request=>request.method==='GET'));
  assert.equal(listener.child.exitCode,null);assert.deepEqual(await(await fetch(`http://127.0.0.1:${listener.port}/ping`)).json(),{alive:true});
});
test('stop launcher is harmless when the selected ephemeral port has no listener',windows,async t=>{
  const f=await fixture(t),reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=(reservation.address() as {port:number}).port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
  const result=await f.launch('stop',port);assert.equal(result.code,0,result.output);assert.match(result.output,/not running/i);await f.noHostWasStarted();
});
test('stop launcher authenticates both identity and stop requests without restarting',windows,async t=>{
  const f=await fixture(t),listener=await f.listener('pocket'),result=await f.launch('stop',listener.port);
  assert.equal(result.code,0,result.output);assert.match(result.output,/will not restart/i);await listener.exited;
  assert.deepEqual(listener.requests.map(request=>[request.method,request.path]),[['GET','/api/runtime'],['POST','/api/runtime/stop']]);
  assert.ok(listener.requests.every(request=>request.authorization===`Bearer ${syntheticKey}`));await f.noHostWasStarted();
});
test('stop launcher refuses an unrelated application identity without posting stop',windows,async t=>{
  const f=await fixture(t),listener=await f.listener('unrelated'),result=await f.launch('stop',listener.port);
  assert.equal(result.code,1,result.output);assert.match(result.output,/not a supported Pocket Code server/i);
  assert.deepEqual(listener.requests.map(request=>[request.method,request.path]),[['GET','/api/runtime']]);
  assert.equal(listener.child.exitCode,null);assert.deepEqual(await(await fetch(`http://127.0.0.1:${listener.port}/ping`)).json(),{alive:true});await f.noHostWasStarted();
});
