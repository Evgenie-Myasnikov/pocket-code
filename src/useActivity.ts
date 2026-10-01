import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {t} from './i18n';
import type {ActivityItem} from '../server/types';
import {pruneSeen,rememberViewed,validActivity,visibleActivity,type ActivitySeen} from './activity-state';

const storageKey=(host:string)=>`pocket-code-activity-seen-v1:${encodeURIComponent(host)}`;
function readSeen(host:string):ActivitySeen[]{try{return pruneSeen(JSON.parse(localStorage.getItem(storageKey(host))||'[]'));}catch{return[];}}
function writeSeen(host:string,entries:ActivitySeen[]){try{localStorage.setItem(storageKey(host),JSON.stringify(entries));}catch{/* Retain acknowledgements in memory if storage is unavailable. */}}
function hostUrl(connection:Connection|null){if(!connection)return'';try{return new URL(connection.url).origin;}catch{return connection.url;}}

export function useActivity(connection:Connection|null){
  const host=hostUrl(connection),identity=connection?JSON.stringify([host,connection.token]):'';
  const identityRef=useRef(identity);identityRef.current=identity;
  const diskSeen=useMemo(()=>host?readSeen(host):[],[host]);
  const [seenState,setSeen]=useState<{host:string;entries:ActivitySeen[]}>({host,entries:diskSeen});
  const seen=seenState.host===host?seenState.entries:diskSeen;
  const [state,setState]=useState<{identity:string;items:ActivityItem[];loading:boolean;error:string}>({identity:'',items:[],loading:false,error:''});
  const inFlight=useRef(new Map<string,Promise<unknown>>());
  const run=useRef<()=>void>(()=>{});
  const refresh=useCallback(()=>run.current(),[]);
  useEffect(()=>{
    if(!connection){run.current=()=>{};return;}
    let cancelled=false,pending=false,timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{clearTimeout(timer);if(!cancelled&&document.visibilityState!=='hidden')timer=setTimeout(()=>void poll(),3000);};
    async function poll(){
      if(cancelled||pending||document.visibilityState==='hidden')return;
      clearTimeout(timer);pending=true;
      setState(previous=>({identity,items:previous.identity===identity?previous.items:[],loading:true,error:previous.identity===identity?previous.error:''}));
      try{
        let promise=inFlight.current.get(identity);
        if(!promise){
          promise=request<unknown>(connection!,'/activity');inFlight.current.set(identity,promise);
          const release=()=>{if(inFlight.current.get(identity)===promise)inFlight.current.delete(identity);};
          void promise.then(release,release);
        }
        const result=await promise;
        if(!validActivity(result))throw new Error(t('Не удалось загрузить активность чатов.'));
        if(!cancelled&&identityRef.current===identity)setState({identity,items:visibleActivity(result,[]),loading:false,error:''});
      }catch(error){
        if(!cancelled&&identityRef.current===identity){
          const message=(error as {status?:number}).status===404?t('Активность чатов недоступна. Обновите сервер ПК.'):(error as Error).message||t('Не удалось загрузить активность чатов.');
          setState(previous=>({identity,items:previous.identity===identity?previous.items:[],loading:false,error:message}));
        }
      }finally{pending=false;schedule();}
    }
    const visible=()=>{clearTimeout(timer);if(document.visibilityState!=='hidden')void poll();};
    run.current=()=>void poll();document.addEventListener('visibilitychange',visible);void poll();
    return()=>{cancelled=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);run.current=()=>{};};
  },[identity]);
  const current=state.identity===identity?state:null;
  const items=useMemo(()=>visibleActivity(current?.items||[],seen),[current?.items,seen]);
  const markViewed=useCallback((item:ActivityItem)=>{
    if(!host||identityRef.current!==identity||!current?.items.some(value=>value.id===item.id&&value.provider===item.provider&&value.version===item.version&&value.status===item.status))return;
    setSeen(previous=>{
      const entries=rememberViewed(previous.host===host?previous.entries:diskSeen,item);writeSeen(host,entries);return{host,entries};
    });
  },[host,identity,current?.items,diskSeen]);
  return{items,loading:current?.loading||Boolean(connection&&!current),error:current?.error||'',refresh,markViewed,count:items.length};
}
