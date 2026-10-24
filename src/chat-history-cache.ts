import type {ChatMessage} from '../server/types';
import {request,type Connection} from './api';

export type HistoryPage={messages:ChatMessage[];previous?:number|null;next?:number|null;total?:number;revision?:string};
type WirePage=HistoryPage&{unchanged?:boolean;delta?:boolean;order?:string[]};
export type HistoryView={messages:ChatMessage[];window:number;fromStart:boolean;hasMore:number|null};
const DB='pocket-chat-history-v1',BUDGET=20*1024*1024;
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
export async function clearHistoryCache(){epoch++;try{const db=await database();if(!db)return;const tx=db.transaction(['data','index'],'readwrite');tx.objectStore('data').clear();tx.objectStore('index').clear();}catch{}}
const key=(scope:string,provider:string,id:string)=>scope+'|'+provider+'|'+id;
const validMessages=(value:unknown):value is ChatMessage[]=>Array.isArray(value)&&value.length<=5000&&value.every(m=>m&&typeof m.id==='string'&&Array.isArray(m.blocks));
export async function readHistoryView(scope:string,provider:string,id:string){const view=await readRecord<HistoryView>(key(scope,provider,'view:'+id));return view&&validMessages(view.messages)&&Number.isInteger(view.window)&&view.window>=1&&view.window<=5000&&typeof view.fromStart==='boolean'?view:undefined;}
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
 const provider=url.searchParams.get('provider')||'claude',cacheKey=key(scope,provider,'page:'+canonical),stored=scope?await readRecord<HistoryPage>(cacheKey):undefined,cached=stored&&validMessages(stored.messages)?stored:undefined;
 if(cached)onCached?.(cached);
 try{
  const known=cached?.revision&&/^[a-f0-9]{64}$/.test(cached.revision)?'&known='+cached.revision:'';
  let wire=await request<WirePage>(connection,endpoint+known),merged=mergeHistoryDelta(cached,wire);
  if(!merged){wire=await request<WirePage>(connection,endpoint);merged=mergeHistoryDelta(undefined,wire);}
  if(!merged||!Array.isArray(merged.messages))throw Error('Invalid history synchronization response');
  const page:HistoryPage={messages:merged.messages,previous:merged.previous,next:merged.next,total:merged.total,revision:merged.revision};
  if(scope&&generation===epoch)await writeRecord(cacheKey,page);
  return page;
 }catch(error){const status=(error as {status?:number}).status;if(cached&&(!status||status>=500))return cached;throw error;}
}
