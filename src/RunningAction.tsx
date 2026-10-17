import {useEffect,useState} from 'react';
import type {JobView} from '../server/types';
import {useLanguage} from './i18n';
import {toolActivity} from './tool-activity';
import './running-action.css';

/** m:ss (or h:mm:ss) with tabular digits, so "slow" is distinguishable from "stuck". */
export function elapsed(ms:number){const total=Math.max(0,Math.floor(ms/1000)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=String(total%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`;}
export function RunningAction({job}:{job:JobView}){
 const ru=useLanguage()==='ru',[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 let label=ru?'Обдумывает ответ':'Thinking';
 if(job.approvals.length)label=ru?'Ждёт вашего ответа':'Waiting for your answer';
 else if(job.partial)label=ru?'Пишет ответ':'Writing a response';
 else {
  const blocks=job.messages.flatMap(message=>message.blocks);
  const last=blocks.reverse().find(block=>['tool_use','codexItem','subagent','thinking','text'].includes(block.type));
  if(last?.type==='subagent')label=last.agent?.name|| (ru?'Запускает субагента':'Running a subagent');
  else if(last?.type==='text')label=ru?'Готовит следующий шаг':'Preparing the next step';
  else if(last&&['tool_use','codexItem'].includes(last.type)){
   const activity=toolActivity(last,undefined,true);
   label=activity.command||(last.type==='tool_use'&&last.name?activity.title:(activity.kind==='edit'?(ru?'Изменяет файлы':'Editing files'):(ru?'Выполняет действие':'Running an action')));
  }
 }
 return <div className="running-action"><span role="status" className={job.approvals.length?'':'action-shimmer'} title={label}>{label}</span><time className="running-action-time" aria-hidden="true">{elapsed(now-job.startedAt)}</time></div>;
}
