import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,Check,ChevronRight,FileText,Folder,GitBranch,MessageSquare,X} from 'lucide-react';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {buildChainStepPrompt,type MarkdownChainDetail,type MarkdownChainSummary} from './markdown-chain';
import './markdown-chain-panel.css';

export type MarkdownChainControls = {
  cwd:string;
  canStart?:boolean;
  list():Promise<MarkdownChainSummary[]>;
  detail(id:string):Promise<MarkdownChainDetail>;
  start(input:{id:string;name:string;context:string;tasks:{title:string;source:string;body:string}[]}):Promise<MarkdownChainDetail>;
  stop(id:string):Promise<MarkdownChainDetail>;
  openChat(step:MarkdownChainDetail['steps'][number]):void;
};

const labels={
  running:['В работе','Running'],done:['Готово','Completed'],stopped:['Остановлено','Stopped'],
  pending:['В очереди','Queued'],waiting:['Ждёт ответа','Needs input'],failed:['Ошибка','Failed'],
};
function statusLabel(status:keyof typeof labels,ru:boolean){return labels[status][ru?0:1];}

export function MarkdownChainPanel({controls,initial,initialId,onClose}:{
  controls:MarkdownChainControls;initial?:MarkdownChainDetail;initialId?:string;onClose():void;
}){
  const ru=useLanguage()==='ru',title=ru?'Цепочки задач':'Task chains';
  const modal=useRef<HTMLElement>(null),heading=useId();
  const latest=useRef(controls);
  latest.current=controls;
  const [id,select]=useState(initial?.id||initialId);
  const [detail,setDetail]=useState(initial);
  const [summaries,setSummaries]=useState<MarkdownChainSummary[]>();
  const [expanded,setExpanded]=useState<number|null>(null);
  const [error,setError]=useState(''),[stopError,setStopError]=useState(''),[stopping,setStopping]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const view=useRef(0),stopLock=useRef(false);
  useLayoutEffect(()=>{view.current++;return ()=>{view.current++;};},[id]);
  function browse(next?:string){
    select(next);setDetail(undefined);setExpanded(null);setError('');setStopError('');setStopping(false);
    if(!next)setSummaries(undefined);
  }
  useModal(modal,true,()=>id?browse():onClose());
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
  return createPortal(<div className="modal-backdrop">
    <section className="confirm-modal chain-panel" ref={modal} role="dialog" aria-modal="true" aria-label={title}>
      <header className="chain-head">
        {id?<button type="button" className="chain-back" onClick={()=>browse()}><ArrowLeft size={16}/>{title}</button>
          :<GitBranch aria-hidden="true" size={22}/>}
        <button type="button" className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={onClose}><X size={18}/></button>
      </header>
      <h2 id={heading}>{detail?.name||title}</h2>
      <div className="chain-location"><Folder size={14} aria-hidden="true"/><span>{controls.cwd}</span></div>
      {error&&<p role="alert" className="error-banner">{error}</p>}
      {!id&&<div className="chain-index">{summaries?.map(chain=>
        <button type="button" className="chain-index-row" key={chain.id} onClick={()=>browse(chain.id)}>
          <span><strong>{chain.name}</strong><small>{statusLabel(chain.status,ru)} · {chain.stepsDone} / {chain.stepCount}</small></span><ChevronRight size={18}/>
        </button>)}
        {summaries?.length===0&&<p>{ru?'В этом проекте пока нет цепочек. Откройте «Задачи из Markdown», чтобы запустить первую.':'No task chains in this project yet. Open Markdown tasks to start one.'}</p>}
      </div>}
      {(!id&&!summaries||id&&!detail)&&!error&&<p role="status">{ru?'Загрузка…':'Loading…'}</p>}
      {detail&&<>
        <div className="chain-progress" aria-live="polite">
          <div><strong>{statusLabel(detail.status,ru)}</strong><span>{ru?'Готово':'Completed'} {done} / {detail.steps.length}</span></div>
          <progress value={done} max={detail.steps.length} aria-label={ru?'Выполнено шагов':'Completed steps'}/>
        </div>
        <ol className="chain-steps">{detail.steps.map((step,i)=><li key={i} data-status={step.status}>
          <div className="chain-node" aria-hidden="true">{step.status==='done'?<Check size={15}/>:i+1}</div>
          <div className="chain-step">
            <div className="chain-step-heading"><h3>{step.title}</h3><span className="chain-state">{statusLabel(step.status,ru)}</span></div>
            <div className="chain-source"><FileText aria-hidden="true" size={13}/>{step.source}</div>
            {step.error&&<p className="chain-step-error">{step.error}</p>}
            <div className="chain-links">
              <button type="button" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)}><ChevronRight className={expanded===i?'chain-chevron-open':''} size={14}/>{ru?'Контекст шага':'Step context'}</button>
              {(step.sessionId||step.jobId)&&<button type="button" onClick={()=>{onClose();controls.openChat(step);}}><MessageSquare size={14}/>{ru?'Открыть чат':'Open chat'}<ArrowUpRight size={12}/></button>}
            </div>
            {expanded===i&&<div className="chain-context">
              <h4>{ru?'Общий контекст':'Shared context'}</h4><pre>{detail.context}</pre>
              {i>0&&detail.steps[i-1].handoff&&<><h4>{ru?'Из предыдущего чата':'From the previous chat'}</h4><pre>{detail.steps[i-1].handoff}</pre></>}
              <h4>{ru?'Задание':'Task'}</h4><pre>{step.body}</pre>
              {step.handoff&&<><h4>{ru?'Результат для следующего шага':'Handoff to the next step'}</h4><pre>{step.handoff}</pre></>}
              <details><summary>{ru?'Полный запрос':'Full prompt'}</summary><pre>{buildChainStepPrompt(detail,i)}</pre></details>
            </div>}
          </div>
        </li>)}</ol>
        {stopError&&<p role="alert" className="error-banner">{stopError}</p>}
        {detail.status==='running'&&<footer><button type="button" className="secondary" disabled={stopping} onClick={()=>void stop()}>{ru?'Остановить цепочку':'Stop chain'}</button></footer>}
      </>}
    </section>
  </div>,document.body);
}
