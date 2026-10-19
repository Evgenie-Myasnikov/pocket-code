import type {Connection} from './api';
// Credentials stay in the connection vault; cache keys contain only a digest.
export async function offlineKey(connection:Connection,endpoint:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(connection.url+'\0'+connection.token));
  return 'pocket-offline:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+':'+endpoint;
}
export function cacheable(endpoint:string){return /^\/(health|workspaces|project-board)(\?|$)/.test(endpoint)||/^\/boards\/[a-f0-9-]+$/.test(endpoint);}
// A small index keeps write times and sizes, so eviction never parses the cached values.
const INDEX='pocket-offline-index',LIMIT=20;
type Index=Record<string,{at:number;bytes:number}>;
let memory:Index|null=null;
function readIndex():Index{
  if(memory)return memory;
  try{const value=JSON.parse(localStorage.getItem(INDEX)||'null');if(value&&typeof value==='object')return memory=value;}catch{/* rebuilt below */}
  // One-time rebuild for caches written before the index existed.
  const index:Index={};for(const key of Object.keys(localStorage))if(key.startsWith('pocket-offline:')){try{const raw=localStorage.getItem(key)||'';index[key]={at:Number(JSON.parse(raw).at)||0,bytes:raw.length};}catch{index[key]={at:0,bytes:0};}}
  return memory=index;
}
const saveIndex=(index:Index)=>{try{localStorage.setItem(INDEX,JSON.stringify(index));}catch{/* The next write rebuilds it. */}};
/** Cached value with the time it was saved, so screens can say how old the data is. */
export async function readOfflineEntry(connection:Connection,endpoint:string):Promise<{value:unknown;at:number}|undefined>{try{const raw=localStorage.getItem(await offlineKey(connection,endpoint));if(!raw)return undefined;const entry=JSON.parse(raw);return {value:entry.value,at:Number(entry.at)||0};}catch{return undefined;}}
export async function readOffline(connection:Connection,endpoint:string){return (await readOfflineEntry(connection,endpoint))?.value;}
const lastWritten=new Map<string,string>();
/** Unchanged answers are not written again; a full storage evicts the oldest snapshots by the index. */
export async function writeOffline(connection:Connection,endpoint:string,value:unknown){try{
  const key=await offlineKey(connection,endpoint),body=JSON.stringify(value);
  if(body.length>2000000)return;
  const index=readIndex();
  if(lastWritten.get(key)===body&&index[key]&&localStorage.getItem(key)!==null){index[key].at=Date.now();saveIndex(index);return;}
  const raw='{"at":'+Date.now()+',"value":'+body+'}';
  const evict=()=>{const oldest=Object.entries(index).filter(([name])=>name!==key).sort((a,b)=>a[1].at-b[1].at)[0];if(!oldest)return false;localStorage.removeItem(oldest[0]);delete index[oldest[0]];return true;};
  for(;;){try{localStorage.setItem(key,raw);break;}catch(error){if(!evict())throw error;}}
  index[key]={at:Date.now(),bytes:raw.length};lastWritten.set(key,body);
  while(Object.keys(index).length>LIMIT&&evict()){/* keep the newest snapshots */}
  saveIndex(index);
}catch{/* Storage limits must not prevent online use. */}}
export function clearOffline(){lastWritten.clear();memory=null;for(const key of Object.keys(localStorage))if(key.startsWith('pocket-offline:')||key===INDEX)localStorage.removeItem(key);}
export async function clearConnectionOffline(connection:Connection){try{const prefix=await offlineKey(connection,''),index=readIndex();for(const key of Object.keys(localStorage))if(key.startsWith(prefix)){localStorage.removeItem(key);lastWritten.delete(key);delete index[key];}saveIndex(index);}catch{}}
