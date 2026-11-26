import {useEffect,useState} from 'react';
import {Cpu} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {LocalModelStatus} from './LocalModels';
import './local-model-card.css';

/**
 * As in Strata's sidebar: which local model is loaded now, or that none is. Shown only on a PC with Strata; a click
 * opens Settings → Providers, where local models are started, stopped and chosen.
 */
export function LocalModelCard({connection,online,onOpen}:{connection:Connection;online:boolean;onOpen():void}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [status,setStatus]=useState<LocalModelStatus|null>(null);
  useEffect(()=>{
    if(!online)return;let live=true;
    const read=()=>request<LocalModelStatus>(connection,'/local-models').then(value=>{if(live)setStatus(value);}).catch(()=>{});
    void read();const timer=setInterval(read,10000);
    window.addEventListener('pocket-custom-providers',read);
    return()=>{live=false;clearInterval(timer);window.removeEventListener('pocket-custom-providers',read);};
  },[online,connection.url,connection.token]);
  if(!status?.available)return null;
  const job=status.job.state,loadedId=job==='ready'?status.job.model:status.running[0]?.name;
  const loaded=loadedId?status.models.find(item=>item.id===loadedId||item.name===loadedId)?.name||loadedId:undefined;
  const state=job==='starting'?'starting':job==='stopping'?'stopping':loaded?'loaded':'none';
  const title=state==='starting'?l('Loading ','Загружается ')+(status.job.model||''):loaded||l('No model loaded','Модель не загружена');
  const note=state==='loaded'?l('Local model · loaded','Локальная модель · загружена'):state==='starting'?l('Local model · starting','Локальная модель · запускается'):state==='stopping'?l('Local model · stopping','Локальная модель · выгружается'):l('Local models of Strata','Локальные модели Strata');
  return <button type="button" className="local-model-card" data-state={state} onClick={onOpen} title={l('Local models in Settings → Providers','Локальные модели в Настройках → Провайдеры')}>
    <span className="local-model-card-icon"><Cpu size={18} aria-hidden="true"/><i aria-hidden="true"/></span>
    <span><strong>{title}</strong><small>{note}</small></span>
  </button>;
}
