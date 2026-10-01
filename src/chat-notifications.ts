import {useEffect,useRef} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import type {Connection} from './api';
export type WatchedChat={provider:string;sessionId?:string;jobId?:string;cwd:string;title:string};
const native=registerPlugin<{
  watch(value:WatchedChat&{url:string;token:string;language:string}):Promise<void>;
  clear():Promise<void>;
  pending():Promise<{chat?:WatchedChat}>;
}>('ChatNotifications');

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
