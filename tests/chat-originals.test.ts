import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createChatOriginals} from '../server/chat-originals';
import {CopilotService} from '../server/copilot';
import {CodexService} from '../server/codex';
import {CodexRequestError} from '../server/codex-rpc';
import {EventEmitter} from 'node:events';
import {SessionPreviews} from '../server/session-previews';

test('Claude deletes the exact original in the trusted project and confirms removal',async()=>{
  const cwd=path.resolve('demo'),id=randomUUID(),other=randomUUID();
  const originals=new Set<string>([id,other]);
  const sdk={getSessionInfo:async(key:string)=>originals.has(key)?{sessionId:key,cwd}:undefined,
    deleteSession:async(key:string,options:{dir:string})=>{assert.equal(options.dir,cwd);originals.delete(key);}};
  const service=createChatOriginals({sdk});
  assert.equal(service.canRemove('codex'),false);
  await assert.rejects(service.remove('claude',id,path.dirname(cwd)),/different project/);
  await service.remove('claude',id,cwd);
  assert.deepEqual([...originals],[other]);
  await service.remove('claude',id,cwd);
  await assert.rejects(createChatOriginals({sdk:{...sdk,deleteSession:async()=>{}}}).remove('claude',other,cwd),/still present/);
});

test('Copilot erases the local catalogued session and declines a remote or relocated original',async t=>{
  const cwd=await mkdtemp(path.join(os.tmpdir(),'erase-copilot-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const rows=[{sessionId:'local-name',context:{workingDirectory:cwd},isRemote:false},{sessionId:'remote-name',context:{workingDirectory:cwd},isRemote:true}];
  const client={start:async()=>{},listSessions:async()=>rows,deleteSession:async(id:string)=>{rows.splice(rows.findIndex(s=>s.sessionId===id),1);}};
  const service=new CopilotService([cwd],client as never);
  await assert.rejects(service.eraseOriginal('local-name',path.dirname(cwd)),/verified/);
  await assert.rejects(service.eraseOriginal('remote-name',cwd),/verified/);
  await service.eraseOriginal('local-name',cwd);
  assert.deepEqual(rows.map(s=>s.sessionId),['remote-name']);
  await service.eraseOriginal('local-name',cwd);
});

test('Codex deletes only an acknowledged thread and distinguishes missing from unavailable storage',async t=>{
  const cwd=await mkdtemp(path.join(os.tmpdir(),'erase-codex-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const id=randomUUID(),deleted:string[]=[];let state='idle',present=true,refuse=false;
  class Rpc extends EventEmitter{
    async request(method:string,params:any){
      if(method==='initialize')return {};
      assert.equal(params.threadId,id);
      if(method==='thread/read'){
        if(!present)throw new CodexRequestError(method,{code:-32600,message:'thread not loaded: '+id});
        return {thread:{id,cwd,status:{type:state}}};
      }
      assert.equal(method,'thread/delete');
      if(refuse)throw new CodexRequestError(method,{code:-32600,message:'storage unavailable'});
      if(!present)throw new CodexRequestError(method,{code:-32600,message:'no rollout found for thread id '+id});
      present=false;deleted.push(id);return {};
    }
    notify(){} close(){} respond(){} reject(){}
  }
  const service=new CodexService([cwd],{rpcFactory:()=>new Rpc() as never});
  await assert.rejects(service.eraseOriginal(id,path.dirname(cwd)),/different project/);
  state='active';await assert.rejects(service.eraseOriginal(id,cwd),/Stop/);state='idle';
  await service.eraseOriginal(id,cwd);await service.eraseOriginal(id,cwd);
  assert.deepEqual(deleted,[id]);
  refuse=true;await assert.rejects(service.eraseOriginal(id,cwd),/Codex rejected/);
  service.close();
});

test('an erased preview is not repopulated by a pending read',async()=>{
  const previews=new SessionPreviews();let finish!:()=>void;
  const held=new Promise<void>(resolve=>{finish=resolve;});
  const prior=previews.get('copilot','x:y',1,async()=>{await held;return [];});
  await previews.get('copilot','x',1,async()=>[]);
  previews.forget('copilot','x:y');finish();await prior;
  assert.equal(previews.size,1);
  previews.forget('copilot','x');assert.equal(previews.size,0);
});
