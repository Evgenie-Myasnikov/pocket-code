import type {ChatMessage} from '../server/types';
import {request,type Connection} from './api';

export type HistoryPage={messages:ChatMessage[];previous?:number|null;next?:number|null;total?:number;revision?:string;stale?:boolean};
type WirePage=HistoryPage&{unchanged?:boolean;delta?:boolean;order?:string[]};
export type HistoryView={messages:ChatMessage[];window:number;fromStart:boolean;hasMore:number|null};
const DB='pocket-chat-history-v1',BUDGET=20*1024*1024;
const recent=new Map<string,{messages:ChatMessage[];bytes:number;window:number;hasMore:number|null;jobId?:string}>();
const messageSizes=new WeakMap<ChatMessage,number>();
let recentBytes=0;
const latestRequest=new Map<string,symbol>();
let opened:Promise<IDBDatabase|undefined>|undefined,epoch=0;
function database(){
 return opened??=new Promise<IDBDatabase|undefined>(resolve=>{
  try{const op=indexedDB.open(DB,1);op.onupgradeneeded=()=>{op.result.createObjectStore('data');op.result.createObjectStore('index',{keyPath:'key'});};op.onsuccess=()=>resolve(op.result);op.onerror=op.onblocked=()=>resolve(undefined);}catch{resolve(undefined);}
 });
}
async function readRecord<T>(key:string):Promise<T|undefined>{
 try{const db=await database();if(!db)return;return await new Promise<T|undefined>(resolve=>{const op=db.transaction('data').objectStore('data').get(key);op.onsuccess=()=>resolve(op.result);op.onerror=()=>resolve(undefined);});}catch{return;}
}
async function writeRecord(key:string,value:unknown){
 const generation=epoch;
 try{const bytes=JSON.stringify(value).length*2;if(bytes>10*1024*1024)return;const db=await database();if(!db||generation!==epoch)return;
  await new Promise<void>(resolve=>{const tx=db.transaction(['data','index'],'readwrite'),data=tx.objectStore('data'),index=tx.objectStore('index');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>resolve();data.put(value,key);index.put({key,bytes,at:Date.now()});const all=index.getAll();all.onsuccess=()=>{const entries=all.result.sort((a,b)=>a.at-b.at);let size=entries.reduce((n,e)=>n+e.bytes,0),count=entries.length;for(const entry of entries){if(size<=BUDGET&&count<=120)break;data.delete(entry.key);index.delete(entry.key);size-=entry.bytes;count--;}};});
 }catch{/* A full or disabled cache must not block the online conversation. */}
}
export async function clearHistoryCache(){epoch++;recent.clear();recentBytes=0;latestRequest.clear();try{const db=await database();if(!db)return;const tx=db.transaction(['data','index'],'readwrite');tx.objectStore('data').clear();tx.objectStore('index').clear();}catch{}}
const key=(scope:string,provider:string,id:string)=>scope+'|'+provider+'|'+id;
export function transcriptScope(scope:string,connection:Connection|null,account?:string){
 if(!scope||!connection)return '';
 // A paired device keeps its identity across tunnel, LAN, and initial host discovery.
 const host=connection.desktop?connection.hostId||connection.url:connection.deviceId||connection.hostId||connection.url;
 return scope+':transcript-v2:'+encodeURIComponent(host)+':'+encodeURIComponent(account||'');
}
/** The old key had neither an account nor a host. Only a paired, single-account provider can prove ownership. */
export function legacyTranscriptScope(connection:Connection|null,provider:string,scope:string){
 return connection?.deviceId&&!connection.desktop&&!connection.workspaceOnly&&!connection.workspaceId&&(provider==='copilot'||provider==='codex')?scope.split(':')[0]:'';
}
function dropRecent(k:string){const old=recent.get(k);if(old){recentBytes-=old.bytes;recent.delete(k);}}
export function rememberTranscript(scope:string,provider:string,id:string,messages:ChatMessage[],window=200,hasMore:number|null=null,jobId?:string){
 if(!scope||!id)return;
 const k=key(scope,provider,'view:'+id),tail=messages.length>5000?messages.slice(-5000):messages,previous=recent.get(k);
 if(previous?.messages===tail&&previous.window===window&&previous.hasMore===hasMore&&previous.jobId===jobId)return;
 dropRecent(k);
 let bytes=4;
 for(const message of tail){
   let size=messageSizes.get(message);
   if(size===undefined){size=JSON.stringify(message).length*2+2;messageSizes.set(message,size);}
   bytes+=size;
 }
 if(!tail.length||bytes>BUDGET/2)return;
 recent.set(k,{messages:tail,bytes,window,hasMore,jobId});recentBytes+=bytes;
 while(recent.size>24||recentBytes>BUDGET)dropRecent(recent.keys().next().value!);
}
export function recentTranscript(scope:string,provider:string,id:string){
 const k=key(scope,provider,'view:'+id),value=recent.get(k);
 if(value){recent.delete(k);recent.set(k,value);}
 return value;
}
export async function forgetHistorySessions(scope:string,hostPrefix:string,provider:string,ids:Set<string>){
 epoch++;
 function matches(k:string){
   const [space,engine,record]=k.split('|');
   if(engine!==provider||!record||space!==scope&&!space.startsWith(hostPrefix))return false;
   if(record.startsWith('view:'))return ids.has(record.slice(5));
   const path=/^page:\/sessions\/([^/]+)\/messages\?/.exec(record);
   return !!path&&ids.has(decodeURIComponent(path[1]));
 }
 for(const k of recent.keys())if(matches(k))dropRecent(k);
 try{const db=await database();if(!db)return false;return await new Promise<boolean>(resolve=>{
   const tx=db.transaction(['data','index'],'readwrite'),data=tx.objectStore('data'),index=tx.objectStore('index');
   const cursor=index.openKeyCursor();cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;if(typeof item.key==='string'&&matches(item.key)){data.delete(item.key);index.delete(item.key);}item.continue();};
   tx.oncomplete=()=>resolve(true);tx.onabort=tx.onerror=()=>resolve(false);
 });}catch{return false;}
}
const validMessages=(value:unknown):value is ChatMessage[]=>Array.isArray(value)&&value.length<=5000&&value.every(m=>m&&typeof m.id==='string'&&Array.isArray(m.blocks));
export async function readHistoryView(scope:string,provider:string,id:string,legacyScope?:string){
 const record='view:'+id;
 const view=await readRecord<HistoryView>(key(scope,provider,record))??(legacyScope?await readRecord<HistoryView>(key(legacyScope,provider,record)):undefined);
 return view&&validMessages(view.messages)&&Number.isInteger(view.window)&&view.window>=1&&view.window<=5000&&typeof view.fromStart==='boolean'?view:undefined;
}
export const writeHistoryView=(scope:string,provider:string,id:string,view:HistoryView)=>scope?writeRecord(key(scope,provider,'view:'+id),view):Promise.resolve();

export function mergeHistoryDelta(cached:HistoryPage|undefined,wire:WirePage):HistoryPage|undefined{
 if(wire.unchanged)return cached?{...cached,revision:wire.revision}:undefined;
 if(!wire.delta)return wire;
 if(!cached||!Array.isArray(wire.order))return;
 const messages=new Map([...cached.messages,...wire.messages].map(message=>[message.id,message]));
 if(wire.order.some(id=>!messages.has(id)))return;
 return {...wire,messages:wire.order.map(id=>messages.get(id)!)};
}

/** Revisions cover content edits, removals and ordering, so timestamps never discard changes. */
export async function chatHistoryRequest(connection:Connection,endpoint:string,scope:string,onCached?:(page:HistoryPage)=>void):Promise<HistoryPage>{
 const generation=epoch,url=new URL(endpoint,'https://cache.invalid');url.searchParams.delete('known');url.searchParams.sort();const canonical=url.pathname+'?'+url.searchParams;
 const provider=url.searchParams.get('provider')||'claude',cacheKey=key(scope,provider,'page:'+canonical),ticket=Symbol();
 latestRequest.set(cacheKey,ticket);
 const legacy=legacyTranscriptScope(connection,provider,scope);
 const stored=(scope?await readRecord<HistoryPage>(cacheKey):undefined)??(legacy&&legacy!==scope?await readRecord<HistoryPage>(key(legacy,provider,'page:'+canonical)):undefined);
 const cached=generation===epoch&&stored&&validMessages(stored.messages)?stored:undefined;
 if(cached)onCached?.(cached);
 try{
  const known=cached?.revision&&/^[a-f0-9]{64}$/.test(cached.revision)?'&known='+cached.revision:'';
  let wire=await request<WirePage>(connection,endpoint+known),merged=mergeHistoryDelta(cached,wire);
  if(!merged){wire=await request<WirePage>(connection,endpoint);merged=mergeHistoryDelta(undefined,wire);}
  if(!merged||!Array.isArray(merged.messages))throw Error('Invalid history synchronization response');
  const page:HistoryPage={messages:merged.messages,previous:merged.previous,next:merged.next,total:merged.total,revision:merged.revision};
  if(scope&&generation===epoch&&latestRequest.get(cacheKey)===ticket)await writeRecord(cacheKey,page);
  return page;
 }catch(error){const status=(error as {status?:number}).status;if(generation===epoch&&cached&&(!status||status>=500))return {...cached,stale:true};throw error;}
 finally{if(latestRequest.get(cacheKey)===ticket)latestRequest.delete(cacheKey);}
}
