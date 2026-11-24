import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {MessageSquare,Plus,X} from 'lucide-react';
import {useBackAction} from './navigation';
import {useLanguage} from './i18n';
import {MarkdownChainPanel,type MarkdownChainControls} from './MarkdownChainPanel';
import {ChainEditorDialog} from './ChainEditorDialog';
import type {ImproveScope} from './ImproveTaskText';
import type {MarkdownChainDetail} from './markdown-chain';
import './tasks-page.css';

type Props={
  controls?:MarkdownChainControls;
  improveScope?:ImproveScope;
  scopePicker?:ReactNode;
  unavailable?:string;
  initialId?:string;
  onPrepareDraft?(prompt:string):void;
  maxDraftLength?:number;
};

export function TasksPage({controls,improveScope,scopePicker,unavailable,initialId,onPrepareDraft,maxDraftLength=1024*1024}:Props){
  const ru=useLanguage()==='ru',title=ru?'Задачи':'Tasks';
  const [create,setCreate]=useState<'steps'>();
  const [started,setStarted]=useState<MarkdownChainDetail>();
  const [chat,setChat]=useState<MarkdownChainDetail['steps'][number]>();
  const [chatActions,setChatActions]=useState<HTMLDivElement|null>(null);
  const drawerId=useId();
  const trigger=useRef<HTMLButtonElement>(null),dismiss=useRef<HTMLButtonElement>(null);
  useLayoutEffect(()=>{if(chat)dismiss.current?.focus({preventScroll:true});},[chat]);
  function closeChat(){
    setChat(undefined);
    requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));
  }
  useBackAction(()=>{closeChat();return true;},55,!!chat);
  const available=Boolean(controls)&&controls?.canStart!==false;
  function close(){setCreate(undefined);}
  function launched(chain:MarkdownChainDetail){close();setChat(undefined);setStarted(chain);}
  return <div className="tasks-workspace" data-chat-open={!!chat||undefined}><section className="tasks-page" aria-label={title}>
    <div className="tasks-page-inner">
      <header className="tasks-page-header">
        <h1>{title}</h1>
        {/* Only the step-by-step editor creates a task: each step is an instruction and a model, run as a chain. */}
        <div className="tasks-page-actions">
          <button type="button" className="primary" disabled={!available} onClick={()=>setCreate('steps')}><Plus aria-hidden="true" size={17}/>{ru?'Создать задачу':'Create Task'}</button>
        </div>
      </header>
      {scopePicker&&<div className="tasks-page-scope">{scopePicker}</div>}
      {unavailable&&<p role="status">{unavailable}</p>}
      {controls&&<MarkdownChainPanel key={started?.id||initialId||'index'} controls={controls} initial={started} initialId={initialId}
        drawerId={drawerId} openSession={chat?.sessionId} openJob={chat?.jobId}
        onBrowse={()=>setChat(undefined)} onChat={(step,button)=>{trigger.current=button;setChat(step);}}/>}
    </div>
    {create==='steps'&&controls&&<ChainEditorDialog controls={controls} improveScope={improveScope} onClose={close} onStarted={launched}/>}
  </section>
    {chat&&controls&&<aside id={drawerId} className="task-chat-drawer" aria-label={ru?'Чат задачи':'Task chat'}>
      <header><MessageSquare size={16} aria-hidden="true"/><strong>{chat.title}</strong><div className="task-chat-actions" ref={setChatActions}/>
        <button className="icon-button" type="button" ref={dismiss} aria-label={ru?'Закрыть чат задачи':'Close task chat'} onClick={closeChat}><X size={18}/></button>
      </header>
      {chatActions&&controls.renderChat(chat,closeChat,chatActions)}
    </aside>}
  </div>;
}
