import {useSyncExternalStore} from 'react';
/** How Enter behaves in the composer and how long an approval waits. Stored per device. */
export type ApprovalTimeout=0|10|60;
type Stored={enterSends?:boolean;approvalTimeout?:ApprovalTimeout};
const key='pocket-code-composer',event='pocket-composer-preferences';
let cache:{raw:string|null;value:Stored}={raw:null,value:{}};
function read():Stored{
  let raw:string|null=null;try{raw=localStorage.getItem(key);}catch{/* Defaults apply. */}
  if(raw===cache.raw)return cache.value;
  let value:Stored={};
  try{const parsed=JSON.parse(raw||'{}');value={...(typeof parsed.enterSends==='boolean'?{enterSends:parsed.enterSends}:{}),...([0,10,60].includes(parsed.approvalTimeout)?{approvalTimeout:parsed.approvalTimeout}:{})};}catch{/* Defaults apply. */}
  cache={raw,value};return value;
}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener);};}
export function useComposerPreferences(){return useSyncExternalStore(subscribe,read,()=>({}) as Stored);}
export function saveComposerPreferences(change:Stored){try{localStorage.setItem(key,JSON.stringify({...read(),...change}));}catch{/* Keep the current behaviour for this session. */}window.dispatchEvent(new Event(event));}
/** The Windows window sends on Enter by default, like other desktop chat apps; the phone keeps Enter as a new line. */
export const enterSends=(stored:Stored,desktop:boolean)=>stored.enterSends??desktop;
/** By default a request waits until the person answers, so a run is never lost while they are away. */
export const approvalTimeout=(stored:Stored):ApprovalTimeout=>stored.approvalTimeout??0;
