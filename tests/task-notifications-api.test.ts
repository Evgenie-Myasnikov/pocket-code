import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import type {AddressInfo} from 'node:net';import {createApp} from '../server/app';import {Jobs} from '../server/jobs';
test('task inbox routes require host authentication and validate read IDs',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-inbox-api-'));const token='fixture-token-'.repeat(4),jobs=new Jobs();
 const {app,terminals}=await createApp({roots:[root],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/task-notifications`;
 try{assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[]})})).status,401);
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};const view=await(await fetch(url,{headers})).json();assert.equal(view.unread,0);assert.deepEqual(view.sources,[]);
 assert.equal((await fetch(url+'/read',{method:'POST',headers,body:JSON.stringify({ids:[123]})})).status,400);assert.equal((await fetch(url+'/read',{method:'POST',headers,body:JSON.stringify({ids:[]})})).status,200);
 }finally{jobs.close();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
