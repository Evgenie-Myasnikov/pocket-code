import {useSyncExternalStore} from 'react';
export type ClaudeAccess='default'|'acceptEdits'|'bypassPermissions';
const key='pocket-code-claude-access',event='pocket-claude-access';
function read():ClaudeAccess{try{const value=localStorage.getItem(key);return value==='acceptEdits'||value==='bypassPermissions'?value:'default';}catch{return 'default';}}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener);};}
export function useClaudeAccess(){return useSyncExternalStore(subscribe,read,()=> 'default' as ClaudeAccess);}
export function setClaudeAccess(value:ClaudeAccess){localStorage.setItem(key,value);window.dispatchEvent(new Event(event));}
