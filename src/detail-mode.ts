import {useSyncExternalStore} from 'react';
import type {DetailMode} from './activity-groups';

/** Both shells use the same per-device detail preference. */
const key='pocket-code-detail-mode-v1',listeners=new Set<()=>void>();
function read():DetailMode|null{try{const value=localStorage.getItem(key);return value==='brief'||value==='detailed'?value:null;}catch{return null;}}
let stored=read();
export function setDetailMode(value:DetailMode){stored=value;try{localStorage.setItem(key,value);}catch{/* Keep the choice for this session. */}listeners.forEach(listener=>listener());}
export const detailMode=():DetailMode=>stored||'brief';
export function useDetailMode(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},detailMode,detailMode);}
