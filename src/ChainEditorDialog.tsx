import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,GripVertical,Plus,Repeat,X} from 'lucide-react';
import {request} from './api';
import type {ImproveScope} from './ImproveTaskText';
import type {MarkdownChainControls} from './MarkdownChainPanel';
import {CHAIN_LOOP_MAX_LAPS,type ChainExecutor,type MarkdownChainDetail} from './markdown-chain';
import {descriptionTitle} from './MarkdownTaskEditor';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './markdown-task-dialog.css';
import './setting-rows.css';
import './chain-editor.css';

type Executor=ChainExecutor&{label:string};
type Step={key:string;body:string;executor:string};
type Props={controls:MarkdownChainControls;improveScope?:ImproveScope;onClose():void;onStarted(chain:MarkdownChainDetail):void};
const identity=(x:ChainExecutor)=>JSON.stringify([x.provider,x.account||'',x.model||'']);
const newStep=():Step=>({key:crypto.randomUUID(),body:'',executor:''});
const totalLimit=1024*1024;

/** A chain as a short list of steps: what to do and which model does it. The last step may lead back to the first one. */
export function ChainEditorDialog({controls,improveScope,onClose,onStarted}:Props){
  const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
  const root=useRef<HTMLElement>(null),heading=useId();
  const [steps,setSteps]=useState<Step[]>(()=>[newStep(),newStep()]);
  const [loop,setLoop]=useState(false),[until,setUntil]=useState(''),[laps,setLaps]=useState(3);
  const [executors,setExecutors]=useState<Executor[]>([]),[catalogueError,setCatalogueError]=useState(false);
  const [starting,setStarting]=useState(false),[error,setError]=useState('');
  const live=useRef(true),lock=useRef(false),attempt=useRef<{signature:string;id:string}|null>(null);
  const dragged=useRef<string|null>(null);
  useModal(root,true,()=>{if(!starting)onClose();});
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const connection=improveScope?.connection;
  useEffect(()=>{
    if(!connection)return;
    let active=true;
    request<{executors?:Executor[]}>(connection,'/task-text/plan/providers').then(data=>{
      if(active)setExecutors((Array.isArray(data?.executors)?data.executors:[]).filter(x=>x&&typeof x.label==='string'&&typeof x.provider==='string'));
    }).catch(()=>{if(active)setCatalogueError(true);});
    return()=>{active=false;};
  },[connection?.url,connection?.token,connection?.desktop]);

  const update=(key:string,patch:Partial<Step>)=>setSteps(list=>list.map(step=>step.key===key?{...step,...patch}:step));
  const moveStep=(key:string,offset:number)=>setSteps(list=>{const from=list.findIndex(step=>step.key===key),to=Math.max(0,Math.min(list.length-1,from+offset));if(from<0||from===to)return list;const next=[...list];next.splice(to,0,next.splice(from,1)[0]);return next;});
  const dropStep=(target:string)=>{const source=dragged.current;dragged.current=null;if(!source||source===target)return;setSteps(list=>{const from=list.findIndex(step=>step.key===source),to=list.findIndex(step=>step.key===target);if(from<0||to<0||from===to)return list;const next=[...list];next.splice(to,0,next.splice(from,1)[0]);return next;});};
  const filled=steps.every(step=>step.body.trim());
  const oversized=steps.reduce((size,step)=>size+step.body.length+100,0)>totalLimit;
  const lapCount=Math.max(2,Math.min(CHAIN_LOOP_MAX_LAPS,Math.round(laps)||2));
  const canStart=filled&&!oversized&&!starting&&controls.canStart!==false;
  async function start(){
    if(!canStart||lock.current)return;
    lock.current=true;setStarting(true);setError('');
    const tasks=steps.map(step=>{
      const executor=executors.find(x=>identity(x)===step.executor);
      const {label:_,...assigned}=executor||{label:''};
      return {title:descriptionTitle(step.body),source:'Markdown',body:step.body.trim(),...(executor?{executor:assigned as ChainExecutor}:{})};
    });
    const plan={name:tasks[0].title.slice(0,512),context:'',tasks,
      ...(loop?{loop:{maxLaps:lapCount,...(until.trim()?{until:until.trim()}:{}),stopIdle:true}}:{})};
    const signature=JSON.stringify(plan);
    if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
    try{
      const chain=await controls.start({id:attempt.current.id,...plan});
      if(live.current)onStarted(chain);
    }catch(e){if(live.current)setError(e instanceof Error?e.message:String(e));}
    finally{lock.current=false;if(live.current)setStarting(false);}
  }
  return createPortal(<div className="modal-backdrop">
    <section ref={root} className="confirm-modal markdown-task-dialog chain-editor" role="dialog" aria-modal="true" aria-labelledby={heading}>
      <header><h2 id={heading}>{l('Chain of steps','Цепочка шагов')}</h2><p className="markdown-project">{controls.cwd}</p></header>
      <fieldset disabled={starting} className="chain-editor-body">
        <ol className="chain-editor-steps">{steps.map((step,index)=>{
          const label=l('Step ','Шаг ')+(index+1);
          return <li key={step.key} onDragOver={event=>{if(dragged.current){event.preventDefault();event.dataTransfer.dropEffect='move';}}} onDrop={event=>{event.preventDefault();dropStep(step.key);}}>
            <span className="chain-editor-node" aria-hidden="true">{index+1}</span>
            <div className="chain-editor-step">
              <div className="chain-editor-reorder">
                <button type="button" className="chain-editor-drag" draggable aria-label={l('Drag to reorder step ','Перетащить шаг ')+(index+1)} title={l('Drag to reorder','Перетащить для сортировки')}
                  onDragStart={event=>{dragged.current=step.key;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',step.key);}}
                  onDragEnd={()=>{dragged.current=null;}}><GripVertical size={15}/></button>
                <button type="button" aria-label={l('Move step up ','Переместить выше ')+(index+1)} disabled={index===0} onClick={()=>moveStep(step.key,-1)}><ArrowUp size={14}/></button>
                <button type="button" aria-label={l('Move step down ','Переместить ниже ')+(index+1)} disabled={index===steps.length-1} onClick={()=>moveStep(step.key,1)}><ArrowDown size={14}/></button>
              </div>
              <textarea rows={2} value={step.body} maxLength={100000} autoFocus={index===0} aria-label={label+' · '+l('instruction','инструкция')}
                placeholder={index===0?l('What should be done first?','Что сделать сначала?'):l('What next?','Что дальше?')}
                onChange={e=>update(step.key,{body:e.target.value})}/>
              <div className="chain-editor-step-foot">
                <select aria-label={label+' · '+l('model','модель')} value={executors.some(x=>identity(x)===step.executor)?step.executor:''} onChange={e=>update(step.key,{executor:e.target.value})}>
                  <option value="">{l('Model: as in Tasks','Модель: как в «Задачах»')}</option>
                  {executors.map(x=><option key={identity(x)} value={identity(x)}>{x.label}</option>)}
                </select>
                {steps.length>1&&<button type="button" className="chain-editor-remove" aria-label={l('Remove step ','Убрать шаг ')+(index+1)} title={l('Remove step','Убрать шаг')} onClick={()=>setSteps(list=>list.filter(s=>s.key!==step.key))}><X size={15}/></button>}
              </div>
            </div>
          </li>;})}
          <li className="chain-editor-tail">
            <span className="chain-editor-node" aria-hidden="true">{loop?<Repeat size={13}/>:<Plus size={13}/>}</span>
            <div className="chain-editor-tail-row">
              <button type="button" className="text-button" disabled={steps.length>=100} onClick={()=>setSteps(list=>[...list,newStep()])}>{l('Add step','Добавить шаг')}</button>
              {loop&&<span>{l('then back to step 1','затем снова к шагу 1')}</span>}
            </div>
          </li>
        </ol>
        {catalogueError&&<small role="status">{l('The model list could not be loaded. Steps use the model selected in Tasks.','Список моделей не загрузился. Шаги используют модель, выбранную в «Задачах».')}</small>}
        <div className="setting-rows chain-editor-loop">
          <label className="setting-row"><div><strong>{l('Repeat in a loop','Замкнуть по кругу')}</strong></div>
            <input type="checkbox" role="switch" checked={loop} onChange={e=>setLoop(e.target.checked)}/></label>
          {loop&&<div className="chain-editor-loop-options">
            <input aria-label={l('Stop when','Остановиться, когда')} value={until} maxLength={2000} placeholder={l('Stop when… (for example: all tests pass)','Остановиться, когда… (например: все тесты проходят)')} onChange={e=>setUntil(e.target.value)}/>
            <label className="chain-editor-laps">{l('laps at most','кругов, не больше')}
              <input type="number" aria-label={l('Lap limit','Предел кругов')} min={2} max={CHAIN_LOOP_MAX_LAPS} value={laps} onChange={e=>setLaps(Number(e.target.value))} onBlur={()=>setLaps(lapCount)}/></label>
            <p className="chain-editor-fuses">{l('Also stops when a step fails, when a lap changes nothing in a Git project, and with Stop chain.','Также остановится при ошибке шага, после круга без изменений в Git-проекте и по кнопке «Остановить цепочку».')}</p>
          </div>}
        </div>
      </fieldset>
      {oversized&&<p role="alert">{l('Shorten the instructions: a chain accepts up to 1,048,576 characters in total.','Сократите инструкции: суммарный лимит цепочки — 1 048 576 символов.')}</p>}
      {error&&<p role="alert" className="error-banner">{error}</p>}
      <footer>
        <button type="button" className="secondary" disabled={starting} onClick={onClose}>{l('Cancel','Отмена')}</button>
        <button type="button" className="primary" disabled={!canStart} title={filled?undefined:l('Fill in every step','Заполните каждый шаг')} onClick={()=>void start()}>{starting?l('Starting…','Запуск…'):loop?l('Start loop','Запустить цикл'):l('Start chain','Запустить цепочку')}</button>
      </footer>
    </section>
  </div>,document.body);
}
