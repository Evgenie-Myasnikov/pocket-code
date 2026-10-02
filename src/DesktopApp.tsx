import {PairingRole} from './PairingRole';
import {WorkBoards,type BoardChat} from './WorkBoards';
import {useProjectWorkspaces,ProjectWorkspacePicker,inWorkspace} from './project-workspaces';
import {App as SharedChat} from './App';
import {DesktopDevices} from './DesktopDevices';
import {ProjectDocs} from './ProjectDocs';
import {watchWindowTheme} from './window-theme';
import {DesktopUpdates} from './DesktopUpdates';
import {ProviderConnections,HostStatus} from './ProviderConnections';
import {useEffect,useMemo,useState} from 'react';
import {ArrowDown,Check,ChevronRight,Folder,GitCompareArrows,MessageSquare,Monitor,RefreshCw,Search,Settings,Smartphone,Wifi,X} from 'lucide-react';
import {request,type Connection} from './api';
import {desktopCall,watchDesktop,type DesktopState} from './desktop-bridge';
import {useAppearance,AppearanceSettings} from './Appearance';
import {LanguageSelector} from './Language';
import {t,useLanguage} from './i18n';
import {MessageList} from './Messages';
import {Review} from './Review';
import {ChatOutputs} from './ChatOutputs';
import {Subagents} from './Subagents';
import {shareSnapshot} from './chat-snapshot';
import {startVisiblePoll} from './visible-poll';
import {useBackNavigation} from './navigation';
import type {JobView} from '../server/types';
import type {Session} from './session';
type Provider='claude'|'codex'|'copilot';
function runLabel(status:string,ru:boolean){const labels:Record<string,[string,string]>={running:['Working…','Работает…'],needs_input:['Needs your answer','Нужен ваш ответ'],done:['Completed','Завершено'],error:['Error','Ошибка'],stopped:['Stopped','Остановлено']};return labels[status]?.[ru?1:0]||'';}
const connection:Connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
const initial:DesktopState={online:false,busy:false,status:'',startup:false,autoReconnect:true,internet:true,addresses:[],jira:false};
const name=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)||path;
function saved(key:string,fallback:string){try{return localStorage.getItem('pocket-desktop-'+key)||fallback;}catch{return fallback;}}
function persist(key:string,value:string){try{localStorage.setItem('pocket-desktop-'+key,value);}catch{}}
// The conversation keeps at least 480px; the rail stays readable at 220px.
const railLimits=(width:number)=>Math.round(Math.min(Math.max(width,220),Math.max(220,Math.min(560,window.innerWidth-480))));
function RailResizer({width,onChange}:{width:number|null;onChange:(width:number|null)=>void}){
  const ru=useLanguage()==='ru';
  const current=()=>width??(document.querySelector('.desktop-rail') as HTMLElement|null)?.getBoundingClientRect().width??290;
  const commit=(next:number|null)=>{onChange(next);persist('rail-width',next===null?'':String(next));};
  return <div className="desktop-rail-resizer" role="separator" aria-orientation="vertical" aria-label={ru?'Ширина боковой панели':'Sidebar width'} aria-valuenow={Math.round(current())} aria-valuemin={220} aria-valuemax={560} tabIndex={0}
    title={ru?'Перетащите, чтобы изменить ширину. Двойной щелчок — по умолчанию.':'Drag to resize. Double-click to reset.'}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();const handle=event.currentTarget;handle.setPointerCapture(event.pointerId);const start=event.clientX,origin=current();let next=origin;document.body.classList.add('desktop-resizing');
      const move=(e:PointerEvent)=>{next=railLimits(origin+e.clientX-start);onChange(next);};
      const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);document.body.classList.remove('desktop-resizing');commit(next);};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);}}
    onDoubleClick={()=>commit(null)}
    onKeyDown={event=>{const step=event.shiftKey?64:16;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();commit(railLimits(current()+(event.key==='ArrowRight'?step:-step)));}else if(event.key==='Home'){event.preventDefault();commit(null);}}}/>;
}
export function DesktopApp(){
  useEffect(watchWindowTheme,[]);
  const [railWidth,setRailWidth]=useState<number|null>(()=>{const value=Number(saved('rail-width',''));return value>0?railLimits(value):null;});
  useEffect(()=>{if(railWidth===null)return;const fit=()=>setRailWidth(width=>width===null?null:railLimits(width));window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[railWidth===null]);
  useBackNavigation();
  const language=useLanguage(),appearance=useAppearance(),label=(en:string,ru:string)=>language==='ru'?ru:en;
  const [state,setState]=useState(initial),[error,setError]=useState(''),[page,setPage]=useState<'work'|'chats'|'project'|'connection'|'settings'>('chats');
  const [provider,setProvider]=useState<Provider>(()=>{const value=saved('provider','claude');return value==='codex'||value==='copilot'?value:'claude';});
  const [project,setProject]=useState(''),[search,setSearch]=useState(''),[sessions,setSessions]=useState<Session[]>([]),[projects,setProjects]=useState<string[]>([]),[jobs,setJobs]=useState<JobView[]>([]);
  const projectSpaces=useProjectWorkspaces(state.online?connection:null);
  const [boardChat,setBoardChat]=useState<BoardChat|undefined>();
  const [creating,setCreating]=useState(false);
  const [selected,setSelected]=useState<Session|null>(null),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[address,setAddress]=useState(0);
  useEffect(()=>{const unwatch=watchDesktop(setState);let active=true;void desktopCall<DesktopState>('state').then(value=>{if(active)setState(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;unwatch();};},[]);
  useEffect(()=>{persist('provider',provider);setSessions([]);setJobs([]);if(!boardChat?.note.chat){setSelected(null);setCreating(false);}setProject(saved('project-'+provider,''));},[provider]);
  useEffect(()=>{if(!state.online)return;let active=true;setLoading(true);
    const stop=startVisiblePoll(async()=>{try{const list=await request<Session[]>(connection,`/sessions?provider=${provider}`);if(!active)return;setSessions(old=>shareSnapshot(old,list));setError('');}catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}},10000);return()=>{active=false;stop();};
  },[state.online,provider,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const folders=await request<string[]>(connection,'/projects');if(active)setProjects(old=>shareSnapshot(old,folders));}catch{/* Session project folders remain available. */}},60000);return()=>{active=false;stop();};},[state.online,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const runs=await request<JobView[]>(connection,`/jobs?provider=${provider}`);if(active)setJobs(old=>shareSnapshot(old,runs));}catch{/* Keep the last known run state during a transient disconnect. */}},1000);return()=>{active=false;stop();};},[state.online,provider,revision]);
  const latestJobs=useMemo(()=>{const map=new Map<string,JobView>();for(const job of [...jobs].sort((a,b)=>b.startedAt-a.startedAt))if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,job);return map;},[jobs]);
  const chatSessions=useMemo(()=>{const map=new Map(sessions.map(item=>[item.sessionId,item]));for(const job of latestJobs.values())if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,{sessionId:job.sessionId,cwd:job.cwd,summary:name(job.cwd),lastModified:job.startedAt});return [...map.values()].sort((a,b)=>Number(latestJobs.get(b.sessionId)?.status==='running')-Number(latestJobs.get(a.sessionId)?.status==='running')||b.lastModified-a.lastModified);},[sessions,latestJobs]);
  const allFolders=useMemo(()=>Array.from(new Set([...projects,...sessions.map(item=>item.cwd||'').filter(Boolean)])).sort(),[projects,sessions]);
  const folders=allFolders.filter(folder=>inWorkspace(folder,projectSpaces.workspace));
  useEffect(()=>{if(projectSpaces.workspace&&selected&&!inWorkspace(selected.cwd,projectSpaces.workspace)){setSelected(null);setCreating(false);}if(projectSpaces.workspace&&project&&!inWorkspace(project,projectSpaces.workspace))setProject('');},[projectSpaces.workspace?.id]);
  // The Project page follows the chat filter, then the open chat, so both views stay on one folder.
  const projectRoot=project||selected?.cwd||folders[0]||'';
  const visible=chatSessions.filter(item=>inWorkspace(item.cwd,projectSpaces.workspace)&&(!project||item.cwd===project)&&`${item.customTitle||item.summary} ${item.cwd}`.toLowerCase().includes(search.toLowerCase()));
  async function action(command:string,args:Record<string,unknown>={}){setError('');try{const next=await desktopCall<DesktopState>(command,args);if(next)setState(next);}catch(e){setError((e as Error).message);}}
  const [pairingBusy,setPairingBusy]=useState(false);
  const pairing=state.addresses[Math.min(address,state.addresses.length-1)];
  return <div className="desktop-app" style={railWidth===null?undefined:{['--desktop-rail-width' as string]:railWidth+'px'}}>
    <aside className="desktop-rail"><RailResizer width={railWidth} onChange={setRailWidth}/><div className="desktop-brand"><span><Monitor size={21}/></span><strong>Pocket Code</strong></div>
      <nav aria-label={label('Navigation','Навигация')}>{([['work',Folder,label('Board','\u0414\u043e\u0441\u043a\u0430')],['project',Folder,label('Project','Проект')],['connection',Smartphone,label('Connection','Подключение')],['settings',Settings,label('Settings','Настройки')]] as const).map(([id,Icon,title])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/>{title}</button>)}</nav>
      <div className="desktop-library"><ProjectWorkspacePicker value={projectSpaces}/><label>{label('Provider','Провайдер')}<select aria-label={label('Provider','Провайдер')} value={provider} onChange={event=>setProvider(event.target.value as Provider)}><option value="claude">Claude</option><option value="codex">Codex</option><option value="copilot">GitHub Copilot</option></select></label>
      <label>{label('Project','Проект')}<select aria-label={label('Project','Проект')} value={project} onChange={event=>{setProject(event.target.value);persist('project-'+provider,event.target.value);setSelected(null);}}><option value="">{label('All projects','Все проекты')}</option>{folders.map(folder=><option key={folder} value={folder}>{name(folder)}</option>)}</select></label>
      <button className="primary desktop-new-chat" disabled={!state.online||!projectRoot} onClick={()=>{setBoardChat(undefined);setCreating(true);setSelected(null);setPage('chats');}}>{label('New chat','Новый чат')}</button><div className="desktop-search"><Search size={16}/><input aria-label={label('Find a chat','Найти чат')} placeholder={label('Find a chat','Найти чат')} value={search} onChange={event=>setSearch(event.target.value)}/></div>
      <div className="desktop-list-caption"><span>{label('Conversations','Переписки')} · {visible.length}</span><button className="icon-button" aria-label={label('Refresh','Обновить')} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={15}/></button></div>
      <div className="desktop-sessions">{creating&&!selected&&<button aria-label={label('Open draft','\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0447\u0435\u0440\u043d\u043e\u0432\u0438\u043a')} aria-pressed={page==='chats'} onClick={()=>setPage('chats')}><MessageSquare size={16}/><span><strong>{label('Draft','\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a')}</strong></span><ChevronRight size={14}/></button>}{loading&&!sessions.length?<p role="status">{label('Loading chats…','Загружаем чаты…')}</p>:visible.map(session=>{const job=latestJobs.get(session.sessionId);const status=job?.status==='running'&&job.approvals?.length?'needs_input':job?.status;return <button key={session.sessionId} aria-pressed={selected?.sessionId===session.sessionId} onClick={()=>{setBoardChat(undefined);setSelected(session);setPage('chats');}}><span className={'desktop-chat-dot '+(status||'idle')}/><span><strong>{session.customTitle||session.summary||label('Untitled chat','Без названия')}</strong><small>{session.cwd?name(session.cwd):label('No project','Без проекта')}</small>{status&&<small className={'desktop-run-label '+status}>{runLabel(status,language==='ru')}</small>}</span><ChevronRight size={14}/></button>;})}{!loading&&!visible.length&&<p className="muted">{state.online?label('No matching chats','Нет подходящих чатов'):label('Connect the PC host to load chats.','Подключите сервер ПК, чтобы загрузить чаты.')}</p>}</div></div>
      <button className="desktop-connection-status" onClick={()=>setPage('connection')}><span className={'desktop-chat-dot '+(state.online?'done':'idle')}/>{state.online?label('PC connected','ПК подключён'):label('Not connected','Нет подключения')}<ChevronRight size={15}/></button>
    </aside>
    <main className="desktop-main">{error&&<div className="desktop-error" role="alert">{error}<button className="icon-button" aria-label={label('Dismiss','Закрыть')} onClick={()=>setError('')}><X size={16}/></button></div>}
    {(selected||creating)&&<div className="desktop-chat-host" hidden={page!=='chats'}><SharedChat key={provider+(selected?.sessionId||'new:'+projectRoot)+(boardChat?':'+boardChat.boardId+':'+boardChat.note.id:'')} embedded={{connection,provider,session:selected||undefined,cwd:selected?.cwd||projectRoot,boardChat,jobId:selected?latestJobs.get(selected.sessionId)?.id:undefined,onBack:()=>{setSelected(null);setCreating(false);}}}/></div>}
    {page==='work'?<WorkBoards connection={connection} roots={allFolders} workspaces={projectSpaces} onChat={target=>{setBoardChat(target);setProject(target.root);if(target.note.chat){setProvider(target.note.chat.provider);setSelected({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now()});setCreating(false);}else{setSelected(null);setCreating(true);}setPage('chats');}}/>:page==='chats'?(selected||creating?null:<div className="desktop-empty"><MessageSquare size={36}/><h1>{label('Your workspace, at a glance','Ваше рабочее пространство')}</h1><p>{label('Choose a conversation to read replies, review changes and explore AI results.','Выберите чат, чтобы читать ответы, смотреть изменения и результаты AI.')}</p><span>{label('Chat here or continue from your phone','Пишите здесь или на телефоне')}</span>{!state.online&&<button className="primary" onClick={()=>setPage('connection')}>{label('Set up connection','Настроить подключение')}</button>}</div>):page==='project'?<div className="desktop-project"><ProjectDocs key={projectRoot} connection={connection} root={projectRoot} roots={folders} onSelectProject={setProject} onProject={setProject}/></div>:page==='connection'?<section className="desktop-settings"><header><h1>{label('Connect your phone','Подключите телефон')}</h1><p className="muted">{label('Scan this QR in Pocket Code on Android.','Отсканируйте QR в Pocket Code на Android.')}</p></header><div className="desktop-pairing"><div className="desktop-qr">{pairing&&!pairingBusy?<img src={pairing.image} alt={label('Private pairing QR','Личный QR подключения')}/>:<Wifi size={48}/>}</div><div><h2>{state.online?label('Ready to connect','Готово к подключению'):label('PC connection','Подключение ПК')}</h2><p className="muted" role="status">{state.status}</p><HostStatus state={state}/><PairingRole connection={connection} workspaces={projectSpaces.catalog.workspaces} onChange={async(role,workspaceId)=>{setPairingBusy(true);try{setState(await desktopCall<DesktopState>('pairing-role',{role,workspaceId}));}finally{setPairingBusy(false);}}}/>{pairing&&<label>{label('Address','Адрес')}<select aria-label={label('Pairing address','Адрес подключения')} value={Math.min(address,state.addresses.length-1)} onChange={event=>setAddress(Number(event.target.value))}>{state.addresses.map((item,index)=><option key={item.url} value={index}>{item.url}</option>)}</select></label>}<button className="primary" disabled={state.busy} onClick={()=>void action('toggle')}>{state.online?label('Disconnect','Отключить'):label('Connect','Подключить')}</button>{state.jira&&<button className="secondary" onClick={()=>void action('jira')}>{label('Jira connection','Подключение Jira')}</button>}</div></div><label className="desktop-toggle"><input type="checkbox" checked={state.internet} disabled={state.online||state.busy} onChange={event=>void action('settings',{internet:event.target.checked})}/>{label('Connect through the internet','Подключение через интернет')}</label><p className="muted">{label('A restarted temporary tunnel may need a new QR scan.','После перезапуска временного туннеля может понадобиться новый QR.')}</p><DesktopDevices connection={connection} online={state.online}/></section>:<section className="desktop-settings"><header><h1>{label('Settings','Настройки')}</h1></header><section className="desktop-system-settings"><h2>{label('Windows application','Приложение Windows')}</h2><label className="desktop-toggle"><input type="checkbox" checked={state.startup} onChange={event=>void action('settings',{startup:event.target.checked})}/>{label('Start with Windows','Запускать с Windows')}</label><label className="desktop-toggle"><input type="checkbox" checked={state.autoReconnect} onChange={event=>void action('settings',{autoReconnect:event.target.checked})}/>{label('Restore the last active connection','Восстанавливать последнее активное подключение')}</label><p className="muted">{label('Closing this window keeps Pocket Code in the tray. Right-click its icon → Exit to quit.','Закрытие окна оставляет Pocket Code в трее. Для выхода: правая кнопка по значку → Выход.')}</p></section><DesktopUpdates state={state} action={action}/><ProviderConnections connection={connection} online={state.online}/><LanguageSelector/><AppearanceSettings {...appearance}/></section>}
    </main>
  </div>;
}
