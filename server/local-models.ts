import {z} from 'zod';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import type {Express} from 'express';
import type {JiraStore} from './jira-vault.js';
import type {CustomProviders} from './custom-providers.js';
import {HttpError} from './security.js';

/** The Strata command-line runtime: its own python.exe running strata.py, called without cmd.exe or a shell. */
export type StrataRuntime={python:string;script:string;version:string};
export type StrataRun=(args:string[],options:{timeoutMs:number;env?:Record<string,string>})=>Promise<{code:number;stdout:string}>;
export const LOCAL_MODEL_PORT=18600;
const KEY_ENV='POCKET_STRATA_API_KEY';
const exists=(file:string)=>access(file).then(()=>true,()=>false);

/** Finds the active Strata control component (%LOCALAPPDATA%\Strata\components\control\<active>), or null when Strata is not installed. */
export async function discoverStrata(env:NodeJS.ProcessEnv=process.env):Promise<StrataRuntime|null>{
 const base=env.POCKET_STRATA_CONTROL||(env.LOCALAPPDATA?path.join(env.LOCALAPPDATA,'Strata','components','control'):'');
 if(!base)return null;
 let folder='';try{folder=z.object({folder:z.string().regex(/^[\w.-]{1,64}$/)}).parse(JSON.parse(await readFile(path.join(base,'active.json'),'utf8'))).folder;}catch{return null;}
 const root=path.join(base,folder),python=path.join(root,'python','python.exe'),script=path.join(root,'strata.py');
 return await exists(python)&&await exists(script)?{python,script,version:folder}:null;
}

/** Runs strata.py with the bundled Python as strata.cmd would: UTF-8 text, no user site-packages, no inherited PYTHONHOME/PYTHONPATH. */
export function strataRunner(runtime:StrataRuntime):StrataRun{
 return (args,{timeoutMs,env})=>new Promise(resolve=>{
  const childEnv:NodeJS.ProcessEnv={...process.env,PYTHONUTF8:'1',PYTHONNOUSERSITE:'1',...env};delete childEnv.PYTHONHOME;delete childEnv.PYTHONPATH;
  execFile(runtime.python,[runtime.script,...args],{windowsHide:true,shell:false,timeout:timeoutMs,maxBuffer:4*1024*1024,env:childEnv},(error,stdout)=>{
   const code=error?(typeof (error as NodeJS.ErrnoException).code==='number'?(error as unknown as {code:number}).code:1):0;
   resolve({code,stdout:String(stdout||'')});
  });
 });
}

/** The first JSON object line of a Strata --output json answer (status also prints a plain summary after it). */
export function strataJson(stdout:string):Record<string,unknown>|null{
 for(const line of stdout.split(/\r?\n/)){const text=line.trim();if(!text.startsWith('{'))continue;try{const value=JSON.parse(text);if(value&&typeof value==='object'&&value.schema_version===1)return value;}catch{}}
 return null;
}

const listing=z.object({ok:z.literal(true),models:z.array(z.object({id:z.string().min(1).max(120),name:z.string().max(200).optional(),context_tokens:z.number().int().positive().nullish(),component_status:z.string().optional()})).max(128)});
const running=z.object({ok:z.literal(true),running:z.array(z.object({name:z.string().max(200),state:z.string().max(40),port:z.number().int().positive().max(65535),url:z.string().max(300)}).passthrough()).max(16)});
const plan=z.object({ok:z.literal(true),plan:z.object({download:z.object({gb:z.number()}).passthrough()}).passthrough()});
const launched=z.object({ok:z.literal(true),urls:z.array(z.string().max(300)).min(1)});
const failure=z.object({ok:z.literal(false),error:z.object({message:z.string().max(2000)}).passthrough()});
export const startInput=z.object({model:z.string().regex(/^[A-Za-z0-9][\w.-]{0,119}$/),context:z.union([z.literal(32768),z.literal(65536),z.literal(131072),z.literal(262144)]),drafting:z.enum(['auto','mtp','dflash2','off'])}).strict();
const saved=z.object({key:z.string().min(32).max(200).optional(),providerId:z.string().uuid().optional()}).passthrough();

export type LocalModelState={state:'stopped'|'starting'|'ready'|'stopping'|'error';model?:string;url?:string;port?:number;error?:string;since?:number};
export type LocalModelDeps={runtime:()=>Promise<StrataRuntime|null>;run?:(runtime:StrataRuntime)=>StrataRun;engines:()=>Promise<number>;store:JiraStore;providers:Pick<CustomProviders,'save'>;now?:()=>number};

/** Starts and stops one local Strata model server without the Strata desktop window, and keeps one custom provider pointed at it. */
export class LocalModels{
 private job:LocalModelState={state:'stopped'};
 private work:Promise<unknown>=Promise.resolve();
 private resolved=new Map<string,string[]>();
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private deps:LocalModelDeps){}
 private now(){return (this.deps.now||Date.now)();}
 private async cli(){const runtime=await this.deps.runtime();if(!runtime)throw new HttpError(404,'Strata is not installed on this PC','strata_missing');return {runtime,run:(this.deps.run||strataRunner)(runtime)};}
 private async call(args:string[],timeoutMs:number,env?:Record<string,string>){const {run}=await this.cli();const out=await run([...args,'--output','json'],{timeoutMs,env});const json=strataJson(out.stdout);const failed=failure.safeParse(json);if(failed.success)throw new HttpError(409,failed.data.error.message.slice(0,300),'strata_failed');if(!json)throw new HttpError(502,out.code?'Strata did not answer (exit code '+out.code+')':'Strata returned no JSON answer','strata_no_json');return json;}
 private async secrets(){return saved.parse(await this.deps.store.load());}
 private transaction<T>(action:()=>Promise<T>):Promise<T>{const work=this.queue.catch(()=>{}).then(action);this.queue=work;return work;}

 /** Installed models, what Strata reports as running, whether another Strata engine holds the GPU, and this host's job. */
 async status(){
  const runtime=await this.deps.runtime();
  if(!runtime)return {available:false as const,models:[],running:[],busy:false,job:this.job};
  const [models,run]=await Promise.all([this.call(['models','list'],30000).then(v=>listing.parse(v).models).catch(()=>[]),this.call(['launch','--status'],30000).then(v=>running.parse(v).running).catch(()=>[])]);
  const engines=await this.deps.engines().catch(()=>0);
  const mine=run.find(r=>r.port===LOCAL_MODEL_PORT);
  if(mine&&this.job.state!=='starting'&&this.job.state!=='stopping')this.job={...this.job,state:mine.state==='ready'?'ready':'starting',url:'http://127.0.0.1:'+LOCAL_MODEL_PORT+'/v1',port:LOCAL_MODEL_PORT};
  if(!mine&&this.job.state==='ready')this.job={state:'stopped'};
  return {available:true as const,version:runtime.version,port:LOCAL_MODEL_PORT,models:models.map(m=>({id:m.id,name:m.name||m.id,context:m.context_tokens||undefined,ready:m.component_status!=='missing'})),running:run.map(r=>({name:r.name,state:r.state,port:r.port})),busy:engines>0&&!run.length,job:this.job};
 }

 /** The launch arguments Strata accepts for a listed model: --model ID, or --family PREFIX --model REST for ids like coder-iq1_m. */
 private async resolve(id:string){
  const known=this.resolved.get(id);if(known)return known;
  const dash=id.indexOf('-');
  const candidates=[['--model',id],...(dash>0?[['--family',id.slice(0,dash),'--model',id.slice(dash+1)]]:[])];
  let reason='';
  for(const candidate of candidates){
   try{const answer=plan.parse(await this.call(['launch',...candidate,'--context','32k','--port',String(LOCAL_MODEL_PORT),'--access','local','--tune','skip','--no-tui','--yes','--plan'],60000));
    if(answer.plan.download.gb>0)throw new HttpError(409,'This model would download '+answer.plan.download.gb+' GB first. Set it up in Strata before starting it here.','strata_download');
    this.resolved.set(id,candidate);return candidate;}
   catch(error){if((error as HttpError).code==='strata_download')throw error;reason=(error as Error).message;}
  }
  throw new HttpError(404,reason||'Strata does not know this model','strata_model');
 }

 /** Starts the model in the background; the job state moves to ready (and the provider is saved) or error. */
 async start(input:unknown){
  const data=startInput.parse(input);
  return this.transaction(async()=>{
   if(this.job.state==='starting'||this.job.state==='stopping')throw new HttpError(409,'A local model is already '+this.job.state,'local_model_busy');
   const now=await this.status();
   if(!now.available)throw new HttpError(404,'Strata is not installed on this PC','strata_missing');
   if(now.busy)throw new HttpError(409,'The Strata app is already running a model. Unload it in the Strata window first.','strata_app_busy');
   if(now.running.length)throw new HttpError(409,'A Strata model is already running. Stop it first.','local_model_running');
   const args=await this.resolve(data.model);
   // Hex only: a base64url key (with - and _) made the Strata engine fail to load (cuBLAS status 14) on a real RTX 4080 run.
   const secret=await this.secrets();const key=secret.key&&/^[0-9a-f]{64}$/.test(secret.key)?secret.key:randomBytes(32).toString('hex');
   if(secret.key!==key)await this.deps.store.save({...secret,key});
   this.job={state:'starting',model:data.model,port:LOCAL_MODEL_PORT,since:this.now()};
   const launch=['launch',...args,'--context',String(data.context),'--drafting',data.drafting,'--vision','off','--parallel','1','--tune','skip','--access','local','--port',String(LOCAL_MODEL_PORT),'--api-key-env',KEY_ENV,'--no-tui','--yes'];
   this.work=this.call(launch,30*60000,{[KEY_ENV]:key}).then(async answer=>{
    launched.parse(answer);
    const url='http://127.0.0.1:'+LOCAL_MODEL_PORT+'/v1';
    const providerId=await this.saveProvider(url,key,data.model);
    this.served={providerId,context:data.context};
    this.job={state:'ready',model:data.model,url,port:LOCAL_MODEL_PORT,since:this.now()};
   }).catch(error=>{this.job={state:'error',model:data.model,error:(error as Error).message.slice(0,300),since:this.now()};});
   return this.job;
  });
 }

 /** The API connection this PC's running model serves and the context it was started with; unknown after a host restart. */
 private served?:{providerId:string;context:number};
 /** The real context window of a chat through this connection, when this host started the model. */
 contextFor(providerId:string){return this.job.state==='ready'&&this.served?.providerId===providerId?this.served.context:undefined;}
 private async saveProvider(url:string,key:string,model:string):Promise<string>{
  const secret=await this.secrets(),name=('Strata · '+model).slice(0,80);
  if(secret.providerId){try{await this.deps.providers.save({id:secret.providerId,name,url,key});return secret.providerId;}catch(error){if((error as HttpError).status!==404)throw error;}}
  const {id}=await this.deps.providers.save({name,url,key});
  await this.deps.store.save({...secret,key,providerId:id});
  return id;
 }

 async stop(){
  return this.transaction(async()=>{
   if(this.job.state==='starting')throw new HttpError(409,'Wait until the model has started, then stop it','local_model_busy');
   this.job={...this.job,state:'stopping',since:this.now()};
   try{const {run}=await this.cli();await run(['launch','--stop'],{timeoutMs:120000});this.job={state:'stopped',since:this.now()};}
   catch(error){this.job={state:'error',error:(error as Error).message.slice(0,300),since:this.now()};throw error;}
   return this.job;
  });
 }
 /** The model this host started and the API connection serving it, while it is ready. */
 serving(){return this.job.state==='ready'&&this.served?{model:this.job.model,providerId:this.served.providerId,context:this.served.context}:undefined;}
 /** Waits for a start to end: the connection serving the model, or the reason it did not start. */
 async ready(timeoutMs=20*60000){
  const until=this.now()+timeoutMs;
  for(;;){
   const serving=this.serving();if(serving)return serving;
   if(this.job.state==='error')throw new HttpError(409,this.job.error||'The local model did not start.','local_model_failed');
   if(this.job.state!=='starting')throw new HttpError(409,'The local model is not starting.','local_model_failed');
   if(this.now()>until)throw new HttpError(504,'The local model took too long to start.','local_model_timeout');
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
 }
 /** For tests: resolves when the background launch has finished. */
 settled(){return this.work.catch(()=>{});}
}

/** Number of Strata engine processes (strata.exe) on this PC, whoever started them. */
export function countStrataEngines():Promise<number>{
 return new Promise(resolve=>execFile('tasklist.exe',['/FI','IMAGENAME eq strata.exe','/FO','CSV','/NH'],{windowsHide:true,shell:false,timeout:10000},(error,stdout)=>{
  if(error)return resolve(0);resolve(String(stdout).split(/\r?\n/).filter(line=>/^"strata\.exe"/i.test(line.trim())).length);
 }));
}

export function mountLocalModels(app:Express,service:LocalModels,guard:()=>void){
 app.get('/api/local-models',async(_req,res)=>{guard();res.json(await service.status());});
 app.post('/api/local-models/start',async(req,res)=>{guard();res.json(await service.start(req.body));});
 app.post('/api/local-models/stop',async(_req,res)=>{guard();res.json(await service.stop());});
}
