import {useEffect,useMemo,useState} from 'react';
import {request,type Connection} from './api';
import {extractChatOutputs,type ChatOutput} from './chat-outputs';
import type {ChatMessage} from '../server/types';
export function mergeOutputs(...groups:ChatOutput[][]){const seen=new Set<string>();return groups.flat().filter(item=>{const key=[item.source,item.category,item.path||item.href||item.id].join('|');if(seen.has(key))return false;seen.add(key);return true;});}
/** Scan independently of the chat viewport; retain only recognized output entries. */
export function useChatOutputIndex(connection:Connection,provider:string,sessionId:string|undefined,messages:ChatMessage[]){
 const scope=JSON.stringify([connection.url,connection.token,provider,sessionId]);
 const [state,setState]=useState({scope:'',items:[] as ChatOutput[],scanning:false,count:0,error:''}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!sessionId||sessionId.startsWith('pending-'))return;let active=true,timer:ReturnType<typeof setTimeout>|undefined;let offset=0;
  setState({scope,items:[],count:0,error:'',scanning:true});
  async function page(){try{
   const value=await request<{messages:ChatMessage[];next:number|null}>(connection,`/sessions/${encodeURIComponent(sessionId!)}/messages?provider=${provider}&offset=${offset}`);
   if(!active)return;
   const found=extractChatOutputs(value.messages,Infinity);setState(old=>({...old,items:mergeOutputs(found,old.items),count:old.count+value.messages.length}));
   if(value.next===null||value.next===undefined){setState(old=>({...old,scanning:false}));return;}
   if(!Number.isSafeInteger(value.next)||value.next<=offset)throw Error('History pagination did not advance');
   offset=value.next;timer=setTimeout(()=>void page(),200);
  }catch(error){if(active)setState(old=>({...old,error:(error as Error).message,scanning:false}));}}
  void page();return()=>{active=false;clearTimeout(timer);};
 },[connection.url,connection.token,provider,sessionId,retry]);
 const recent=useMemo(()=>extractChatOutputs(messages,Infinity),[messages]);
 const current=state.scope===scope?state:undefined;
 return{outputs:useMemo(()=>mergeOutputs(recent,current?.items||[]),[recent,current?.items]),scanning:current?.scanning||false,count:current?.count||0,error:current?.error||'',retry:()=>setRetry(value=>value+1)};
}
