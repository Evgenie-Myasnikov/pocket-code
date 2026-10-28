import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';
import {CopilotService} from '../server/copilot';
test('Claude branch API authenticates, validates source and uses the inclusive preceding message',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-branch-')),root=path.join(dir,'project');await mkdir(root);
 const id=randomUUID(),fork=randomUUID(),calls:any[]=[],messages=[{type:'user',uuid:'u1',message:{content:'First'}},{type:'assistant',uuid:'a1',message:{content:'Answer'}},{type:'user',uuid:'u2',message:{content:'Second'}}];
 const sdk:any={listSessions:async()=>[{sessionId:id,cwd:root,summary:'Synthetic chat',lastModified:1}],getSessionMessages:async()=>messages,forkSession:async(...args:any[])=>{calls.push(args);return{sessionId:fork};}};
 const token='t'.repeat(43),{app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Test',uploads:path.join(dir,'uploads'),desktopSessionIndexes:[]},undefined,sdk);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 t.after(async()=>{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));await rm(dir,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/sessions/${id}/branch`;
 const request=(messageId:string)=>fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({provider:'claude',messageId})});
 assert.equal((await fetch(url,{method:'POST'})).status,401);
 assert.equal((await request('missing')).status,404);assert.equal(calls.length,0);
 assert.equal((await (await request('u1')).json()).sessionId,null);assert.equal(calls.length,0);
 assert.equal((await (await request('u2')).json()).sessionId,fork);
 assert.deepEqual(calls,[[id,{dir:root,upToMessageId:'a1'}]]);assert.equal(messages.length,3);
});
test('Copilot branches at an exclusive user event and never truncates the source',async()=>{
 const calls:any[]=[],id=randomUUID(),fork=randomUUID();
 const client:any={start:async()=>{},stop:async()=>[],resumeSession:async()=>({getEvents:async()=>[{id:'u1',type:'user.message',data:{content:'Original'}}],disconnect:async()=>{}}),rpc:{sessions:{fork:async(args:any)=>{calls.push(args);return{sessionId:fork};}}}};
 const service=new CopilotService([process.cwd()],client);
 try{assert.equal(await service.forkBeforeMessage(id,'u1'),fork);assert.deepEqual(calls,[{sessionId:id,toEventId:'u1'}]);await assert.rejects(service.forkBeforeMessage(id,'missing'),/unavailable/);assert.equal(calls.length,1);}finally{await service.close();}
});
