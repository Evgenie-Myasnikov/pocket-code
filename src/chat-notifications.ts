import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import type {Connection} from './api';
import {desktopCall} from './desktop-bridge';
export type WatchedChat={provider:string;sessionId?:string;jobId?:string;cwd:string;title:string;connectionUrl?:string};
const desktop=()=>new URLSearchParams(location.search).get('desktop')==='1';
const native=registerPlugin<{
  watch(value:WatchedChat&{url:string;token:string;language:string;alerts:boolean}):Promise<void>;
  clear():Promise<void>;
  pending():Promise<{chat?:WatchedChat}>;
  watchAll(value:{url:string;token:string;language:string}):Promise<void>;
  stopAll():Promise<void>;
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
export function useRunNotifications(connection:Connection|null,language:string,nativeDesktop=false){
  const enabled=useRunAlertsPreference();
  useEffect(()=>{
    // A temporary native host outage must not turn the user's preference off or discard queued targets.
    if(desktop()){if(nativeDesktop)void desktopCall('run-alerts',{enabled,language}).catch(()=>{});return;}
    if(Capacitor.getPlatform()!=='android')return;
    if(connection&&enabled)void native.watchAll({url:connection.url,token:connection.token,language}).catch(()=>{});
    else void native.stopAll().catch(()=>{});
  },[connection?.url,connection?.token,language,enabled,nativeDesktop]);
}

/** The desktop shell owns navigation even when no SharedChat is mounted. */
export function useDesktopRunNotifications(connection:Connection|null,language:string,onOpen:(chat:WatchedChat)=>void){
  useRunNotifications(connection,language,true);
  usePendingNotification(connection,onOpen,true);
}

function usePendingNotification(connection:Connection|null,onOpen:(chat:WatchedChat)=>void,desktopOwner=false){
  const latest=useRef(onOpen);latest.current=onOpen;
  useEffect(()=>{
    if((desktop()? !desktopOwner:Capacitor.getPlatform()!=='android')||!connection)return;
    let active=true;
    const resume=()=>{void (desktop()?desktopCall<{chat?:WatchedChat}>('notification-pending'):native.pending()).then(({chat})=>{
      if(active&&chat&&(!chat.connectionUrl||chat.connectionUrl.replace(/\/$/,'')===connection.url.replace(/\/$/,'')))latest.current(chat);
    }).catch(()=>{});};
    const visible=()=>{if(document.visibilityState==='visible')resume();};
    window.addEventListener('pocket-code-notification',resume);document.addEventListener('visibilitychange',visible);resume();
    return()=>{active=false;window.removeEventListener('pocket-code-notification',resume);document.removeEventListener('visibilitychange',visible);};
  },[connection,desktopOwner]);
}

/** Native polling survives WebView suspension. Credentials stay in process memory. */
export function useChatNotifications(connection:Connection|null,chat:WatchedChat|null|undefined,language:string,onOpen:(chat:WatchedChat)=>void){
  const alerts=useRunAlertsPreference();
  usePendingNotification(connection,onOpen);
  const signature=chat?JSON.stringify(chat):chat;
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android')return;
    if(!connection||chat===null){void native.clear().catch(()=>{});return;}
    // undefined means another main section is open; retain the last chat.
    if(chat)void native.watch({...chat,url:connection.url,token:connection.token,language,alerts}).catch(()=>{});
  },[connection,signature,language,alerts]);
}
