import type {JobView} from '../server/types';
import {useLanguage} from './i18n';
import {toolActivity} from './tool-activity';
import './running-action.css';

export function RunningAction({job}:{job:JobView}){
 const ru=useLanguage()==='ru';
 let label=ru?'Обдумывает ответ':'Thinking';
 if(job.approvals.length)label=ru?'Ждёт вашего ответа':'Waiting for your answer';
 else if(job.partial)label=ru?'Пишет ответ':'Writing a response';
 else {
  const blocks=job.messages.flatMap(message=>message.blocks);
  const last=blocks.reverse().find(block=>['tool_use','codexItem','subagent','thinking','text'].includes(block.type));
  if(last?.type==='subagent')label=last.agent?.name|| (ru?'Запускает субагента':'Running a subagent');
  else if(last?.type==='text')label=ru?'Готовит следующий шаг':'Preparing the next step';
  else if(last&&['tool_use','codexItem'].includes(last.type)){
   const input=last.input as Record<string,unknown>|undefined;
   const command=typeof input?.command==='string'?input.command:typeof input?.cmd==='string'?input.cmd:'';
   const kind=toolActivity(last).kind;
   label=command||last.name||(kind==='edit'?(ru?'Изменяет файлы':'Editing files'):(ru?'Выполняет действие':'Running an action'));
  }
 }
 return <div className="running-action" role="status"><span className={job.approvals.length?'':'action-shimmer'} title={label}>{label}</span></div>;
}
