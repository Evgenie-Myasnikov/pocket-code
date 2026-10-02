import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {DeviceRegistry} from '../server/devices.js';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

test('device keys are independent, hashed on disk, revocable across restart and expire online presence',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-devices-')),file=path.join(root,'devices.json');let now=100000;
 try{const registry=await new DeviceRegistry(file,()=>now).load(),qr=registry.pairingToken;
 const first=await registry.pair(qr,{name:'Test phone',platform:'android',version:'1'}),second=await registry.pair(qr,{name:'Test tablet',platform:'android',version:'1'});
 assert.notEqual(first.token,second.token);assert.equal(registry.authenticate(first.token),first.deviceId);
 assert.equal((await readFile(file,'utf8')).includes(first.token),false);assert.equal(JSON.stringify(registry.list()).includes('hash'),false);
 now+=46000;assert.equal(registry.list()[0].status,'offline');registry.authenticate(second.token);assert.equal(registry.list().find(d=>d.id===second.deviceId)?.status,'online');
 let aborted=false;registry.track(first.deviceId,()=>{aborted=true;});await registry.revoke(first.deviceId);assert.equal(aborted,true);
 assert.equal(registry.authenticate(first.token),undefined);assert.equal(registry.authenticate(second.token),second.deviceId);assert.equal(registry.isPairing(qr),false);
 const restored=await new DeviceRegistry(file,()=>now).load();assert.equal(restored.authenticate(first.token),undefined);assert.equal(restored.authenticate(second.token),second.deviceId);
 await assert.rejects(()=>restored.pair(qr,{name:'Stale QR',platform:'browser',version:'1'}));await restored.rename(second.deviceId,'Test renamed tablet');assert.equal(restored.list().find(d=>d.id===second.deviceId)?.name,'Test renamed tablet');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('only PC admin manages devices; pairing keys cannot read data and remote shared keys cannot bypass revocation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-devices-api-')),registry=await new DeviceRegistry(path.join(root,'devices.json')).load();const admin='synthetic-admin-key-'.repeat(3);let qrUpdates=0;
 const result=await createApp({devices:registry,refreshPairing:async()=>{qrUpdates++;},roots:[root],token:admin,hostName:'Test host',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=result.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
 const req=(url:string,key:string,body?:unknown,headers={})=>fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 try{assert.equal((await req('/health',registry.pairingToken)).status,401);assert.equal((await req('/health',admin,undefined,{'X-Forwarded-For':'192.0.2.1'})).status,401);
 const paired=await(await req('/devices/pair',registry.pairingToken,{name:'Synthetic phone',platform:'android',version:'1'})).json();assert.ok(paired.deviceId);
 assert.equal((await req('/health',paired.token)).status,200);assert.equal((await req('/devices',paired.token)).status,403);
 assert.equal((await req('/devices/'+paired.deviceId+'/disconnect',paired.token,{})).status,403);
 assert.equal((await req('/devices/heartbeat',paired.token,{})).status,200);
 assert.equal((await req('/devices/'+paired.deviceId+'/rename',admin,{name:'Renamed test phone'})).status,200);
 assert.equal((await(await req('/devices',admin)).json())[0].name,'Renamed test phone');
 assert.equal((await req('/devices/'+paired.deviceId+'/disconnect',admin,{})).status,200);assert.equal(qrUpdates,1);
 assert.equal((await req('/health',paired.token)).status,401);
 const other=await(await req('/devices/pair',registry.pairingToken,{name:'Synthetic tablet',platform:'android',version:'1',model:'Example X2',installation:'synthetic-installation-0003'})).json();
 assert.equal((await req('/devices/self/forget',admin,{})).status,403);
 assert.equal((await req('/devices/self/forget',other.token,{})).status,200);assert.equal((await req('/health',other.token)).status,401);assert.deepEqual(await(await req('/devices',admin)).json(),[]);
 assert.equal((await req('/devices/pair',registry.pairingToken,{name:'Synthetic phone',platform:'android',version:'1',installation:'../escape'})).status,400);
 }finally{result.jobs.close();result.terminals.close();await result.queue?.close();await result.codexQueue?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});

test('a phone pairing again keeps one entry, removals leave no trace and legacy revoked entries vanish',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-devices-dedupe-')),file=path.join(root,'devices.json');let now=100000;
 try{const registry=await new DeviceRegistry(file,()=>now).load(),qr=registry.pairingToken,installation='synthetic-installation-0001';
 const first=await registry.pair(qr,{name:'Synthetic phone',platform:'android',version:'1',model:'Example X1',installation});
 await registry.rename(first.deviceId,'Synthetic kitchen tablet');now+=1000;
 const again=await registry.pair(qr,{name:'Synthetic phone',platform:'android',version:'2',model:'Example X1',installation});
 assert.equal(again.deviceId,first.deviceId);assert.equal(registry.list().length,1);
 const [entry]=registry.list();assert.equal(entry.name,'Synthetic kitchen tablet');assert.equal(entry.version,'2');assert.equal(entry.model,'Example X1');
 assert.equal(JSON.stringify(registry.list()).includes(installation),false);assert.equal((await readFile(file,'utf8')).includes(installation),false);
 assert.equal(registry.authenticate(first.token),undefined);assert.equal(registry.authenticate(again.token),first.deviceId);
 const other=await registry.pair(qr,{name:'Second synthetic phone',platform:'android',version:'1',installation:'synthetic-installation-0002'});assert.equal(registry.list().length,2);
 await registry.forget(other.deviceId);assert.equal(registry.list().length,1);assert.equal(registry.isPairing(qr),true);assert.equal(registry.authenticate(other.token),undefined);
 await registry.revoke(first.deviceId);assert.deepEqual(registry.list(),[]);assert.equal(registry.isPairing(qr),false);
 await writeFile(file,JSON.stringify({pairing:'synthetic-legacy-pairing-key',devices:[{id:'legacy-1',name:'Revoked synthetic',platform:'android',version:'1',hash:'a',pairedAt:1,lastSeen:1,revokedAt:2},{id:'legacy-2',name:'Kept synthetic',platform:'android',version:'1',hash:'b',pairedAt:1,lastSeen:1}]}));
 assert.deepEqual((await new DeviceRegistry(file,()=>now).load()).list().map(d=>d.name),['Kept synthetic']);
 }finally{await rm(root,{recursive:true,force:true});}
});
