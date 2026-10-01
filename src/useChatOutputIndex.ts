import {useEffect,useMemo,useState} from 'react';
import {request,type Connection} from './api';
import {extractChatOutputs,type ChatOutput} from './chat-outputs';
import type {ChatMessage} from '../server/types';
export function mergeOutputs(...groups:ChatOutput[][]){const seen=new Set<string>();return groups.flat().filter(item=>{const key=[item.source,item.category,item.path||item.href||item.id].join('|');if(seen.has(key))return false;seen.add(key);return true;});}
/** Scan independently of the chat viewport; retain only recognized output entries. */
export function useChatOutputIndex(connection:Connection,provider:string,sessionId:string|undefined,messages:ChatMessage[]){
 const [items,setItems]=useState<ChatOutput[]>([]),[scanning,setScanning]=useState(false),[count,setCount]=useState(0),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!sessionId||sessionId.startsWith('pending-'))return;let active=true,timer:ReturnType<typeof setTimeout>|undefined;let offset=0;
  setItems([]);setCount(0);setError('');setScanning(true);
  async function page(){try{
   const value=await request<{messages:ChatMessage[];next:number|null}>(connection,`/sessions/${encodeURIComponent(sessionId!)}/messages?provider=${provider}&offset=${offset}`);
   if(!active)return;
   const found=extractChatOutputs(value.messages,Infinity);setItems(old=>mergeOutputs(found,old));setCount(old=>old+value.messages.length);
   if(value.next===null||value.next===undefined){setScanning(false);return;}
   if(!Number.isSafeInteger(value.next)||value.next<=offset)throw Error('History pagination did not advance');
   offset=value.next;timer=setTimeout(()=>void page(),200);
  }catch(error){if(active){setError((error as Error).message);setScanning(false);}}}
  void page();return()=>{active=false;clearTimeout(timer);};
 },[connection.url,connection.token,provider,sessionId,retry]);
 const recent=useMemo(()=>extractChatOutputs(messages,Infinity),[messages]);
 return{outputs:useMemo(()=>mergeOutputs(recent,items),[recent,items]),scanning,count,error,retry:()=>setRetry(value=>value+1)};
}
