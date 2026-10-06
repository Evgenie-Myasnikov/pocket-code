import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {RunNotificationJournal,mountRunNotifications} from '../server/run-notifications.js';
import express from 'express';
import type {JobView} from '../server/types.js';

const job=(overrides:Partial<JobView>={}):JobView=>({id:'fixture-run',provider:'claude',cwd:'/fixture/project',status:'running',startedAt:100,revision:1,baseMessageCount:0,approvals:[],partial:'PRIVATE_STREAM',messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Synthetic task'}]},{id:'a',role:'assistant',blocks:[{type:'text',text:'PRIVATE_RESULT'}]}],...overrides});
async function fixture(run:(file:string)=>Promise<void>){const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-run-notification-'));try{await run(path.join(dir,'events.json'));}finally{await rm(dir,{recursive:true,force:true});}}

test('durable alerts retain questions, errors and exact run targets through host restart',()=>fixture(async file=>{
  let now=1000;const journal=new RunNotificationJournal(file,()=>now);
  assert.equal((await journal.sync([job()])).events.length,0);
  const question=job({approvals:[{id:'q1',tool:'AskUserQuestion',input:{text:'PRIVATE_QUESTION'},expiresAt:3000}]});
  const first=await journal.sync([question]);assert.equal(first.events.length,1);assert.equal(first.events[0].status,'needs_input');assert.equal(first.events[0].jobId,'fixture-run');
  assert.equal((await journal.sync([question])).events.length,1);
  now=1100;await journal.sync([job({status:'error',error:'PRIVATE_STACK'})]);
  const restored=new RunNotificationJournal(file,()=>now);
  const events=(await restored.sync([job({status:'error'})])).events;
  assert.deepEqual(events.map(item=>item.status),['needs_input','error']);assert.equal(events[0].id,first.events[0].id);
  assert.deepEqual(restored.snapshot(first.now).events.map(item=>item.status),['error']);
  assert.doesNotMatch(await readFile(file,'utf8'),/PRIVATE_|"(?:messages|partial|approvals|input|errorCode)":/);
}));

test('same-millisecond transitions receive ordered cursors and stable question fingerprints',()=>fixture(async file=>{
  const journal=new RunNotificationJournal(file,()=>1000);
  const question=(id:string)=>job({approvals:[{id,tool:'AskUserQuestion',input:{},expiresAt:3000}]});
  const first=await journal.sync([question('one')]);await journal.sync([job()]);
  await journal.sync([question('two')]);await journal.sync([job({status:'done',sessionId:'session-1'})]);
  const events=journal.snapshot(0).events;
  assert.deepEqual(events.map(item=>item.at),[1000,1001,1002]);assert.equal(journal.snapshot(first.now).events.length,2);
  assert.equal(events[2].sessionId,'session-1');assert.equal(events[2].jobId,'fixture-run');
}));

test('external transcript completion does not duplicate the matching bridge result',()=>fixture(async file=>{
  const journal=new RunNotificationJournal(file,()=>1000);
  const external={id:'external-1',provider:'claude' as const,sessionId:'session-1',cwd:'/fixture/project',title:'Synthetic task',status:'done' as const,at:1000};
  await journal.sync([job({status:'done',sessionId:'session-1'})],[external]);
  assert.equal(journal.snapshot(0).events.length,1);
  const restored=new RunNotificationJournal(file,()=>1100);await restored.sync([],[external]);
  assert.equal(restored.snapshot(0).events.length,1);
  await restored.sync([],[{...external,id:'external-2',provider:'codex'}]);
  assert.equal(restored.snapshot(0).events.length,2,'provider namespace remains isolated');
}));

test('journal bounds retention and preserves fast runs missed between client polls',()=>fixture(async file=>{
  let now=1000;const journal=new RunNotificationJournal(file,()=>now);
  await journal.sync([job({status:'done'})]);assert.equal(journal.snapshot(0).events.length,1);
  now+=8*86400000;await journal.sync([job({status:'done'})]);assert.equal(journal.snapshot(0).events.length,0);
  await journal.sync([job({id:'next-run',status:'stopped',startedAt:now})]);assert.equal(journal.snapshot(0).events[0].status,'stopped');
}));

test('synchronous provider failure is contained at startup and the feed recovers on the next request',()=>fixture(async file=>{
  const app=express();let unavailable=true;
  const close=mountRunNotifications(app,{file,jobs:()=>{if(unavailable)throw Error('Synthetic unavailable provider');return [];},intervalMs:60000});
  app.use((_error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(503).json({error:'Synthetic temporarily unavailable'}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const endpoint=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/activity/events?since=0`;
  try{assert.equal((await fetch(endpoint)).status,503);unavailable=false;const response=await fetch(endpoint);assert.equal(response.status,200);assert.deepEqual((await response.json()).events,[]);}
  finally{await close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}));
