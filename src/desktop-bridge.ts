export type DesktopState={online:boolean;busy:boolean;hostBusy?:boolean;tunnelOnline?:boolean;status:string;startup:boolean;autoReconnect:boolean;internet:boolean;addresses:{url:string;image:string}[];jira:boolean};
type Reply={id?:number;value?:unknown;error?:string;status?:number;state?:DesktopState};
type WebView={postMessage(value:unknown):void;addEventListener(name:'message',listener:(event:{data:Reply})=>void):void};
const view=()=>((window as unknown as {chrome?:{webview?:WebView}}).chrome?.webview);
let sequence=0,attached=false;
const pending=new Map<number,{resolve(value:unknown):void;reject(error:Error):void;timer:ReturnType<typeof setTimeout>}>();
const listeners=new Set<(state:DesktopState)=>void>();
function attach(){if(attached)return;const bridge=view();if(!bridge)throw Error('Open this window from the Pocket Code desktop application.');attached=true;bridge.addEventListener('message',({data})=>{
  if(data.state)for(const listener of listeners)listener(data.state);
  if(data.id===undefined)return;const task=pending.get(data.id);if(!task)return;clearTimeout(task.timer);pending.delete(data.id);
  if(data.error)task.reject(Object.assign(Error(data.error),{status:data.status}));else task.resolve(data.value);
});}
export function desktopCall<T>(action:string,args:Record<string,unknown>={}):Promise<T>{
  try{attach();}catch(error){return Promise.reject(error);}
  const id=++sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('The desktop host did not respond.'));},100000);pending.set(id,{resolve:resolve as (value:unknown)=>void,reject,timer});view()!.postMessage({id,action,...args});});
}
export function watchDesktop(listener:(state:DesktopState)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
