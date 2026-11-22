import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronDown,FileUp,MessageSquare,Plus,Sparkles,X} from 'lucide-react';
import {useBackAction} from './navigation';
import {useLanguage} from './i18n';
import {MarkdownChainPanel,type MarkdownChainControls} from './MarkdownChainPanel';
import {ChainPlannerDialog} from './ChainPlannerDialog';
import {MarkdownTaskDialog,type MarkdownSelection} from './MarkdownTaskDialog';
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
  const [create,setCreate]=useState<'manual'|'import'|'ai'>();
  const [imported,setImported]=useState<{selection:MarkdownSelection;parallel:boolean}>();
  const [started,setStarted]=useState<MarkdownChainDetail>();
  const [chainOptions,setChainOptions]=useState(false);
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
  function close(){setCreate(undefined);setImported(undefined);}
  function launched(chain:MarkdownChainDetail){close();setChat(undefined);setChainOptions(false);setStarted(chain);}
  return <div className="tasks-workspace" data-chat-open={!!chat||undefined}><section className="tasks-page" aria-label={title}>
    <div className="tasks-page-inner">
      <header className="tasks-page-header">
        <h1>{title}</h1>
        <div className="tasks-page-actions">
          <button type="button" className="primary" disabled={!available} onClick={()=>{setChainOptions(false);setCreate('manual');}}><Plus aria-hidden="true" size={17}/>{ru?'Создать задачу':'Create task'}</button>
          <button type="button" className="text-button" disabled={!available} aria-expanded={chainOptions} onClick={()=>setChainOptions(open=>!open)}>{ru?'Создать цепочку':'Create chain'}<ChevronDown size={14} aria-hidden="true"/></button>
        </div>
      </header>
      {chainOptions&&<div className="tasks-chain-options tasks-page-actions" role="group" aria-label={ru?'Создать цепочку':'Create chain'}>
        <button type="button" className="secondary" disabled={!available} onClick={()=>setCreate('import')}><FileUp aria-hidden="true" size={16}/>{ru?'Импорт Markdown':'Import Markdown'}</button>
        {improveScope&&<button type="button" className="secondary" disabled={!available} onClick={()=>setCreate('ai')}><Sparkles aria-hidden="true" size={16}/>{ru?'Спланировать с ИИ':'Plan with AI'}</button>}
      </div>}
      {scopePicker&&<div className="tasks-page-scope">{scopePicker}</div>}
      {unavailable&&<p role="status">{unavailable}</p>}
      {controls&&<MarkdownChainPanel key={started?.id||initialId||'index'} controls={controls} initial={started} initialId={initialId}
        drawerId={drawerId} openSession={chat?.sessionId} openJob={chat?.jobId}
        onBrowse={()=>setChat(undefined)} onChat={(step,button)=>{trigger.current=button;setChat(step);}}/>}
    </div>
    {create==='ai'&&controls&&improveScope&&<ChainPlannerDialog controls={controls} improveScope={improveScope}
      initialFiles={imported?.selection.main?[imported.selection.main,...imported.selection.children]:undefined}
      initialParallelSubtasks={imported?.parallel} onClose={()=>{if(imported)setCreate('import');else close();}} onStarted={launched}/>}
    {create&&create!=='ai'&&controls&&<MarkdownTaskDialog manual={create==='manual'} maxLength={maxDraftLength} improveScope={improveScope}
      controls={controls} initialSelection={imported?.selection} initialParallelSubtasks={imported?.parallel}
      onPlan={improveScope?(selection,parallel)=>{setImported({selection,parallel});setCreate('ai');}:undefined}
      onClose={close} onPrepare={onPrepareDraft?prompt=>{close();onPrepareDraft(prompt);}:undefined} onStarted={launched}/>}
  </section>
    {chat&&controls&&<aside id={drawerId} className="task-chat-drawer" aria-label={ru?'Чат задачи':'Task chat'}>
      <header><MessageSquare size={16} aria-hidden="true"/><strong>{chat.title}</strong><div className="task-chat-actions" ref={setChatActions}/>
        <button className="icon-button" type="button" ref={dismiss} aria-label={ru?'Закрыть чат задачи':'Close task chat'} onClick={closeChat}><X size={18}/></button>
      </header>
      {chatActions&&controls.renderChat(chat,closeChat,chatActions)}
    </aside>}
  </div>;
}
