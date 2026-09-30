import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Circle,LoaderCircle,RefreshCw,TriangleAlert,X} from 'lucide-react';
import {request,type Connection} from './api';
import {useModal} from './navigation';
import {t,useLanguage} from './i18n';
import {Message} from './Messages';
import {agentLabel as label} from './subagent-labels';
import type {ChatMessage,SubagentView} from '../server/types';
export type {SubagentView} from '../server/types';
import './subagents.css';

type Props={connection:Connection;provider:'claude'|'codex';parentId:string;onClose:()=>void;initialAgentId?:string;initialAgent?:SubagentView};
const states=new Set(['running','completed','error','stopped','unknown']);
function status(agent:SubagentView){return states.has(agent.status)?agent.status:'unknown';}
function State({agent}:{agent:SubagentView}){
  const value=status(agent),Icon=value==='running'?LoaderCircle:value==='completed'?Check:value==='error'?TriangleAlert:Circle;
  return <span className={'subagent-status '+value}><Icon size={14} aria-hidden="true"/>{label(value)}</span>;
}

/** Remount request state when its authenticated parent changes; never show another chat's children. */
export function Subagents(props:Props){return <SubagentsPanel key={[props.connection.url,props.connection.token,props.provider,props.parentId].join('|')} {...props}/>;}
function SubagentsPanel({connection,provider,parentId,onClose,initialAgentId,initialAgent}:Props){
  useLanguage();
  const [agents,setAgents]=useState<SubagentView[]>(initialAgent?[initialAgent]:[]);
  const [selected,setSelected]=useState(initialAgentId||initialAgent?.id||'');
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [messageAgentId,setMessageAgentId]=useState('');
  const [listBusy,setListBusy]=useState(true),[historyBusy,setHistoryBusy]=useState(false);
  const [listError,setListError]=useState(''),[historyError,setHistoryError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const panel=useRef<HTMLElement|null>(null),content=useRef<HTMLDivElement|null>(null),backButton=useRef<HTMLButtonElement|null>(null);
  const listScroll=useRef(0),firstSelection=useRef(true);
  useModal(panel,true,()=>selected?setSelected(''):onClose());
  const base=`/sessions/${encodeURIComponent(parentId)}/subagents`,query=`?provider=${provider}`;
  const agent=agents.find(item=>item.id===selected)||(initialAgent?.id===selected?initialAgent:undefined);
  const visibleMessages=messageAgentId===selected?messages:[];
  const visibleHistoryError=messageAgentId===selected?historyError:'';
  const loadingHistory=messageAgentId!==selected||historyBusy;

  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined;setListBusy(true);
    const poll=async()=>{
      try{
        const value=await request<{agents:SubagentView[]}>(connection,base+query);
        if(active){
          const next=Array.isArray(value.agents)?value.agents.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'):[];
          setAgents(initialAgent?next.some(item=>item.id===initialAgent.id)?next.map(item=>item.id===initialAgent.id?{...initialAgent,...item}:item):[...next,initialAgent]:next);setListError('');
        }
      }catch(error){if(active)setListError((error as Error).message);}
      finally{if(active){setListBusy(false);timer=setTimeout(poll,4000);}}
    };
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[connection,base,query,refresh,initialAgent]);

  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>|undefined;setMessages([]);setHistoryError('');setMessageAgentId(selected);
    if(!selected){setHistoryBusy(false);return;}
    setHistoryBusy(true);
    const poll=async()=>{
      try{
        const value=await request<{messages:ChatMessage[]}>(connection,`${base}/${encodeURIComponent(selected)}/messages${query}`);
        if(active){setMessages(Array.isArray(value.messages)?value.messages.filter(message=>message&&Array.isArray(message.blocks)):[]);setHistoryError('');}
      }catch(error){if(active)setHistoryError((error as Error).message);}
      finally{if(active){setHistoryBusy(false);timer=setTimeout(poll,4000);}}
    };
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[connection,base,query,selected,refresh]);

  useEffect(()=>{
    if(content.current)content.current.scrollTop=selected?0:listScroll.current;
    if(!firstSelection.current)backButton.current?.focus({preventScroll:true});
    firstSelection.current=false;
  },[selected]);
  const choose=(id:string)=>{listScroll.current=content.current?.scrollTop||0;setSelected(id);};
  return <aside ref={panel} className="subagents-panel" role="dialog" aria-modal="true" aria-label={label('agents')}>
    <header className="subagents-header"><h2>{label('agents')} <span>{agents.length||''}</span></h2><button className="icon-button" aria-label={label('close')} onClick={onClose}><X size={20}/></button></header>
    <div className="subagents-toolbar">
      {selected?<button ref={backButton} className="subagent-back" onClick={()=>setSelected('')}><ArrowLeft size={18}/>{label('back')}</button>:<p>{label('note')}</p>}
      <button className="icon-button" aria-label={label('refresh')} disabled={listBusy||historyBusy} onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={18}/></button>
    </div>
    <div className="subagents-scroll" ref={content}>
      {listError&&<Failure text={label('listError')} error={listError}/>}
      {!selected?<>
        {listBusy&&!agents.length&&<p role="status">{label('loading')}</p>}
        {!listBusy&&!agents.length&&!listError&&<p className="subagents-empty">{label('empty')}</p>}
        <ul className="subagent-list">{agents.map(item=><li key={item.id}><button className="subagent-row" onClick={()=>choose(item.id)}><span><strong>{item.name}</strong><State agent={item}/>{item.prompt&&<small>{item.prompt}</small>}</span><ChevronRight size={18} aria-hidden="true"/></button></li>)}</ul>
      </>:<section className="subagent-detail">
        {agent&&agent.name.length>110?<details className="subagent-full-name"><summary><h3>{agent.name.slice(0,110)}…</h3></summary><p>{agent.name}</p></details>:<h3>{agent?.name||label('agents')}</h3>}{agent&&<State agent={agent}/>}
        {visibleHistoryError&&<Failure text={label('historyError')} error={visibleHistoryError}/>}
        {agent?.prompt&&<details className="subagent-context" open={!visibleMessages.length}><summary>{label('task')}</summary><p>{agent.prompt}</p></details>}
        {agent?.result&&<details className="subagent-context" open={!visibleMessages.length}><summary>{label('result')}</summary><Message message={{id:`${agent.id}-result`,role:'assistant',blocks:[{type:'text',text:agent.result}]}} provider={provider}/></details>}
        {loadingHistory&&!visibleMessages.length&&<p role="status">{label('historyLoading')}</p>}
        {!loadingHistory&&!visibleMessages.length&&!visibleHistoryError&&<p className="subagents-empty">{label('noHistory')}</p>}
        {!!visibleMessages.length&&<div className="subagent-messages" aria-label={label('messages')}>{visibleMessages.map(message=><Message key={message.id} message={message} provider={provider}/>)}</div>}
      </section>}
    </div>
  </aside>;
}
function Failure({text,error}:{text:string;error:string}){return <div className="subagents-error" role="status"><p>{text}</p><details><summary>{label('details')}</summary><p>{t(error)}</p></details></div>;}
