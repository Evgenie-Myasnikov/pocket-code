import {useEffect,useRef,useState} from 'react';
import {BookmarkPlus,ChevronDown,ChevronRight,Clock3,MoreHorizontal,Pause,Pencil,Play,Plus,RotateCw,Trash2} from 'lucide-react';
import {CardActionMenu} from './CardActionMenu';
import {HeaderModelMenu} from './HeaderModelMenu';
import {ImproveTaskText} from './ImproveTaskText';
import {useClaudeModels} from './ModelPicker';
import {request,type Connection} from './api';
import {useCustomModels} from './custom-account';
import {useLanguage} from './i18n';
import {fullTime,relativeTime} from './run-status';
import {startVisiblePoll} from './visible-poll';
import type {ProviderModel} from '../server/provider-model';
import type {Schedule,ScheduledTask} from '../server/scheduled-tasks';
import type {Session} from './session';
import './scheduled-tasks.css';

type Provider='claude'|'codex'|'copilot';
/**
 * A plan chat kept as a template: its name, prompt and schedule. The provider, model and folder are chosen when a task
 * is made from it, so one template serves any provider. Templates belong to this PC window, like its folders.
 */
export type ScheduledTemplate={id:string;name:string;prompt:string;schedule:Schedule};
const TEMPLATES='pocket-scheduled-templates';
export function readTemplates():ScheduledTemplate[]{
  try{const value=JSON.parse(localStorage.getItem(TEMPLATES)||'[]');
    return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.prompt==='string'&&item.schedule&&typeof item.schedule.kind==='string').slice(0,50):[];}
  catch{return [];}
}
function writeTemplates(list:ScheduledTemplate[]){try{localStorage.setItem(TEMPLATES,JSON.stringify(list.slice(0,50)));}catch{/* The template holds until the window closes. */}}
/** Keeps a task's name, prompt and schedule; a template of the same name is replaced. */
export function saveTemplate(task:{name:string;prompt:string;schedule:Schedule}){
  const others=readTemplates().filter(item=>item.name!==task.name);
  writeTemplates([{id:crypto.randomUUID(),name:task.name,prompt:task.prompt,schedule:task.schedule},...others]);
}
export type {ScheduledTask};
/** Other parts of the window (the editor) ask the list to read the tasks again. */
export const SCHEDULED_TASKS_CHANGED='pocket-scheduled-tasks';
const changed=()=>window.dispatchEvent(new Event(SCHEDULED_TASKS_CHANGED));
const basename=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)||path;

export function scheduleText(schedule:Schedule,ru:boolean){
  if(schedule.kind==='interval')return ru?`Каждые ${schedule.hours} ч`:`Every ${schedule.hours} h`;
  return (schedule.kind==='weekdays'?(ru?'По будням в ':'Weekdays at '):(ru?'Каждый день в ':'Daily at '))+schedule.time;
}

/**
 * Scheduled chats of this PC in the chat list: a clock, the task's name and a dot while one of its runs is unread.
 * Opening a task opens its latest run, an ordinary chat; its "…" menu pauses, edits, runs now and deletes it.
 */
const COLLAPSED='pocket-desktop-scheduled-collapsed';
export function ScheduledTaskList({connection,online,focusId,sessions,onOpenChat,onEdit,onNew}:{
  connection:Connection;online:boolean;focusId?:string;sessions:Session[];onOpenChat(session:Session):void;onEdit(task:ScheduledTask):void;
  /** The heading's "+": opens the editor for a new task; absent when there is no working folder to run in. */
  onNew?():void;
}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [tasks,setTasks]=useState<ScheduledTask[]>([]),[menu,setMenu]=useState<{task:ScheduledTask;x:number;y:number}>(),[removing,setRemoving]=useState<ScheduledTask>(),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3500);return()=>window.clearTimeout(timer);},[notice]);
  const load=async()=>{try{const list=await request<ScheduledTask[]>(connection,'/scheduled-tasks');setTasks(Array.isArray(list)?list:[]);}catch{/* An older host has no scheduled tasks; the list stays as it was. */}};
  useEffect(()=>{if(!online)return;const stop=startVisiblePoll(load,30000);window.addEventListener(SCHEDULED_TASKS_CHANGED,load);return()=>{stop();window.removeEventListener(SCHEDULED_TASKS_CHANGED,load);};},[online,connection.url,connection.token]);
  const act=async(path:string,data:unknown={})=>{setError('');try{await request(connection,path,data);}catch(e){setError((e as Error).message);}await load();};
  // Opening a run's chat from anywhere marks its task read.
  useEffect(()=>{const task=tasks.find(item=>item.unread&&item.runs[0]?.sessionId&&item.runs[0].sessionId===focusId);if(task)void act('/scheduled-tasks/'+task.id+'/read');},[focusId,tasks]);
  function open(task:ScheduledTask){
    const run=task.runs.find(item=>item.sessionId);
    if(!run?.sessionId){onEdit(task);return;}
    // Only the latest run is there, named by its time (09:00, or the day and time when it is not today); nothing can be written to it.
    const found=sessions.find(item=>item.sessionId===run.sessionId)||{sessionId:run.sessionId,cwd:task.cwd,summary:task.prompt,lastModified:run.at,provider:task.provider,...(task.account?{account:task.account}:{})};
    // The task is the stable chat entry; a new run replaces its visible answer without exposing a new chat title.
    onOpenChat({...found,customTitle:task.name,scheduled:true});
    if(task.unread)void act('/scheduled-tasks/'+task.id+'/read');
  }
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem(COLLAPSED)==='1';}catch{return false;}});
  const toggle=()=>setCollapsed(old=>{const next=!old;try{localStorage.setItem(COLLAPSED,next?'1':'0');}catch{/* The block stays as it is until the window closes. */}return next;});
  const Chevron=collapsed?ChevronRight:ChevronDown;
  return <section className="scheduled-tasks" aria-label={l('Scheduled chats','Плановые чаты')}>
    <div className="desktop-list-heading scheduled-tasks-heading">
      <button type="button" className="desktop-list-heading-title" aria-expanded={!collapsed} onClick={toggle}><span>{l('Scheduled chats','Плановые чаты')}</span><Chevron size={13} aria-hidden="true"/></button>
      {onNew&&<button type="button" className="icon-button desktop-list-heading-action" aria-label={l('New scheduled task','Новая запланированная задача')} title={l('New scheduled task','Новая запланированная задача')} disabled={!online} onClick={onNew}><Plus size={16} aria-hidden="true"/></button>}
    </div>
    {!collapsed&&<div className="scheduled-tasks-body">{tasks.map(task=>{
      const last=task.runs[0],state=task.paused?l('Paused','На паузе'):last?.error?l('Last run failed','Последний запуск не удался'):l('Next: ','Далее: ')+relativeTime(task.nextRunAt);
      const description=[scheduleText(task.schedule,ru),state,task.unread?l('New run','Новый запуск'):''].filter(Boolean).join(' · ');
      return <div key={task.id} className="scheduled-task" data-paused={task.paused||undefined} data-unread={task.unread||undefined}>
        <button type="button" className="scheduled-task-open" aria-pressed={!!last?.sessionId&&last.sessionId===focusId} aria-description={description}
          title={[task.name,scheduleText(task.schedule,ru),basename(task.cwd),task.paused?l('Paused','На паузе'):l('Next run ','Следующий запуск ')+fullTime(task.nextRunAt)].join(' · ')} onClick={()=>open(task)}
          onContextMenu={e=>{e.preventDefault();setMenu({task,x:e.clientX,y:e.clientY});}}>
          <span className="scheduled-task-icon"><Clock3 size={16} aria-hidden="true"/>{task.unread&&<span className="scheduled-task-dot" aria-hidden="true"/>}</span>
          <span><strong>{task.name}</strong><small>{scheduleText(task.schedule,ru)} · {state}</small></span>
        </button>
        <button type="button" className="scheduled-task-actions" aria-label={l('Scheduled task actions','Действия запланированной задачи')} aria-description={task.name} aria-haspopup="menu" aria-expanded={menu?.task.id===task.id}
          onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();setMenu(menu?.task.id===task.id?undefined:{task,x:rect.right+6,y:rect.top});}}><MoreHorizontal size={18} aria-hidden="true"/></button>
      </div>;
    })}
    {error&&<p className="scheduled-tasks-error" role="alert">{error}</p>}{notice&&<p className="scheduled-tasks-notice" role="status">{notice}</p>}</div>}
    {menu&&<CardActionMenu point={menu} label={l('Scheduled task actions','Действия запланированной задачи')} onClose={()=>setMenu(undefined)} items={[
      {label:menu.task.paused?l('Resume','Возобновить'):l('Pause','Приостановить'),Icon:menu.task.paused?Play:Pause,disabled:!online,onSelect:()=>void act('/scheduled-tasks/'+menu.task.id,{paused:!menu.task.paused})},
      {label:l('Edit','Изменить'),Icon:Pencil,disabled:!online,onSelect:()=>onEdit(menu.task)},
      {label:l('Run now','Запустить сейчас'),Icon:RotateCw,disabled:!online,onSelect:()=>void act('/scheduled-tasks/'+menu.task.id+'/run')},
      {label:l('Save as template','Сохранить как шаблон'),Icon:BookmarkPlus,onSelect:()=>{saveTemplate(menu.task);setNotice(l('Saved as a template: it can be made for any provider with "+".','Сохранено как шаблон: из него можно создать задачу для любого провайдера через «+».'));}},
      {label:l('Delete','Удалить'),Icon:Trash2,danger:true,disabled:!online,onSelect:()=>setRemoving(menu.task)}]}/>}
    {removing&&<ScheduleDialog label={l('Delete scheduled task','Удалить запланированную задачу')} onClose={()=>setRemoving(undefined)}>
      <h2>{l('Delete scheduled task','Удалить запланированную задачу')}</h2>
      <p><strong>{removing.name}</strong></p>
      <p className="muted">{l('No new runs will start. Chats from earlier runs stay in the chat list.','Новые запуски не начнутся. Чаты прошлых запусков останутся в списке.')}</p>
      <div className="bulk-dialog-actions"><button type="button" className="secondary" onClick={()=>setRemoving(undefined)}>{l('Cancel','Отмена')}</button>
        <button type="button" className="primary danger" onClick={()=>{const id=removing.id;setRemoving(undefined);setTasks(old=>old.filter(item=>item.id!==id));void act('/scheduled-tasks/'+id+'/delete');}}>{l('Delete','Удалить')}</button></div>
    </ScheduleDialog>}
  </section>;
}

/** A dialog without a focus trap: the provider and model menu opens in a layer of its own and must keep keyboard focus. */
function ScheduleDialog({label,onClose,children}:{label:string;onClose():void;children:React.ReactNode}){
  const ref=useRef<HTMLElement>(null),latest=useRef(onClose);latest.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus({preventScroll:true});
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('.header-model-menu')){event.preventDefault();latest.current();}};
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <div className="modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} className="confirm-modal scheduled-task-dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>;
}

/** Creates or edits a scheduled task: its name, prompt, provider and model, working folder and schedule. */
export function ScheduledTaskDialog({connection,task,defaultCwd,folders,onClose,onManage}:{
  connection:Connection;task?:ScheduledTask;defaultCwd:string;folders:string[];onClose():void;onManage?():void;
}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [name,setName]=useState(task?.name||''),[prompt,setPrompt]=useState(task?.prompt||''),[cwd,setCwd]=useState(task?.cwd||defaultCwd||folders[0]||'');
  const [provider,setProvider]=useState<Provider>(task?.provider||'claude'),[account,setAccount]=useState(task?.account||''),[model,setModel]=useState(task?.model||'');
  const [kind,setKind]=useState<Schedule['kind']>(task?.schedule.kind||'weekdays'),[time,setTime]=useState(task&&task.schedule.kind!=='interval'?task.schedule.time:'09:00'),[hours,setHours]=useState(task?.schedule.kind==='interval'?task.schedule.hours:4);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  // A local model is kept by its id: it is started for each run, not now.
  const [localModel,setLocalModel]=useState(task?.localModel||'');
  const [templates,setTemplates]=useState(readTemplates),[template,setTemplate]=useState('');
  function applyTemplate(id:string){
    setTemplate(id);const chosen=templates.find(item=>item.id===id);if(!chosen)return;
    setName(chosen.name);setPrompt(chosen.prompt);setKind(chosen.schedule.kind);
    if(chosen.schedule.kind==='interval')setHours(chosen.schedule.hours);else setTime(chosen.schedule.time);
  }
  function dropTemplate(){const rest=templates.filter(item=>item.id!==template);writeTemplates(rest);setTemplates(rest);setTemplate('');}
  const claude=useClaudeModels(connection,provider,cwd),custom=useCustomModels(connection,provider==='claude'?account:'');
  const [catalog,setCatalog]=useState<Record<string,ProviderModel[]>>({});
  useEffect(()=>{let live=true;void request<{id:string;models?:ProviderModel[]}[]>(connection,'/providers').then(list=>{if(live&&Array.isArray(list))setCatalog(Object.fromEntries(list.map(item=>[item.id,item.models||[]])));}).catch(()=>{});return()=>{live=false;};},[connection.url,connection.token]);
  const models=provider==='claude'?(account?custom.models:claude.models):catalog[provider]||[];
  const choices=[...new Set([cwd,...folders].filter(Boolean))];
  const schedule:Schedule=kind==='interval'?{kind,hours}:{kind,time};
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy)return;
    if(!name.trim()||!prompt.trim()||!cwd){setError(l('Fill in the name, the prompt and the folder.','Заполните название, промпт и папку.'));return;}
    if(!localModel&&provider==='claude'&&account&&!(model||custom.model)){setError(l('Choose a model of this connection.','Выберите модель этого подключения.'));return;}
    setBusy(true);setError('');
    const body={name:name.trim(),prompt:prompt.trim(),provider,account:provider==='claude'&&!localModel?account:'',model:localModel?'':provider==='claude'&&account?model||custom.model:model,cwd,schedule,localModel};
    try{await request(connection,task?'/scheduled-tasks/'+task.id:'/scheduled-tasks',body);changed();onClose();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const title=task?l('Edit scheduled task','Изменить запланированную задачу'):l('New scheduled task','Новая запланированная задача');
  return <ScheduleDialog label={title} onClose={onClose}><form onSubmit={e=>void save(e)}>
    <h2>{title}</h2>
    {!task&&templates.length>0&&<div className="scheduled-task-template"><label>{l('Template','Шаблон')}<select value={template} onChange={e=>applyTemplate(e.target.value)}>
      <option value="">{l('No template','Без шаблона')}</option>{templates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {template&&<button type="button" className="text-button" onClick={dropTemplate}>{l('Delete template','Удалить шаблон')}</button>}</div>}
    <label>{l('Name','Название')}<span className="scheduled-task-input"><input value={name} maxLength={120} placeholder={l('Weekday morning brief','Утренняя сводка по будням')} onChange={e=>setName(e.target.value)}/>{cwd&&<ImproveTaskText connection={connection} cwd={cwd} provider={provider} field="title" value={name} context={prompt} maxLength={120} compact onApply={setName}/>}</span></label>
    <label>{l('Prompt','Промпт')}<span className="scheduled-task-input"><textarea value={prompt} maxLength={20000} rows={5} placeholder={l('What should the agent do at each run?','Что агент делает при каждом запуске?')} onChange={e=>setPrompt(e.target.value)}/>{cwd&&<ImproveTaskText connection={connection} cwd={cwd} provider={provider} field="instructions" value={prompt} context={name} maxLength={20000} compact onApply={setPrompt}/>}</span></label>
    <div className="scheduled-task-field"><span>{l('Provider and model','Провайдер и модель')}</span>
      <HeaderModelMenu connection={connection} provider={provider} onProvider={value=>{setProvider(value);setModel('');setLocalModel('');}} account={account} onAccount={value=>{setAccount(value);setModel('');setLocalModel('');}} models={localModel?[]:models} model={provider==='claude'&&account?model||custom.model:model} onModel={setModel} onManage={onManage}
        localModel={localModel} onLocalModel={id=>{setLocalModel(id);setProvider('claude');setAccount('');setModel('');}}/></div>
    <label>{l('Folder','Папка')}<select value={cwd} onChange={e=>setCwd(e.target.value)}>{!cwd&&<option value="">—</option>}{choices.map(folder=><option key={folder} value={folder} title={folder}>{basename(folder)}</option>)}</select></label>
    <fieldset className="scheduled-task-schedule"><legend>{l('Schedule','Расписание')}</legend>
      <select aria-label={l('Repeat','Повтор')} value={kind} onChange={e=>setKind(e.target.value as Schedule['kind'])}>
        <option value="daily">{l('Every day','Каждый день')}</option><option value="weekdays">{l('Weekdays','По будням')}</option><option value="interval">{l('Every N hours','Каждые N часов')}</option></select>
      {kind==='interval'
        ?<label>{l('Hours','Часов')}<input type="number" min={1} max={24} value={hours} onChange={e=>setHours(Math.max(1,Math.min(24,Math.round(Number(e.target.value)||1))))}/></label>
        :<label>{l('Time','Время')}<input type="time" required value={time} onChange={e=>setTime(e.target.value)}/></label>}
    </fieldset>
    <p className="muted">{l('Each run starts a new chat on this PC while the PC host is running. A run missed while the PC was off starts once when it is back.','Каждый запуск — новый чат на этом ПК, пока работает хост ПК. Пропущенный, пока ПК был выключен, запуск начнётся один раз после включения.')}</p>
    {error&&<p role="alert">{error}</p>}
    <div className="bulk-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button>
      <button type="submit" className="primary" disabled={busy}>{busy?l('Saving…','Сохраняем…'):task?l('Save','Сохранить'):l('Create','Создать')}</button></div>
  </form></ScheduleDialog>;
}
