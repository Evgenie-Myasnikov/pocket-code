import {useSyncExternalStore} from 'react';
import type {DetailMode} from './activity-groups';

/** Per-device transcript detail: brief by default on the phone, detailed in the PC window. */
const key='pocket-code-detail-mode-v1',listeners=new Set<()=>void>();
function read():DetailMode|null{try{const value=localStorage.getItem(key);return value==='brief'||value==='detailed'?value:null;}catch{return null;}}
let stored=read();
export function setDetailMode(value:DetailMode){stored=value;try{localStorage.setItem(key,value);}catch{/* Keep the choice for this session. */}listeners.forEach(listener=>listener());}
export const detailMode=(fallback:DetailMode)=>stored||fallback;
export function useDetailMode(fallback:DetailMode){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>stored||fallback,()=>fallback);}
