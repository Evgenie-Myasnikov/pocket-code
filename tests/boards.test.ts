import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {BoardStore,validateDependencies,boardBranches,type BoardNote} from '../server/boards.js';
import {Jobs} from '../server/jobs.js';
import {DeviceRegistry} from '../server/devices.js';
import {execFileSync} from 'node:child_process';

test('workspace login isolates projects and chats, roles and credentials stay host-controlled',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-boards-')),a=path.join(dir,'atlas'),b=path.join(dir,'garden');await mkdir(a);await mkdir(b);await writeFile(path.join(b,'private.txt'),'synthetic private content');
 const aId=randomUUID(),bId=randomUUID(),token='host-synthetic-token'.repeat(3),password='synthetic workspace password';
 const sdk:any={listSessions:async()=>[{sessionId:aId,cwd:a,summary:'Atlas',lastModified:1},{sessionId:bId,cwd:b,summary:'Garden',lastModified:1}],getSessionMessages:async()=>[]};
 const devices=await new DeviceRegistry(path.join(dir,'devices.json')).load();
 const {app,jobs,terminals}=await createApp({devices,roots:[a,b],token,hostName:'Synthetic host',uploads:path.join(dir,'uploads'),desktopSessionIndexes:[]},new Jobs(),sdk);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api';
 const call=(p:string,body?:unknown,key=token)=>fetch(base+p,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const ws=await (await call('/workspaces',{name:'Atlas team',password,roots:[a]})).json();assert.ok(ws.id);
  await call('/workspaces',{name:'Garden team',password,roots:[b]});
  const board=await (await call('/boards',{workspaceId:ws.id,name:'Roadmap',root:a})).json();assert.ok(board.id);
  assert.equal((await (await call('/pairing-role')).json()).role,'host');
  const originalQr=devices.pairingToken;
  const owner=await (await call('/devices/pair',{name:'Host phone',platform:'android',version:'test'},originalQr)).json();
  assert.equal((await (await call('/workspaces',undefined,owner.token)).json()).host,true);
  assert.equal((await call('/pairing-role',{role:'viewer',workspaceId:ws.id})).status,200);
  assert.notEqual(devices.pairingToken,originalQr);
  assert.equal((await call('/devices/pair',{name:'Old invitation',platform:'android',version:'test'},originalQr)).status,401);
  const invited=await (await call('/devices/pair',{name:'Invited viewer',platform:'android',version:'test',role:'host'},devices.pairingToken)).json();
  assert.equal(invited.role,'viewer');assert.equal(invited.workspaceId,ws.id);
  assert.equal((await (await call('/workspaces',undefined,invited.token)).json()).host,false);
  assert.equal((await call('/pairing-role',{role:'host'},invited.token)).status,403);
  assert.equal((await call('/workspace-login',{name:'Atlas team',password:'wrong',displayName:'Reader'},'')).status,401);
  const guest=await (await call('/workspace-login',{name:'Atlas team',password,displayName:'Reader'},'')).json();assert.ok(guest.token);
  const catalog=await (await call('/workspaces',undefined,guest.token)).json();assert.equal(catalog.host,false);assert.equal(catalog.workspaces.length,1);assert.equal(catalog.workspaces[0].role,'viewer');assert.equal(JSON.stringify(catalog).includes(password),false);assert.equal(JSON.stringify(catalog).includes('tokenHash'),false);
  const list=await (await call('/sessions',undefined,guest.token)).json();assert.deepEqual(list.map((s:any)=>s.sessionId),[aId]);assert.equal(list[0].readOnly,true);
  assert.equal((await call('/sessions/'+bId+'/messages',undefined,guest.token)).status,404);
  assert.equal((await call('/file?path='+encodeURIComponent(path.join(b,'private.txt')),undefined,guest.token)).status,403);
  assert.deepEqual((await (await call('/health',undefined,guest.token)).json()).roots,[a]);
  assert.equal((await call('/boards/'+board.id,{revision:0,versions:[],notes:[]},guest.token)).status,403);
  assert.equal((await call('/workspaces',{name:'Escape',password,roots:[b]},guest.token)).status,403);
  assert.equal((await call('/jobs',{cwd:a,text:'run'},guest.token)).status,403);
  await call('/workspaces/'+ws.id+'/member',{memberId:guest.memberId,role:'developer'});
  assert.equal((await call('/boards/'+board.id,{revision:0,versions:['release/1.0'],notes:[]},guest.token)).status,200);
  assert.equal((await call('/boards/'+board.id,{revision:0,versions:[],notes:[]},guest.token)).status,409);
  const disk=await readFile(path.join(dir,'uploads','.boards','workspaces.json'),'utf8');assert.equal(disk.includes(password),false);assert.equal(disk.includes(guest.token),false);
  const loaded=await new BoardStore(path.join(dir,'uploads','.boards','workspaces.json')).load();assert.equal(loaded.snapshot().boards[0].versions[0],'release/1.0');
  await call('/workspaces/'+ws.id+'/member',{memberId:guest.memberId,remove:true});assert.equal((await call('/workspaces',undefined,guest.token)).status,401);
 }finally{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
});
test('dependencies reject dangling links and cycles; branches come from the exact repository',async()=>{
 const a:BoardNote={id:randomUUID(),title:'First',description:'',branch:'',status:'idea',owner:'',x:24,y:70,dependencies:[]},b={...a,id:randomUUID(),dependencies:[a.id]};validateDependencies([a,b]);assert.throws(()=>validateDependencies([{...a,dependencies:[b.id]},b]),/cycle/);assert.throws(()=>validateDependencies([b]),/not found/);
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-roadmap-'));try{execFileSync('git',['init',dir],{windowsHide:true,stdio:'ignore'});await writeFile(path.join(dir,'example.txt'),'synthetic');execFileSync('git',['-C',dir,'add','example.txt'],{windowsHide:true});execFileSync('git',['-C',dir,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m','Synthetic'],{windowsHide:true,stdio:'ignore'});execFileSync('git',['-C',dir,'branch','release/1.0'],{windowsHide:true});assert.ok((await boardBranches(dir)).branches.includes('release/1.0'));await mkdir(path.join(dir,'child'));assert.deepEqual((await boardBranches(path.join(dir,'child'))).branches,[]);}finally{await rm(dir,{recursive:true,force:true});}
});
