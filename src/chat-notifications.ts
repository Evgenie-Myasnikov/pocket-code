import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import type {Connection} from './api';
export type WatchedChat={provider:string;sessionId?:string;jobId?:string;cwd:string;title:string};
const native=registerPlugin<{
  watch(value:WatchedChat&{url:string;token:string;language:string}):Promise<void>;
  clear():Promise<void>;
  pending():Promise<{chat?:WatchedChat}>;
  watchAll(value:{url:string;token:string;language:string}):Promise<void>;
  stopAll():Promise<void>;
}>('ChatNotifications');

const runAlertsKey='pocket-code-run-alerts';
export function runAlertsEnabled(){try{return localStorage.getItem(runAlertsKey)!=='false';}catch{return true;}}
export function setRunAlerts(enabled:boolean){try{localStorage.setItem(runAlertsKey,String(enabled));}catch{/* Falls back to the default for this session. */}window.dispatchEvent(new Event('pocket-run-alerts'));}
/** Completion alerts for every PC chat, including ones started on the PC; native so they continue while the WebView sleeps. */
export function useRunNotifications(connection:Connection|null,language:string){
  const [enabled,setEnabled]=useState(runAlertsEnabled);
  useEffect(()=>{const sync=()=>setEnabled(runAlertsEnabled());window.addEventListener('pocket-run-alerts',sync);return()=>window.removeEventListener('pocket-run-alerts',sync);},[]);
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android')return;
    if(connection&&enabled)void native.watchAll({url:connection.url,token:connection.token,language}).catch(()=>{});
    else void native.stopAll().catch(()=>{});
  },[connection?.url,connection?.token,language,enabled]);
}

/** Native polling survives WebView suspension. Credentials stay in process memory. */
export function useChatNotifications(connection:Connection|null,chat:WatchedChat|null|undefined,language:string,onOpen:(chat:WatchedChat)=>void){
  const latest=useRef(onOpen);latest.current=onOpen;
  const signature=chat?JSON.stringify(chat):chat;
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android')return;
    if(!connection||chat===null){void native.clear().catch(()=>{});return;}
    // undefined means another main section is open; retain the last chat.
    if(chat)void native.watch({...chat,url:connection.url,token:connection.token,language}).catch(()=>{});
  },[connection,signature,language]);
  useEffect(()=>{
    if(Capacitor.getPlatform()!=='android'||!connection)return;
    const resume=()=>{void native.pending().then(({chat})=>{if(chat)latest.current(chat);}).catch(()=>{});};
    const visible=()=>{if(document.visibilityState==='visible')resume();};
    window.addEventListener('pocket-code-notification',resume);document.addEventListener('visibilitychange',visible);resume();
    return()=>{window.removeEventListener('pocket-code-notification',resume);document.removeEventListener('visibilitychange',visible);};
  },[connection]);
}
