import {useEffect,useSyncExternalStore} from 'react';
const key='pocket-code-chat-edge-fade',event='pocket-chat-edge-fade-changed';
export const validEdgeFade=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.min(100,Math.max(0,Math.round(value))):100;
function read(){try{const value=localStorage.getItem(key);return value===null||value.trim()===''?100:validEdgeFade(Number(value));}catch{return 100;}}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener);};}
export function setEdgeFade(value:number){localStorage.setItem(key,String(validEdgeFade(value)));window.dispatchEvent(new Event(event));}
export function useEdgeFade(){return useSyncExternalStore(subscribe,read,()=>100);}
export function useApplyEdgeFade(){const value=useEdgeFade();useEffect(()=>{const root=document.documentElement;root.dataset.chatEdgeFade=value===0?'off':'on';root.style.setProperty('--chat-edge-floor',String(1-value/100));root.style.setProperty('--chat-edge-soft',String(1-.92*value/100));},[value]);}
