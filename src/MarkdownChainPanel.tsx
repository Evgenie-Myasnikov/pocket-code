import {ChainStepReader} from './ChainStepReader';
import {Disclosure,Markdown} from './RichBlocks';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {ChainDeleteDialog} from './ChainDeleteDialog';
import {ArrowLeft,Check,ChevronRight,ListOrdered,MessageSquare,Repeat} from 'lucide-react';
import {useLanguage} from './i18n';
import {useBackAction} from './navigation';
import {type ChainDeleteChat,type ChainDeletePreview,type ChainSourceInput,type ChainExecutor,type MarkdownChainDetail,type MarkdownChainSummary} from './markdown-chain';
import './markdown-chain-panel.css';

export type MarkdownChainControls = {
  cwd:string;
  canStart?:boolean;
  list():Promise<MarkdownChainSummary[]>;
  detail(id:string):Promise<MarkdownChainDetail>;
  start(input:{id:string;name:string;context:string;parallelSubtasks?:boolean;loop?:{maxLaps:number;until?:string;stopIdle?:boolean};sourceFiles?:ChainSourceInput[];tasks:{title:string;source:string;body:string;executor?:ChainExecutor}[]}):Promise<MarkdownChainDetail>;
  stop(id:string):Promise<MarkdownChainDetail>;
  audit?(id:string):Promise<{diff:string}>;
  previewDeletion?(id:string):Promise<ChainDeletePreview>;
  remove?(id:string,chats?:ChainDeleteChat[]):Promise<({ok:boolean}&ChainDeletePreview)|undefined>;
  renderChat(step:MarkdownChainDetail['steps'][number],close:()=>void,actions:HTMLElement):ReactNode;
};

const labels={
  running:['В работе','Running'],done:['Готово','Completed'],stopped:['Остановлено','Stopped'],
  pending:['В очереди','Queued'],waiting:['Ждёт ответа','Needs input'],failed:['Ошибка','Failed'],
};
const phases={
  responding:['Пишет ответ','Writing a response'],command:['Выполняет команду','Running a command'],
  files:['Работает с файлами','Working with files'],search:['Выполняет поиск','Searching'],
  agent:['Работает с помощником','Working with an agent'],tool:['Использует инструмент','Using a tool'],
  approval:['Ожидает разрешения','Awaiting approval'],question:['Ожидает ответа','Awaiting an answer'],
};
const providerNames={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
function statusLabel(status:keyof typeof labels,ru:boolean){return labels[status][ru?0:1];}
const loopEndings={
  condition:['Цикл остановлен: условие выполнено','Loop stopped: the condition is met'],
  limit:['Цикл остановлен: достигнут предел кругов','Loop stopped: the lap limit is reached'],
  idle:['Цикл остановлен: круг не внёс изменений','Loop stopped: the lap changed nothing'],
};
function lapLabel(loop:{lap:number;maxLaps:number},ru:boolean){return (ru?'Круг ':'Lap ')+loop.lap+(ru?' из ':' of ')+loop.maxLaps;}

export function MarkdownChainPanel({controls,initial,initialId,onChat,onBrowse,drawerId,openSession,openJob}:{
  controls:MarkdownChainControls;initial?:MarkdownChainDetail;initialId?:string;
  drawerId:string;openSession?:string;openJob?:string;
  onChat(step:MarkdownChainDetail['steps'][number],trigger:HTMLButtonElement):void;onBrowse():void;
}){
  const ru=useLanguage()==='ru',title=ru?'Цепочки задач':'Task chains';
  const latest=useRef(controls);
  latest.current=controls;
  const [id,select]=useState(initial?.id||initialId);
  const [detail,setDetail]=useState(initial);
  const [summaries,setSummaries]=useState<MarkdownChainSummary[]>();
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState(''),[stopError,setStopError]=useState(''),[stopping,setStopping]=useState(false);
  const [audit,setAudit]=useState<{id:string;text:string}>();
  const [refresh,setRefresh]=useState(0);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const view=useRef(0),stopLock=useRef(false);
  useLayoutEffect(()=>{view.current++;return ()=>{view.current++;};},[id]);
  function browse(next?:string){
    onBrowse();
    select(next);setDetail(undefined);setExpanded(null);setError('');setStopError('');setStopping(false);
    setConfirmDelete(false);
    if(!next)setSummaries(undefined);
  }
  useBackAction(()=>{browse();return true;},50,!!id&&!confirmDelete);
  // Schedule the next read after this one completes; switching steps or closing the panel discards late replies.
  useEffect(()=>{
    let active=true,timer:ReturnType<typeof setTimeout>;
    async function load(){
      let poll=true;
      try{
        if(id){
          const chain=await latest.current.detail(id);
          if(!active)return;
          setDetail(chain);poll=chain.status==='running';
        }else{
          const list=await latest.current.list();
          if(!active)return;
          setSummaries(list);
        }
        setError('');
      }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
      if(active&&poll)timer=setTimeout(load,2500);
    }
    void load();
    return ()=>{active=false;clearTimeout(timer);};
  },[id,refresh]);
  async function stop(){
    if(!id||stopLock.current)return;
    stopLock.current=true;setStopping(true);setStopError('');
    const before=view.current;
    try{
      const chain=await controls.stop(id);
      if(view.current===before){setDetail(chain);setRefresh(n=>n+1);}
    }catch(e){if(view.current===before)setStopError(e instanceof Error?e.message:String(e));}
    finally{stopLock.current=false;if(view.current===before)setStopping(false);}
  }
  const done=detail?.steps.filter(step=>step.status==='done').length??0;
  const currentStep=useRef<HTMLLIElement>(null);
  const activeIndex=detail?.steps.findIndex(step=>step.status==='running'||step.status==='waiting')??-1;
  const single=detail?.steps.length===1;
  const showProgress=!!detail&&!single;
  return <section className="chain-panel tasks-chain-content" aria-label={title}>
      {id&&<header className="chain-head"><button type="button" className="chain-back" onClick={()=>browse()}><ArrowLeft size={16}/>{title}</button></header>}
      <div className="chain-heading">
        <h2>{detail?.name||title}</h2>
        {showProgress&&<div className="chain-progress" aria-live="polite">
          <span>{ru?'Готово':'Completed'} {done} / {detail.steps.length}</span>
          <progress value={done} max={detail.steps.length} aria-label={ru?'Выполнено шагов':'Completed steps'}/>
        </div>}
      </div>
      {error&&<p role="alert" className="error-banner">{error}</p>}
      {!id&&<div className="chain-index">{summaries?.map(chain=>
        <button type="button" className="chain-index-row" key={chain.id} data-status={chain.status} onClick={()=>browse(chain.id)}>
          <ListOrdered size={19} aria-hidden="true"/><strong>{chain.name}</strong><span className="chain-state">{statusLabel(chain.status,ru)}{chain.loop?' · '+lapLabel(chain.loop,ru):''}</span><small>{chain.stepsDone} / {chain.stepCount}</small><ChevronRight size={16} aria-hidden="true"/>
        </button>)}
        {summaries?.length===0&&<div className="chain-empty"><ListOrdered size={24} aria-hidden="true"/><p>{ru?'В этом проекте пока нет цепочек.':'No task chains in this project yet.'}</p></div>}
      </div>}
      {(!id&&!summaries||id&&!detail)&&!error&&<p role="status">{ru?'Загрузка…':'Loading…'}</p>}
      {detail&&<>
        {detail.loop&&<p className="chain-outcome chain-loop-state"><Repeat size={14} aria-hidden="true"/>{lapLabel(detail.loop,ru)}{detail.loop.until?' · '+(ru?'до: ':'until: ')+detail.loop.until:''}</p>}
        {(!single||detail.loop)&&detail.status!=='running'&&<p className="chain-outcome">{detail.loop?.ended?loopEndings[detail.loop.ended][ru?0:1]:statusLabel(detail.status,ru)}</p>}
        {detail.status==='done'&&(detail.loop?.baseCommit||detail.steps[0]?.baseCommit)&&detail.steps.at(-1)?.headCommit&&<details><summary>{ru?'Финальный аудит и слияние':'Final review and merge'}</summary>{controls.audit&&<button type="button" onClick={async()=>{try{const result=await controls.audit!(detail.id);setAudit({id:detail.id,text:result.diff||(ru?'Без изменений':'No changes')});}catch(e){setError(String(e));}}}>{ru?'Показать общий diff':'Show cumulative diff'}</button>}{audit?.id===detail.id&&<pre tabIndex={0}>{audit.text}</pre>}<p>{ru?'В целевой ветке проверьте общий diff, затем выполните одно слияние.':'In the target branch, review the cumulative diff, then merge once.'}</p><pre>{'git diff '+(detail.loop?.baseCommit||detail.steps[0].baseCommit)+' '+detail.steps.at(-1)?.headCommit+'\ngit merge --no-ff '+detail.steps.at(-1)?.headCommit}</pre></details>}
        {activeIndex>=3&&<button type="button" className="chain-jump text-button" onClick={()=>{currentStep.current?.scrollIntoView({block:'center'});currentStep.current?.focus({preventScroll:true});}}>{ru?'К текущему шагу':'Go to current step'} · {activeIndex+1}</button>}
        <ol className="chain-steps">{detail.steps.map((step,i)=>{
          const isActive=activeIndex===i;
          const executor=step.executor??detail;
          const accountName=step.executor?step.executorAccountName:detail.accountName;
          const executionProvider=[providerNames[executor.provider],executor.account&&(accountName||(ru?'API-подключение':'API connection'))].filter(Boolean).join(' · ');
          const output=step.output||step.handoff;
          const outputBody=<>
            {step.outputTruncated&&<small>{ru?'Показана последняя часть ответа':'Showing the end of the response'}</small>}
            <Markdown text={output||''}/>
          </>;
          return <li key={i} data-status={step.status} aria-current={isActive?'step':undefined} ref={isActive?currentStep:undefined} tabIndex={isActive?-1:undefined}>
          <div className="chain-node" aria-hidden="true">{step.status==='done'?<Check size={15}/>:i+1}</div>
          <div className="chain-step">
            <div className="chain-step-heading">{(!single||step.title!==detail.name)&&<h3>{step.title}</h3>}<span className="chain-state">{step.retryAt ? (ru ? 'Ожидает повтора' : 'Retry scheduled') : statusLabel(step.status,ru)}{step.retryCount ? ` · ${ru ? 'Попытка' : 'Attempt'} ${step.retryCount + 1}` : ''}</span></div>
            {step.executor&&!isActive&&<small>{executionProvider}</small>}
            {Boolean(step.subtasks?.length)&&<details className="chain-subtasks">
              <summary>{ru?'Подзадачи':'Subtasks'} · {step.subtasks!.length}</summary>
              <ul>{step.subtasks!.map(child=><li key={child.id}><span>{child.name}</span><small>{({running:ru?'В работе':'Running',completed:ru?'Готово':'Done',error:ru?'Ошибка':'Error',stopped:ru?'Остановлено':'Stopped',unknown:ru?'Статус неизвестен':'Status unknown'})[child.status]}</small></li>)}</ul>
            </details>}
            {step.error&&<p className="chain-step-error">{step.error}</p>}
            {isActive&&<div className="task-live-response">
              <div className="task-phase"><strong>{executionProvider}</strong>
                {step.phase&&phases[step.phase]&&<span>{phases[step.phase][ru?0:1]}</span>}</div>
              {output&&outputBody}
            </div>}
            {!isActive&&output&&<Disclosure className="task-step-result" summary={<><ChevronRight aria-hidden="true" size={14}/>{ru?'Результат':'Result'}</>}>{()=>outputBody}</Disclosure>}
            <div className="chain-links">
              <button type="button" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)}><ChevronRight className={expanded===i?'chain-chevron-open':''} size={14}/>{ru?'Контекст шага':'Step context'}</button>
              {(step.sessionId||step.jobId)&&<button type="button" aria-controls={openSession||openJob?drawerId:undefined} aria-expanded={!!(step.sessionId&&step.sessionId===openSession||step.jobId&&step.jobId===openJob)} onClick={event=>onChat(step,event.currentTarget)}><MessageSquare size={14}/>{ru?'Открыть чат':'Open chat'}</button>}
            </div>
            {!!step.previousChats?.length&&<details className="chain-subtasks chain-attempts">
              <summary>{ru?'Предыдущие попытки':'Previous attempts'} · {step.previousChats.length}</summary>
              <ul>{step.previousChats.map(chat=><li className="chain-links" key={chat.attempt}>
                <button type="button" aria-controls={openSession||openJob?drawerId:undefined} aria-expanded={chat.sessionId===openSession} onClick={event=>onChat({...step,
                  title:step.title+' · '+(ru?'Попытка ':'Attempt ')+chat.attempt,
                  status:'done',sessionId:chat.sessionId,jobId:undefined,launchCwd:chat.cwd,
                  executor:{provider:chat.provider,account:chat.account},
                },event.currentTarget)}>
                  <MessageSquare size={14}/>{ru?'Попытка':'Attempt'} {chat.attempt} · {providerNames[chat.provider]}
                </button>
              </li>)}</ul>
            </details>}
            {expanded===i&&<ChainStepReader key={i} chain={detail} index={i} provider={executionProvider} model={executor.model} ru={ru}/>}
          </div>
        </li>;})}</ol>
        {stopError&&<p role="alert" className="error-banner">{stopError}</p>}
        {detail.status==='running'&&<footer><button type="button" className="secondary" disabled={stopping} onClick={()=>void stop()}>{single?(ru?'Остановить задачу':'Stop task'):(ru?'Остановить цепочку':'Stop chain')}</button></footer>}
        {detail.status!=='running'&&controls.remove&&<footer><button type="button" className="secondary" onClick={()=>setConfirmDelete(true)}>{detail.steps.length===1?(ru?'Удалить задачу':'Delete task'):(ru?'Удалить цепочку':'Delete chain')}</button></footer>}
      </>}
      {confirmDelete&&detail&&<ChainDeleteDialog chain={detail} controls={controls} ru={ru} onClose={()=>setConfirmDelete(false)} onDeleted={()=>browse()}/>}
    </section>;
}
