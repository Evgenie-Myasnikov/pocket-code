import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Express} from 'express';
import type {JiraStore} from './jira-vault.js';
import {HttpError} from './security.js';
const message=z.object({role:z.enum(['user','assistant']),content:z.string().max(32000)}).strict();
const profile=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(80),url:z.string().max(2048),key:z.string().max(8192),messages:z.array(message).max(100).default([])});
export function providerUrl(value:string){let url:URL;try{url=new URL(value);}catch{throw new HttpError(400,'Invalid API URL');}if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new HttpError(400,'Use HTTPS, or HTTP on localhost, without credentials or query parameters');return url.href.replace(/\/$/,'');}
export function parseModelCatalog(value:unknown){const parsed=z.object({data:z.array(z.object({id:z.string().min(1).max(300)})).max(10000)}).safeParse(value);if(!parsed.success)throw new HttpError(502,'Provider returned an invalid model catalog');return [...new Set(parsed.data.data.map(m=>m.id))].sort();}
export class CustomProviders{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private store:JiraStore,private send:typeof fetch=fetch){}
 private async load(){const raw=await this.store.load();return z.array(profile).max(30).parse(raw.profiles||[]);}
 private async transaction<T>(action:()=>Promise<T>):Promise<T>{const work=this.queue.catch(()=>{}).then(action);this.queue=work;return work;}
 async list(){return (await this.load()).map(({key,messages,...p})=>({...p,hasKey:!!key}));}
 async save(input:unknown){const data=z.object({name:profile.shape.name,url:profile.shape.url,key:profile.shape.key}).strict().parse(input);return this.transaction(async()=>{const list=await this.load();if(list.length>=30)throw new HttpError(400,'Provider limit reached');const saved={...data,url:providerUrl(data.url),id:randomUUID(),messages:[]};await this.store.save({profiles:[...list,saved]});return {id:saved.id};});}
 private async get(id:string){const found=(await this.load()).find(p=>p.id===id);if(!found)throw new HttpError(404,'Provider not found');return found;}
 private async call(p:z.infer<typeof profile>,suffix:string,body?:unknown){
  let response:Response;try{response=await this.send(providerUrl(p.url)+'/'+suffix,{method:body?'POST':'GET',headers:{...(p.key?{Authorization:'Bearer '+p.key}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(body?90000:15000)});}catch{throw new HttpError(502,'Provider connection failed or timed out');}
  if(!response.ok){await response.body?.cancel();throw new HttpError(502,'Provider returned HTTP '+response.status);}
  const reader=response.body?.getReader();if(!reader)throw new HttpError(502,'Empty provider response');const chunks:Uint8Array[]=[];let size=0;while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>2_000_000){await reader.cancel();throw new HttpError(502,'Provider response is too large');}chunks.push(next.value);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new HttpError(502,'Provider returned invalid JSON');}
 }
 async models(id:string){return parseModelCatalog(await this.call(await this.get(id),'models'));}
 async history(id:string){return (await this.get(id)).messages;}
 async chat(id:string,input:unknown){const data=z.object({model:z.string().min(1).max(300),text:z.string().trim().min(1).max(16000)}).strict().parse(input);return this.transaction(async()=>{const p=await this.get(id),models=parseModelCatalog(await this.call(p,'models'));if(!models.includes(data.model))throw new HttpError(400,'Choose a model from the provider catalog');const messages=[...p.messages.slice(-38),{role:'user' as const,content:data.text}];const raw=await this.call(p,'chat/completions',{model:data.model,messages,stream:false});const answer=z.object({choices:z.array(z.object({message:z.object({content:z.string().max(32000)})})).min(1)}).safeParse(raw);if(!answer.success)throw new HttpError(502,'Provider returned no text answer');const updated=[...messages,{role:'assistant' as const,content:answer.data.choices[0].message.content}];const list=await this.load();await this.store.save({profiles:list.map(v=>v.id===id?{...v,messages:updated}:v)});return updated;});}
 async remove(id:string){return this.transaction(async()=>{await this.store.save({profiles:(await this.load()).filter(p=>p.id!==id)});});}
}
export function mountCustomProviders(app:Express,service:CustomProviders,guard:()=>void){
 app.get('/api/custom-providers',async(_req,res)=>{guard();res.json(await service.list());});
 app.post('/api/custom-providers',async(req,res)=>{guard();res.json(await service.save(req.body));});
 app.post('/api/custom-providers/remove',async(req,res)=>{guard();await service.remove(z.string().uuid().parse(req.body.id));res.json({ok:true});});
 app.get('/api/custom-providers/:id/models',async(req,res)=>{guard();res.json(await service.models(z.string().uuid().parse(req.params.id)));});
 app.get('/api/custom-providers/:id/history',async(req,res)=>{guard();res.json(await service.history(z.string().uuid().parse(req.params.id)));});
 app.post('/api/custom-providers/:id/chat',async(req,res)=>{guard();res.json(await service.chat(z.string().uuid().parse(req.params.id),req.body));});
}
