import type {Connection} from './api';
// Credentials stay in the connection vault; cache keys contain only a digest.
export async function offlineKey(connection:Connection,endpoint:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(connection.url+'\0'+connection.token));
  return 'pocket-offline:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+':'+endpoint;
}
export function cacheable(endpoint:string){return /^\/(health|workspaces|project-board)(\?|$)/.test(endpoint)||/^\/boards\/[a-f0-9-]+$/.test(endpoint);}
export async function readOffline(connection:Connection,endpoint:string){try{const raw=localStorage.getItem(await offlineKey(connection,endpoint));return raw?JSON.parse(raw).value:undefined;}catch{return undefined;}}
export async function writeOffline(connection:Connection,endpoint:string,value:unknown){try{const key=await offlineKey(connection,endpoint),raw=JSON.stringify({at:Date.now(),value});if(raw.length>2000000)return;localStorage.setItem(key,raw);const keys=Object.keys(localStorage).filter(k=>k.startsWith('pocket-offline:')).sort((a,b)=>JSON.parse(localStorage.getItem(a)||'{}').at-JSON.parse(localStorage.getItem(b)||'{}').at);while(keys.length>20)localStorage.removeItem(keys.shift()!);}catch{/* Storage limits must not prevent online use. */}}
export function clearOffline(){for(const key of Object.keys(localStorage))if(key.startsWith('pocket-offline:'))localStorage.removeItem(key);}
export async function clearConnectionOffline(connection:Connection){try{const prefix=await offlineKey(connection,'');for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);}catch{}}
