import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {waitFor} from './wait-for';
test('Claude model API protects project access and sends a full model ID unchanged',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'pocket-models-')),root=path.join(temp,'project');await mkdir(root);
 const calls:string[]=[],inputs:any[]=[],jobs=new Jobs((({options}:any)=>{inputs.push(options);return(async function*(){})();}) as any),token='synthetic-'.repeat(5);
 const runtime=await createApp({roots:[root],uploads:path.join(temp,'uploads'),token,hostName:'Synthetic',desktopSessionIndexes:[],claudeModels:{read:async cwd=>{calls.push(cwd);return{source:'sdk',models:[{id:'claude-fixture-v1',name:'Fixture'}]};}}},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=runtime.app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+(server.address() as any).port+'/api',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(url+'/claude/models?cwd='+encodeURIComponent(root))).status,401);
  assert.equal((await fetch(url+'/claude/models?cwd='+encodeURIComponent(temp),{headers})).status,403);assert.equal(calls.length,0);
  const catalog=await fetch(url+'/claude/models?cwd='+encodeURIComponent(root),{headers});assert.equal(catalog.status,200);assert.equal((await catalog.json()).models[0].id,'claude-fixture-v1');assert.deepEqual(calls,[root]);
  for(const model of ['claude-fixture-v1[1m]','sonnet']){const id=randomUUID();const response=await fetch(url+'/jobs',{method:'POST',headers,body:JSON.stringify({id,cwd:root,text:'Synthetic',model})});assert.equal(response.status,200);await waitFor(()=>jobs.get(id).status!=='running');assert.equal(inputs.at(-1).model,model);}
  assert.equal((await fetch(url+'/jobs',{method:'POST',headers,body:JSON.stringify({id:randomUUID(),cwd:root,text:'Synthetic',model:'bad\nmodel'})})).status,400);
 }finally{jobs.close();runtime.terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(temp,{recursive:true,force:true});}
});
