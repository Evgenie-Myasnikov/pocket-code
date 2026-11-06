import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import type {ProviderModel} from '../server/provider-model';

/** The custom provider the Claude agent runs with on this device ('' = the PC's own Claude sign-in). */
const ACCOUNT='pocket-claude-account',MODEL='pocket-custom-model:',CHANGED='pocket-custom-account',PROFILES='pocket-custom-providers';
const read=(key:string)=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
const write=(key:string,value:string)=>{try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);}catch{/* Private mode keeps the choice for this view only. */}};

export function setCustomAccount(id:string){if(read(ACCOUNT)===id)return;write(ACCOUNT,id);window.dispatchEvent(new Event(CHANGED));}
export function useCustomAccount(){
  const [value,setValue]=useState(()=>read(ACCOUNT));
  useEffect(()=>{const update=()=>setValue(read(ACCOUNT));window.addEventListener(CHANGED,update);window.addEventListener('storage',update);return()=>{window.removeEventListener(CHANGED,update);window.removeEventListener('storage',update);};},[]);
  return value;
}
/** Account pages call this after adding, renaming or removing a provider so pickers refresh. */
export function customProvidersChanged(){window.dispatchEvent(new Event(PROFILES));}

export type CustomAccount={id:string;name:string;hasKey:boolean};
export function useCustomAccounts(connection:Connection|null|undefined){return useCustomAccountsState(connection).accounts;}
/** Custom providers and whether the list has loaded. A failed load (the host still starting) retries instead of leaving the list empty. */
export function useCustomAccountsState(connection:Connection|null|undefined){
  const [state,setState]=useState<{accounts:CustomAccount[];loaded:boolean}>({accounts:[],loaded:false}),[revision,setRevision]=useState(0);
  useEffect(()=>{const update=()=>setRevision(v=>v+1);window.addEventListener(PROFILES,update);return()=>window.removeEventListener(PROFILES,update);},[]);
  useEffect(()=>{if(!connection){setState({accounts:[],loaded:false});return;}let live=true,timer=0;
    const load=(attempt:number)=>request<CustomAccount[]>(connection,'/custom-providers').then(list=>{if(live)setState({accounts:list.map(({id,name,hasKey})=>({id,name,hasKey})),loaded:true});}).catch(()=>{if(live)timer=window.setTimeout(()=>void load(attempt+1),Math.min(30000,2000*(attempt+1)));});
    void load(0);
    return()=>{live=false;window.clearTimeout(timer);};},[connection?.url,connection?.token,revision]);
  return state;
}

/** Models of the active custom provider, from its /models catalog, and the model chosen for it on this device. */
export function useCustomModels(connection:Connection|null|undefined,account:string){
  const [state,setState]=useState<{account:string;models:ProviderModel[];error:string}>({account:'',models:[],error:''});
  const [model,setModelState]=useState(()=>read(MODEL+account));
  useEffect(()=>setModelState(read(MODEL+account)),[account]);
  useEffect(()=>{if(!connection||!account)return;let live=true,timer=0;
    const load=(attempt:number)=>request<string[]>(connection,`/custom-providers/${account}/models`).then(ids=>{if(live)setState({account,models:ids.map(id=>({id,name:id})) as ProviderModel[],error:''});}).catch(e=>{if(!live)return;setState({account,models:[],error:(e as Error).message});if(attempt<5)timer=window.setTimeout(()=>void load(attempt+1),2000*(attempt+1));});
    void load(0);
    return()=>{live=false;window.clearTimeout(timer);};},[connection?.url,connection?.token,account]);
  const models=state.account===account?state.models:[];
  const chosen=model||models[0]?.id||'';
  return {models,model:chosen,error:state.account===account?state.error:'',setModel:(value:string)=>{write(MODEL+account,value);setModelState(value);}};
}
