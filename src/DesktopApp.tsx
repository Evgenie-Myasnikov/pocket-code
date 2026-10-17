import {useActivity} from './useActivity';
import {useDesktopRunNotifications,type WatchedChat} from './chat-notifications';
import {InboxButton,NotificationInbox,useBoardNotices,type BoardNoticeTarget} from './BoardNotifications';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime} from './run-status';
import {providerName} from './ActivityList';
import {useChatShortcuts} from './use-chat-shortcuts';
import {readChatCache,writeChatCache} from './chat-cache';
import {DesktopSettings} from './DesktopSettings';
import {DesktopWorkspaces} from './DesktopWorkspaces';
import {connectionKind} from './connection-kind';
import {WorkspaceIdentity} from './WorkspaceIdentity';
import {PairingRole} from './PairingRole';
import {WorkBoards,type BoardChat} from './WorkBoards';
import {useProjectWorkspaces} from './project-workspaces';
import {App as SharedChat} from './App';
import {DesktopDevices,type Device} from './DesktopDevices';
import {DocumentLibrary} from './DocumentLibrary';
import {watchWindowTheme} from './window-theme';
import {DesktopUpdates} from './DesktopUpdates';
import {ProviderConnections,HostStatus} from './ProviderConnections';
import {useEffect,useMemo,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {releaseRepository} from './release-update';
import {ArrowDown,BookOpen,FileText,Check,ChevronRight,Folder,GitCompareArrows,Keyboard,MessageSquare,Monitor,Plus,RefreshCw,Search,Settings,Smartphone,Wifi,X} from 'lucide-react';
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
import {useBackNavigation,useModal} from './navigation';
import type {JobView} from '../server/types';
import type {Session} from './session';
type Provider='claude'|'codex'|'copilot';
const connection:Connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
const initial:DesktopState={online:false,busy:false,status:'',startup:false,autoReconnect:true,internet:true,addresses:[],jira:false};
const name=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)||path;
const rotation=90;
// Native shells report fixed English statuses; the window shows them in the selected language.
const hostStatuses:Record<string,string>={'Ready to connect':'Готово к подключению','Disconnected':'Отключено','Host unavailable. Reconnecting…':'Сервер ПК недоступен. Переподключаемся…','Starting the host / restoring connection…':'Запускаем сервер / восстанавливаем связь…','Preparing the host. First launch may take several minutes.':'Готовим сервер. Первый запуск может занять несколько минут.','Disconnect before changing connection mode.':'Остановите сервер, чтобы сменить режим подключения.'};
const bridgeAvailable=()=>typeof window!=='undefined'&&!!(window as unknown as {chrome?:{webview?:unknown}}).chrome?.webview;
function DesktopConnection({state,action,onState,label}:{state:DesktopState;action:(command:string,args?:Record<string,unknown>)=>Promise<void>;onState:(state:DesktopState)=>void;label:(en:string,ru:string)=>string}){
  const [address,setAddress]=useState(0),[confirmStop,setConfirmStop]=useState(false),[phones,setPhones]=useState(0),[hidden,setHidden]=useState(()=>document.visibilityState==='hidden'),[left,setLeft]=useState(rotation),[install,setInstall]=useState(''),[internet,setInternet]=useState<boolean|null>(null);
  const pairing=state.addresses[Math.min(address,state.addresses.length-1)],ru=label('en','ru')==='ru';
  useEffect(()=>{const update=()=>setHidden(document.visibilityState==='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  // While this page is open the QR changes every 90 s, so an old photo of it cannot pair a device later.
  useEffect(()=>{if(!state.online||!state.addresses.length||hidden)return;setLeft(rotation);const timer=setInterval(()=>setLeft(value=>{if(value>1)return value-1;void desktopCall<DesktopState>('pairing-rotate').then(next=>{if(next)onState(next);}).catch(()=>{});return rotation;}),1000);return()=>clearInterval(timer);},[state.online,state.addresses.length>0,hidden]);
  useEffect(()=>{void QRCode.toDataURL('https://github.com/'+releaseRepository+'/releases/latest',{width:240,margin:2}).then(setInstall).catch(()=>{});},[]);
  useEffect(()=>{if(internet===state.internet)setInternet(null);},[state.internet]);
  const status=ru?hostStatuses[state.status]||state.status:state.status,routeName=(url:string)=>({Tailscale:'Tailscale',Local:label('Same Wi-Fi','Та же сеть Wi-Fi'),Internet:label('Internet (temporary)','Интернет (временный)'),Unknown:label('Other address','Другой адрес')} as Record<string,string>)[connectionKind(url)];
  async function restart(){setInternet(null);await action('toggle');await action('settings',{internet});await action('toggle');}
  return <section className="desktop-settings"><header><h1>{label('Connect your phone','Подключите телефон')}</h1><p className="muted">{label('Scan this QR in Pocket Code on Android.','Отсканируйте QR в Pocket Code на Android.')}</p></header>
    <HostStatus state={state}/>
    <div className="desktop-install">{install&&<img src={install} alt={label('QR code for the Android app download','QR-код для загрузки Android-приложения')}/>}<div><span className="desktop-step">{label('Step 1','Шаг 1')}</span><strong>{label('Install the Android app','Установите Android-приложение')}</strong><p className="muted">{label('Scan to open the latest release, download the APK and allow installation from this source.','Отсканируйте, чтобы открыть последний релиз, скачайте APK и разрешите установку из этого источника.')}</p></div></div>
    <div className="desktop-pairing"><div className={'desktop-qr'+(hidden?' concealed':'')}>{pairing?<img src={pairing.image} alt={label('Private pairing QR','Личный QR подключения')}/>:<Wifi size={48}/>}</div><div><span className="desktop-step">{label('Step 2','Шаг 2')}</span><h2>{state.online?label('Ready to connect','Готово к подключению'):label('PC connection','Подключение ПК')}</h2><p className="muted" role="status">{status}</p>{state.logs&&<button className="text-button" onClick={()=>void action('open-logs')}>{label('Open logs folder','Открыть папку логов')}</button>}
      {state.addresses.length>0&&<div className="desktop-routes" role="group" aria-label={label('Pairing address','Адрес подключения')}>{state.addresses.map((item,index)=><button key={item.url} className="desktop-route" aria-pressed={index===Math.min(address,state.addresses.length-1)} onClick={()=>setAddress(index)}><strong>{routeName(item.url)}</strong><small>{connectionKind(item.url)==='Internet'?label('Temporary link: it changes after a restart','Временная ссылка: меняется после перезапуска'):item.url}</small></button>)}</div>}
      {pairing&&<p className="desktop-qr-timer" role="timer">{hidden?label('The QR is hidden while the window is in the background.','QR скрыт, пока окно в фоне.'):label(`The QR changes in ${left} s and after each pairing.`,`QR обновится через ${left} с и после каждого подключения.`)}</p>}
      {state.online?<button className="secondary danger" disabled={state.busy} onClick={()=>setConfirmStop(true)}>{label('Stop host','Остановить сервер')}</button>:<button className="primary" disabled={state.busy||!bridgeAvailable()} onClick={()=>void action('toggle')}>{label('Connect','Подключить')}</button>}
      {!bridgeAvailable()&&<p className="muted">{label('Open Pocket Code for Windows to manage the connection.','Откройте Pocket Code для Windows, чтобы управлять подключением.')}</p>}
      {confirmStop&&<div className="desktop-stop-confirm" role="alert"><p>{phones?label(`Phones that lose the connection: ${phones}. Chats stay on the PC.`,`Телефонов потеряют связь: ${phones}. Чаты останутся на ПК.`):label('Phones will lose the connection until the host starts again.','Телефоны потеряют связь, пока сервер не запустится снова.')}</p><button className="primary danger" onClick={()=>{setConfirmStop(false);void action('toggle');}}>{label('Stop host','Остановить сервер')}</button><button className="text-button" autoFocus onClick={()=>setConfirmStop(false)}>{label('Cancel','Отмена')}</button></div>}
    </div></div>
    <label className="desktop-toggle"><input type="checkbox" checked={internet??state.internet} disabled={state.busy} onChange={event=>{if(state.online)setInternet(event.target.checked);else void action('settings',{internet:event.target.checked});}}/>{label('Connect through the internet','Подключение через интернет')}</label>
    {internet!==null&&state.online?<p className="desktop-stop-confirm"><span>{label('The host restarts to apply this. Phones reconnect automatically.','Чтобы применить, сервер перезапустится. Телефоны переподключатся сами.')}</span><button className="secondary" onClick={()=>void restart()}>{label('Restart host to apply','Перезапустить сервер, чтобы применить')}</button><button className="text-button" onClick={()=>setInternet(null)}>{label('Cancel','Отмена')}</button></p>:<p className="muted">{label('A restarted temporary tunnel may need a new QR scan.','После перезапуска временного туннеля может понадобиться новый QR.')}</p>}
    {state.keepAwake!==undefined&&<><label className="desktop-toggle"><input type="checkbox" checked={state.keepAwake} onChange={event=>void action('settings',{keepAwake:event.target.checked})}/>{label('Keep the PC awake while agents run or a phone is connected','Не давать ПК засыпать, пока работают агенты или подключён телефон')}</label><p className="muted">{label('Only on mains power. Closing the lid or choosing Sleep still interrupts access.','Только при питании от сети. Закрытие крышки и ручной сон всё равно прерывают доступ.')}</p></>}
    <DesktopDevices connection={connection} online={state.online} onDevices={(list:Device[])=>setPhones(list.filter(item=>item.status==='online').length)}/></section>;
}
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
  useChatShortcuts(true);
  const [railWidth,setRailWidth]=useState<number|null>(()=>{const value=Number(saved('rail-width',''));return value>0?railLimits(value):null;});
  useEffect(()=>{if(railWidth===null)return;const fit=()=>setRailWidth(width=>width===null?null:railLimits(width));window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[railWidth===null]);
  useBackNavigation();
  const language=useLanguage(),appearance=useAppearance(),label=(en:string,ru:string)=>language==='ru'?ru:en;
  const [state,setState]=useState(initial),[error,setError]=useState(''),[page,setPage]=useState<'work'|'workspace'|'chats'|'rules'|'changelog'|'connection'|'settings'>('chats');
  const [provider,setProvider]=useState<Provider>(()=>{const value=saved('provider','claude');return value==='codex'||value==='copilot'?value:'claude';});
  const [project,setProject]=useState(''),[search,setSearch]=useState(''),[sessions,setSessions]=useState<Session[]>([]),[projects,setProjects]=useState<string[]>([]),[jobs,setJobs]=useState<JobView[]>([]);
  const projectSpaces=useProjectWorkspaces(state.online?connection:null);
  const [noticeTarget,setNoticeTarget]=useState<BoardNoticeTarget|null>(null);
  const [localBoards,setLocalBoards]=useState(true);
  const [boardChat,setBoardChat]=useState<BoardChat|undefined>();
  const [creating,setCreating]=useState(false);
  const activity=useActivity(state.online?connection:null);
  const notices=useBoardNotices(state.online?connection:null);
  const [inboxOpen,setInboxOpen]=useState(false),[shortcutsOpen,setShortcutsOpen]=useState(false);
  const shortcutsSheet=useRef<HTMLElement|null>(null);useModal(shortcutsSheet,shortcutsOpen,()=>setShortcutsOpen(false));
  const [notificationChat,setNotificationChat]=useState<WatchedChat|null>(null);
  const [selected,setSelected]=useState<Session|null>(null),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[address,setAddress]=useState(0);
  useEffect(()=>{const unwatch=watchDesktop(setState);let active=true;void desktopCall<DesktopState>('state').then(value=>{if(active)setState(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;unwatch();};},[]);
  function openNotificationChat(chat:WatchedChat){
    if(!['claude','codex','copilot'].includes(chat.provider))return;
    setBoardChat(undefined);setNotificationChat(chat);setProvider(chat.provider as Provider);
    setSelected({sessionId:chat.sessionId||`pending-${chat.jobId}`,cwd:chat.cwd,summary:chat.title,lastModified:Date.now()});setCreating(false);setPage('chats');
  }
  useDesktopRunNotifications(state.online?connection:null,language,openNotificationChat);
  useEffect(()=>{
    persist('provider',provider);setSessions(readChatCache<Session[]>('desktop-local',provider,'sessions')||[]);setJobs([]);
    const boardTarget=boardChat&&(boardChat.taskRun?.provider||boardChat.note.chat?.provider)===provider?boardChat:null;
    const alertTarget=notificationChat?.provider===provider?notificationChat:null;
    if(!boardTarget&&!alertTarget){setSelected(null);setCreating(false);}
    setProject(boardTarget?.root||alertTarget?.cwd||saved('project-'+provider,''));
  },[provider]);
  useEffect(()=>{if(!state.online)return;let active=true;setLoading(true);
    const stop=startVisiblePoll(async()=>{try{const list=await request<Session[]>(connection,`/sessions?provider=${provider}`);if(!active)return;setSessions(old=>shareSnapshot(old,list));writeChatCache('desktop-local',provider,'sessions',list);setError('');}catch(e){if(active)setError((e as Error).message);}finally{if(active)setLoading(false);}},10000);return()=>{active=false;stop();};
  },[state.online,provider,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const folders=await request<string[]>(connection,'/projects');if(active)setProjects(old=>shareSnapshot(old,folders));}catch{/* Session project folders remain available. */}},60000);return()=>{active=false;stop();};},[state.online,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const runs=await request<JobView[]>(connection,`/jobs?provider=${provider}`);if(active)setJobs(old=>shareSnapshot(old,runs));}catch{/* Keep the last known run state during a transient disconnect. */}},1000);return()=>{active=false;stop();};},[state.online,provider,revision]);
  const latestJobs=useMemo(()=>{const map=new Map<string,JobView>();for(const job of [...jobs].sort((a,b)=>b.startedAt-a.startedAt))if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,job);return map;},[jobs]);
  const chatSessions=useMemo(()=>{const map=new Map(sessions.map(item=>[item.sessionId,item]));for(const job of latestJobs.values())if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,{sessionId:job.sessionId,cwd:job.cwd,summary:name(job.cwd),lastModified:job.startedAt});return [...map.values()].sort((a,b)=>Number(latestJobs.get(b.sessionId)?.status==='running')-Number(latestJobs.get(a.sessionId)?.status==='running')||b.lastModified-a.lastModified);},[sessions,latestJobs]);
  const allFolders=useMemo(()=>Array.from(new Set([...projects,...sessions.map(item=>item.cwd||'').filter(Boolean)])).sort(),[projects,sessions]);
  const folders=allFolders;
  // The Project page follows the chat filter, then the open chat, so both views stay on one folder.
  const projectRoot=project||selected?.cwd||folders[0]||'';
  const visible=chatSessions.filter(item=>`${item.customTitle||item.summary} ${item.cwd}`.toLowerCase().includes(search.toLowerCase()));
  async function action(command:string,args:Record<string,unknown>={}){setError('');try{const next=await desktopCall<DesktopState>(command,args);if(next)setState(next);}catch(e){setError((e as Error).message);}}
  function startChat(){if(!state.online||!projectRoot)return;setNotificationChat(null);setBoardChat(undefined);setCreating(true);setSelected(null);setPage('chats');}
  function openChat(session:Session){setNotificationChat(null);setBoardChat(undefined);setSelected(session);setPage('chats');}
  // Keyboard: Ctrl+N new chat, Ctrl+Tab / Ctrl+Shift+Tab next or previous chat, Ctrl+Alt+U inbox, Ctrl+/ the list of shortcuts.
  const shortcutActions=useRef({startChat,cycle:(_step:number)=>{}});
  shortcutActions.current={startChat,cycle:step=>{if(!visible.length)return;const index=visible.findIndex(item=>item.sessionId===selected?.sessionId);openChat(visible[index<0?(step>0?0:visible.length-1):(index+step+visible.length)%visible.length]);}};
  useEffect(()=>{const key=(event:KeyboardEvent)=>{
    if(!(event.ctrlKey||event.metaKey))return;
    if(event.code==='Slash'&&!event.altKey){event.preventDefault();setShortcutsOpen(open=>!open);return;}
    if(document.querySelector('[aria-modal="true"]'))return;
    if(event.code==='KeyN'&&!event.altKey&&!event.shiftKey){event.preventDefault();shortcutActions.current.startChat();}
    else if(event.key==='Tab'&&!event.altKey){event.preventDefault();shortcutActions.current.cycle(event.shiftKey?-1:1);}
    else if(event.code==='KeyU'&&event.altKey&&!event.shiftKey){event.preventDefault();setInboxOpen(true);}
  };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const shortcuts:[string,string][]=[['Ctrl+N',label('New chat in the current project','Новый чат в текущем проекте')],['Ctrl+Tab',label('Next chat','Следующий чат')],['Ctrl+Shift+Tab',label('Previous chat','Предыдущий чат')],['Ctrl+Alt+U',label('Open the inbox','Открыть входящие')],['Ctrl+/',label('Show keyboard shortcuts','Показать сочетания клавиш')],['Ctrl+A',label('Select the conversation','Выделить переписку')],['Ctrl+V',label('Paste into the message','Вставить в сообщение')],['Esc',label('Close a panel or dialog','Закрыть панель или диалог')]];
  const connectionPanel=<DesktopConnection state={state} action={action} onState={setState} label={label}/>;
  return <div className="desktop-app" style={railWidth===null?undefined:{['--desktop-rail-width' as string]:railWidth+'px'}}>
    {page==='workspace'&&<WorkspaceIdentity connection={state.online?connection:null} value={projectSpaces}/>}
    <aside className="desktop-rail"><RailResizer width={railWidth} onChange={setRailWidth}/>
      <nav aria-label={label('Navigation','Навигация')}>{([['work',Folder,label('Board','\u0414\u043e\u0441\u043a\u0430')],['rules',BookOpen,label('Rules','Правила')],['changelog',FileText,label('Changelog','История изменений')],['settings',Settings,label('Settings','Настройки')]] as const).map(([id,Icon,title])=>{const active=!inboxOpen&&(page===id||id==='settings'&&page==='connection');return <button key={id} className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>setPage(id)}><Icon size={19}/>{title}</button>;})}<InboxButton notices={notices} activity={activity} open={inboxOpen} onOpen={()=>setInboxOpen(true)} variant="rail"/></nav>
      <NotificationInbox open={inboxOpen} onClose={()=>setInboxOpen(false)} notices={notices} activity={activity} onOpenActivity={item=>openNotificationChat({provider:item.provider,jobId:item.id,sessionId:item.sessionId,cwd:item.cwd,title:item.title})} onOpenNotice={target=>{setNoticeTarget(target);setPage('work');}}/>
      <div className="desktop-library"><div className="provider-chips" role="group" aria-label={label('Provider','Провайдер')}>{(['claude','codex','copilot'] as const).map(id=>{const waiting=activity.items.filter(item=>item.provider===id&&(item.status==='needs_input'||item.status==='error')).length;return <button key={id} aria-pressed={provider===id} onClick={()=>setProvider(id)}>{providerName(id)}{waiting>0&&<b aria-label={label(`Needs you: ${waiting}`,`Ждут вас: ${waiting}`)}>{waiting}</b>}</button>;})}</div>
      <div className="desktop-search"><Search size={16}/><input aria-label={label('Find a chat','Найти чат')} placeholder={label('Find a chat','Найти чат')} value={search} onChange={event=>setSearch(event.target.value)}/></div>
      <div className="desktop-list-caption"><span>{label('Chats','Чаты')} · {visible.length}</span><button className="icon-button" aria-label={label('Refresh','Обновить')} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={15}/></button></div>
      <div className="desktop-sessions"><button className="desktop-new-chat" aria-pressed={creating&&!selected&&page==='chats'} aria-keyshortcuts="Control+N" title={label('New chat (Ctrl+N)','Новый чат (Ctrl+N)')} disabled={!state.online||!projectRoot} onClick={startChat}><Plus size={16}/><span><strong>{label('New chat','Новый чат')}</strong></span></button>{loading&&!sessions.length?<p role="status">{label('Loading chats…','Загружаем чаты…')}</p>:visible.map(session=>{const job=latestJobs.get(session.sessionId);const status=job?.status==='running'&&job.approvals?.length?'needs_input':job?.status;return <button key={session.sessionId} aria-pressed={page==='chats'&&selected?.sessionId===session.sessionId} onClick={()=>openChat(session)}>{status?<RunStatusDot status={status} className="desktop-chat-dot"/>:<span className="desktop-chat-dot idle"/>}<span><strong>{session.customTitle||session.summary||label('Untitled chat','Без названия')}</strong><small>{session.cwd?name(session.cwd):label('No project','Без проекта')}{!status&&<> · <time title={fullTime(session.lastModified)}>{relativeTime(session.lastModified)}</time></>}</small>{status&&<small className="desktop-run-label"><ChatRunStatus status={status}/></small>}</span><ChevronRight size={14}/></button>;})}{!loading&&!visible.length&&<p className="muted">{state.online?label('No matching chats','Нет подходящих чатов'):label('Connect the PC host to load chats.','Подключите сервер ПК, чтобы загрузить чаты.')}</p>}</div></div>
      <button className="desktop-shortcuts-button" aria-keyshortcuts="Control+/" onClick={()=>setShortcutsOpen(true)}><Keyboard size={16}/>{label('Keyboard shortcuts','Сочетания клавиш')}<kbd>Ctrl+/</kbd></button>
      <button className="desktop-connection-status" onClick={()=>setPage('connection')}><span className={'desktop-chat-dot '+(state.online?'done':'idle')}/>{state.online?label('PC connected','ПК подключён'):label('Not connected','Нет подключения')}<ChevronRight size={15}/></button>
    </aside>
    <main className="desktop-main">{error&&<div className="desktop-error" role="alert">{error}<button className="icon-button" aria-label={label('Dismiss','Закрыть')} onClick={()=>setError('')}><X size={16}/></button></div>}
    {(selected||creating)&&<div className="desktop-chat-host" hidden={page!=='chats'}><SharedChat key={provider+(selected?.sessionId||'new:'+projectRoot)+(boardChat?':'+boardChat.boardId+':'+boardChat.note.id:'')} embedded={{activity,inboxOpen,visible:page==='chats',connection,provider,session:selected||undefined,cwd:selected?.cwd||projectRoot,boardChat,jobId:selected?(notificationChat?.provider===provider&&selected.sessionId===(notificationChat.sessionId||`pending-${notificationChat.jobId}`)?notificationChat.jobId:latestJobs.get(selected.sessionId)?.id):undefined,onBoard:target=>{setNoticeTarget(target);setPage('work');},onCreated:(session,run)=>{setJobs(old=>[run,...old.filter(j=>j.id!==run.id)]);setSelected(session);setCreating(false);},onBack:()=>{setSelected(null);setCreating(false);}}}/></div>}
    {page==='workspace'?<DesktopWorkspaces connection={connection} value={projectSpaces} roots={allFolders} addresses={state.addresses} onBoard={()=>{setLocalBoards(false);setPage('work');}}/>:page==='work'?<div className="desktop-board-section"><WorkBoards focusTarget={noticeTarget} local connection={connection} roots={allFolders} workspaces={projectSpaces} onChat={target=>{setNotificationChat(null);setBoardChat(target);setProject(target.root);if(target.taskRun)setProvider(target.taskRun.provider);if(target.note.chat){setProvider(target.note.chat.provider);setSelected({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now()});setCreating(false);}else{setSelected(null);setCreating(true);}setPage('chats');}}/></div>:page==='chats'?(selected||creating?null:<div className="desktop-empty"><MessageSquare size={36}/><h1>{label('Your workspace, at a glance','Ваше рабочее пространство')}</h1><p>{label('Choose a conversation to read replies, review changes and explore AI results.','Выберите чат, чтобы читать ответы, смотреть изменения и результаты AI.')}</p><span>{label('Chat here or continue from your phone','Пишите здесь или на телефоне')}</span>{!state.online&&(bridgeAvailable()?<button className="primary" onClick={()=>setPage('connection')}>{label('Set up connection','Настроить подключение')}</button>:<p className="muted">{label('Open Pocket Code for Windows to set up the connection.','Откройте Pocket Code для Windows, чтобы настроить подключение.')}</p>)}</div>):(page==='rules'||page==='changelog')?<div className="desktop-project"><header className="document-section-heading"><h1>{page==='rules'?label('Rules','Правила'):label('Changelog','История изменений')}</h1></header><DocumentLibrary connection={connection} kind={page}/></div>:<DesktopSettings roots={allFolders} key={page} initialPage={page==='connection'?'connection':'index'} connectionPanel={connectionPanel} state={state} connection={connection} appearance={appearance} action={action}/>}
    </main>
    {shortcutsOpen&&<div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)setShortcutsOpen(false);}}><section ref={shortcutsSheet} className="confirm-modal desktop-shortcuts" role="dialog" aria-modal="true" aria-label={label('Keyboard shortcuts','Сочетания клавиш')}><Keyboard size={26}/><h2>{label('Keyboard shortcuts','Сочетания клавиш')}</h2><dl>{shortcuts.map(([keys,text])=><div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{text}</dd></div>)}</dl><button className="secondary" onClick={()=>setShortcutsOpen(false)}>{label('Close','Закрыть')}</button></section></div>}
  </div>;
}
