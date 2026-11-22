import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,FileText,Plus,Sparkles,Trash2,X} from 'lucide-react';
import {request} from './api';
import {ImproveTaskText,type ImproveScope} from './ImproveTaskText';
import {ProjectSourcePicker,sourceFileBinding,sourceFileLabel} from './ProjectSourcePicker';
import {catalogueWarning,providerIssueText,type CatalogueSection,type TextProviderIssue} from './task-catalogue';
import type {MarkdownChainControls} from './MarkdownChainPanel';
import type {MarkdownChainDetail} from './markdown-chain';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './markdown-task-dialog.css';
import './chain-planner.css';

type Provider=MarkdownChainDetail['provider'];
type Executor={provider:Provider;account?:string;model?:string};
type Catalogue={
  providers:Provider[];
  accounts:{id:string;name:string}[];
  executors:(Executor&{label:string})[];
  warnings?:CatalogueSection[];
  unavailable?:TextProviderIssue[];
};
type Step={title:string;body:string;source:string;executor:Executor};
type Draft={name:string;context:string;tasks:Step[]};
type Editable=Omit<Draft,'tasks'>&{tasks:(Step&{key:string})[];sourceFiles:{name:string;projectPath?:string;text?:string}[]};
type Props={improveScope:ImproveScope;controls:MarkdownChainControls;initialFiles?:File[];initialParallelSubtasks?:boolean;onClose():void;onStarted(chain:MarkdownChainDetail):void};
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const identity=(x:Executor)=>JSON.stringify([x.provider,x.account||'',x.model||'']);
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
const withoutKeys=(draft:Editable):Draft=>({name:draft.name,context:draft.context,tasks:draft.tasks.map(({key,...step})=>step)});

export function ChainPlannerDialog({improveScope,controls,initialFiles=[],initialParallelSubtasks=true,onClose,onStarted}:Props){
  const {connection,cwd,provider}=improveScope;
  const ru=useLanguage()==='ru';
  const tr=(r:string,en:string)=>ru?r:en;
  const root=useRef<HTMLElement>(null),titleId=useId();
  const [catalogue,setCatalogue]=useState<Catalogue>(),[reload,setReload]=useState(0);
  const [loadingCatalogue,setLoadingCatalogue]=useState(true);
  const [choice,setChoice]=useState(''),[models,setModels]=useState<string[]>(),[model,setModel]=useState('');
  const [catalogueError,setCatalogueError]=useState(''),[modelError,setModelError]=useState(''),[modelReload,setModelReload]=useState(0);
  const [files,setFiles]=useState<File[]>(initialFiles),[brief,setBrief]=useState('');
  const [draft,setDraft]=useState<Editable>(),[inputs,setInputs]=useState(true);
  const [proposal,setProposal]=useState<Editable>();
  const [busy,setBusy]=useState<'generate'|'start'>(),[error,setError]=useState('');
  const [parallelSubtasks,setParallelSubtasks]=useState(initialParallelSubtasks);
  const live=useRef(true),lock=useRef(false),attempt=useRef<{signature:string;id:string}|null>(null);
  const custom=choice.startsWith('account:'),account=custom?choice.slice(8):undefined;
  useModal(root,true,()=>{if(busy!=='start')onClose();});
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    setCatalogueError('');setLoadingCatalogue(true);
    request<Catalogue>(connection,'/task-text/plan/providers'+(reload?'?refresh=1':'')).then(data=>{
      if(!active)return;
      if(!Array.isArray(data?.providers)||!Array.isArray(data.accounts)||!Array.isArray(data.executors))
        throw Error(ru?'Не удалось прочитать список провайдеров.':'Could not read the provider catalogue.');
      setCatalogue(data);
      const keepSelected=data.providers.some(id=>id===choice)||data.accounts.some(a=>'account:'+a.id===choice);
      if(!keepSelected)setChoice(provider&&data.providers.includes(provider)?provider:data.providers[0]||(data.accounts[0]?'account:'+data.accounts[0].id:''));
    }).catch(e=>{if(active)setCatalogueError(message(e));})
      .finally(()=>{if(active)setLoadingCatalogue(false);});
    return()=>{active=false;};
  },[connection.url,connection.token,connection.desktop,provider,ru,reload]);
  useEffect(()=>{
    let active=true;
    setModelError('');setModels(undefined);setModel('');
    if(account)request<string[]>(connection,'/custom-providers/'+encodeURIComponent(account)+'/models').then(items=>{
      if(!active)return;
      if(!Array.isArray(items))throw Error(ru?'Не удалось прочитать список моделей.':'Could not read the model list.');
      setModels(items);setModel(items[0]||'');
    }).catch(e=>{if(active)setModelError(message(e));});
    return()=>{active=false;};
  },[connection.url,connection.token,connection.desktop,account,modelReload,ru]);

  function addFiles(incoming:File[]){
    const next=[...files,...incoming];
    setError('');
    if(next.length>50){setError(tr('Можно выбрать до 50 файлов.','Choose up to 50 files.'));return;}
    if(next.reduce((sum,file)=>sum+file.size,0)>100000){setError(tr('Общий размер файлов должен быть не больше 100 000 байт.','Choose files totalling at most 100,000 bytes.'));return;}
    if(new Set(next.map(sourceFileLabel)).size!==next.length){setError(tr('Имена выбранных файлов должны различаться.','Choose files with distinct names.'));return;}
    setFiles(next);
  }
  const executors=catalogue?.executors||[];
  const warning=catalogueWarning(catalogue?.warnings,ru);
  const tooManyFiles=files.length>50||files.reduce((sum,file)=>sum+file.size,0)>100000;
  const canGenerate=files.length>0&&!tooManyFiles&&!loadingCatalogue&&!catalogueError&&!!choice&&(!custom||!!model&&models?.includes(model))&&executors.length>0;
  async function generate(){
    if(lock.current||!canGenerate)return;
    lock.current=true;setBusy('generate');setError('');
    try{
      const sources=await Promise.all(files.map(async file=>{
        const bytes=await file.arrayBuffer();
        let text:string;
        try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
        catch{throw Error(tr('Нужен текст в UTF-8: ','Choose a UTF-8 text file: ')+file.name);}
        if(!text.trim()||text.includes('\0'))throw Error(tr('Нужен непустой текстовый файл: ','Choose a nonempty text file: ')+file.name);
        return {name:sourceFileLabel(file),text};
      }));
      const result=await request<Draft>(connection,'/task-text/plan',{cwd,provider:custom?'custom':choice,...(custom?{account,model}:{}),files:sources,brief,language:ru?'ru':'en',...(draft?{draft:withoutKeys(draft)}:{})});
      if(!result?.name||!Array.isArray(result.tasks)||!result.tasks.length)throw Error(tr('Провайдер вернул пустой план.','The provider returned an empty plan.'));
      if(live.current){
        const sourceFiles=files.map((file,i)=>{
          const binding=sourceFileBinding(file);
          return binding.projectPath?binding:{...binding,text:sources[i].text};
        });
        const importedMain=!draft&&initialFiles[0]?files.indexOf(initialFiles[0]):-1;
        const next={...result,context:importedMain>=0?sources[importedMain].text:result.context,tasks:result.tasks.map(step=>({...step,key:crypto.randomUUID()})),sourceFiles};
        if(draft)setProposal(next);else setDraft(next);
        setInputs(false);
      }
    }catch(e){if(live.current)setError(message(e));}
    finally{lock.current=false;if(live.current)setBusy(undefined);}
  }
  function updateStep(key:string,patch:Partial<Step>){
    setDraft(prev=>prev&&({...prev,tasks:prev.tasks.map(s=>s.key===key?{...s,...patch}:s)}));
  }
  function move(key:string,direction:number){
    setDraft(prev=>{
      if(!prev)return prev;
      const tasks=[...prev.tasks],from=tasks.findIndex(s=>s.key===key),to=from+direction;
      if(from<0||to<0||to>=tasks.length)return prev;
      [tasks[from],tasks[to]]=[tasks[to],tasks[from]];
      return {...prev,tasks};
    });
  }
  const valid=draft?.name.trim()&&draft.tasks.length&&draft.tasks.every(s=>s.title.trim()&&s.body.trim()&&draft.sourceFiles.some(file=>file.name===s.source)&&executors.some(x=>identity(x)===identity(s.executor)));
  async function start(){
    if(!draft||!valid||lock.current||controls.canStart===false)return;
    lock.current=true;setBusy('start');setError('');
    try{
      const plan={...withoutKeys(draft),parallelSubtasks,sourceFiles:draft.sourceFiles};
      const signature=JSON.stringify(plan);
      if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
      const chain=await controls.start({id:attempt.current.id,...plan});
      if(live.current)onStarted(chain);
    }catch(e){if(live.current)setError(message(e));}
    finally{lock.current=false;if(live.current)setBusy(undefined);}
  }
  const title=tr('Спланировать цепочку с ИИ','Plan a chain with AI');
  function field(id:string,label:string,kind:'title'|'instructions'|'context',value:string,context:string,maxLength:number,onChange:(text:string)=>void){
    const htmlId=titleId+id;
    return <div className="markdown-edit-field">
      <label htmlFor={htmlId}>{label}</label>
      <ImproveTaskText {...improveScope} compact disabled={!!busy} field={kind} value={value} context={context} maxLength={maxLength} onApply={onChange}/>
      {kind==='title'?<input id={htmlId} value={value} maxLength={maxLength} onChange={e=>onChange(e.target.value)}/>
        :<textarea id={htmlId} rows={3} value={value} maxLength={maxLength} onChange={e=>onChange(e.target.value)}/>}
    </div>;
  }
  return createPortal(<div className="modal-backdrop">
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby={titleId} className="confirm-modal markdown-task-dialog chain-planner">
      <header><h2 id={titleId}><Sparkles aria-hidden="true" size={21}/>{proposal?tr('Предложенные изменения','Proposed revision'):inputs?title:tr('Проверить план','Review plan')}</h2><p className="markdown-project">{controls.cwd}</p></header>
      {inputs&&<fieldset disabled={!!busy} className="chain-planner-inputs">
        <label>{tr('Исходные файлы','Source files')}<input type="file" multiple onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value='';}}/></label>
        <ProjectSourcePicker connection={connection} cwd={cwd} disabled={!!busy} onPick={file=>addFiles([file])}/>
        {tooManyFiles&&<p role="alert">{tr('Для планирования выберите до 50 файлов общим размером до 100 000 байт.','Choose up to 50 files totalling at most 100,000 bytes for planning.')}</p>}
        {files.length>0&&<ul className="chain-planner-files">{files.map(f=><li key={sourceFileLabel(f)}><FileText aria-hidden="true" size={15}/><span>{sourceFileLabel(f)}</span>
          <button type="button" className="text-button" aria-label={tr('Убрать ','Remove ')+sourceFileLabel(f)} onClick={()=>{setFiles(files.filter(x=>x!==f));setError('');}}><X size={15}/></button></li>)}</ul>}
        <div className="chain-planner-provider">
          <label>{tr('Провайдер планирования','Planning provider')}<select disabled={!choice||loadingCatalogue} value={choice} onChange={e=>{setChoice(e.target.value);setModels(undefined);setModel('');setModelError('');}}>
            {!choice&&<option value="">{catalogue||catalogueError?'—':tr('Загрузка…','Loading…')}</option>}
            {catalogue?.providers.map(id=><option key={id} value={id}>{names[id]}</option>)}
            {catalogue?.accounts.map(a=><option key={a.id} value={'account:'+a.id}>{a.name}</option>)}
          </select></label>
          {custom&&<label>{tr('Модель','Model')}<select disabled={!models?.length} value={model} onChange={e=>setModel(e.target.value)}>
            {!model&&<option value="">{models||modelError?'—':tr('Загрузка…','Loading…')}</option>}
            {models?.map(m=><option key={m}>{m}</option>)}</select></label>}
        </div>
        {!!catalogue?.unavailable?.length&&<details><summary>{tr('Недоступные провайдеры','Unavailable providers')}</summary>
          <ul>{catalogue.unavailable.map(issue=><li key={issue.provider}>{names[issue.provider]} · {providerIssueText(issue.reason,ru)}</li>)}</ul>
          {!warning&&choice&&executors.length>0&&<button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>{tr('Обновить список','Refresh providers')}</button>}
        </details>}
        {custom&&(modelError||models?.length===0)&&<div><p role="alert">{modelError||tr('У подключения нет доступных моделей.','This connection has no available models.')}</p><button type="button" className="text-button" onClick={()=>setModelReload(n=>n+1)}>{tr('Обновить модели','Refresh models')}</button></div>}
        {(catalogueError||warning||catalogue&&(!choice||!executors.length))&&<div><p role="alert">{catalogueError||warning||tr('Подключите провайдера для планирования и исполнителя задач.','Connect a planning provider and a task executor.')}</p>
          <button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>{tr('Обновить список','Refresh providers')}</button></div>}
        {choice==='codex'&&<p className="markdown-project">{tr('Для Codex весь запрос, включая файлы и инструкции, должен помещаться в 4 000 байт. Для больших файлов выберите другого провайдера.','Codex accepts up to 4,000 bytes including files and instructions. Choose another provider for larger files.')}</p>}
        {field('brief',draft?tr('Что изменить в плане?','What should change?'):tr('Пожелания к плану','Planning instructions'),'instructions',brief,files.map(sourceFileLabel).join('\n'),4000,setBrief)}
      </fieldset>}
      {proposal&&<div className="chain-planner-proposal">
        <h3>{proposal.name}</h3><pre>{proposal.context}</pre>
        <ol>{proposal.tasks.map(step=><li key={step.key}>
          <strong>{step.title}</strong><small>{executors.find(x=>identity(x)===identity(step.executor))?.label||names[step.executor.provider]} · {step.source}</small><pre>{step.body}</pre>
        </li>)}</ol>
      </div>}
      {!proposal&&!inputs&&draft&&<fieldset disabled={!!busy} className="markdown-task-editor">
        <details><summary>{tr('Исходные файлы','Source files')} ({draft.sourceFiles.length})</summary><ul>{draft.sourceFiles.map(file=><li key={file.name}>{file.name}</li>)}</ul></details>
        {field('name',tr('Название цепочки','Chain name'),'title',draft.name,draft.context,512,name=>setDraft({...draft,name}))}
        {field('context',tr('Общий контекст','Shared context'),'context',draft.context,draft.tasks.map(s=>s.title).join('\n'),100000,context=>setDraft({...draft,context}))}
        {draft.tasks.map((step,index)=>{
          const stepLabel=tr('Шаг ','Step ')+(index+1);
          const action=(label:string,disabled:boolean,onClick:()=>void,icon:React.ReactNode)=><button type="button" className="text-button" disabled={disabled} aria-label={label} title={label} onClick={onClick}>{icon}</button>;
          return <fieldset key={step.key} className="markdown-step-editor">
            <legend>{stepLabel}</legend>
            <div className="chain-planner-step-head"><label>{tr('Исполнитель шага','Step executor')}<select value={identity(step.executor)} onChange={e=>{
              const executor=executors.find(x=>identity(x)===e.target.value);
              if(executor){const {label,...selected}=executor;updateStep(step.key,{executor:selected});}
            }}>{executors.map(x=><option key={identity(x)} value={identity(x)}>{x.label}</option>)}</select></label>
            <div className="chain-planner-step-actions">
              {action(stepLabel+tr(' вверх',' up'),index===0,()=>move(step.key,-1),<ArrowUp size={16}/>)}
              {action(stepLabel+tr(' вниз',' down'),index===draft.tasks.length-1,()=>move(step.key,1),<ArrowDown size={16}/>)}
              {action(tr('Удалить шаг ','Remove step ')+(index+1),false,()=>setDraft({...draft,tasks:draft.tasks.filter(s=>s.key!==step.key)}),<Trash2 size={16}/>)}
            </div></div>
            {field(step.key+'title',tr('Название шага','Step title'),'title',step.title,step.body,4096,title=>updateStep(step.key,{title}))}
            {field(step.key+'body',tr('Инструкция','Instructions'),'instructions',step.body,[draft.name,draft.context,step.title].join('\n'),100000,body=>updateStep(step.key,{body}))}
            <label>{tr('Источник','Source')}<select value={step.source} onChange={e=>updateStep(step.key,{source:e.target.value})}>
              {draft.sourceFiles.map(file=><option key={file.name}>{file.name}</option>)}
            </select></label>
          </fieldset>;
        })}
        <button className="secondary" type="button" disabled={draft.tasks.length>=100||!executors.length} onClick={()=>{
          const {label,...executor}=executors[0];
          setDraft({...draft,tasks:[...draft.tasks,{key:crypto.randomUUID(),title:'',body:'',source:draft.sourceFiles[0]?.name||'Markdown',executor}]});
        }}><Plus size={15}/>{tr('Добавить шаг','Add step')}</button>
        <label className="chain-planner-parallel"><input type="checkbox" checked={parallelSubtasks} onChange={e=>setParallelSubtasks(e.target.checked)}/>{tr('Разрешить параллельные подзадачи','Allow parallel subtasks')}</label>
      </fieldset>}
      {error&&<p className="error-banner" role="alert">{error}</p>}
      {busy==='generate'&&<p role="status">{tr('Провайдер составляет план…','The provider is drafting the plan…')}</p>}
      <footer>
        <button type="button" className="secondary" disabled={busy==='start'} onClick={onClose}>{tr('Закрыть','Close')}</button>
        {proposal?<><button type="button" className="secondary" onClick={()=>setProposal(undefined)}>{tr('Оставить текущий план','Keep current plan')}</button>
          <button type="button" className="primary" onClick={()=>{setDraft(proposal);setProposal(undefined);}}>{tr('Применить изменения','Apply revision')}</button></>:<>
        {draft&&<button type="button" className="secondary" disabled={!!busy} onClick={()=>{setInputs(!inputs);if(!inputs)setBrief('');setError('');}}>{inputs?tr('К черновику','Back to draft'):tr('Изменить план с ИИ','Revise plan with AI')}</button>}
        {inputs?<button type="button" className="primary" disabled={!!busy||!canGenerate||!!draft&&!brief.trim()} onClick={()=>void generate()}>
          <Sparkles size={16}/>{draft?tr('Предложить изменения','Suggest revision'):tr('Составить план','Generate plan')}</button>
          :<button type="button" className="primary" disabled={!valid||!!busy||controls.canStart===false} onClick={()=>void start()}>{busy==='start'?tr('Запуск…','Starting…'):tr('Запустить цепочку','Start chain')}</button>}</>}
      </footer>
    </section>
  </div>,document.body);
}
