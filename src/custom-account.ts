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
export function useCustomAccounts(connection:Connection|null|undefined){
  const [accounts,setAccounts]=useState<CustomAccount[]>([]),[revision,setRevision]=useState(0);
  useEffect(()=>{const update=()=>setRevision(v=>v+1);window.addEventListener(PROFILES,update);return()=>window.removeEventListener(PROFILES,update);},[]);
  useEffect(()=>{if(!connection){setAccounts([]);return;}let live=true;
    request<CustomAccount[]>(connection,'/custom-providers').then(list=>{if(live)setAccounts(list.map(({id,name,hasKey})=>({id,name,hasKey})));}).catch(()=>{if(live)setAccounts([]);});
    return()=>{live=false;};},[connection?.url,connection?.token,revision]);
  return accounts;
}

/** Models of the active custom provider, from its /models catalog, and the model chosen for it on this device. */
export function useCustomModels(connection:Connection|null|undefined,account:string){
  const [state,setState]=useState<{account:string;models:ProviderModel[];error:string}>({account:'',models:[],error:''});
  const [model,setModelState]=useState(()=>read(MODEL+account));
  useEffect(()=>setModelState(read(MODEL+account)),[account]);
  useEffect(()=>{if(!connection||!account)return;let live=true;
    request<string[]>(connection,`/custom-providers/${account}/models`).then(ids=>{if(live)setState({account,models:ids.map(id=>({id,name:id})) as ProviderModel[],error:''});}).catch(e=>{if(live)setState({account,models:[],error:(e as Error).message});});
    return()=>{live=false;};},[connection?.url,connection?.token,account]);
  const models=state.account===account?state.models:[];
  const chosen=model||models[0]?.id||'';
  return {models,model:chosen,error:state.account===account?state.error:'',setModel:(value:string)=>{write(MODEL+account,value);setModelState(value);}};
}
