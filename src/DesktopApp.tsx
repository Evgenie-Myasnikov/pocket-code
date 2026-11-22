import {useCustomAccount} from './custom-account';
import {chatTitle} from './chat-title';
import {RailButton} from './RailButton';
import {ChatAtmosphere} from './ChatAtmosphere';
import {ChatActions,type ChatActionTarget} from './ChatActions';
import {ChatListActions} from './ChatListActions';
import {Fragment} from 'react';
import {PanelResizeHandle} from './PanelResizeHandle';
import './desktop-sidebar.css';
import type {BoardSelection} from './board-selection-context';
import {prepareBoardConversation,adoptBoardConversation,readBoardConversation} from './board-conversation';
import {boardConversationHost} from './board-conversation-host';
import './board-chat-compact.css';
import './compact-ui.css';
import {ProjectFolderPicker} from './ProjectFolderPicker';
import {ProviderPicker} from './ProviderPicker';
import {useActivity} from './useActivity';
import {useDesktopRunNotifications,type WatchedChat} from './chat-notifications';
import type {BoardNoticeTarget} from './BoardNotifications';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime} from './run-status';
import {providerName} from './ActivityList';
import {useChatShortcuts} from './use-chat-shortcuts';
import {useComposerPreferences,enterSends} from './composer-preferences';
import {detailMode,setDetailMode} from './detail-mode';
import {readChatCache,writeChatCache} from './chat-cache';
import {DesktopSettings} from './DesktopSettings';
import {DesktopWorkspaces} from './DesktopWorkspaces';
import {connectionKind} from './connection-kind';
import {WorkspaceIdentity} from './WorkspaceIdentity';
import {PairingRole} from './PairingRole';
import {WorkBoards,type BoardChat,type BoardRevealTarget} from './WorkBoards';
import {useProjectWorkspaces} from './project-workspaces';
import {App as SharedChat,type ChatDraft} from './App';
import {DesktopDevices,type Device} from './DesktopDevices';
import type {DocumentKind} from './DocumentLibrary';
import {watchWindowTheme} from './window-theme';
import {DesktopUpdates} from './DesktopUpdates';
import {ProviderConnections,HostStatus} from './ProviderConnections';
import {useEffect,useMemo,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {releaseRepository} from './release-update';
import {ListChecks,Home,LayoutDashboard,PanelLeftClose,PanelLeftOpen,ArrowDown,BookOpen,FileText,Check,ChevronRight,Folder,GitCompareArrows,Keyboard,MessageCirclePlus,MessageSquare,Monitor,Plus,RefreshCw,Settings,Smartphone,Wifi,X} from 'lucide-react';
import {request,type Connection} from './api';
import {loadLinkedBoard} from './board-link';
import {boardChatContext} from './board-chat-context';
import {desktopCall,watchDesktop,type DesktopState} from './desktop-bridge';
import {ConnectionStatus} from './ConnectionStatus';
import {setPrimaryHost} from './reachability';
import {hostStatusText} from './ProviderConnections';
import {useAppearance,AppearanceSettings} from './Appearance';
import {LanguageSelector} from './Language';
import {t,useLanguage} from './i18n';
import {MessageList} from './Messages';
import {Review,ChatOutputs,Subagents,DocumentLibrary} from './lazy-panels';


import {shareSnapshot} from './chat-snapshot';
import {startVisiblePoll} from './visible-poll';
import {useBackNavigation,useModal} from './navigation';
import type {JobView} from '../server/types';
import type {BoardLink,Session} from './session';
type Provider='claude'|'codex'|'copilot';
const connection:Connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
const initial:DesktopState={online:false,busy:false,status:'',startup:false,autoReconnect:true,internet:true,addresses:[],jira:false};
const name=(path:string)=>path.split(/[\\/]/).filter(Boolean).at(-1)||path;
const rotation=90;
// Native shells report fixed English statuses; the window shows them in the selected language.
const bridgeAvailable=()=>typeof window!=='undefined'&&!!(window as unknown as {chrome?:{webview?:unknown}}).chrome?.webview;
function DesktopConnection({state,action,onState,label}:{state:DesktopState;action:(command:string,args?:Record<string,unknown>)=>Promise<void>;onState:(state:DesktopState)=>void;label:(en:string,ru:string)=>string}){
  const [address,setAddress]=useState(0),[phones,setPhones]=useState(0),[hidden,setHidden]=useState(()=>document.visibilityState==='hidden'),[left,setLeft]=useState(rotation),[install,setInstall]=useState('');
  const supportsPhoneSetting=state.phoneAccess!==undefined;
  const sharing=state.online&&(state.activePhoneAccess??!supportsPhoneSetting);
  const pairing=sharing?state.addresses[Math.min(address,state.addresses.length-1)]:undefined;
  useEffect(()=>{const update=()=>setHidden(document.visibilityState==='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  // While this page is open the QR changes every 90 s, so an old photo of it cannot pair a device later.
  useEffect(()=>{if(!sharing||!state.addresses.length||hidden)return;setLeft(rotation);const timer=setInterval(()=>setLeft(value=>{if(value>1)return value-1;void desktopCall<DesktopState>('pairing-rotate').then(next=>{if(next)onState(next);}).catch(()=>{});return rotation;}),1000);return()=>clearInterval(timer);},[sharing,state.addresses.length>0,hidden]);
  useEffect(()=>{if(!sharing)return;void QRCode.toDataURL('https://github.com/'+releaseRepository+'/releases/latest',{width:240,margin:2}).then(setInstall).catch(()=>{});},[sharing]);
  const routeName=(url:string)=>({Tailscale:'Tailscale',Local:label('Same Wi-Fi','Та же сеть Wi-Fi'),Internet:label('Internet (temporary)','Интернет (временный)'),Unknown:label('Other address','Другой адрес')} as Record<string,string>)[connectionKind(url)];
  return <section className="desktop-settings">
    <header><h1>{label('Phone access','Доступ с телефона')}</h1><p className="muted">{label('Chats run on this PC. Enable phone access to open them on Android.','Чаты работают на этом ПК. Включите доступ с телефона, чтобы открывать их на Android.')}</p></header>
    {supportsPhoneSetting&&<label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.phoneAccess} disabled={state.busy} onChange={event=>void action('settings',{phoneAccess:event.target.checked})}/><span>{label('Allow phone access','Разрешить доступ с телефона')}</span></label>}
    {supportsPhoneSetting&&<p className="muted">{label('Changes apply the next time the local server starts.','Изменения применяются при следующем запуске локального сервера.')}</p>}
    {supportsPhoneSetting&&state.online&&state.activePhoneAccess!==undefined&&state.activePhoneAccess!==state.phoneAccess&&<p role="status">{state.activePhoneAccess?label('Phone access is still active for this server session.','В текущем сеансе сервера доступ с телефона ещё активен.'):label('Phone access is enabled in settings. A phone connection is currently unavailable.','Доступ с телефона включён в настройках. Подключение с телефона пока недоступно.')}</p>}
    {sharing&&<>
    <HostStatus state={state}/>
    <div className="desktop-install">{install&&<img src={install} alt={label('QR code for the Android app download','QR-код для загрузки Android-приложения')}/>}<div><span className="desktop-step">{label('Step 1','Шаг 1')}</span><strong>{label('Install the Android app','Установите Android-приложение')}</strong><p className="muted">{label('Scan to open the latest release, download the APK and allow installation from this source.','Отсканируйте, чтобы открыть последний релиз, скачайте APK и разрешите установку из этого источника.')}</p></div></div>
    <div className="desktop-pairing"><div className={'desktop-qr'+(hidden?' concealed':'')}>{pairing?<img src={pairing.image} alt={label('Private pairing QR','Личный QR подключения')}/>:<Wifi size={48}/>}</div><div>
      <span className="desktop-step">{label('Step 2','Шаг 2')}</span><h2>{phones?label('Connect another phone','Подключить ещё телефон'):label('Connect your phone','Подключите телефон')}</h2>
      <p className="muted">{pairing?label('Scan this QR in Pocket Code on Android.','Отсканируйте QR в Pocket Code на Android.'):label('Waiting for a pairing address…','Ожидаем адрес для подключения…')}</p>
      {state.addresses.length>0&&<div className="desktop-routes" role="group" aria-label={label('Pairing address','Адрес подключения')}>{state.addresses.map((item,index)=><button key={item.url} className="desktop-route" aria-pressed={index===Math.min(address,state.addresses.length-1)} onClick={()=>setAddress(index)}><strong>{routeName(item.url)}</strong><small>{connectionKind(item.url)==='Internet'?label('Temporary link: it changes after a restart','Временная ссылка: меняется после перезапуска'):item.url}</small></button>)}</div>}
      {pairing&&<p className="desktop-qr-timer" role="timer">{hidden?label('The QR is hidden while the window is in the background.','QR скрыт, пока окно в фоне.'):label(`The QR changes in ${left} s and after each pairing.`,`QR обновится через ${left} с и после каждого подключения.`)}</p>}
    </div></div>
    <DesktopDevices connection={connection} online={state.online} onDevices={(list:Device[])=>setPhones(list.filter(item=>item.status==='online').length)}/>
    </>}
    {(state.phoneAccess??true)&&<><label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.internet} disabled={state.busy||(!supportsPhoneSetting&&state.online)} onChange={event=>void action('settings',{internet:event.target.checked})}/><span>{label('Connect through the internet','Подключение через интернет')}</span></label>
      <p className="muted">{label('Internet access settings apply the next time the local server starts.','Настройки доступа через интернет применяются при следующем запуске локального сервера.')}</p></>}
    {state.keepAwake!==undefined&&<><label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.keepAwake} onChange={event=>void action('settings',{keepAwake:event.target.checked})}/><span>{label('Keep the PC awake while agents run or a phone is connected','Не давать ПК засыпать, пока работают агенты или подключён телефон')}</span></label><p className="muted">{label('Only on mains power. Closing the lid or choosing Sleep still interrupts access.','Только при питании от сети. Закрытие крышки и ручной сон всё равно прерывают доступ.')}</p></>}
    </section>;
}
function saved(key:string,fallback:string){try{return localStorage.getItem('pocket-desktop-'+key)||fallback;}catch{return fallback;}}
function persist(key:string,value:string){try{localStorage.setItem('pocket-desktop-'+key,value);}catch{}}
// The conversation keeps at least 480px; the rail stays readable at 220px.
const railLimits=(width:number)=>Math.round(Math.min(Math.max(width,220),Math.max(220,Math.min(560,window.innerWidth-480))));
function RailResizer({width,onChange}:{width:number|null;onChange:(width:number|null)=>void}){
  const ru=useLanguage()==='ru';
  const current=()=>width??(document.querySelector('.desktop-rail') as HTMLElement|null)?.getBoundingClientRect().width??290;
  const commit=(next:number|null)=>{onChange(next);persist('rail-width',next===null?'':String(next));};
  return <PanelResizeHandle className="desktop-rail-resizer" label={ru?'Ширина боковой панели':'Sidebar width'} hint={ru?'Перетащите, чтобы изменить ширину. Двойной щелчок — по умолчанию.':'Drag to resize. Double-click to reset.'} axis="x" current={current} limits={()=>({min:220,max:railLimits(560)})} onChange={onChange} onCommit={commit} onReset={()=>commit(null)}/>;
}
function BoardChatDivider(){
 const ru=useLanguage()==='ru',ref=useRef<HTMLDivElement>(null),[axis,setAxis]=useState<'x'|'y'>(()=>window.innerWidth<=1000?'y':'x'),[extent,setExtent]=useState(0),[size,setSize]=useState(0),value=useRef(0),total=useRef(0),direction=useRef<'x'|'y'>(axis);
 const limits=()=>({min:Math.min(direction.current==='x'?360:220,total.current*.4),max:Math.max(0,total.current-Math.min(direction.current==='x'?340:300,total.current*.45))});
 const apply=(next:number)=>{const {min,max}=limits();value.current=Math.round(Math.max(min,Math.min(max,next)));setSize(value.current);ref.current?.closest<HTMLElement>('.desktop-main')?.style.setProperty('--board-pane-size',value.current+'px');};
 const commit=(next:number)=>{apply(next);persist('board-chat-'+direction.current,String(total.current?value.current/total.current:.58));};
 useEffect(()=>{const main=ref.current!.closest<HTMLElement>('.desktop-main')!,query=matchMedia('(max-width:1000px)');const fit=()=>{direction.current=query.matches?'y':'x';setAxis(direction.current);const rect=main.getBoundingClientRect();total.current=direction.current==='x'?rect.width:rect.height;setExtent(total.current);const fallback=direction.current==='x'?.58:.5,ratio=Number(saved('board-chat-'+direction.current,String(fallback)));apply(total.current*(Number.isFinite(ratio)&&ratio>0&&ratio<1?ratio:fallback));};const observer=new ResizeObserver(fit);observer.observe(main);query.addEventListener('change',fit);fit();return()=>{observer.disconnect();query.removeEventListener('change',fit);main.style.removeProperty('--board-pane-size');};},[]);
 return <div ref={ref} className="desktop-board-divider"><PanelResizeHandle className="desktop-board-resizer" label={ru?'Размер чата доски':'Board chat size'} hint={ru?'Перетащите границу. Стрелки — размер, Home или двойной щелчок — по умолчанию.':'Drag the divider. Arrow keys resize; Home or double-click resets.'} axis={axis} current={()=>size||value.current} limits={()=>extent?limits():{min:0,max:0}} onChange={apply} onCommit={commit} onReset={()=>{persist('board-chat-'+direction.current,'');apply(total.current*(direction.current==='x'?.58:.5));}}/></div>;
}
export function DesktopApp(){
  useEffect(watchWindowTheme,[]);
  useChatShortcuts(true);
  const [railWidth,setRailWidth]=useState<number|null>(()=>{const value=Number(saved('rail-width',''));return value>0?railLimits(value):null;});
  useEffect(()=>{if(railWidth===null)return;const fit=()=>setRailWidth(width=>width===null?null:railLimits(width));window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[railWidth===null]);
  useBackNavigation();
  const language=useLanguage(),appearance=useAppearance(),label=(en:string,ru:string)=>language==='ru'?ru:en;
  const [state,setState]=useState(initial),[error,setError]=useState(''),[page,setPage]=useState<'tasks'|'work'|'workspace'|'chats'|'rules'|'changelog'|'settings'>('chats');
  // Re-selecting Settings (or Ctrl+,) returns to the settings root instead of keeping the last subsection.
  const [settingsNonce,setSettingsNonce]=useState(0);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key===','){event.preventDefault();setSettingsNonce(value=>value+1);setPage('settings');}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const [provider,setProvider]=useState<Provider>(()=>{const value=saved('provider','claude');return value==='codex'||value==='copilot'?value:'claude';});
  const [chatAction,setChatAction]=useState<ChatActionTarget|null>(null),[attachedProjects,setAttachedProjects]=useState<string[]>([]);
  const [projectFilter,setProjectFilter]=useState('');
  const [project,setProject]=useState(''),[sessions,setSessions]=useState<Session[]>([]),[projects,setProjects]=useState<string[]>([]),[jobs,setJobs]=useState<JobView[]>([]);
  const projectSpaces=useProjectWorkspaces(state.online?connection:null);
  const [noticeTarget,setNoticeTarget]=useState<BoardNoticeTarget|null>(null);
  const [localBoards,setLocalBoards]=useState(true);
  const [boardSelection,setBoardSelection]=useState<BoardSelection|null>(null),[boardReveal,setBoardReveal]=useState<BoardRevealTarget|null>(null);
  const [boardChat,setBoardChat]=useState<BoardChat|undefined>(),[docDraft,setDocDraft]=useState(''),[docTab,setDocTab]=useState<DocumentKind>('rules');
  const [creating,setCreating]=useState(false);
  const activity=useActivity(state.online?connection:null);
  const [railCollapsed,setRailCollapsed]=useState(()=>{try{return localStorage.getItem('pocket-desktop-sidebar-collapsed-v1')==='true';}catch{return false;}});
  function collapseRail(value:boolean){setRailCollapsed(value);try{localStorage.setItem('pocket-desktop-sidebar-collapsed-v1',String(value));}catch{}}
  const [taskChainId,setTaskChainId]=useState<string>();
  const [taskDraft,setTaskDraft]=useState<{root:string;prompt:string}>();
  const chatDrafts=useRef(new Map<string,Map<string,ChatDraft>>());
  function openTasks(id?:string){setTaskChainId(id);setPage('tasks');}
  function navigateRail(next:'chats'|'work'|'rules'|'changelog'|'settings'){if(next==='settings'&&(page==='settings'))setSettingsNonce(value=>value+1);setPage(next);if(next==='rules'||next==='changelog')setDocTab(next);}
  const [shortcutsOpen,setShortcutsOpen]=useState(false),composerPreferences=useComposerPreferences();
  const shortcutsSheet=useRef<HTMLElement|null>(null);useModal(shortcutsSheet,shortcutsOpen,()=>setShortcutsOpen(false));
  const [notificationChat,setNotificationChat]=useState<WatchedChat|null>(null);
  const [selected,setSelected]=useState<Session|null>(null),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[address,setAddress]=useState(0);
  // The window's own host is the one the supervisor watches; a failed bridge read turns the footer amber at once.
  useEffect(()=>{if(!state.online){setPrimaryHost('',null);return;}setPrimaryHost(connection.url,()=>request(connection,'/health'));},[state.online]);
  useEffect(()=>{const unwatch=watchDesktop(setState);let active=true;void desktopCall<DesktopState>('state').then(value=>{if(active)setState(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;unwatch();};},[]);
  function openNotificationChat(chat:WatchedChat){
    if(!['claude','codex','copilot'].includes(chat.provider))return;
    setBoardChat(undefined);setNotificationChat(chat);setProvider(chat.provider as Provider);
    setSelected({sessionId:chat.sessionId||`pending-${chat.jobId}`,cwd:chat.cwd,summary:chat.title,lastModified:Date.now()});setCreating(false);setPage('chats');
  }
  useDesktopRunNotifications(state.online?connection:null,language,openNotificationChat);
  useEffect(()=>{
    persist('provider',provider);setSessions(readChatCache<Session[]>('desktop-local',provider,'sessions')||[]);setJobs([]);
    const boardTarget=boardChat&&(boardChat.taskRun?.provider||boardChat.note.chat?.provider||(boardChat.conversation?readBoardConversation(boardChat.conversation.key)?.provider:undefined))===provider?boardChat:null;
    const alertTarget=notificationChat?.provider===provider?notificationChat:null;
    if(!boardTarget&&!alertTarget){setSelected(null);setCreating(false);}
    setProject('');setProjectFilter('');
    // A board chat open beside the board switches to this provider's chat of the same board.
    if(!boardTarget&&boardChat?.context&&!boardChat.taskRun)void openBoardChat(laneTarget(boardChat));
  },[provider]);
  useEffect(()=>{if(!state.online)return;let active=true;setLoading(true);
    const stop=startVisiblePoll(async()=>{try{const list=await request<Session[]>(connection,`/sessions?provider=${provider}`);if(!active)return;setSessions(old=>shareSnapshot(old,list));writeChatCache('desktop-local',provider,'sessions',list);setError('');}catch(e){if(active&&!(e as {code?:string}).code?.startsWith('host_'))setError((e as Error).message);}finally{if(active)setLoading(false);}},10000);return()=>{active=false;stop();};
  },[state.online,provider,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const folders=await request<string[]>(connection,'/projects');if(active)setProjects(old=>shareSnapshot(old,folders));}catch{/* Session project folders remain available. */}},60000);return()=>{active=false;stop();};},[state.online,revision]);
  useEffect(()=>{if(!state.online)return;let active=true;const stop=startVisiblePoll(async()=>{try{const runs=await request<JobView[]>(connection,`/jobs?provider=${provider}`);if(active)setJobs(old=>shareSnapshot(old,runs));}catch{/* Keep the last known run state during a transient disconnect. */}},1000);return()=>{active=false;stop();};},[state.online,provider,revision]);
  // Custom providers share the Claude workspace; each lists only its own chats, the PC's Claude sign-in lists the rest.
  const customAccount=useCustomAccount(),account=provider==='claude'?customAccount:'';
  const previousAccount=useRef(account);useEffect(()=>{if(previousAccount.current===account)return;previousAccount.current=account;if(!selected?.account&&!account||selected?.account===account)return;setSelected(null);setCreating(false);if(boardChat?.context&&!boardChat.taskRun)void openBoardChat(laneTarget(boardChat));},[account]);
  const latestJobs=useMemo(()=>{const map=new Map<string,JobView>();for(const job of [...jobs].sort((a,b)=>b.startedAt-a.startedAt))if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,job);return map;},[jobs]);
  const chatSessions=useMemo(()=>{const map=new Map(sessions.map(item=>[item.sessionId,item]));for(const job of latestJobs.values())if(job.sessionId&&!map.has(job.sessionId))map.set(job.sessionId,{sessionId:job.sessionId,cwd:job.cwd,summary:name(job.cwd),lastModified:job.startedAt,...(job.account?{account:job.account}:{})});return [...map.values()].filter(item=>provider!=='claude'||(item.account||'')===account).sort((a,b)=>Number(latestJobs.get(b.sessionId)?.status==='running')-Number(latestJobs.get(a.sessionId)?.status==='running')||b.lastModified-a.lastModified);},[sessions,latestJobs,provider,account]);
  const allFolders=useMemo(()=>Array.from(new Set([...projects,...sessions.map(item=>item.cwd||'').filter(Boolean)])).sort(),[projects,sessions]);
  const folders=attachedProjects;
  useEffect(()=>{if(!state.online)return;let alive=true;const load=async()=>{await request<string[]>(connection,'/chat-library/projects').then(data=>{if(alive)setAttachedProjects(data);}).catch(()=>{});};const stop=startVisiblePoll(load,60000);window.addEventListener('pocket-chat-project-added',load);return()=>{alive=false;stop();window.removeEventListener('pocket-chat-project-added',load);};},[state.online,revision]);
  // The Project page follows the chat filter, then the open chat, so both views stay on one folder.
  const projectRoot=project||selected?.cwd||allFolders[0]||'';
  const visible=chatSessions.filter(item=>!projectFilter||item.cwd===projectFilter);
  const sessionsByFolder=new Map<string,Session[]>();
  for(const session of visible){
    const root=session.cwd||'';
    const group=sessionsByFolder.get(root);
    if(group)group.push(session);else sessionsByFolder.set(root,[session]);
  }
  async function action(command:string,args:Record<string,unknown>={}){setError('');try{const next=await desktopCall<DesktopState>(command,args);if(next)setState(next);}catch(e){setError((e as Error).message);}}
  const laneTarget=(target:BoardChat):BoardChat=>({...target,conversation:undefined,resumeJobId:undefined,note:{...target.note,chat:undefined}});
  async function openBoardChat(target:BoardChat,prepared=false){
    try{if(!prepared)target=await prepareBoardConversation(connection,target,provider,false,boardConversationHost(connection),account);setNotificationChat(null);setDocDraft('');setBoardChat(target);setProject(target.root);if(target.taskRun)setProvider(target.taskRun.provider);if(target.note.chat){if(target.note.chat.provider!==provider)setProvider(target.note.chat.provider);setSelected({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now(),...(target.note.chat.provider==='claude'&&account?{account}:{})});setCreating(false);}else{setSelected(null);setCreating(true);}setPage(target.context?'work':'chats');}catch{setError(label('Could not save the board chat association.','Не удалось сохранить привязку чата доски.'));}
  }
  function startChat(){if(!state.online||!projectRoot)return;setProject(projectRoot);setDocDraft('');setNotificationChat(null);setBoardChat(undefined);setCreating(true);setSelected(null);setPage('chats');}
  function openChat(session:Session){if(session.board?.kind==='discussion'&&state.online){void openDiscussion(session,session.board);return;}openPlainChat(session);}
  function openPlainChat(session:Session){setNotificationChat(null);setBoardChat(undefined);setSelected(session);setPage('chats');}
  // A board discussion opened from the chat list returns to its board with the chat beside it; if the board is gone it stays a plain chat.
  async function openDiscussion(session:Session,link:BoardLink){
    try{
      const board=await loadLinkedBoard(connection,link);
      const target:BoardChat={root:board.root,boardId:board.id,connectionUrl:connection.url,context:{name:board.name,revision:(board as {repositoryRevision?:string}).repositoryRevision||String(board.revision)},prompt:boardChatContext(board,[]),note:{id:board.id,title:board.name,description:'',owner:'',status:'idea',priority:'normal',branch:'',x:0,y:0,dependencies:[]}};
      // The chat picked from the list becomes the board's chat, so the board and the list keep one history.
      const prepared=await adoptBoardConversation(connection,target,provider,session.sessionId,boardConversationHost(connection),session.account||account);
      setNotificationChat(null);setDocDraft('');setBoardChat({...prepared,note:{...prepared.note,chat:{provider,sessionId:session.sessionId}}});setProject(board.root);setSelected(session);setCreating(false);
      setNoticeTarget({board,connection,noteId:'',message:'',requestId:Date.now()});setPage('work');
    }catch{openPlainChat(session);}
  }
  // Keyboard: Ctrl+N new chat, Ctrl+Tab / Ctrl+Shift+Tab next or previous chat, Ctrl+O brief or detailed transcript, Ctrl+/ the list of shortcuts.
  const shortcutActions=useRef({startChat,cycle:(_step:number)=>{}});
  shortcutActions.current={startChat,cycle:step=>{if(!visible.length)return;const index=visible.findIndex(item=>item.sessionId===selected?.sessionId);openChat(visible[index<0?(step>0?0:visible.length-1):(index+step+visible.length)%visible.length]);}};
  useEffect(()=>{const key=(event:KeyboardEvent)=>{
    if(!(event.ctrlKey||event.metaKey))return;
    // Ctrl+/ closes its own sheet but never stacks it over another dialog.
    if(event.code==='Slash'&&!event.altKey){event.preventDefault();setShortcutsOpen(open=>open?false:!document.querySelector('[aria-modal="true"]'));return;}
    if(document.querySelector('[aria-modal="true"]'))return;
    if(event.code==='KeyN'&&!event.altKey&&!event.shiftKey){event.preventDefault();shortcutActions.current.startChat();}
    else if(event.key==='Tab'&&!event.altKey){event.preventDefault();shortcutActions.current.cycle(event.shiftKey?-1:1);}
    else if(event.code==='KeyO'&&!event.altKey&&!event.shiftKey){event.preventDefault();setDetailMode(detailMode('detailed')==='brief'?'detailed':'brief');}
  };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
  const shortcuts:[string,string][]=[['Ctrl+N',label('New chat in the current project','Новый чат в текущем проекте')],['Ctrl+,',label('Open Settings','Открыть настройки')],['Ctrl+Tab',label('Next chat','Следующий чат')],['Ctrl+Shift+Tab',label('Previous chat','Предыдущий чат')],['Ctrl+O',label('Brief or detailed transcript','Кратко или подробно')],['Ctrl+/',label('Show keyboard shortcuts','Показать сочетания клавиш')],['Ctrl+A',label('Select the conversation','Выделить переписку')],['Ctrl+V',label('Paste into the message','Вставить в сообщение')],
    [enterSends(composerPreferences,true)?'Enter':'Ctrl+Enter',label('Send the message (Settings → Windows application)','Отправить сообщение (Настройки → Приложение Windows)')],['Shift+Enter',label('New line in the message','Новая строка в сообщении')],['↑',label('Edit the last message (empty field)','Вернуть последнее сообщение (пустое поле)')],
    ['Ctrl+Shift+D',label('Open Review','Открыть Review')],['N / P',label('Review: next or previous file','Review: следующий или предыдущий файл')],['V',label('Review: mark the file viewed','Review: отметить файл просмотренным')],['Ctrl+B',label('Review: one or two columns','Review: одна или две колонки')],['Ctrl+Shift+M',label('Access mode of the chat','Режим доступа чата')],['Ctrl+Shift+I',label('Model','Модель')],['Ctrl+Shift+E',label('Reasoning effort','Глубина рассуждений')],
    ['Esc',label('Close a panel or dialog; in a running chat, stop the agent','Закрыть панель или диалог; в работающем чате — остановить агента')]];
  const recent=visible.reduce<Session|undefined>((latest,session)=>!latest||session.lastModified>latest.lastModified?session:latest,undefined);
  const hostStarting=state.busy||state.statusCode==='starting'||state.statusCode==='preparing';
  const localHostRecovery=!state.online&&<div className="desktop-host-recovery">
    <p role="status">{bridgeAvailable()?(hostStatusText(state)||label('Starting the local server…','Запускаем локальный сервер…')):label('Open Pocket Code for Windows to use local chats.','Откройте Pocket Code для Windows, чтобы работать с локальными чатами.')}</p>
    {bridgeAvailable()&&!hostStarting&&state!==initial&&<button className="secondary" onClick={()=>void action('restart-host')}>{label('Start local server','Запустить локальный сервер')}</button>}
    {state.logs&&<button className="text-button" onClick={()=>void action('open-logs')}>{label('Open logs folder','Открыть папку логов')}</button>}
  </div>;
  const connectionPanel=<DesktopConnection state={state} action={action} onState={setState} label={label}/>;
  return <div className="desktop-app" style={{['--desktop-rail-width' as string]:railCollapsed?'52px':railWidth===null?'clamp(280px,calc(310px * var(--ui-scale,1)),380px)':railWidth+'px'}}><ChatAtmosphere active={page==='chats'} empty={false} surface="desktop"/>
    {page==='workspace'&&<WorkspaceIdentity connection={state.online?connection:null} value={projectSpaces}/>}
    <aside className={'desktop-rail'+(railCollapsed?' rail-collapsed':'')} aria-label={label('Sidebar','Боковая панель')}>
      {!railCollapsed&&<RailResizer width={railWidth} onChange={setRailWidth}/>}
      <nav aria-label={label('Navigation','Навигация')}>
       <RailButton className="icon-button desktop-rail-toggle" aria-label={railCollapsed?label('Expand sidebar','Развернуть панель'):label('Collapse sidebar','Свернуть панель')} title={railCollapsed?label('Expand sidebar','Развернуть панель'):label('Collapse sidebar','Свернуть панель')} aria-expanded={!railCollapsed} onClick={()=>collapseRail(!railCollapsed)}>{railCollapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</RailButton>
       <RailButton className="desktop-new-chat" aria-label={label('New chat','Новый чат')} aria-keyshortcuts="Control+N" title={label('New chat (Ctrl+N)','Новый чат (Ctrl+N)')} disabled={!state.online||!projectRoot} onClick={startChat}><MessageCirclePlus aria-hidden="true" size={19}/></RailButton>
       <RailButton className={page==='chats'?'active':''} aria-label={label('Chats','Чаты')} title={label('Chats','Чаты')} aria-current={page==='chats'?'page':undefined} onClick={()=>{navigateRail('chats');if(railCollapsed)collapseRail(false);}}><Home size={18}/><span>{label('Chats','Чаты')}</span></RailButton>
       <RailButton className={page==='tasks'?'active':''} aria-label={label('Tasks','Задачи')} title={label('Tasks','Задачи')} aria-current={page==='tasks'?'page':undefined} onClick={()=>openTasks()}><ListChecks size={18}/><span>{label('Tasks','Задачи')}</span></RailButton>
       <RailButton className={page==='work'?'active':''} aria-label={label('Board','Доска')} title={label('Board','Доска')} aria-current={page==='work'?'page':undefined} onClick={()=>navigateRail('work')}><Folder size={18}/><span>{label('Board','Доска')}</span></RailButton>
       {railCollapsed&&<div className="rail-quick-chats">{visible.slice(0,6).map((item,index)=>{
         const title=item.customTitle||chatTitle(item.summary,label('Untitled chat','Без названия'));
         return <RailButton key={item.sessionId} aria-label={title} title={title} aria-pressed={page==='chats'&&selected?.sessionId===item.sessionId} onClick={()=>openChat(item)}>
           <MessageSquare aria-hidden="true" size={17}/><small aria-hidden="true">{index+1}</small>
         </RailButton>;
       })}</div>}
       <RailButton data-rail-utility className={page==='rules'?'active':''} aria-label={label('Rules','Правила')} title={label('Rules','Правила')} aria-current={page==='rules'?'page':undefined} onClick={()=>navigateRail('rules')}><BookOpen size={18}/><span>{label('Rules','Правила')}</span></RailButton>
       <RailButton className={page==='changelog'?'active':''} aria-label={label('Changelog','История изменений')} title={label('Changelog','История изменений')} aria-current={page==='changelog'?'page':undefined} onClick={()=>navigateRail('changelog')}><FileText size={18}/><span>{label('Changelog','История изменений')}</span></RailButton>
       <RailButton className={page==='settings'?'active':''} aria-label={label('Settings','Настройки')} title={label('Settings','Настройки')} aria-current={page==='settings'?'page':undefined} onClick={()=>navigateRail('settings')}><Settings size={18}/><span>{label('Settings','Настройки')}</span></RailButton>
      </nav>
      <div className="desktop-rail-content">
      <div className="desktop-rail-heading"><strong hidden={railCollapsed}>Pocket Code</strong></div>

      <div className="desktop-library" hidden={railCollapsed}><ProviderPicker connection={connection||undefined} value={provider} onChange={setProvider} attention={id=>activity.items.filter(item=>item.provider===id&&(item.status==='needs_input'||item.status==='error')).length}/>
      {folders.length>0&&<div className="desktop-project-links"><div className="desktop-list-caption">{label('Projects','Проекты')}</div>{folders.length>1?<ProjectFolderPicker label={label('Filter projects','Фильтр проектов')} paths={folders}
        value={projectFilter} allowClear placeholder={label('All projects','Все проекты')} onChange={folder=>{setProjectFilter(folder);if(folder)setProject(folder);}}/>:folders.map(folder=><button key={folder} className="rail-action" title={folder} aria-pressed={projectFilter===folder} onClick={()=>{setProjectFilter(projectFilter===folder?'':folder);setProject(folder);}}><Folder size={16}/><span>{name(folder)}</span></button>)}</div>}
      <div className="desktop-list-caption"><span>{label('Workspace chats','Чаты по папкам')}</span><button className="icon-button" aria-label={label('Refresh','Обновить')} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={16}/></button></div>
      <div className="desktop-session-groups">{loading&&!sessions.length?<p role="status">{label('Loading chats…','Загружаем чаты…')}</p>:Array.from(sessionsByFolder,([folder,items])=><details key={folder} className="rail-chat-folder" open>
        <summary title={folder}><ChevronRight size={13} aria-hidden="true"/><Folder size={15} aria-hidden="true"/><span>{folder?name(folder):label('No project','Без проекта')}</span></summary>
        <div className="desktop-sessions">{items.map((session,index)=>{const job=latestJobs.get(session.sessionId);const status=job?.status==='running'&&job.approvals?.length?'needs_input':job?.status;return <Fragment key={session.sessionId}><button style={{gridRow:index+1}} data-running={job?.status==='running'||undefined} aria-description={job?.status==='running'?label('Working','Работает'):undefined} onContextMenu={event=>{event.preventDefault();setChatAction({session,x:event.clientX,y:event.clientY,running:job?.status==='running'});}} onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const r=event.currentTarget.getBoundingClientRect();setChatAction({session,x:r.left,y:r.bottom,running:job?.status==='running'});}}} key={session.sessionId} title={[session.customTitle||session.summary,session.board?(session.board.kind==='discussion'?label('Board discussion: ','Обсуждение доски: '):session.board.kind==='task'?label('Board task: ','Задача доски: '):label('Board: ','Доска: '))+session.board.title:'',session.cwd?name(session.cwd):'',fullTime(session.lastModified)].filter(Boolean).join(' · ')} aria-pressed={page==='chats'&&selected?.sessionId===session.sessionId} onClick={()=>openChat(session)}>{status&&status!=='running'?<RunStatusDot status={status} className="desktop-chat-dot" labelled={false}/>:<span className="desktop-chat-dot" data-status="idle"/>}<span><strong>{session.board&&<LayoutDashboard className="desktop-chat-board" size={13} aria-label={label('Board chat: ','Чат доски: ')+session.board.title}/>}{session.customTitle||chatTitle(session.summary,label('Untitled chat','Без названия'))}</strong><small>{session.cwd?name(session.cwd):label('No project','Без проекта')}{!status&&<> · <time title={fullTime(session.lastModified)}>{relativeTime(session.lastModified)}</time></>}</small>{status&&status!=='running'&&<small className="desktop-run-label"><ChatRunStatus status={status}/></small>}</span><ChevronRight size={14}/></button><ChatListActions session={session} provider={provider} connection={connection} jobId={job?.id} row={index+1} running={job?.status==='running'} open={chatAction?.session.sessionId===session.sessionId} onOpen={setChatAction} onClose={()=>setChatAction(null)}/></Fragment>;})}</div></details>)}{!loading&&!visible.length&&<p className="muted">{state.online?label('No matching chats','Нет подходящих чатов'):label('Chats will load when the local server is available.','Чаты загрузятся, когда локальный сервер будет доступен.')}</p>}</div></div>
      </div>
    </aside>
    <main className={'desktop-main'+(page==='work'&&boardChat?.context&&(selected||creating)?' desktop-board-chat':'')}>{state.online&&<ConnectionStatus/>}{error&&<div className="desktop-error" role="alert">{error}<button className="icon-button" aria-label={label('Dismiss','Закрыть')} onClick={()=>setError('')}><X size={16}/></button></div>}
    {(selected||creating||page==='tasks')&&<div className="desktop-chat-host" hidden={page!=='tasks'&&page!=='chats'&&!(page==='work'&&boardChat?.context)}>{localHostRecovery}<SharedChat key={provider+':'+account+(selected?'saved':'new')+(boardChat?':'+boardChat.boardId+':'+boardChat.note.id:'')+(boardChat?.conversation?':'+boardChat.conversation.generation:'')+(docDraft?':draft':'')} embedded={{tasksPage:page==='tasks'?{initialId:taskChainId}:undefined,onOpenTasks:openTasks,draftStore:chatDrafts.current,taskDraft,onTaskDraftUsed:()=>setTaskDraft(undefined),onTaskProvider:value=>{setTaskChainId(undefined);setProvider(value);},onTaskDraft:(root,prompt)=>{if(prompt!==undefined){setTaskDraft({root,prompt});setDocDraft('');setNotificationChat(null);setBoardChat(undefined);setProject(root);setSelected(null);setCreating(true);setPage('chats');}else{if(!selected)setCreating(true);setPage(boardChat?.context?'work':'chats');}},draft:docDraft||undefined,activity,visible:page==='chats'||(page==='work'&&!!boardChat?.context),connection,provider,session:selected||undefined,cwd:selected?.cwd||projectRoot,boardSelection,boardChat,jobId:boardChat?.resumeJobId||(selected?(notificationChat?.provider===provider&&selected.sessionId===(notificationChat.sessionId||`pending-${notificationChat.jobId}`)?notificationChat.jobId:latestJobs.get(selected.sessionId)?.id):undefined),onRevealBoardSelection:target=>{setBoardReveal(target);setPage('work');},onNewBoardChat:target=>void openBoardChat(target,true),onOpenChainChat:(session,jobId)=>{setDocDraft('');setCreating(false);openPlainChat(session);if(jobId)setNotificationChat({provider,sessionId:session.sessionId,jobId,cwd:session.cwd||projectRoot,title:session.summary||''});},onBoard:target=>{setNoticeTarget(target);setPage('work');},onCreated:(session,run)=>{setProvider(run.provider||provider);setDocDraft('');setJobs(old=>[run,...old.filter(j=>j.id!==run.id)]);setSelected(session);setCreating(false);},onBack:()=>{setDocDraft('');setSelected(null);setCreating(false);setBoardChat(undefined);}}}/></div>}
    {page==='tasks'?null:page==='workspace'?<DesktopWorkspaces connection={connection} value={projectSpaces} roots={allFolders} addresses={state.addresses} onBoard={()=>{setLocalBoards(false);setPage('work');}}/>:page==='work'?<div className="desktop-board-section">{boardChat?.context&&(selected||creating)&&<BoardChatDivider/>}<WorkBoards revealTarget={boardReveal} onSelection={setBoardSelection} focusTarget={noticeTarget} local connection={connection} roots={allFolders} workspaces={projectSpaces} onChat={target=>void openBoardChat(target)}/></div>:page==='chats'?(selected||creating?null:<div className="desktop-empty"><MessageSquare size={36}/><h1>{label('Chats','Чаты')}</h1>
      {state.online&&(projectRoot?<button className="primary" onClick={startChat}>{label('Start a conversation','Начать разговор')}</button>:<p>{label('Add a project folder on the PC to start a chat.','Добавьте папку проекта на ПК, чтобы начать чат.')}</p>)}
      {localHostRecovery}
      {recent&&<button className="secondary" aria-label={label('Resume latest chat','Продолжить последний чат')} onClick={()=>openChat(recent)}>{label('Resume latest chat','Продолжить последний чат')} · {recent.customTitle||chatTitle(recent.summary,label('Untitled chat','Без названия'))}</button>}
    </div>):(page==='rules'||page==='changelog')?<div className="desktop-project"><DocumentLibrary connection={connection} kind={docTab} showHeading onKind={kind=>{setDocTab(kind);if(kind!=='files')setPage(kind);}} onChat={state.online?(root,prompt)=>{setNotificationChat(null);setBoardChat(undefined);setProject(root);setDocDraft(prompt);setSelected(null);setCreating(true);setPage('chats');}:undefined}/></div>:<DesktopSettings onShortcuts={()=>setShortcutsOpen(true)} roots={allFolders} key={page+':'+settingsNonce} connectionPanel={connectionPanel} state={state} connection={connection} appearance={appearance} action={action}/>}
    </main>
    {chatAction&&<ChatActions key={provider+chatAction.session.sessionId+chatAction.x+chatAction.y} target={chatAction} provider={provider} jobId={latestJobs.get(chatAction.session.sessionId)?.id} managementDisabled={!state.online} connection={connection} onClose={()=>setChatAction(null)} onChanged={(session,deleted)=>{setSessions(old=>{const next=deleted?old.filter(s=>s.sessionId!==session.sessionId):old.map(s=>s.sessionId===session.sessionId?session:s);writeChatCache('desktop-local',provider,'sessions',next);return next;});if(selected?.sessionId===session.sessionId){setSelected(deleted?null:session);if(deleted)setCreating(false);}setRevision(value=>value+1);}}/>}
    {shortcutsOpen&&<div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)setShortcutsOpen(false);}}><section ref={shortcutsSheet} className="confirm-modal desktop-shortcuts" role="dialog" aria-modal="true" aria-label={label('Keyboard shortcuts','Сочетания клавиш')}><Keyboard size={32}/><h2>{label('Keyboard shortcuts','Сочетания клавиш')}</h2><dl>{shortcuts.map(([keys,text])=><div key={keys+text}><dt><kbd>{keys}</kbd></dt><dd>{text}</dd></div>)}</dl><button className="secondary" onClick={()=>setShortcutsOpen(false)}>{label('Close','Закрыть')}</button></section></div>}
  </div>;
}
