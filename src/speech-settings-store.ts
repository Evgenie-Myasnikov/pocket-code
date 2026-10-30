import {useSyncExternalStore} from 'react';
const key='pocket-code-speech-v1',event='pocket-speech-settings';
export type SpeechSettings={engine:'system'|'supertonic';voice:number};
export function speechSettings():SpeechSettings{try{const v=JSON.parse(localStorage.getItem(key)||'{}');return {engine:v.engine==='supertonic'?'supertonic':'system',voice:Number.isInteger(v.voice)&&v.voice>=0&&v.voice<=9?v.voice:0};}catch{return {engine:'system',voice:0};}}
const read=()=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
const subscribe=(fn:()=>void)=>{window.addEventListener(event,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener('storage',fn);};};
export function useSpeechSettings(){useSyncExternalStore(subscribe,read,()=> '');return speechSettings();}
export function saveSpeechSettings(value:SpeechSettings){localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new Event(event));}
