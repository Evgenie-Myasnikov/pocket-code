import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {BoardMcpStatus as Status} from '../server/board-mcp-runtime';
export function BoardMcpStatus({connection,root}:{connection:Connection;root:string}){
 const ru=useLanguage()==='ru',[status,setStatus]=useState<Status|null>(null),[error,setError]=useState(false);
 useEffect(()=>{let stopped=false,busy=false;setStatus(null);setError(false);const poll=async()=>{if(stopped||busy||document.visibilityState==='hidden')return;busy=true;try{const value=await request<Status>(connection,'/project-board/mcp/status?'+new URLSearchParams({root}));if(!value||!['waiting','ready','restarting','error'].includes(value.state))throw Error();if(!stopped){setStatus(value);setError(false);}}catch{if(!stopped)setError(true);}finally{busy=false;}};void poll();const timer=setInterval(()=>void poll(),2000);return()=>{stopped=true;clearInterval(timer);};},[connection.url,connection.token,root]);
 const state=error?'error':status?.state||'waiting',labels=ru?{waiting:'Ожидает агента',ready:'Подключён',restarting:'Обновляется',error:'Нет подключения'}:{waiting:'Waiting for agent',ready:'Connected',restarting:'Refreshing',error:'Unavailable'};
 const detail=state==='ready'?(ru?'Каталог сервера: ':'Server catalog: ')+status!.tools.length+(ru?' команд. ':' tools. ')+(ru?'Управление доской готово.':'Board control ready.'):state==='waiting'?(ru?'Подключение появится при запуске или возобновлении чата доски.':'The connection starts with a new or resumed board chat.'):state==='restarting'?(ru?'Текущая операция завершается перед обновлением.':'Finishing the active operation before refreshing.'):(ru?'Не удалось получить готовое подключение MCP.':'Could not obtain a ready MCP connection.');
 return <span className="board-mcp-state" data-state={state} role="status" title={detail} aria-label={'MCP: '+labels[state]+'. '+detail}><i aria-hidden="true"/>MCP</span>;
}
