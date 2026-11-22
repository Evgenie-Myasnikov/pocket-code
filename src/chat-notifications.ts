import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {request,type Connection} from './api';
import type {MarkdownChainScope} from './markdown-chain';
import {desktopCall} from './desktop-bridge';
import {muteScope,useChatMute,useMutedChats,type MutedChat} from './chat-mute';
export type WatchedChat={provider:string;sessionId?:string;jobId?:string;cwd:string;title:string;connectionUrl?:string};
const desktop=()=>new URLSearchParams(location.search).get('desktop')==='1';
const native=registerPlugin<{
  watch(value:WatchedChat&{url:string;token:string;language:string;alerts:boolean}):Promise<void>;
  clear():Promise<void>;
  pending():Promise<{chat?:WatchedChat}>;
  watchAll(value:{url:string;token:string;language:string}):Promise<void>;
  stopAll():Promise<void>;
  setMuted(value:{url:string;mutedChats:MutedChat[]}):Promise<void>;
}>('ChatNotifications');

const runAlertsKey='pocket-code-run-alerts';
let sessionRunAlerts:boolean|undefined;
export function runAlertsEnabled(){if(sessionRunAlerts!==undefined)return sessionRunAlerts;try{return localStorage.getItem(runAlertsKey)!=='false';}catch{return true;}}
export function setRunAlerts(enabled:boolean){sessionRunAlerts=enabled;try{localStorage.setItem(runAlertsKey,String(enabled));}catch{/* Keep the explicit choice for this session. */}window.dispatchEvent(new Event('pocket-run-alerts'));}
export function useRunAlertsPreference(){
  const [enabled,setEnabled]=useState(runAlertsEnabled);
  useEffect(()=>{const sync=()=>setEnabled(runAlertsEnabled());window.addEventListener('pocket-run-alerts',sync);return()=>window.removeEventListener('pocket-run-alerts',sync);},[]);
  return enabled;
}
/** Completion alerts for every PC chat, including ones started on the PC; native so they continue while the WebView sleeps. */
export function useRunNotifications(connection:Connection|null,language:string,nativeDesktop=false,passive=false){
  const enabled=useRunAlertsPreference();
  const mutedChats=useMutedChats(nativeDesktop?'desktop':muteScope(connection));
  useEffect(()=>{
    if(passive)return;
    if(nativeDesktop){void desktopCall('chat-mutes',{mutedChats}).catch(()=>{});return;}
    if(!desktop()&&connection?.url&&Capacitor.getPlatform()==='android'){
      void native.setMuted({url:connection.url,mutedChats}).catch(()=>{});
    }
  },[passive,nativeDesktop,connection?.url,mutedChats]);
  useEffect(()=>{
    // A temporary native host outage must not turn the user's preference off or discard queued targets.
    if(passive)return;
    if(desktop()){if(nativeDesktop)void desktopCall('run-alerts',{enabled,language}).catch(()=>{});return;}
    if(Capacitor.getPlatform()!=='android')return;
    if(connection&&enabled)void native.watchAll({url:connection.url,token:connection.token,language}).catch(()=>{});
    else void native.stopAll().catch(()=>{});
  },[passive,connection?.url,connection?.token,language,enabled,nativeDesktop]);
}

/** The desktop shell owns navigation even when no SharedChat is mounted. */
type OpenTask=(id:string,owner:MarkdownChainScope)=>void;
export function useDesktopRunNotifications(connection:Connection|null,language:string,onOpen:(chat:WatchedChat)=>void,onTask?:OpenTask){
  useRunNotifications(connection,language,true);
  usePendingNotification(connection,onOpen,true,onTask);
}

function usePendingNotification(connection:Connection|null,onOpen:(chat:WatchedChat)=>void,desktopOwner=false,onTask?:OpenTask){
  const latest=useRef({onOpen,onTask});latest.current={onOpen,onTask};
  useEffect(()=>{
    if((desktop()? !desktopOwner:Capacitor.getPlatform()!=='android')||!connection)return;
    let active=true,sequence=0;
    const resume=()=>{void (desktop()?desktopCall<{chat?:WatchedChat}>('notification-pending'):native.pending()).then(async({chat})=>{
      if(!active||!chat||chat.connectionUrl&&chat.connectionUrl.replace(/\/$/,'')!==connection.url.replace(/\/$/,''))return;
      const ticket=++sequence;
      if(latest.current.onTask&&!connection.workspaceId&&chat.cwd&&(chat.sessionId||chat.jobId)){
        const query=new URLSearchParams({notification:'1',provider:chat.provider,cwd:chat.cwd});
        if(chat.sessionId)query.set('sessionId',chat.sessionId);
        if(chat.jobId)query.set('jobId',chat.jobId);
        const task=await request<{id:string;owner:MarkdownChainScope}|null>(connection,'/task-chains?'+query).catch(()=>null);
        if(!active||ticket!==sequence)return;
        if(task?.id&&task.owner?.cwd&&latest.current.onTask){latest.current.onTask(task.id,task.owner);return;}
      }
      latest.current.onOpen(chat);
    }).catch(()=>{});};
    const visible=()=>{if(document.visibilityState==='visible')resume();};
    window.addEventListener('pocket-code-notification',resume);document.addEventListener('visibilitychange',visible);resume();
    return()=>{active=false;window.removeEventListener('pocket-code-notification',resume);document.removeEventListener('visibilitychange',visible);};
  },[connection,desktopOwner]);
}

/** Native polling survives WebView suspension. Credentials stay in process memory. */
export function useChatNotifications(connection:Connection|null,chat:WatchedChat|null|undefined,language:string,onOpen:(chat:WatchedChat)=>void,passive=false,onTask?:OpenTask){
  const alerts=useRunAlertsPreference();
  const {muted}=useChatMute(connection,chat?.provider||'',chat?.sessionId||'',chat?.jobId);
  usePendingNotification(passive?null:connection,onOpen,false,onTask);
  const signature=chat?JSON.stringify(chat):chat;
  useEffect(()=>{
    if(passive||Capacitor.getPlatform()!=='android')return;
    if(!connection||chat===null||chat&&muted){void native.clear().catch(()=>{});return;}
    // undefined means another main section is open; retain the last chat.
    if(chat)void native.watch({...chat,url:connection.url,token:connection.token,language,alerts}).catch(()=>{});
  },[passive,connection,signature,language,alerts,muted]);
}
