import {useSyncExternalStore} from 'react';

export const streamSpeeds=[20,40,80,0] as const;
const key='pocket-code-stream-speed',event='pocket-stream-speed-changed';
export function validStreamSpeed(value:unknown){return typeof value==='number'&&streamSpeeds.includes(value as typeof streamSpeeds[number])?value:40;}
function read(){try{const value=localStorage.getItem(key);return value===null?40:validStreamSpeed(Number(value));}catch{return 40;}}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener);};}
export function useStreamSpeed(){return useSyncExternalStore(subscribe,read,()=>40);}
export function setStreamSpeed(value:number){localStorage.setItem(key,String(validStreamSpeed(value)));window.dispatchEvent(new Event(event));}
