import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {JiraConnection} from '../server/jira-connection';
import {JiraLogin} from '../server/jira-login';
test('a stable shared Jira service follows the persisted connection, independent of task AI',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pocket-jira-choice-'));
 try{
  const services=Object.fromEntries(['claude','codex'].map(source=>[source,{status:async()=>({connected:true,sites:[],source}),issue:async()=>source}])) as any;
  const file=path.join(dir,'choice.json'),choice=new JiraConnection(file,services),service=choice.service;
  assert.equal(await service.issue('site','EX-1'),'claude');
  await choice.select('codex');assert.equal(await service.issue('site','EX-1'),'codex');
  const restored=new JiraConnection(file,services);await restored.ready;assert.equal(restored.selected(),'codex');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('PC login runs once, verifies OAuth completion, and owns its process',async()=>{
 let calls=0,killed=0,verified=0;const child=Object.assign(new EventEmitter(),{kill(){killed++;}});
 const login=new JiraLogin(async()=>{verified++;return true;},async()=> 'codex.exe',((exe:any,args:any,options:any)=>{calls++;assert.deepEqual(args,['mcp','login','jira']);assert.equal(options.windowsHide,true);return child;}) as any);
 await Promise.all([login.start(),login.start()]);assert.equal(calls,1);
 child.emit('exit',0);await new Promise(resolve=>setImmediate(resolve));assert.equal(verified,1);assert.equal(login.status().state,'connected');
 await login.start();login.close();assert.equal(killed,1);child.emit('exit',0);assert.equal(verified,1);
});
test('failed OAuth never verifies or silently changes the connection',async()=>{
 const child=Object.assign(new EventEmitter(),{kill(){}});let verified=false;
 const login=new JiraLogin(async()=>{verified=true;return true;},async()=> 'codex.exe',(()=>child) as any);
 await login.start();child.emit('exit',1);assert.equal(login.status().state,'error');assert.equal(verified,false);login.close();
});
