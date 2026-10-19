import {useSyncExternalStore} from 'react';

/** One answer to "can the PC be reached?" for every screen: requests report into it, one probe with backoff runs while the PC is away. */
export type ReachabilityStatus='online'|'connecting'|'unreachable'|'no-network'|'restarting';
export type ReachabilityCause='network'|'tunnel'|'host';
export type Reachability={status:ReachabilityStatus;cause?:ReachabilityCause;httpStatus?:number;detail?:string;since:number;lastOkAt:number;cachedAt:number;failures:number;nextRetryAt:number;recovered:number;checking?:boolean};
const initial:Reachability={status:'online',since:0,lastOkAt:0,cachedAt:0,failures:0,nextRetryAt:0,recovered:0};
let lastOk=0,state:Reachability=initial,primary='',probe:(()=>Promise<unknown>)|null=null,timer:ReturnType<typeof setTimeout>|undefined,probing=false;
const listeners=new Set<()=>void>();
const now=()=>Date.now();
function set(next:Partial<Reachability>){state={...state,...next};for(const listener of listeners)listener();}
/** HTTP statuses that come from a tunnel or proxy in front of a PC that does not answer (Cloudflare 520–530 included). */
export function proxyFailure(status:number){return status===502||status===503||status===504||status>=520&&status<=530;}
/** Backoff 1, 2, 4 … 30 s with ±20 % jitter, so many phones do not knock on the tunnel at the same moment. */
export function backoff(failures:number,random=Math.random){const base=Math.min(30000,1000*2**Math.max(0,failures-1));return Math.round(base*(0.8+random()*0.4));}
const down=()=>state.status==='unreachable'||state.status==='no-network'||state.status==='restarting';
function schedule(){
  clearTimeout(timer);timer=undefined;
  if(!probe||!down()&&state.status!=='connecting')return;
  if(typeof document!=='undefined'&&document.visibilityState==='hidden')return;
  const delay=Math.max(0,state.nextRetryAt-now());timer=setTimeout(()=>void runProbe(),delay);
}
async function runProbe(){
  if(!probe||probing)return;probing=true;
  set({checking:true});
  try{await probe();}catch{/* request() already reported the failure. */}finally{probing=false;if(state.checking)set({checking:false});schedule();}
}
/** The PC this phone talks to; reports for other hosts (a shared workspace) do not change its status. */
export function setPrimaryHost(url:string,check:(()=>Promise<unknown>)|null){
  if(primary!==url){primary=url;lastOk=0;clearTimeout(timer);state={...initial,recovered:state.recovered};for(const listener of listeners)listener();}
  probe=check;schedule();
}
const tracked=(url?:string)=>!!primary&&(!url||url===primary);
export function reportOk(url?:string){
  if(!tracked(url))return;
  const wasDown=state.status!=='online';
  lastOk=now();
  // Screens re-render only when the status changes, not on every successful request.
  if(!wasDown&&!state.cachedAt&&!state.failures)return;
  set({status:'online',cause:undefined,httpStatus:undefined,detail:undefined,lastOkAt:lastOk,cachedAt:0,failures:0,nextRetryAt:0,...(wasDown?{since:now(),recovered:state.recovered+1}:{})});
  clearTimeout(timer);timer=undefined;
  if(wasDown&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('pocket-recovered'));
}
/** A transport error, a tunnel 5xx or a host restart: the first failure retries at once, later ones back off. */
export function reportFail(url:string|undefined,failure:{cause:ReachabilityCause;httpStatus?:number;detail?:string;restarting?:boolean}){
  if(!tracked(url))return;
  const failures=state.failures+1,offlineDevice=typeof navigator!=='undefined'&&navigator.onLine===false;
  const status:ReachabilityStatus=offlineDevice?'no-network':failure.restarting?'restarting':failures<2?'connecting':'unreachable';
  set({status,lastOkAt:lastOk,cause:failure.cause,httpStatus:failure.httpStatus,detail:failure.detail,failures,since:state.status==='online'?now():state.since,nextRetryAt:now()+backoff(failures)});
  schedule();
}
/** Cached data is on screen: remember how old it is for the status line. */
export function reportCached(url:string|undefined,at:number){if(tracked(url)&&at&&state.cachedAt!==at)set({cachedAt:at});}
/** "Retry", the network coming back or the app returning to the screen: probe now instead of waiting for the backoff. */
export function retryNow(){if(!probe||state.status==='online')return;set({nextRetryAt:0});clearTimeout(timer);void runProbe();}
export function getReachability(){return state;}
export function hostDown(value:Reachability=state){return value.status==='unreachable'||value.status==='no-network'||value.status==='restarting';}
/** Polls of the primary PC skip their work while it is away; the probe brings them back with one "recovered" event. */
export function hostGate(url?:string){return ()=>!(url&&url===primary&&down());}
export function subscribeReachability(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function useReachability(){return useSyncExternalStore(subscribeReachability,getReachability,getReachability);}
if(typeof window!=='undefined'){
  window.addEventListener('online',()=>{if(state.status==='no-network')set({status:'connecting'});retryNow();});
  window.addEventListener('offline',()=>{if(primary)set({status:'no-network',since:state.status==='online'?now():state.since});});
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')retryNow();else{clearTimeout(timer);timer=undefined;}});
}
/** Test hook: forget the primary host and every report. */
export function resetReachability(){lastOk=0;clearTimeout(timer);timer=undefined;primary='';probe=null;probing=false;state=initial;for(const listener of listeners)listener();}
