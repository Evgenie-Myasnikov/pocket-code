import {useEffect,useRef} from 'react';
import {request,type Connection} from './api';
import {chatCacheScope,forgetChatTranscripts} from './chat-cache';
import {transcriptScope} from './chat-history-cache';
import {hostGate} from './reachability';
import {startVisiblePoll} from './visible-poll';

type Feed={revision:string;unchanged?:boolean;restart?:boolean;entries?:{provider:string;sessionId:string}[];next?:number|null};
const digest=/^[a-f0-9]{64}$/;

/** Copies erased on another device are purged on reconnect, including chats never reopened here. */
export function useChatErasures(connection:Connection|null){
 const revisions=useRef(new Map<string,string>());
 useEffect(()=>{
   if(!connection||connection.workspaceOnly||connection.workspaceId)return;
   const host=connection;
   let active=true,stop:undefined|(()=>void);
   void chatCacheScope(host).then(scope=>{
     if(!active)return;
     const key='pocket-code-chats-v1:'+transcriptScope(scope,host)+':erasures';
     if(!revisions.current.has(key)){
       let saved='';
       try{saved=localStorage.getItem(key)||'';}catch{/* Storage can be disabled. */}
       revisions.current.set(key,digest.test(saved)?saved:'');
     }
     async function sync(){
       const known=revisions.current.get(key)||'';
       let offset=0,revision='',persist=true;
       while(active){
         const params=offset?'?snapshot='+revision+'&offset='+offset:known?'?known='+known:'';
         const page=await request<Feed>(host,'/chat-library/erasures'+params);
         if(!active||!page||!digest.test(page.revision)||page.unchanged||page.restart)return;
         if(offset&&revision!==page.revision||!Array.isArray(page.entries)||page.entries.length>200)return;
         revision=page.revision;
         const groups=new Map<string,string[]>();
         for(const item of page.entries){
           if(!item||!['claude','codex','copilot'].includes(item.provider)||typeof item.sessionId!=='string'||!item.sessionId)return;
           const ids=groups.get(item.provider)||[];ids.push(item.sessionId);groups.set(item.provider,ids);
         }
         for(const [provider,ids] of groups){
           if(!active)return;
           if(!await forgetChatTranscripts(host,provider,ids))persist=false;
         }
         if(page.next===null){
           if(persist&&active){
             revisions.current.set(key,revision);
             try{localStorage.setItem(key,revision);}catch{/* The current window still knows this revision. */}
           }
           return;
         }
         if(!page.next||!Number.isSafeInteger(page.next)||page.next!==offset+page.entries.length)return;
         offset=page.next;
       }
     }
     stop=startVisiblePoll(sync,30_000,true,document,hostGate(host.url));
   }).catch(()=>{/* A host that cannot cache transcripts has no persisted acknowledgement. */});
   return()=>{active=false;stop?.();};
 },[connection]);
}
