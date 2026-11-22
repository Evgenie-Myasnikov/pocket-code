import {useEffect,useState} from 'react';
import {Gauge} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {GenerationMetrics,JobView} from '../server/types';
import './chat-generation.css';

const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const count=(value:unknown):value is number=>positive(value)&&Number.isSafeInteger(value);

export function ChatGenerationFooter({connection,provider,account,sessionId,job}:{
  connection:Connection;provider:'claude'|'codex'|'copilot';account?:string;sessionId?:string;job:JobView|null|undefined;
}){
  const ru=useLanguage()==='ru',locale=ru?'ru':'en';
  const [record,setRecord]=useState<GenerationMetrics>();
  const matches=job&&(job.provider||'claude')===provider&&(!job.sessionId||!sessionId||job.sessionId===sessionId||sessionId==='pending-'+job.id);
  const live=matches?job.generation:undefined,running=Boolean(matches&&job.status==='running');
  useEffect(()=>{
    setRecord(undefined);
    if(running||live||!sessionId||sessionId.startsWith('pending-')||connection.workspaceId)return;
    let active=true;
    const query=new URLSearchParams({provider,...(account?{account}:{})});
    void request<{generation?:GenerationMetrics}>(connection,'/sessions/'+encodeURIComponent(sessionId)+'/generation?'+query)
      .then(reply=>{if(active)setRecord(reply?.generation);}).catch(()=>{});
    return()=>{active=false;};
  },[connection,provider,account,sessionId,Boolean(live),running]);
  const metrics=live??(!running?record:undefined);
  if(!metrics)return null;
  const {outputTokens,outputTokensPerSecond,totalTokens,contextTokens,contextWindow}=metrics;
  const percentage=typeof contextTokens==='number'&&Number.isSafeInteger(contextTokens)&&contextTokens>=0&&count(contextWindow)?contextTokens/contextWindow*100:undefined;
  if(!count(outputTokens)&&!positive(outputTokensPerSecond)&&!count(totalTokens)&&percentage===undefined)return null;
  const full=(n:number)=>n.toLocaleString(locale);
  const short=(n:number)=>n>=10000?n.toLocaleString(locale,{notation:'compact',maximumFractionDigits:1}):full(n);
  const rate=positive(outputTokensPerSecond)?(outputTokensPerSecond<.01?'<'+(.01).toLocaleString(locale):outputTokensPerSecond.toLocaleString(locale,{maximumFractionDigits:outputTokensPerSecond<1?2:1})):'';
  const pct=percentage!==undefined?(percentage>0&&percentage<1?'<1':Math.round(percentage).toLocaleString(locale)):'';
  return <div className="chat-generation-metrics" role="group" aria-label={ru?'Статистика токенов':'Token usage'}>
    {positive(outputTokensPerSecond)&&<span className="chat-generation-rate" title={ru?'Средняя скорость по данным провайдера':'Average generation speed reported for this response'}><Gauge size={13} aria-hidden="true"/><b>{rate} {ru?'токенов/с':'tokens/s'}</b><span>· {running?(ru?'текущий ответ':'current response'):(ru?'последний ответ':'last response')}</span></span>}
    {count(outputTokens)&&<span title={ru?'Выходные токены модели за этот ответ':'Model output tokens for this response'}>{ru?'Сгенерировано':'Generated'} <b>{full(outputTokens)}</b></span>}
    {count(totalTokens)&&<span title={(ru?'Всего токенов за чат':'Total tokens for the conversation')+' · '+full(totalTokens)}>{ru?'Всего токенов':'Total tokens'} <b>{short(totalTokens)}</b></span>}
    {percentage!==undefined&&<span title={full(contextTokens!)+' / '+full(contextWindow!)+(ru?' токенов':' tokens')}><b>{pct}%</b> {ru?'контекста':'context'}</span>}
  </div>;
}
