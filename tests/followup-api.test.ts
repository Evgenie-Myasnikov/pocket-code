import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
test('follow-up API authenticates, scopes attachments and replays accepted messages once',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-followup-')),other=path.join(root,'other');await mkdir(other);
  const jobs=new Jobs((({options}:any)=>(async function*(){await new Promise(resolve=>options.abortController.signal.addEventListener('abort',resolve,{once:true}));})()) as any);
  const token='fixture-token-'.repeat(4),id=randomUUID();
  const {app}=await createApp({roots:[root],token,hostName:'Fixture',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const post=(endpoint:string,body:unknown,auth=token)=>fetch(url+endpoint,{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
  jobs.start({id,cwd:root,text:'Start',mode:'default',maxBudgetUsd:1});
  try{
    const input={id:randomUUID(),text:'Clarify',attachments:[]};
    assert.equal((await post(`/jobs/${id}/messages`,input,'wrong')).status,401);
    const upload=await(await post('/uploads',{cwd:other,name:'note.txt',base64:Buffer.from('test').toString('base64')})).json();
    assert.equal((await post(`/jobs/${id}/messages`,{...input,attachments:[upload.id]})).status,400);
    const responses=await Promise.all([post(`/jobs/${id}/messages`,input),post(`/jobs/${id}/messages`,input)]);assert.deepEqual(responses.map(item=>item.status),[200,200]);
    assert.equal(jobs.get(id).messages.filter(item=>item.id===input.id).length,1);
    assert.equal((await post(`/jobs/${id}/messages`,{...input,text:'Changed'})).status,409);
    jobs.stop(id);assert.equal((await post(`/jobs/${id}/messages`,{id:randomUUID(),text:'Late'})).status,409);
  }finally{jobs.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
