import {useEffect,useState} from 'react';
import {Gauge,MemoryStick} from 'lucide-react';
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
    // The saved record of the last finished turn is read also while a turn runs: until the provider reports the
    // current turn, the line keeps the chat's total and the last reply's speed instead of dropping them.
    if(!sessionId||sessionId.startsWith('pending-')||connection.workspaceId)return;
    let active=true;
    const query=new URLSearchParams({provider,...(account?{account}:{})});
    void request<{generation?:GenerationMetrics}>(connection,'/sessions/'+encodeURIComponent(sessionId)+'/generation?'+query)
      .then(reply=>{if(active)setRecord(reply?.generation);}).catch(()=>{});
    return()=>{active=false;};
  },[connection,provider,account,sessionId,running]);
  const metrics=live||record?{...record,...live}:undefined;
  // A live context count with no known window must not borrow the last turn's window.
  if(metrics&&live?.contextTokens!==undefined&&live.contextWindow===undefined)delete metrics.contextWindow;
  // "current reply" only for a speed the provider reported for this turn; a carried one belongs to the last reply.
  const liveRate=Boolean(live&&positive(live.outputTokensPerSecond));
  if(!metrics)return null;
  const {outputTokens,outputTokensPerSecond,totalTokens,contextTokens,contextWindow}=metrics;
  const percentage=typeof contextTokens==='number'&&Number.isSafeInteger(contextTokens)&&contextTokens>=0&&count(contextWindow)?contextTokens/contextWindow*100:undefined;
  if(!count(outputTokens)&&!positive(outputTokensPerSecond)&&!count(totalTokens)&&percentage===undefined)return null;
  const full=(n:number)=>n.toLocaleString(locale);
  const short=(n:number)=>n>=10000?n.toLocaleString(locale,{notation:'compact',maximumFractionDigits:1}):full(n);
  const rate=positive(outputTokensPerSecond)?(outputTokensPerSecond<.01?'<'+(.01).toLocaleString(locale):outputTokensPerSecond.toLocaleString(locale,{maximumFractionDigits:outputTokensPerSecond<1?2:1})):'';
  const pct=percentage!==undefined?(percentage>0&&percentage<1?'<1':Math.round(percentage).toLocaleString(locale)):'';
  // As in Strata: an icon, the number in bold and a quiet word, centred under the message field.
  const ring=percentage!==undefined?Math.min(100,Math.max(0,percentage)):0;
  return <div className="chat-generation-metrics" role="group" aria-label={ru?'Статистика токенов':'Token usage'}>
    {positive(outputTokensPerSecond)&&<span className="chat-generation-rate" title={ru?'Средняя скорость по данным провайдера':'Average generation speed reported for this response'}><Gauge size={15} aria-hidden="true"/><b>{rate}</b><span>{ru?'ток/с':'tok/s'} · {running&&liveRate?(ru?'текущий ответ':'current reply'):(ru?'последний ответ':'last reply')}</span></span>}
    {count(totalTokens)&&<span title={(ru?'Всего токенов за чат':'Total tokens for the conversation')+' · '+full(totalTokens)}><MemoryStick size={15} aria-hidden="true"/><b>{short(totalTokens)}</b><span>{ru?'всего токенов':'total tokens'}</span></span>}
    {percentage!==undefined&&<span title={full(contextTokens!)+' / '+full(contextWindow!)+(ru?' токенов':' tokens')}><svg className="chat-generation-ring" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2"/><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${ring/100*40.84} 40.84`} transform="rotate(-90 8 8)" strokeLinecap="round"/></svg><b>{pct}</b><span>{ru?'% контекста':'% of context'}</span></span>}
  </div>;
}
