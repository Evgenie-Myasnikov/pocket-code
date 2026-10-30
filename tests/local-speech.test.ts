import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {LocalSpeech,mountSpeech} from '../server/speech';
test('speech API rejects out-of-range voices and oversized input before synthesis',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pocket-speech-test-')),app=express();app.use(express.json());mountSpeech(app,directory);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;
 try{const state=await (await fetch(url+'/api/speech/status')).json() as any;assert.equal(state.ready,false);
 for(const body of [{text:'Hello',voice:10},{text:'Hello',voice:-1},{text:'x'.repeat(1201),voice:0},{text:' ',voice:0}]){const response=await fetch(url+'/api/speech/synthesize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,400);}
 }finally{await new Promise<void>(r=>server.close(()=>r()));await rm(directory,{recursive:true,force:true});}
});
test('native Supertonic worker produces WAV and cancels when a test model is provided',{skip:!process.env.POCKET_SPEECH_TEST_MODEL},async()=>{
 const speech=new LocalSpeech(process.env.POCKET_SPEECH_TEST_MODEL!);assert.equal((await speech.status()).ready,true);
 const audio=await speech.generate('\u041f\u0440\u0438\u0432\u0435\u0442! \u042d\u0442\u043e \u0442\u0435\u0441\u0442.',5,'ru');
 const bytes=Buffer.from(audio.audio,'base64');assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(bytes.length>10000);assert.ok(bytes.readUInt32LE(24)>0);
 const controller=new AbortController();controller.abort();await assert.rejects(speech.generate('Test',0,'en',controller.signal),/cancelled/);
});

test('model installer rejects bytes that do not match the pinned archive hash',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pocket-speech-hash-')),speech=new LocalSpeech(directory),saved=globalThis.fetch;
 globalThis.fetch=async()=>new Response('invalid model');
 try{await speech.install();for(let i=0;i<50;i++){if(!(await speech.status()).installing)break;await new Promise(r=>setTimeout(r,10));}const state=await speech.status();assert.equal(state.ready,false);assert.ok(state.error);}
 finally{globalThis.fetch=saved;await rm(directory,{recursive:true,force:true});}
});

test('host protects speech status and installation with authentication',async()=>{
 const {createApp}=await import('../server/app');const {Jobs}=await import('../server/jobs');
 const root=await mkdtemp(path.join(tmpdir(),'pocket-speech-auth-')),token='synthetic-speech-token-'.repeat(3);
 const {app,jobs,terminals}=await createApp({roots:[root],uploads:path.join(root,'uploads'),token,hostName:'Synthetic',desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const url='http://127.0.0.1:'+(server.address() as any).port;
 try{assert.equal((await fetch(url+'/api/speech/status')).status,401);assert.equal((await fetch(url+'/api/speech/install',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);assert.equal((await fetch(url+'/api/speech/status',{headers:{Authorization:'Bearer '+token}})).status,200);}
 finally{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
});
