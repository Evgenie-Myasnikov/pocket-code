import {useEffect,useSyncExternalStore} from 'react';
import type {Connection} from './api';

export type MutedChat={provider:string;sessionId?:string;jobId?:string};
const prefix='pocket-code-muted-chats-v1:';
const empty:MutedChat[]=[];
const cache=new Map<string,MutedChat[]>();
const listeners=new Set<()=>void>();

export function muteScope(connection:Connection|null){
  if(!connection)return '';
  if(connection.desktop)return 'desktop';
  if(connection.hostId)return 'host:'+connection.hostId;
  try{const url=new URL(connection.url);return url.origin+url.pathname.replace(/\/+$/,'');}catch{return '';}
}
function target(provider:string,sessionId:string,jobId?:string):MutedChat{
  if(sessionId.startsWith('pending-'))return {provider,jobId:jobId||sessionId.slice(8)};
  return {provider,...(sessionId?{sessionId}:{}),...(jobId?{jobId}:{})};
}
function matches(a:MutedChat,b:MutedChat){
  return a.provider===b.provider&&Boolean(a.sessionId&&a.sessionId===b.sessionId||a.jobId&&a.jobId===b.jobId);
}
function read(scope:string){
  if(!scope)return empty;
  const cached=cache.get(scope);
  if(cached)return cached;
  let entries:MutedChat[]=empty;
  try{
    const saved:unknown=JSON.parse(localStorage.getItem(prefix+scope)||'[]');
    if(Array.isArray(saved))entries=saved.filter((item):item is MutedChat=>item&&typeof item.provider==='string'&&(typeof item.sessionId==='string'||typeof item.jobId==='string'));
  }catch{/* Keep a session preference if storage is unavailable. */}
  cache.set(scope,entries);
  return entries;
}
function changed(){for(const listener of listeners)listener();}
function onStorage(event:StorageEvent){
  if(event.key===null)cache.clear();
  else if(event.key.startsWith(prefix))cache.delete(event.key.slice(prefix.length));
  else return;
  changed();
}
function subscribe(listener:()=>void){
  if(!listeners.size)window.addEventListener('storage',onStorage);
  listeners.add(listener);
  return ()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('storage',onStorage);};
}
function save(scope:string,entries:MutedChat[]){
  cache.set(scope,entries);
  try{localStorage.setItem(prefix+scope,JSON.stringify(entries));}catch{/* Keep the setting for this window. */}
  changed();
}
export function useMutedChats(scope:string){return useSyncExternalStore(subscribe,()=>read(scope));}
export function useChatMute(connection:Connection|null,provider:string,sessionId:string,jobId?:string){
  const scope=muteScope(connection),chat=target(provider,sessionId,jobId);
  const entries=useMutedChats(scope),muted=entries.some(item=>matches(item,chat));
  // Remember the permanent session when it first becomes available for a muted job.
  useEffect(()=>{
    if(!scope||!sessionId||sessionId.startsWith('pending-')||!jobId)return;
    const current=read(scope);
    if(current.some(item=>item.provider===provider&&item.jobId===jobId&&!item.sessionId)){
      const resolved={provider,sessionId,jobId};
      save(scope,[...current.filter(item=>!matches(item,resolved)),resolved]);
    }
  },[scope,provider,sessionId,jobId]);
  function toggle(){
    if(!scope||!(chat.sessionId||chat.jobId))return;
    const current=read(scope),others=current.filter(item=>!matches(item,chat));
    save(scope,current.length===others.length?[...others,chat]:others);
  }
  return {muted,toggle};
}
