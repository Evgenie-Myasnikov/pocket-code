import {mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {HttpError} from './security.js';
import {fileBusy,readGuarded,writeDurable} from './durable-file.js';
/** The board a chat was started from. Host-private: repository boards never store chat associations. */
export type BoardLink={id:string;root:string;title:string;noteId?:string;kind?:'discussion'|'note'|'task'};
type OriginalRemoval={cwd:string;account?:string;status:'pending'|'erased'|'done'};
type Entry={title?:string;deleted?:boolean;board?:BoardLink;account?:string;accountName?:string;originalRemoval?:OriginalRemoval};
/** Which chat is a board's current discussion, keyed by board and project folder. Host-private like every chat association. */
export type BoardChatPointer={provider:string;sessionId:string;at:number};
type Library={chats:Record<string,Entry>;projects:string[];boardChats?:Record<string,BoardChatPointer>};
export class ChatLibrary {
 revision=0;
 private pending:Promise<unknown>=Promise.resolve();
 private resuming=new Map<string,number>();
 private deleting=new Set<string>();
 constructor(private file:string){}
 isResuming(provider:string,id:string){return this.resuming.has(provider+':'+id);}
 isDeleting(provider:string,id:string){return this.deleting.has(provider+':'+id);}
 async resume<T>(provider:string,id:string|undefined,start:()=>Promise<T>):Promise<T>{
  if(!id)return start();
  const key=provider+':'+id;
  if(this.deleting.has(key))throw new HttpError(409,'This chat is being removed.');
  this.resuming.set(key,(this.resuming.get(key)||0)+1);
  try{
   if((await this.read()).chats[key]?.deleted)throw new HttpError(404,'This chat was removed.');
   return await start();
  }finally{
   const count=this.resuming.get(key)!-1;if(count)this.resuming.set(key,count);else this.resuming.delete(key);
  }
 }
 async deleteChats(provider:string,change:(data:Library,remove:(id:string)=>boolean)=>void){
  const reserved:string[]=[];
  try{
   await this.edit(data=>change(data,id=>{
    const key=provider+':'+id;
    if(this.resuming.has(key)||this.deleting.has(key))return false;
    this.deleting.add(key);reserved.push(key);
    data.chats[key]={...data.chats[key],deleted:true};return true;
   }));
  }finally{for(const key of reserved)this.deleting.delete(key);}
 }
 async eraseOriginal(provider:string,id:string,scope:{cwd:string;account?:string},check:(data:Library)=>boolean,erase:()=>Promise<void>,forget:()=>void|Promise<void>){
  const key=provider+':'+id;
  if(this.resuming.has(key)||this.deleting.has(key))return 'running' as const;
  this.deleting.add(key);
  try{
   let allowed=false,complete=false;
   await this.edit(data=>{
    if(!check(data))return;
    allowed=true;
    const entry=data.chats[key];
    const prior=entry?.originalRemoval;
    complete=!!prior&&prior.status!=='pending'&&prior.cwd===scope.cwd&&prior.account===scope.account;
    if(!complete)data.chats[key]={...entry,originalRemoval:{...scope,status:'pending'}};
   });
   if(!allowed)return 'unavailable' as const;
   if(!complete){
    try{await erase();}catch{return 'failed' as const;}
    await this.edit(data=>{data.chats[key]={...data.chats[key],deleted:true,originalRemoval:{...scope,status:'erased'}};});
   }
   try{await forget();}catch{return 'failed' as const;}
   await this.edit(data=>{data.chats[key]={...data.chats[key],deleted:true,originalRemoval:{...scope,status:'done'}};});
   return 'ids' as const;
  }finally{this.deleting.delete(key);}
 }
 /** The library as last written. Every caller gets its own copy, so nothing a caller does to it reaches the next reader. */
 async read():Promise<Library>{
  // Windows briefly locks the file while edit() replaces it; retry instead of failing the chat list.
  for(let attempt=0;;attempt++){try{return await this.readOnce();}catch(error){if(attempt<4&&fileBusy(error))await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));else throw error;}}
 }
 private cache?:{stamp:string;data:Library};
 /** Changes when the file is replaced, so polls reuse the parsed library instead of reading it again. */
 private async stamp(){try{const info=await stat(this.file);return info.mtimeMs+':'+info.size;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return 'none';throw error;}}
 private async readOnce():Promise<Library>{
  const stamp=await this.stamp();
  if(this.cache?.stamp===stamp)return structuredClone(this.cache.data);
  // A damaged library (an interrupted write, a zero-filled file after a power loss) must not switch every chat off:
  // the host continues from the backup or from an empty library and keeps the damaged copy beside it.
  const {value,recovered}=await readGuarded<Library>(this.file,data=>!!data&&typeof data==='object'&&!!(data as Library).chats&&typeof (data as Library).chats==='object'&&!Array.isArray((data as Library).chats)&&Array.isArray((data as Library).projects));
  const data=value??{chats:{},projects:[]};
  this.cache={stamp:recovered?await this.stamp():stamp,data};
  return structuredClone(data);
 }
 async edit(change:(data:Library)=>void){
  const write=this.pending.catch(()=>{}).then(async()=>{
   const data=await this.read();change(data);
   await mkdir(path.dirname(this.file),{recursive:true});
   await writeDurable(this.file,JSON.stringify(data),{backup:true});
   this.cache={stamp:await this.stamp(),data:structuredClone(data)};
  });
  this.pending=write.then(()=>{this.revision++;});await this.pending;
 }
 /** Record the custom provider account of a Claude chat; only writes when it changes. */
 async tagAccount(sessionId:string,account:string,accountName?:string){const key='claude:'+sessionId,entry=(await this.read()).chats[key];if(entry?.account===account&&(!accountName||entry.accountName===accountName))return;await this.edit(data=>{data.chats[key]={...data.chats[key],account,...(accountName?{accountName}:{})};});}
 /**
  * Chats follow their custom provider by name: a provider removed and added again gets a new ID, and its chats move to it.
  * A chat recorded before names were kept moves to the only custom provider; a chat whose provider is gone is listed with the PC's Claude sign-in instead of disappearing.
  */
 async resolveAccounts<T extends {sessionId:string;account?:string}>(sessions:T[],providers:{id:string;name:string}[]):Promise<T[]>{
  const data=await this.read(),ids=new Map(providers.map(p=>[p.id,p.name])),key=(name:string)=>name.trim().toLowerCase(),byName=new Map<string,string|null>();
  for(const p of providers)byName.set(key(p.name),byName.has(key(p.name))?null:p.id);
  const moves:[string,string,string][]=[];
  const resolved=sessions.map(s=>{
   if(!s.account)return s;
   const entry=data.chats['claude:'+s.sessionId],name=ids.get(s.account);
   if(name!==undefined){if(entry?.accountName!==name)moves.push([s.sessionId,s.account,name]);return s;}
   const target=entry?.accountName?byName.get(key(entry.accountName)):providers.length===1?providers[0].id:undefined;
   if(target){moves.push([s.sessionId,target,ids.get(target)!]);return {...s,account:target};}
   const {account:_gone,...rest}=s;return rest as T;
  });
  for(const [sessionId,account,name] of moves)await this.tagAccount(sessionId,account,name).catch(()=>{});
  return resolved;
 }
 async decorate<T extends {sessionId:string}>(provider:string,sessions:T[],boardLinks?:Map<string,BoardLink>,includeDeleted=false){const data=await this.read();return sessions.filter(s=>includeDeleted||!data.chats[provider+':'+s.sessionId]?.deleted).map(s=>{const entry=data.chats[provider+':'+s.sessionId];return {...s,...(entry?.title?{customTitle:entry.title}:{}),...(entry?.account?{account:entry.account}:{}),...(entry?.board?{board:entry.board}:boardLinks?.has(provider+':'+s.sessionId)?{board:boardLinks.get(provider+':'+s.sessionId)}:{})};});}
}
