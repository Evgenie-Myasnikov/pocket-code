import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowUpRight,Check,ChevronRight,FileText,ListOrdered,MessageSquare} from 'lucide-react';
import {useLanguage} from './i18n';
import {useBackAction,useModal} from './navigation';
import {buildChainStepPrompt,type MarkdownChainDetail,type MarkdownChainSummary} from './markdown-chain';
import './markdown-chain-panel.css';

export type MarkdownChainControls = {
  cwd:string;
  canStart?:boolean;
  list():Promise<MarkdownChainSummary[]>;
  detail(id:string):Promise<MarkdownChainDetail>;
  start(input:{id:string;name:string;context:string;tasks:{title:string;source:string;body:string}[]}):Promise<MarkdownChainDetail>;
  stop(id:string):Promise<MarkdownChainDetail>;
  audit?(id:string):Promise<{diff:string}>;
  remove?(id:string):Promise<void>;
  openChat(step:MarkdownChainDetail['steps'][number]):void;
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

export function MarkdownChainPanel({controls,initial,initialId}:{
  controls:MarkdownChainControls;initial?:MarkdownChainDetail;initialId?:string;
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
  const [confirmDelete,setConfirmDelete]=useState(false),[deleting,setDeleting]=useState(false);
  const confirmRoot=useRef<HTMLElement>(null),deleteLock=useRef(false);
  const view=useRef(0),stopLock=useRef(false);
  useLayoutEffect(()=>{view.current++;return ()=>{view.current++;};},[id]);
  function browse(next?:string){
    select(next);setDetail(undefined);setExpanded(null);setError('');setStopError('');setStopping(false);
    setConfirmDelete(false);setDeleting(false);
    if(!next)setSummaries(undefined);
  }
  useModal(confirmRoot,confirmDelete,()=>{if(!deleting)setConfirmDelete(false);});
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
  async function remove(){
    if(!detail||detail.status==='running'||!controls.remove||deleteLock.current)return;
    deleteLock.current=true;setDeleting(true);setStopError('');
    const before=view.current;
    try{
      await controls.remove(detail.id);
      if(view.current===before)browse();
    }catch(e){
      if(view.current===before){setConfirmDelete(false);setStopError(e instanceof Error?e.message:String(e));}
    }finally{deleteLock.current=false;if(view.current===before)setDeleting(false);}
  }
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
  const showProgress=!!detail&&detail.steps.length>0;
  const executionProvider=detail&&[providerNames[detail.provider],detail.account&&(detail.accountName||(ru?'API-подключение':'API connection'))].filter(Boolean).join(' · ');
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
          <ListOrdered size={19} aria-hidden="true"/><strong>{chain.name}</strong><span className="chain-state">{statusLabel(chain.status,ru)}</span><small>{chain.stepsDone} / {chain.stepCount}</small><ChevronRight size={16} aria-hidden="true"/>
        </button>)}
        {summaries?.length===0&&<div className="chain-empty"><ListOrdered size={24} aria-hidden="true"/><p>{ru?'В этом проекте пока нет цепочек.':'No task chains in this project yet.'}</p></div>}
      </div>}
      {(!id&&!summaries||id&&!detail)&&!error&&<p role="status">{ru?'Загрузка…':'Loading…'}</p>}
      {detail&&<>
        {detail.status!=='running'&&<p className="chain-outcome">{statusLabel(detail.status,ru)}</p>}
        {detail.status==='done'&&detail.steps[0]?.baseCommit&&detail.steps.at(-1)?.headCommit&&<details><summary>{ru?'Финальный аудит и слияние':'Final review and merge'}</summary>{controls.audit&&<button type="button" onClick={async()=>{try{const result=await controls.audit!(detail.id);setAudit({id:detail.id,text:result.diff||(ru?'Без изменений':'No changes')});}catch(e){setError(String(e));}}}>{ru?'Показать общий diff':'Show cumulative diff'}</button>}{audit?.id===detail.id&&<pre tabIndex={0}>{audit.text}</pre>}<p>{ru?'В целевой ветке проверьте общий diff, затем выполните одно слияние.':'In the target branch, review the cumulative diff, then merge once.'}</p><pre>{'git diff '+detail.steps[0].baseCommit+' '+detail.steps.at(-1)?.headCommit+'\ngit merge --no-ff '+detail.steps.at(-1)?.headCommit}</pre></details>}
        {activeIndex>=3&&<button type="button" className="chain-jump text-button" onClick={()=>{currentStep.current?.scrollIntoView({block:'center'});currentStep.current?.focus({preventScroll:true});}}>{ru?'К текущему шагу':'Go to current step'} · {activeIndex+1}</button>}
        <ol className="chain-steps">{detail.steps.map((step,i)=>{
          const isActive=activeIndex===i;
          const output=step.output||step.handoff;
          const outputBody=<>
            {step.outputTruncated&&<small>{ru?'Показана последняя часть ответа':'Showing the end of the response'}</small>}
            <pre tabIndex={0}>{output}</pre>
          </>;
          return <li key={i} data-status={step.status} aria-current={isActive?'step':undefined} ref={isActive?currentStep:undefined} tabIndex={isActive?-1:undefined}>
          <div className="chain-node" aria-hidden="true">{step.status==='done'?<Check size={15}/>:i+1}</div>
          <div className="chain-step">
            <div className="chain-step-heading"><h3>{step.title}</h3><span className="chain-state">{step.retryAt ? (ru ? 'Ожидает повтора' : 'Retry scheduled') : statusLabel(step.status,ru)}{step.retryCount ? ` · ${ru ? 'Попытка' : 'Attempt'} ${step.retryCount + 1}` : ''}</span></div>
            {step.branch&&<small>{step.branch}</small>}
            {step.error&&<p className="chain-step-error">{step.error}</p>}
            {isActive&&<div className="task-live-response">
              <div className="task-phase"><strong>{executionProvider}</strong>
                {step.phase&&phases[step.phase]&&<span>{phases[step.phase][ru?0:1]}</span>}</div>
              {output&&outputBody}
            </div>}
            {!isActive&&output&&<details className="task-step-result"><summary><ChevronRight aria-hidden="true" size={14}/>{ru?'Результат':'Result'}</summary>{outputBody}</details>}
            <div className="chain-links">
              <button type="button" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)}><ChevronRight className={expanded===i?'chain-chevron-open':''} size={14}/>{ru?'Контекст шага':'Step context'}</button>
              {(step.sessionId||step.jobId)&&<button type="button" onClick={()=>controls.openChat(step)}><MessageSquare size={14}/>{ru?'Открыть чат':'Open chat'}<ArrowUpRight size={12}/></button>}
            </div>
            {expanded===i&&<div className="chain-context">
              <div className="chain-source"><FileText aria-hidden="true" size={14}/>{step.source}</div>
              <dl className="chain-run-settings">
                <dt>{ru?'Провайдер':'Provider'}</dt><dd>{executionProvider}</dd>
                {detail.model&&<><dt>{ru?'Модель запуска':'Requested model'}</dt><dd>{detail.model}</dd></>}
              </dl>
              <h4>{ru?'Общий контекст':'Shared context'}</h4><pre>{detail.context}</pre>
              {i>0&&detail.steps[i-1].handoff&&<><h4>{ru?'Из предыдущего чата':'From the previous chat'}</h4><pre>{detail.steps[i-1].handoff}</pre></>}
              <h4>{ru?'Задание':'Task'}</h4><pre>{step.body}</pre>
              {step.handoff&&<><h4>{ru?'Результат для следующего шага':'Handoff to the next step'}</h4><pre>{step.handoff}</pre></>}
              <details><summary><ChevronRight aria-hidden="true" size={14}/>{ru?'Полный запрос':'Full prompt'}</summary><pre>{buildChainStepPrompt(detail,i)}</pre></details>
            </div>}
          </div>
        </li>;})}</ol>
        {stopError&&<p role="alert" className="error-banner">{stopError}</p>}
        {detail.status==='running'&&<footer><button type="button" className="secondary" disabled={stopping} onClick={()=>void stop()}>{ru?'Остановить цепочку':'Stop chain'}</button></footer>}
        {detail.status!=='running'&&controls.remove&&<footer><button type="button" className="secondary" onClick={()=>setConfirmDelete(true)}>{ru?'Удалить цепочку':'Delete chain'}</button></footer>}
      </>}
      {confirmDelete&&detail&&createPortal(<div className="modal-backdrop"><section ref={confirmRoot} className="confirm-modal tasks-delete-dialog" role="alertdialog" aria-modal="true" aria-label={ru?'Удалить цепочку':'Delete chain'}>
        <h2>{ru?'Удалить цепочку?':'Delete this chain?'}</h2>
        <p>{ru?'История шагов и сохранённые результаты цепочки «'+detail.name+'» будут удалены. Связанные чаты останутся в списке чатов.':'The step history and saved results for “'+detail.name+'” will be deleted. The linked conversations will stay in Chats.'}</p>
        <button className="secondary" type="button" disabled={deleting} onClick={()=>setConfirmDelete(false)}>{ru?'Отмена':'Cancel'}</button>
        <button className="primary" type="button" disabled={deleting} onClick={()=>void remove()}>{ru?'Удалить':'Delete'}</button>
      </section></div>,document.body)}
    </section>;
}
