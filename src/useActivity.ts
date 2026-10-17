import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {t} from './i18n';
import type {ActivityItem} from '../server/types';
import {pruneSeen,rememberViewed,validActivity,visibleActivity,activityCounts,type ActivitySeen} from './activity-state';
import {shareSnapshot} from './chat-snapshot';

const storageKey=(host:string)=>`pocket-code-activity-seen-v1:${encodeURIComponent(host)}`;
function readSeen(host:string):ActivitySeen[]{try{return pruneSeen(JSON.parse(localStorage.getItem(storageKey(host))||'[]'));}catch{return[];}}
function writeSeen(host:string,entries:ActivitySeen[]){try{localStorage.setItem(storageKey(host),JSON.stringify(entries));}catch{/* Retain acknowledgements in memory if storage is unavailable. */}}
function hostUrl(connection:Connection|null){if(!connection)return'';try{return new URL(connection.url).origin;}catch{return connection.url;}}
type FeedState={identity:string;items:ActivityItem[];loaded:boolean;refreshing:boolean;error:string;updatedAt:number};

export function useActivity(connection:Connection|null){
  const host=hostUrl(connection),identity=connection?JSON.stringify([host,connection.token]):'';
  const identityRef=useRef(identity);identityRef.current=identity;
  const diskSeen=useMemo(()=>host?readSeen(host):[],[host]);
  const [seenState,setSeen]=useState<{host:string;entries:ActivitySeen[]}>({host,entries:diskSeen});
  const seen=seenState.host===host?seenState.entries:diskSeen;
  const [state,setState]=useState<FeedState>({identity:'',items:[],loaded:false,refreshing:false,error:'',updatedAt:0});
  const inFlight=useRef(new Map<string,Promise<unknown>>());
  const run=useRef<(manual:boolean)=>void>(()=>{});
  // Background polls stay silent; only an explicit refresh shows progress, so an empty inbox never flickers.
  const refresh=useCallback(()=>run.current(true),[]);
  useEffect(()=>{
    if(!connection){run.current=()=>{};return;}
    let cancelled=false,pending=false,timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{clearTimeout(timer);if(!cancelled&&document.visibilityState!=='hidden')timer=setTimeout(()=>void poll(false),3000);};
    const update=(change:(previous:FeedState)=>FeedState)=>setState(previous=>{const base=previous.identity===identity?previous:{identity,items:[],loaded:false,refreshing:false,error:'',updatedAt:0},next=change(base);return next.identity===previous.identity&&next.items===previous.items&&next.loaded===previous.loaded&&next.refreshing===previous.refreshing&&next.error===previous.error&&next.updatedAt===previous.updatedAt?previous:next;});
    async function poll(manual:boolean){
      if(cancelled||pending||document.visibilityState==='hidden')return;
      clearTimeout(timer);pending=true;
      if(manual)update(previous=>({...previous,refreshing:true}));
      try{
        let promise=inFlight.current.get(identity);
        if(!promise){
          promise=request<unknown>(connection!,'/activity');inFlight.current.set(identity,promise);
          const release=()=>{if(inFlight.current.get(identity)===promise)inFlight.current.delete(identity);};
          void promise.then(release,release);
        }
        const result=await promise;
        if(!validActivity(result))throw new Error(t('Не удалось загрузить активность чатов.'));
        if(!cancelled&&identityRef.current===identity)update(previous=>({identity,items:shareSnapshot(previous.items,visibleActivity(result,[])),loaded:true,refreshing:false,error:'',updatedAt:Date.now()}));
      }catch(error){
        if(!cancelled&&identityRef.current===identity){
          const message=(error as {status?:number}).status===404?t('Активность чатов недоступна. Обновите сервер ПК.'):(error as Error).message||t('Не удалось загрузить активность чатов.');
          update(previous=>({...previous,loaded:true,refreshing:false,error:message}));
        }
      }finally{pending=false;schedule();}
    }
    const visible=()=>{clearTimeout(timer);if(document.visibilityState!=='hidden')void poll(false);};
    run.current=manual=>void poll(manual);document.addEventListener('visibilitychange',visible);void poll(false);
    return()=>{cancelled=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);run.current=()=>{};};
  },[identity]);
  const current=state.identity===identity?state:null;
  const items=useMemo(()=>visibleActivity(current?.items||[],seen),[current?.items,seen]);
  const remember=useCallback((targets:ActivityItem[])=>{
    if(!host||identityRef.current!==identity)return;
    const known=targets.filter(item=>current?.items.some(value=>value.id===item.id&&value.provider===item.provider&&value.version===item.version&&value.status===item.status));
    if(!known.length)return;
    setSeen(previous=>{const base=previous.host===host?previous.entries:diskSeen,entries=known.reduce((list,item)=>rememberViewed(list,item),base);writeSeen(host,entries);return{host,entries};});
  },[host,identity,current?.items,diskSeen]);
  const markViewed=useCallback((item:ActivityItem)=>{remember([item]);},[remember]);
  /** Hides several finished entries at once; the returned snapshot restores them for Undo. */
  const markAllViewed=useCallback((targets:ActivityItem[])=>{const before=seen;remember(targets);return before;},[remember,seen]);
  const restoreSeen=useCallback((entries:ActivitySeen[])=>{if(!host)return;const restored=pruneSeen(entries);writeSeen(host,restored);setSeen({host,entries:restored});},[host]);
  const counts=useMemo(()=>activityCounts(items),[items]);
  return{items,loading:Boolean(connection)&&!current?.loaded,refreshing:Boolean(current?.refreshing),updatedAt:current?.updatedAt||0,error:current?.error||'',refresh,markViewed,markAllViewed,restoreSeen,...counts,count:counts.attention};
}
