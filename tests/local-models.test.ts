import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {z} from 'zod';
import {LocalModels,mountLocalModels,discoverStrata,strataJson,LOCAL_MODEL_PORT,type StrataRun} from '../server/local-models.js';

const runtime={python:'C:/synthetic/python.exe',script:'C:/synthetic/strata.py',version:'9.9.9'};
const json=(value:unknown)=>JSON.stringify({schema_version:1,...(value as object)});
type Call={args:string[];env?:Record<string,string>};
/** A fake Strata CLI: answers models list, launch --status/--plan/--stop and a real launch, recording every call. */
function fakeStrata(options:{running?:boolean;planDownloadGb?:number;launchError?:string}={}){
 const calls:Call[]=[];let serving=!!options.running;
 const run:StrataRun=async(args,{env})=>{
  calls.push({args,env});const has=(flag:string)=>args.includes(flag);
  if(args[0]==='models')return {code:0,stdout:json({ok:true,models:[{id:'iq3_s',name:'flash-iq3_s',context_tokens:131072,component_status:'present'},{id:'coder-iq1_m',name:'flash-coder-iq1_m',context_tokens:131072,component_status:'present'}]})};
  if(has('--status'))return {code:0,stdout:json({ok:true,running:serving?[{name:'iq3_s-128k',state:'ready',port:LOCAL_MODEL_PORT,url:'http://127.0.0.1:'+LOCAL_MODEL_PORT}]:[]})+'\niq3_s-128k: ready'};
  if(has('--stop')){serving=false;return {code:0,stdout:'Stopped iq3_s-128k.'};}
  const model=args[args.indexOf('--model')+1],family=has('--family')?args[args.indexOf('--family')+1]:'';
  if(model==='coder-iq1_m')return {code:2,stdout:json({ok:false,error:{code:2,message:"There is no model called 'coder-iq1_m'."}})};
  if(has('--plan'))return {code:0,stdout:json({ok:true,plan:{download:{gb:options.planDownloadGb||0},family}})};
  if(options.launchError)return {code:3,stdout:json({ok:false,error:{code:3,message:options.launchError}})};
  serving=true;return {code:0,stdout:json({ok:true,urls:['http://127.0.0.1:'+LOCAL_MODEL_PORT],api_key:null})};
 };
 return {calls,run};
}
function service(strata:ReturnType<typeof fakeStrata>,engines=0,installed=true){
 let stored:any={};const saves:any[]=[];let next=0;
 const providers={save:async(input:any)=>{saves.push(structuredClone(input));if(input.id)return {id:input.id};return {id:'00000000-0000-4000-8000-00000000000'+(++next)};}};
 const models=new LocalModels({runtime:async()=>installed?runtime:null,run:()=>strata.run,engines:async()=>engines,store:{load:async()=>stored,save:async v=>{stored=structuredClone(v);}},providers});
 return {models,saves,stored:()=>stored};
}

test('Strata JSON answers are read from the first schema line',()=>{
 assert.deepEqual(strataJson('noise\n{"schema_version": 1, "ok": true}\nsummary'),{schema_version:1,ok:true});
 assert.equal(strataJson('{"other": 1}\nplain text'),null);
});

test('a model starts without the Strata window, with a host key and one provider kept up to date',async()=>{
 const strata=fakeStrata(),{models,saves,stored}=service(strata);
 const before=await models.status();
 assert.equal(before.available,true);assert.deepEqual(before.models.map(m=>m.id),['iq3_s','coder-iq1_m']);assert.equal(before.busy,false);
 const started=await models.start({model:'coder-iq1_m',context:131072,drafting:'dflash2'});
 assert.equal(started.state,'starting');await models.settled();
 const launch=strata.calls.find(c=>c.args[0]==='launch'&&c.args.includes('--no-tui')&&!c.args.includes('--plan'))!;
 assert.deepEqual(launch.args.slice(0,5),['launch','--family','coder','--model','iq1_m']);
 for(const flag of ['--api-key-env','--access','--vision','--no-tui','--yes','--output'])assert.ok(launch.args.includes(flag),flag);
 assert.equal(launch.args[launch.args.indexOf('--access')+1],'local');assert.equal(launch.args[launch.args.indexOf('--port')+1],String(LOCAL_MODEL_PORT));
 const key=stored().key;assert.match(key,/^[0-9a-f]{64}$/,'hex only: the Strata engine failed to load with a base64url key');assert.equal(launch.env?.POCKET_STRATA_API_KEY,key);
 assert.equal(launch.args.includes(key),false,'the key never appears in the command line');
 assert.deepEqual(saves[0],{name:'Strata · coder-iq1_m',url:'http://127.0.0.1:'+LOCAL_MODEL_PORT+'/v1',key});
 assert.equal((await models.status()).job.state,'ready');
 await models.stop();assert.ok(strata.calls.some(c=>c.args.includes('--stop')));assert.equal((await models.status()).job.state,'stopped');
 await models.start({model:'iq3_s',context:32768,drafting:'auto'});await models.settled();
 assert.equal(saves[1].id,stored().providerId,'the same provider is updated, not duplicated');assert.equal(saves[1].key,key,'the key is reused');
});

test('a stored key in another format is replaced by a hex key',async()=>{
 const strata=fakeStrata(),{models,stored}=service(strata);
 await (models as any).deps.store.save({key:'Ab-_'.repeat(11)});
 await models.start({model:'iq3_s',context:131072,drafting:'auto'});await models.settled();
 assert.match(stored().key,/^[0-9a-f]{64}$/);
});

test('a model is not started while the Strata app holds the GPU, when it would download, or twice',async()=>{
 const busy=fakeStrata(),app=service(busy,1);
 await assert.rejects(app.models.start({model:'iq3_s',context:131072,drafting:'auto'}),(e:any)=>e.code==='strata_app_busy');
 assert.equal(busy.calls.some(c=>c.args.includes('--no-tui')),false,'nothing was launched');
 const download=fakeStrata({planDownloadGb:58}),dl=service(download);
 await assert.rejects(dl.models.start({model:'iq3_s',context:131072,drafting:'auto'}),(e:any)=>e.code==='strata_download');
 const running=fakeStrata({running:true}),own=service(running,1);
 assert.equal((await own.models.status()).busy,false,'an engine this command started is not a foreign one');
 await assert.rejects(own.models.start({model:'iq3_s',context:131072,drafting:'auto'}),(e:any)=>e.code==='local_model_running');
 await assert.rejects(own.models.start({model:'iq3_s; calc',context:131072,drafting:'auto'}),z.ZodError);
 await assert.rejects(own.models.start({model:'iq3_s',context:1000,drafting:'auto'}),z.ZodError);
});

test('a failed launch is reported and Strata missing is explicit',async()=>{
 const broken=fakeStrata({launchError:'Not enough graphics memory'}),{models,saves}=service(broken);
 await models.start({model:'iq3_s',context:131072,drafting:'auto'});await models.settled();
 const state=(await models.status()).job;assert.equal(state.state,'error');assert.match(state.error||'',/graphics memory/);assert.equal(saves.length,0);
 const missing=service(fakeStrata(),0,false);
 assert.equal((await missing.models.status()).available,false);
 await assert.rejects(missing.models.start({model:'iq3_s',context:131072,drafting:'auto'}),(e:any)=>e.code==='strata_missing');
});

test('the Strata runtime is found from its active control component',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'pocket-strata-'));
 try{
  assert.equal(await discoverStrata({POCKET_STRATA_CONTROL:temp}),null);
  await writeFile(path.join(temp,'active.json'),JSON.stringify({folder:'1.2.3'}));assert.equal(await discoverStrata({POCKET_STRATA_CONTROL:temp}),null);
  await mkdir(path.join(temp,'1.2.3','python'),{recursive:true});await writeFile(path.join(temp,'1.2.3','python','python.exe'),'');await writeFile(path.join(temp,'1.2.3','strata.py'),'');
  const found=await discoverStrata({POCKET_STRATA_CONTROL:temp});assert.equal(found?.version,'1.2.3');assert.equal(found?.python,path.join(temp,'1.2.3','python','python.exe'));
  await writeFile(path.join(temp,'active.json'),JSON.stringify({folder:'..\\..\\evil'}));assert.equal(await discoverStrata({POCKET_STRATA_CONTROL:temp}),null);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('only the host manages local models over the API',async()=>{
 const {models}=service(fakeStrata());let guest=false;
 const app=express();app.use(express.json());mountLocalModels(app,models,()=>{if(guest)throw Object.assign(new Error('Only the host can manage local models'),{status:403});});
 app.use((error:any,_req:any,res:any,_next:any)=>res.status(error instanceof z.ZodError?400:error.status||500).json({error:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+(server.address() as any).port;
 try{
  assert.equal((await (await fetch(url+'/api/local-models')).json()).available,true);
  assert.equal((await fetch(url+'/api/local-models/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'iq3_s',context:5,drafting:'auto'})})).status,400);
  guest=true;
  for(const [route,method] of [['/api/local-models','GET'],['/api/local-models/start','POST'],['/api/local-models/stop','POST']])assert.equal((await fetch(url+route,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})})).status,403,route);
 }finally{server.close();}
});
