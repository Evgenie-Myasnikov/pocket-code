import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {replaceFile} from './fs-retry.js';
import type {GenerationMetrics,JobView} from './types.js';

type Saved={account?:string;startedAt:number;generation?:GenerationMetrics};
const missing=(error:unknown)=>(error as NodeJS.ErrnoException).code==='ENOENT';

/** Only provider measurements are stored. A newer unmeasured answer invalidates the previous rate. */
export class SessionGeneration {
  private pending:Promise<unknown>=Promise.resolve();
  constructor(private directory:string){}
  private location(provider:string,id:string){
    return path.join(this.directory,createHash('sha256').update(JSON.stringify([provider,id])).digest('hex')+'.json');
  }
  private async fromDisk(file:string):Promise<Saved|undefined>{
    try{return JSON.parse(await readFile(file,'utf8'));}catch(error){if(!missing(error))throw error;}
  }
  private serialize<T>(work:()=>Promise<T>){
    const result=this.pending.then(work);
    this.pending=result.catch(()=>{});
    return result;
  }
  record(job:JobView){
    if(!job.sessionId)return Promise.resolve();
    const file=this.location(job.provider||'claude',job.sessionId);
    const snapshot:Saved={account:job.account,startedAt:job.startedAt,generation:job.generation&&{...job.generation}};
    return this.serialize(async()=>{
      const previous=await this.fromDisk(file);
      if(previous && previous.startedAt>snapshot.startedAt || !previous && !snapshot.generation)return;
      await mkdir(this.directory,{recursive:true,mode:0o700});
      const temp=path.join(this.directory,randomUUID()+'.tmp');
      try{await writeFile(temp,JSON.stringify(snapshot),{flag:'wx',mode:0o600});await replaceFile(temp,file);}
      finally{await unlink(temp).catch(()=>{});}
    });
  }
  async get(provider:string,id:string,account?:string){
    await this.pending;const stored=await this.fromDisk(this.location(provider,id));
    return stored?.account===account?stored?.generation:undefined;
  }
  forget(provider:string,id:string){return this.serialize(async()=>{
    try{await unlink(this.location(provider,id));}catch(error){if(!missing(error))throw error;}
  });}
  async flush(){await this.pending;}
}
