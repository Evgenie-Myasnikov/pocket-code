import {useChatReturn} from './use-chat-return';
import {WorkspacePassword} from './WorkspacePassword';
import {BoardNotifications,type BoardNoticeTarget} from './BoardNotifications';
import {MobileWorkspaceHeader} from './MobileWorkspaceHeader';
import {savedWorkspaces,rememberWorkspace,workspaceJoinId,type WorkspaceAccess} from './workspace-access';
import {clearOffline} from './offline-data';
import {WorkspaceIdentity} from './WorkspaceIdentity';
import {ChatHeader} from './ChatHeader';
import {WorkBoards,type BoardChat} from './WorkBoards';
import {useProjectWorkspaces} from './project-workspaces';
import {version as packageVersion} from '../package.json';
import {positionKey,positionOnOpen,savePosition,flushPositions,clearPositions,type ChatPosition} from './chat-position';
import {UsageIndicator} from './UsageIndicator';
import './composer-controls.css';
import {shareMessages,shareSnapshot} from './chat-snapshot';
import {startVisiblePoll} from './visible-poll';
import {chatCacheScope,readChatCache,writeChatCache,clearChatCache} from './chat-cache';
import {TaskNotificationBell,TaskNotificationInbox,useTaskNotifications} from './TaskNotifications';
import type {JiraIssue} from '../server/jira';
import {AttachmentTray,type DraftAttachment} from './AttachmentTray';
import { Review } from './Review';
import {ActivityDrawer} from './ActivityDrawer';
import {ActivityHandle} from './ActivityHandle';
import {useActivity} from './useActivity';
import {useChatNotifications,useRunNotifications,type WatchedChat} from './chat-notifications';
import {EffortPicker,useCodexEffort,type EffortModel} from './EffortPicker';
import { Subagents } from './Subagents';
import { ChatOutputs } from './ChatOutputs';
import {extractChatOutputs} from './chat-outputs';
import {useBackAction,useBackNavigation,useModal} from './navigation';
import { preferences, preferredRoot, savePreferredRoot, savePreferences, selectedWorkspace, saveSelectedWorkspace, type WorkspaceProvider } from './preferences';
import { useWorkspaceState, useWorkspaceRef } from './workspace-state';
import { Updates } from './Updates';
import { useLanguage } from './i18n';
import { LanguageSelector } from './Language';
import { t, locale } from "./i18n";import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import { BookOpen, FileText, ArrowUp, ArrowLeft, Plus, Search, MessageSquare, Folder, Settings, Terminal, Wifi, ChevronDown, Paperclip, Square, X, GitBranch, RefreshCw, Laptop, LogOut, ShieldCheck, ClipboardList, Eye, EyeOff, PanelsTopLeft } from 'lucide-react';
import { Connect } from './Connect';
import { useAppearance } from './Appearance';
import {SettingsPanel,type SettingsPage} from './SettingsPanel';
import { Message, MessageList, ApprovalCard } from './Messages';
import { JiraJobs, JiraSettings } from './Jira';
import { DocumentLibrary } from './DocumentLibrary';
import { LiveTerminal } from './LiveTerminal';
import { fileBase64, loadConnection, pairDevice, request, saveConnection, type Connection } from './api';
import { demoMessages, demoSessions } from './demo';
import type { ChatMessage, JobView, SubagentView,ActivityItem } from '../server/types';

import type {Session} from './session';
type Health = {name: string;roots: string[];version: string;protocol: number;};
type ProviderInfo = {id: WorkspaceProvider;name: string;available: boolean;authenticated?: boolean;models?: EffortModel[];error?: string;};
type Attachment = DraftAttachment;
type Draft = {text: string;attachments: Attachment[];};
type RejectedDraft = Draft & {restored: boolean;};
const codexBusyMessage = 'This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
const uniqueMessages = (messages:ChatMessage[]) => [...new Map(messages.map(message=>[message.id,message])).values()];
const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
export type EmbeddedChat={visible?:boolean;connection:Connection;provider:WorkspaceProvider;session?:Session;cwd:string;jobId?:string;boardChat?:BoardChat;onCreated?(session:Session,job:JobView):void;onBack():void};
export function App({embedded}:{embedded?:EmbeddedChat}={}) {
  useBackNavigation();
  const [generation, setGeneration] = useState(0);
  return <WorkspaceApp key={generation} embedded={embedded} onDisconnect={() => setGeneration(value => value + 1)} />;
}
function WorkspaceApp({onDisconnect,embedded}: {onDisconnect():void;embedded?:EmbeddedChat}) {
  useLanguage();
  const appearanceSettings = useAppearance();
  const [provider, setProvider] = useState<WorkspaceProvider>(()=>embedded?.provider||selectedWorkspace());
  const [providers, setProviders] = useState<ProviderInfo[]>([{id:'claude',name:'Claude',available:true}]);
  const providerInfo = providers.find(item => item.id === provider);
  const engineName = provider==='copilot'?'Copilot':provider === 'codex' ? 'Codex' : 'Claude';

  const [cacheScope,setCacheScope]=useState('');
  const connectEpoch=useRef(0);
  const useStateForWorkspace = <T,>(initial:T | ((provider:WorkspaceProvider)=>T)) => useWorkspaceState(provider, initial, cacheScope);
  const useRefForWorkspace = <T,>(initial:T) => useWorkspaceRef(provider, initial, cacheScope);
  const [reviewOpen,setReviewOpen] = useStateForWorkspace(false);
  const [reviewAvailability,setReviewAvailability]=useStateForWorkspace<{key:string;mode:'working'|'branch'}|null>(null);
  const [outputsOpen,setOutputsOpen] = useStateForWorkspace(false);
  const [agentPanel,setAgentPanel] = useStateForWorkspace<{initial?:SubagentView}|null>(null);
  const [agentList,setAgentList] = useStateForWorkspace<SubagentView[]>([]);
  const [readingMode,setReadingMode] = useStateForWorkspace(false);
  const [showScrollActions, setShowScrollActions] = useStateForWorkspace(false);
  const [fromStart, setFromStart] = useStateForWorkspace(false);
  const lastScrollTop = useRefForWorkspace(0);
  const [connection, setConnection] = useState<Connection | null>(null),[saved, setSaved] = useState<Connection | null>(null);
  const [workspaceConnection,setWorkspaceConnection]=useState<Connection|null>(null),[workspaceScanner,setWorkspaceScanner]=useState(false);
  const projectSpaces=useProjectWorkspaces(embedded?connection:workspaceConnection);
  const personalBoards=useProjectWorkspaces(connection);const [localBoards,setLocalBoards]=useState(true);
  const [offline,setOffline]=useState(false);
  useEffect(()=>{const stale=()=>setOffline(true),fresh=()=>setOffline(false);window.addEventListener('pocket-offline-read',stale);window.addEventListener('pocket-online-read',fresh);return()=>{window.removeEventListener('pocket-offline-read',stale);window.removeEventListener('pocket-online-read',fresh);};},[]);
  const canRun = !offline && !!connection && providerInfo?.available === true && providerInfo.authenticated !== false && !connection?.workspaceId;
  const [boardChat,setBoardChat]=useState<BoardChat|null>(embedded?.boardChat||null);
  const [noticeTarget,setNoticeTarget]=useState<BoardNoticeTarget|null>(null);
  const [boardLaunch,setBoardLaunch]=useState<BoardChat|null>(null);
  const [workspaceAccesses,setWorkspaceAccesses]=useState<WorkspaceAccess[]>([]);
  const [health, setHealth] = useState<Health | null>(embedded?null:{name:'Offline',roots:[],version:packageVersion,protocol:1}),[sessions, setSessions] = useStateForWorkspace<Session[]>([]),[jobs, setJobs] = useStateForWorkspace<JobView[]>([]);
  const [selected, setSelected] = useStateForWorkspace<Session | null>(null),[history, setHistory] = useStateForWorkspace<ChatMessage[]>([]),[job, setJob] = useStateForWorkspace<JobView | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const projectRoots = (projects || health?.roots || []);
  const [projectReady, setProjectReady] = useStateForWorkspace(false);
  const projectChosen = useRefForWorkspace(false);
  const [cwd, setCwd] = useStateForWorkspace('');
  // Section navigation belongs to the connected PC, not to an AI provider.
  const [tab,setTab]=useWorkspaceState<'chats' | 'files' | 'changelog' | 'settings' | 'terminal' | 'jobs' | 'connection' | 'workspace'>('claude',embedded?'chats':'workspace',cacheScope);
  const [mobileChat,setMobileChat]=useWorkspaceState('claude',!embedded,cacheScope);
  const [chatViewOpen,setChatViewOpen]=useStateForWorkspace(false);
  useEffect(()=>{if(tab==='chats')setChatViewOpen(mobileChat);},[tab,mobileChat]);
  const returnToChats=()=>{setTab('chats');setMobileChat(chatViewOpen);};
  const [settingsPage,setSettingsPage]=useWorkspaceState<SettingsPage>('claude','index',cacheScope);
  const [draft, setDraft] = useStateForWorkspace(''),[search, setSearch] = useStateForWorkspace(''),[model, setModel] = useStateForWorkspace(id=>preferences(id).model);
  const codexEffort=useCodexEffort(provider==='codex'?providerInfo?.models:undefined,model);
  const [codexAccess,setCodexAccess]=useStateForWorkspace(id=>preferences(id).codexAccess);
  const [error, setError] = useStateForWorkspace(''),[networkError, setNetworkError] = useStateForWorkspace(''),[busy, setBusy] = useStateForWorkspace(false),[loading, setLoading] = useStateForWorkspace(false);
  const [hostRestarting,setHostRestarting] = useState(false);
  useEffect(()=>{const handle=(event:Event)=>setHostRestarting(!!(event as CustomEvent).detail?.active);window.addEventListener('pocket-code-host-update-restarting',handle);return()=>window.removeEventListener('pocket-code-host-update-restarting',handle);},[]);
  const [demo, setDemo] = useState(false),[attachments, setAttachments] = useStateForWorkspace<Attachment[]>([]),[uploading, setUploading] = useStateForWorkspace(false);
  const activity=useActivity(demo?null:connection);
  const taskFeed=useTaskNotifications(null,provider) // Jira is parked while Work uses project boards.;
  const taskOpenGeneration=useRef(0);
  const [taskInboxOpen,setTaskInboxOpen]=useState(false),[taskTarget,setTaskTarget]=useState<{id:string;site:string;issue:JiraIssue}|null>(null);
  useEffect(()=>{taskOpenGeneration.current++;setTaskInboxOpen(false);setTaskTarget(null);},[connection,provider]);
  useEffect(()=>{if(!taskInboxOpen)taskOpenGeneration.current++;},[taskInboxOpen,connection]);
  const activitySurface=useRef<HTMLDivElement|null>(null),activityDistance=useRef(0);
  const [activityDragging,setActivityDragging]=useState(false);
  const [activityOpen,setActivityOpen]=useState(false),[activityTarget,setActivityTarget]=useState<{item:ActivityItem;connection:Connection}|null>(null);
  const [notificationTarget,setNotificationTarget]=useState<WatchedChat|null>(null);
  useRunNotifications(demo||connection?.workspaceId?null:connection,locale().startsWith('ru')?'ru':'en');
  useChatNotifications(connection,demo?null:tab==='chats'?(mobileChat&&(selected||job)?{provider,sessionId:job?.sessionId||selected?.sessionId,jobId:job?.id,cwd,title:selected?.customTitle||selected?.summary||engineName}:null):undefined,locale().startsWith('ru')?'ru':'en',chat=>{
    if(chat.provider!=='claude'&&chat.provider!=='codex'&&chat.provider!=='copilot')return;
    setNotificationTarget(chat);setProvider(chat.provider);
  });
  useEffect(()=>{
    if(!notificationTarget||notificationTarget.provider!==provider||!connection)return;
    const target=notificationTarget;setNotificationTarget(null);
    if(busy||uploading)return;
    void openSession({sessionId:target.sessionId||`pending-${target.jobId}`,cwd:target.cwd,summary:target.title,provider,lastModified:Date.now()},target.jobId?{id:target.jobId,sessionId:target.sessionId}:undefined);
  },[notificationTarget,provider,connection,busy,uploading]);
  useEffect(()=>{setActivityOpen(false);setActivityDragging(false);setActivityTarget(null);},[connection]);
  const [takeover, setTakeover] = useStateForWorkspace(false),[pendingTakeover, setPendingTakeover] = useStateForWorkspace(false),[budget, setBudget] = useStateForWorkspace(id=>preferences(id).budget);
  const confirmation=useRef<HTMLElement|null>(null);
  useModal(confirmation,pendingTakeover,()=>setPendingTakeover(false));
  useBackAction(()=>{
    if(activityTarget){setActivityTarget(null);return true;}
    if(readingMode&&tab==='chats'){toggleReadingMode(false);return true;}
    if(tab==='settings'&&settingsPage!=='index'){setSettingsPage('index');return true;}
    if(tab!=='chats'){returnToChats();return true;}
    if(mobileChat){setMobileChat(false);return true;}
    return false;
  });
  const drafts=useRefForWorkspace<Map<string,Draft>|null>(null);
  if(!drafts.current)drafts.current=new Map();
  const submissions=useRefForWorkspace<Map<string,Draft & {key:string}>|null>(null);
  if(!submissions.current)submissions.current=new Map();
  const [rejectedDrafts,setRejectedDrafts]=useStateForWorkspace<Record<string,RejectedDraft>>({});
  const currentDraftKey=()=>job?.sessionId||selected?.sessionId||`new:${cwd}`;
  const rejectedDraft=rejectedDrafts[currentDraftKey()];
  const rememberDraft=()=>{drafts.current!.set(currentDraftKey(),{text:draft,attachments});};
  const restoreDraft=(key:string)=>{const value=drafts.current!.get(key);setDraft(value?.text||'');setAttachments(value?.attachments||[]);};
  function openActivity(item:ActivityItem){
    if(!connection||busy||uploading)return;
    rememberDraft();setActivityOpen(false);setActivityTarget({item,connection});setProvider(item.provider);
  }
  useEffect(()=>{
    if(!activityTarget||activityTarget.item.provider!==provider)return;
    const target=activityTarget;setActivityTarget(null);
    if(target.connection!==connection)return;
    // Never queue navigation behind another workspace's upload/send.
    if(busy||uploading){setActivityOpen(true);return;}
    const item=target.item;
    void openSession({sessionId:item.sessionId||`pending-${item.id}`,cwd:item.cwd,summary:item.title,provider:item.provider,lastModified:item.startedAt},{id:item.id,sessionId:item.sessionId});
  },[activityTarget,provider,busy,uploading,connection]);
  const [hasMore, setHasMore] = useStateForWorkspace<number | null>(null);
  const [loadingOlder,setLoadingOlder]=useStateForWorkspace(false);
  const pendingPosition=useRefForWorkspace<ChatPosition|null>(null);
  const paging=useRefForWorkspace<symbol|null>(null);
  const scrollAnchor=useRefForWorkspace<{height:number;top:number;epoch:number;prepend:boolean;messageId?:string;offset?:number}|null>(null);
  useEffect(()=>saveSelectedWorkspace(provider),[provider]);
  useEffect(()=>savePreferences(provider,{model,mode:"default",budget,codexAccess}),[provider,model,budget,codexAccess]);
  useEffect(()=>{
    if (!connection || !health) return;
    if (projects !== null && !projectReady) {
      if (!projectChosen.current) setCwd(preferredRoot(connection.url, projectRoots, provider));
      setProjectReady(true);
    } else if (!cwd) setCwd(preferredRoot(connection.url, health.roots, provider));
  },[connection,health,projects,projectReady,cwd,provider]);
  useEffect(()=>{if(connection&&!demo)void request(connection,'/engine-updates/settings',{provider}).catch(()=>{});},[connection,provider,demo]);
  useEffect(()=>{if(connection&&projectReady&&projects?.includes(cwd))savePreferredRoot(connection.url,cwd,provider);},[connection,cwd,projects,projectReady,provider]);
  useEffect(()=>{if(tab!=='chats')setReadingMode(false);if(provider!=='claude'&&tab==='terminal')setTab('chats');},[provider,tab]);
  const historyWindow = useRefForWorkspace(100);
  const [historyError, setHistoryError] = useStateForWorkspace('');
  const bottom = useRefForWorkspace<HTMLDivElement|null>(null),scroll = useRefForWorkspace<HTMLDivElement|null>(null),fileInput = useRefForWorkspace<HTMLInputElement|null>(null);
  const navigation = useRefForWorkspace(0),sending = useRefForWorkspace(false),nearBottom = useRefForWorkspace(true);
  const retry = useRefForWorkspace<{signature: string;id: string;} | null>(null);
  const running = job?.status === 'running';
  function acknowledgeVisibleActivity(){
    const element=scroll.current;
    if(!element||!element.getClientRects().length||element.closest('[inert]')||document.visibilityState==='hidden'||tab!=='chats'||loading||loadingOlder||error||historyError||activityOpen||activityTarget||reviewOpen||agentPanel||outputsOpen||pendingTakeover)return;
    if(element.scrollHeight-element.scrollTop-element.clientHeight>80)return;
    for(const item of activity.items){
      if(item.provider!==provider||item.status==='running'||item.status==='needs_input')continue;
      const viewedJob=job?.id===item.id&&job.status===item.status;
      const viewedHistory=item.status==='done'&&item.sessionId===selected?.sessionId&&item.resultMessageId&&history.some(message=>message.id===item.resultMessageId);
      if(viewedJob||viewedHistory)activity.markViewed(item);
    }
  }
  const acknowledgeActivity=useRef(acknowledgeVisibleActivity);acknowledgeActivity.current=acknowledgeVisibleActivity;
  useEffect(()=>{acknowledgeActivity.current();},[activity.items,job?.revision,loading,loadingOlder,history,provider,tab,mobileChat,activityOpen,activityTarget,reviewOpen,agentPanel,outputsOpen,pendingTakeover,error,historyError]);
  useEffect(()=>{const visible=()=>{if(document.visibilityState!=='hidden')requestAnimationFrame(()=>acknowledgeActivity.current());};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[]);
  const parentChatId = job?.sessionId || selected?.sessionId;
  const outputMessages=useMemo(()=>uniqueMessages([...history,...(job?.errorCode!=='codex_thread_busy'?job?.messages||[]:[])]),[history,job?.messages,job?.errorCode]);
  const runningMessages=useMemo(()=>job?.status==='running'?new Set(job.messages):null,[job?.messages,job?.status]);
  const toolResults=useMemo(()=>{const blocks=outputMessages.flatMap(message=>message.blocks),calls=new Set(blocks.filter(b=>b.type==='tool_use').map(b=>b.id));return new Map(blocks.filter(b=>b.type==='tool_result'&&b.tool_use_id&&calls.has(b.tool_use_id)).map(b=>[b.tool_use_id!,b]));},[outputMessages]);
  const hasOutputs=useMemo(()=>extractChatOutputs(outputMessages,1).length>0,[outputMessages]);
  // Review follows the open conversation, never a remembered folder from another screen.
  const reviewCwd=selected?selected.cwd:job?.cwd||cwd;
  const reviewContext=[connection?.url,provider,reviewCwd,parentChatId].join('|');
  useEffect(()=>setReviewOpen(false),[connection,reviewCwd,parentChatId]);
  const availableReview=reviewAvailability?.key===reviewContext?reviewAvailability:null;
  useEffect(()=>{
    setReviewAvailability(null);
    if(!connection||!reviewCwd||demo||selected?.readOnly||networkError||tab!=='chats'||readingMode)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
    const poll=async()=>{
      if(document.visibilityState!=='hidden'&&document.querySelector('.workspace')?.getClientRects().length)try{
        const value=await request<{available:boolean;mode:'working'|'branch'}>(connection,`/review/availability?cwd=${encodeURIComponent(reviewCwd)}`);
        if(!cancelled)setReviewAvailability(value.available&&(value.mode==='working'||value.mode==='branch')?{key:reviewContext,mode:value.mode}:null);
      }catch{if(!cancelled)setReviewAvailability(null);}
      if(!cancelled)timer=setTimeout(poll,15000);
    };
    void poll();return()=>{cancelled=true;clearTimeout(timer);};
  },[connection,reviewCwd,provider,parentChatId,tab,mobileChat,readingMode,networkError,demo,selected?.readOnly,job?.status]);
  const agentMap=useMemo(()=>{
  const agentMap = new Map<string,SubagentView>();
  for(const message of [...history,...(job?.messages || [])]) for(const block of message.blocks) if(block.agent) agentMap.set(block.agent.id,block.agent);
  for(const agent of agentList) {
    const existing=agentMap.get(agent.id);
    agentMap.set(agent.id,{...existing,...agent,name:existing && /^(Claude|Codex) agent$/.test(agent.name)?existing.name:agent.name,
      status:agent.status==='unknown'&&existing?.status && (existing.status!=='running'||running)?existing.status:agent.status});
  }
  return agentMap;
  },[history,job?.messages,agentList,running]);
  const openSubagent=useCallback((agent:SubagentView)=>setAgentPanel({initial:agent}),[setAgentPanel]);
  useEffect(()=>{
    setAgentPanel(null);setAgentList([]);setOutputsOpen(false);
    if(!connection||demo||tab!=='chats'||!parentChatId||parentChatId.startsWith('pending-'))return;
    let cancelled=false;
    async function pollAgents(){
      try{const data=await request<{agents:SubagentView[]}>(connection!,`/sessions/${encodeURIComponent(parentChatId!)}/subagents?provider=${provider}`);if(!cancelled)setAgentList(old=>shareSnapshot(old,Array.isArray(data.agents)?data.agents.filter(agent=>agent&&typeof agent.id==='string'&&typeof agent.name==='string'):[]));}
      catch{/* Main chat remains usable if an older bridge or provider cannot expose child histories. */}
    }
    const stop=startVisiblePoll(pollAgents,6000);return()=>{cancelled=true;stop();};
  },[connection,provider,parentChatId,tab,demo]);
  const api = <T,>(endpoint: string, data?: unknown) => request<T>(connection!, endpoint, data);
  useEffect(()=>{
    // Rejected turns never reached Codex. Recover only the originating draft;
    // navigation or typing a newer message must not lose either piece of work.
    for(const completed of [...(job?[job]:[]),...jobs]) {
      if(completed.status==='running')continue;
      const submitted=submissions.current!.get(completed.id);
      if(!submitted)continue;
      submissions.current!.delete(completed.id);
      if(completed.errorCode!=='codex_thread_busy')continue;
      const key=completed.sessionId||submitted.key, visible=key===currentDraftKey();
      const existing=visible?{text:draft,attachments}:drafts.current!.get(key);
      const restored=!existing?.text && !existing?.attachments.length;
      if(restored){
        drafts.current!.set(key,submitted);
        if(visible){setDraft(submitted.text);setAttachments(submitted.attachments);}
      }
      setRejectedDrafts(old=>({...old,[key]:{text:submitted.text,attachments:submitted.attachments,restored}}));
    }
  },[provider,job,jobs]);
  function addRejectedDraft() {
    if(!rejectedDraft || rejectedDraft.restored)return;
    const combined=[...attachments,...rejectedDraft.attachments.filter(item=>!attachments.some(old=>old.id===item.id))];
    if(combined.length>10){setError(t("Можно прикрепить до 10 файлов"));return;}
    setDraft([draft,rejectedDraft.text].filter(Boolean).join('\n\n'));setAttachments(combined);
    setRejectedDrafts(old=>({...old,[currentDraftKey()]:{...rejectedDraft,restored:true}}));
  }
  useEffect(()=>{if(!connection?.deviceId)return;const beat=()=>void request(connection,'/devices/heartbeat',{}).catch(()=>{});beat();const timer=setInterval(beat,15000);const revoked=(event:Event)=>{if((event as CustomEvent).detail===connection.deviceId)void disconnect();};window.addEventListener('pocket-device-revoked',revoked);return()=>{clearInterval(timer);window.removeEventListener('pocket-device-revoked',revoked);};},[connection]);
  async function connect(c: Connection) {
    const epoch=++connectEpoch.current;
    setBusy(true);setError('');
    try {
      if(c.workspaceOnly||c.workspaceInvite)throw Error('Use Connection QR to access personal PC chats. WorkSpace invitations only open shared boards.');
      const original=c;c=await pairDevice(c,packageVersion);if(epoch!==connectEpoch.current)return;
      const scope=await chatCacheScope(c),access=workspaceConnection||original.workspaceAccess,accesses=workspaceAccesses.length?workspaceAccesses:savedWorkspaces(original);
      if(!embedded)await saveConnection({...c,...(access?{workspaceAccess:access}:{}),workspaceAccesses:accesses});
      if(epoch!==connectEpoch.current)return;
      if(scope!==cacheScope){rememberPosition();rememberDraft();setProjects(null);setProviders([]);setBoardChat(null);setBoardLaunch(null);setActivityTarget(null);}
      setCacheScope(scope);setSaved(c);setConnection(c);setDemo(false);
      const h=await request<Health>(c,'/health');if(epoch!==connectEpoch.current)return;if(h.protocol!==1)throw Error(t('Обновите приложение и сервер до одной версии'));setHealth(h);
    }catch(e){if(epoch===connectEpoch.current){setError((e as Error).message);setOffline(true);}}finally{if(epoch===connectEpoch.current)setBusy(false);}
  }
  useEffect(()=>{if(embedded){void connect(embedded.connection);return;}loadConnection().then(c=>{if(!c)return;setSaved(c);if(c.workspaceOnly){setTab('settings');setSettingsPage('connection');}else void connect(c);}).catch(()=>setError(t('Не удалось прочитать сохранённое подключение. Введите ключ снова.')));},[]);
  async function switchWorkspace(access:WorkspaceAccess){
    setWorkspaceConnection(access);setLocalBoards(false);setWorkspaceScanner(false);setError('');
    await saveConnection(connection?{...connection,workspaceAccess:access,workspaceAccesses}:{...access,workspaceOnly:true,workspaceAccesses});
  }
  const [workspacePasswordRequest,setWorkspacePasswordRequest]=useState<Connection|null>(null);
  async function joinWorkspace(c:Connection,password?:string){
    setBusy(true);setError('');try{
      const linked=connection?.url===c.url?connection:undefined,previous=workspaceAccesses.find(item=>item.url===c.url&&item.workspaceId===c.workspaceId);
      const joined=await request<{token:string;workspaceId:string;deviceId?:string}>(c,'/workspace-join',{password,...(linked?{connectionToken:linked.token}:{}),...(previous?{previousToken:previous.token}:{}),joinId:await workspaceJoinId(c)});
      const catalog=await request<{workspaces:{id:string;name:string}[]}>({url:c.url,...joined},'/workspaces?workspaceId='+encodeURIComponent(joined.workspaceId));
      const access={url:c.url,...joined,name:catalog.workspaces.find(item=>item.id===joined.workspaceId)?.name},accesses=rememberWorkspace(workspaceAccesses,access);setWorkspaceAccesses(accesses);setWorkspaceConnection(access);setWorkspaceScanner(false);setLocalBoards(false);setTab('workspace');setWorkspacePasswordRequest(null);
      await saveConnection(connection?{...connection,workspaceAccess:access,workspaceAccesses:accesses}:{...access,workspaceOnly:true,workspaceAccesses:accesses});
    }catch(e){if((e as {status?:number}).status===428)setWorkspacePasswordRequest(c);setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{if(embedded&&!embedded.session&&job?.sessionId)embedded.onCreated?.({sessionId:job.sessionId,cwd:job.cwd,summary:job.messages.find(m=>m.role==='user')?.blocks.find(b=>b.type==='text')?.text||'New',lastModified:job.startedAt},job);},[job?.sessionId]);
  const embeddedOpened=useRef(false);
  useEffect(()=>{if(!embedded||!health||!connection||embeddedOpened.current)return;embeddedOpened.current=true;
    if(embedded.session){void (async()=>{try{const active=embedded.jobId?await request<JobView>(connection,'/jobs/'+embedded.jobId):undefined;await openSession(embedded.session!,active);}catch(e){setError((e as Error).message);}})();}
    else {newChat(embedded.cwd);if(embedded.boardChat)setDraft(embedded.boardChat.prompt);}
  },[health,connection,embedded]);
  useEffect(() => {
    if (!connection || demo) return;
    let cancelled = false;
    async function refreshProviders() {
      try {
        const list = await request<ProviderInfo[]>(connection!, '/providers');
        if (!cancelled && Array.isArray(list)) setProviders(old=>shareSnapshot(old,list.filter(item => item.id === 'claude' || item.id === 'codex'||item.id==='copilot')));
      } catch { /* Older bridge versions support the existing Claude workspace. */ }
    }
    const stop=startVisiblePoll(refreshProviders,30000);window.addEventListener('pocket-code-providers',refreshProviders);
    return () => {cancelled=true;stop();window.removeEventListener('pocket-code-providers',refreshProviders);};
  },[connection,demo]);
  useEffect(() => {
    if (!connection || !health || demo) return;
    let cancelled = false;
    async function refreshProjects() {
      try {
        const list = await request<string[]>(connection!, '/projects');
        if (!Array.isArray(list) || !list.every(root => typeof root === 'string')) throw new Error('Invalid project list');
        if (!cancelled) setProjects(old=>shareSnapshot(old,[...new Set([...health!.roots, ...list])]));
      } catch {
        // Older bridges still expose their configured roots through /health.
        if (!cancelled) setProjects(previous => previous || health!.roots);
      }
    }
    const stop=startVisiblePoll(refreshProjects,15000);
    return () => { cancelled = true;stop(); };
  }, [connection, health, demo]);
  useEffect(()=>{if(provider!=='claude' && model && providerInfo?.models?.length && !providerInfo.models.some(item=>item.id===model))setModel('');},[provider,providerInfo?.models,model]);
  useEffect(()=>{
    if(!cacheScope||demo)return;
    const cached=readChatCache<Session[]>(cacheScope,provider,'sessions');
    if(Array.isArray(cached))setSessions(cached);
  },[cacheScope,provider,demo]);
  useEffect(()=>{
    if(!cacheScope||demo||!selected||loading||fromStart||!outputMessages.length)return;
    const timer=setTimeout(()=>writeChatCache(cacheScope,provider,'chat:'+selected.sessionId,outputMessages.slice(-100)),400);
    return()=>clearTimeout(timer);
  },[cacheScope,provider,demo,selected?.sessionId,outputMessages,loading,fromStart]);
  useEffect(() => {
    if (!connection || demo) return;
    let cancelled = false;
    let cachedSessions:Session[]|null=null;
    async function refresh() {
      try {
        const [sessionResult,jobResult]=await Promise.allSettled([request<Session[]>(connection!, `/sessions?provider=${provider}`),request<JobView[]>(connection!, `/jobs?provider=${provider}`)]);
        if(sessionResult.status==='rejected')throw sessionResult.reason;const s=sessionResult.value,j=jobResult.status==='fulfilled'?jobResult.value:null;
        if (!cancelled) {
          const scopedSessions=s.filter(item=>!item.provider || item.provider===provider),scopedJobs=j?.filter(item=>!item.provider || item.provider===provider);
          const cacheSnapshot=shareSnapshot(cachedSessions,scopedSessions.slice(0,300));
          if(cacheScope&&cacheSnapshot!==cachedSessions)writeChatCache(cacheScope,provider,'sessions',cacheSnapshot);
          cachedSessions=cacheSnapshot;
          setSessions(old=>shareSnapshot(old,scopedSessions));if(scopedJobs)setJobs(old=>shareSnapshot(old,scopedJobs));setSelected(old=>old?shareSnapshot(old,scopedSessions.find(item=>item.sessionId===old.sessionId)||old):null);setNetworkError('');
        }
      } catch (e) {if (!cancelled) setNetworkError((e as Error).message);}
    }
    const stop=startVisiblePoll(refresh,5000);return () => {cancelled = true;stop();};
  }, [connection, demo, provider, Boolean(providerInfo),cacheScope]);
  useEffect(() => {
    if (!connection || !job || demo || job.status !== 'running') return;
    let cancelled = false,revision = -1;
    async function poll() {
      let finished = false;
      try {
        const updated = await request<JobView | null>(connection!, `/jobs/${job!.id}?revision=${revision}`);
        if (!cancelled) {setNetworkError('');if (updated) {revision = updated.revision;setJob(old=>shareSnapshot(old,updated));finished = updated.status !== 'running';}}
      } catch (e) {if (!cancelled) setNetworkError((e as Error).message);}
      return !finished;
    }
    const stop=startVisiblePoll(poll,900);return () => {cancelled = true;stop();};
  }, [connection, job?.id, job?.status, demo, provider]);
  useEffect(() => {
    if (!connection || !selected || job && job.errorCode !== 'codex_thread_busy' || demo || loading || loadingOlder || busy || tab !== 'chats') return;
    let cancelled = false;
    const epoch = navigation.current;
    async function sync() {
      try {
        const window=historyWindow.current;
        const data = await request<{messages: ChatMessage[];previous: number | null;next: number | null;}>(connection!, `/sessions/${encodeURIComponent(selected!.sessionId)}/messages?provider=${provider}&window=${window}${fromStart ? '&from=start' : ''}`);
        if (!cancelled && epoch === navigation.current && !sending.current && !paging.current && window===historyWindow.current) {setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore(fromStart ? data.next : data.previous);setHistoryError('');}
      } catch (e) {if (!cancelled) setHistoryError((e as Error).message);}
    }
    const stop=startVisiblePoll(sync,3000,false);
    return () => {cancelled = true;stop();};
  }, [connection, selected?.sessionId, job?.id, job?.errorCode, demo, loading, loadingOlder, busy, tab, fromStart, provider]);
  useEffect(() => {
    // Keep the live answer until the host has flushed it to session history.
    // Only then can normal desktop history polling take over without duplicates.
    if (!connection || demo || job?.status !== 'done' || !job.sessionId || busy || loading || loadingOlder || fromStart || tab !== 'chats') return;
    const completed = job, lastAnswer = [...completed.messages].reverse().find(message => message.role === 'assistant');
    if (!lastAnswer) return;
    const epoch = navigation.current;
    let cancelled = false;
    async function syncCompleted() {
      try {
        const window=historyWindow.current;
        const data = await request<{messages:ChatMessage[];previous:number|null}>(connection!, `/sessions/${encodeURIComponent(completed.sessionId!)}/messages?provider=${provider}&window=${window}`);
        if (cancelled || epoch !== navigation.current || sending.current || paging.current || window!==historyWindow.current) return;
        if (data.messages.some(message => message.id === lastAnswer!.id)) {
          setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore(data.previous);setHistoryError('');setJob(null);
          setSelected(old => old?.sessionId === completed.sessionId ? old : sessions.find(session => session.sessionId === completed.sessionId) || {sessionId:completed.sessionId!,provider,cwd:completed.cwd,summary:t("Текущая задача"),lastModified:completed.startedAt});
          return false;
        }
      } catch (error) {if (!cancelled && epoch === navigation.current) setHistoryError((error as Error).message);}
    }
    const stop=startVisiblePoll(syncCompleted,3000);return () => {cancelled=true;stop();};
  },[connection,provider,job?.id,job?.status,demo,busy,loading,loadingOlder,fromStart,tab]);
  useLayoutEffect(()=>{if(tab==='chats'&&scroll.current&&!loading){scroll.current.scrollTop=lastScrollTop.current;setShowScrollActions(fromStart||scroll.current.scrollHeight-scroll.current.scrollTop-scroll.current.clientHeight>=80);}},[provider,tab,mobileChat]);
  useLayoutEffect(()=>{const position=pendingPosition.current,el=scroll.current;if(!position||!el||loading||tab!=='chats')return;pendingPosition.current=null;const message=position.messageId?[...el.querySelectorAll<HTMLElement>('[data-message-id]')].find(node=>node.dataset.messageId===position.messageId):null;el.scrollTop=position.bottom?el.scrollHeight:message&&position.offset!==undefined?el.scrollTop+message.getBoundingClientRect().top-el.getBoundingClientRect().top-position.offset:position.top;lastScrollTop.current=el.scrollTop;nearBottom.current=position.bottom;setShowScrollActions(!position.bottom||fromStart);},[loading,history,provider,tab]);
  useChatReturn(selected?positionKey(cacheScope,provider,selected.sessionId):'',tab==='chats'&&(embedded?embedded.visible!==false:mobileChat),running,!loading&&!busy&&!paging.current,()=>{void jumpHistory(false);});
  function rememberPosition(){const el=scroll.current;if(!el||loading||!selected||!el.getClientRects().length)return;const top=el.getBoundingClientRect().top,message=[...el.querySelectorAll<HTMLElement>('[data-message-id]')].find(node=>node.getBoundingClientRect().bottom>top);savePosition(positionKey(cacheScope,provider,selected.sessionId),{top:el.scrollTop,window:historyWindow.current,fromStart,bottom:nearBottom.current,messageId:message?.dataset.messageId,offset:message?message.getBoundingClientRect().top-top:undefined});}
  const persistPosition=useRef(()=>{});persistPosition.current=rememberPosition;
  useEffect(()=>{const save=()=>{persistPosition.current();flushPositions();};window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);return()=>{save();window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};},[]);
  useLayoutEffect(()=>{
    const anchor=scrollAnchor.current,el=scroll.current;
    if(!anchor||!el)return;
    scrollAnchor.current=null;
    if(anchor.epoch!==navigation.current)return;
    const message=anchor.messageId?[...el.querySelectorAll<HTMLElement>('.conversation-inner > .message')].find(element=>element.dataset.messageId===anchor.messageId):null;
    el.scrollTop=message&&anchor.offset!==undefined?el.scrollTop+message.getBoundingClientRect().top-el.getBoundingClientRect().top-anchor.offset:anchor.top+(anchor.prepend?el.scrollHeight-anchor.height:0);
    lastScrollTop.current=el.scrollTop;
  },[history,provider,readingMode]);
  useLayoutEffect(() => {if (!loading && nearBottom.current && !readingMode) bottom.current?.scrollIntoView({ behavior: 'auto' });}, [history.length, job?.revision, loading, selected?.sessionId, provider, agentList.length]);
  function captureScrollAnchor(prepend:boolean) {
    const el=scroll.current;if(!el)return;
    const top=el.getBoundingClientRect().top,elements=[...el.querySelectorAll<HTMLElement>('.conversation-inner > .message')];
    const index=elements.findIndex(element=>element.getBoundingClientRect().bottom>top);
    scrollAnchor.current={height:el.scrollHeight,top:el.scrollTop,epoch:navigation.current,prepend,messageId:elements[index]?.dataset.messageId,offset:index>=0?elements[index].getBoundingClientRect().top-top:undefined};
  }
  function toggleReadingMode(value:boolean) {
    if(value&&document.activeElement instanceof HTMLElement)document.activeElement.blur();
    captureScrollAnchor(false);nearBottom.current=false;setReadingMode(value);
  }
  async function extendHistory() {
    if(!connection||!selected||demo||loading||busy||paging.current||hasMore===null||historyWindow.current>=5000)return;
    const epoch=navigation.current,nextWindow=Math.min(5000,historyWindow.current+100),requestId=Symbol('history-page');
    paging.current=requestId;setLoadingOlder(true);
    try {
      const active=job?.errorCode==='codex_thread_busy'?null:job;
      const query=provider==='codex'
        ? fromStart ? `offset=${hasMore}${active?`&end=${active.baseMessageCount}`:''}` : `window=100&end=${hasMore}`
        : `window=${nextWindow}${fromStart?'&from=start':''}${active?`&end=${active.baseMessageCount}`:''}`;
      const data=await api<{messages:ChatMessage[];previous:number|null;next:number|null}>(`/sessions/${encodeURIComponent(selected.sessionId)}/messages?provider=${provider}&${query}`);
      if(epoch!==navigation.current||paging.current!==requestId)return;
      captureScrollAnchor(!fromStart);
      nearBottom.current=false;historyWindow.current=nextWindow;
      setHistory(old=>shareMessages(old,uniqueMessages(provider==='codex'?(fromStart?[...old,...data.messages]:[...data.messages,...old]):data.messages).slice(fromStart?0:-5000,fromStart?5000:undefined)));
      setHasMore(fromStart?data.next:data.previous);setHistoryError('');
    } catch(e) {if(epoch===navigation.current)setHistoryError((e as Error).message);}
    finally {if(paging.current===requestId){paging.current=null;setLoadingOlder(false);}}
  }
  async function loadHistory(s: Session, active: JobView | null, epoch: number, older = false, beginning = fromStart) {
    if (older) historyWindow.current = Math.min(5000, historyWindow.current + 100);
    if(active?.errorCode==='codex_thread_busy')active=null;
    const data = await api<{messages: ChatMessage[];previous: number | null;next: number | null;}>(`/sessions/${encodeURIComponent(s.sessionId)}/messages?provider=${provider}&window=${historyWindow.current}${beginning ? '&from=start' : ''}${active ? `&end=${active.baseMessageCount}` : ''}`);
    if (epoch !== navigation.current) return;
    setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore(beginning ? data.next : data.previous);setHistoryError('');
  }
  async function jumpHistory(beginning: boolean) {
    if (loading || busy) return;
    pendingPosition.current=null;
    const epoch = ++navigation.current;
    paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
    nearBottom.current = false;setLoading(true);
    try {
      if (selected && !demo) {historyWindow.current = 100;await loadHistory(selected, job, epoch, false, beginning);}
      if (epoch !== navigation.current) return;
      setFromStart(beginning);setShowScrollActions(beginning);
      requestAnimationFrame(() => {
        if (epoch !== navigation.current) return;
        const el = scroll.current;
        if (el) {el.scrollTop = beginning ? 0 : el.scrollHeight;lastScrollTop.current = el.scrollTop;}
        nearBottom.current = !beginning;
      });
    } catch (e) {setError((e as Error).message);} finally
    {if (epoch === navigation.current) setLoading(false);}
  }
  useEffect(()=>{if(!boardLaunch||!health)return;const target=boardLaunch;if(!connection||target.connectionUrl&&target.connectionUrl!==connection.url){setError(t('Подключите ПК этой доски через Connection, чтобы открыть её чат.'));setBoardLaunch(null);return;}if(target.note.chat&&target.note.chat.provider!==provider){setProvider(target.note.chat.provider);return;}setBoardLaunch(null);setBoardChat(target);if(target.note.chat)void openSession({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now()});else{newChat(target.root);setDraft(target.prompt);}},[boardLaunch,provider,health]);
  useEffect(()=>{if(!boardChat||!job?.sessionId||!connection)return;const target=boardChat;setBoardChat(null);void (async()=>{try{const b=await request<any>(connection,'/boards/'+target.boardId);await request(connection,'/boards/'+b.id,{revision:b.revision,versions:b.versions,notes:b.notes.map((n:any)=>n.id===target.note.id?{...n,chat:{provider,sessionId:job.sessionId}}:n)});}catch(e){setError((e as Error).message);}})();},[job?.sessionId,boardChat,connection]);
  async function openSession(s: Session, activeJob?: Pick<JobView,'id'|'sessionId'>) {
    if (busy || uploading) return;
    rememberPosition();rememberDraft();setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
    const epoch = ++navigation.current;setSelected(s);projectChosen.current=true;setCwd(s.cwd || health!.roots[0]);setMobileChat(true);setTab('chats');
    const savedPosition=positionOnOpen(positionKey(cacheScope,provider,s.sessionId));pendingPosition.current=savedPosition;
    historyWindow.current = savedPosition?.window||100;setHistoryError('');setFromStart(savedPosition?.fromStart||false);setShowScrollActions(savedPosition?!savedPosition.bottom:false);lastScrollTop.current = savedPosition?.top||0;
    const cached=cacheScope&&!demo?readChatCache<ChatMessage[]>(cacheScope,provider,'chat:'+s.sessionId):null;
    setHistory(Array.isArray(cached)?cached:[]);setJob(null);restoreDraft(activeJob?.sessionId||s.sessionId);setError('');setTakeover(false);setHasMore(null);nearBottom.current = savedPosition?.bottom??true;
    if (demo) {setHistory(demoMessages);return;}
    setLoading(true);
    try {
      const active = activeJob || jobs.find((j) => j.sessionId === s.sessionId && j.status === 'running');
      const full = active ? await api<JobView>(`/jobs/${active.id}`) : null;
      if (epoch !== navigation.current) return;
      if(full&&(full.provider||'claude')!==provider)throw new Error(t('Чат относится к другому рабочему пространству.'));
      if(full)setHistory([]);
      setJob(full);setTakeover(Boolean(full));
      const resolved=full?.sessionId?{...s,sessionId:full.sessionId,cwd:full.cwd}:s;
      if(resolved.sessionId!==s.sessionId)setSelected(resolved);
      if (!resolved.sessionId.startsWith('pending-')) await loadHistory(resolved, full, epoch, false, savedPosition?.fromStart||false);
    } catch (e) {if (epoch === navigation.current) setError((e as Error).message);} finally {if (epoch === navigation.current) setLoading(false);}
  }
  function newChat(project = cwd) {
    if (busy || uploading) return;
    rememberPosition();
    rememberDraft();setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;navigation.current++;setSelected(null);setHistory([]);setJob(null);restoreDraft(`new:${project}`);setError('');setHasMore(null);
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    pendingPosition.current=null;projectChosen.current=true;setCwd(project);setMobileChat(true);setTab('chats');setTakeover(true);setLoading(false);
  }
  async function send(confirmed = takeover) {
    if (sending.current || loading || uploading || demo || !canRun || selected?.readOnly || !draft.trim() && !attachments.length) return;
    if(running&&job){
      sending.current=true;setBusy(true);setError('');
      const epoch=navigation.current,data={text:draft,attachments:attachments.map(item=>item.id)},signature=JSON.stringify({jobId:job.id,...data});
      const id=retry.current?.signature===signature?retry.current.id:crypto.randomUUID();retry.current={signature,id};
      try{
        const next=await api<JobView>(`/jobs/${job.id}/messages`,{...data,id});
        if(epoch!==navigation.current)return;
        setJob(next);setDraft('');setAttachments([]);drafts.current!.delete(currentDraftKey());retry.current=null;nearBottom.current=true;
      }catch(error){if(epoch===navigation.current)setError((error as Error).message);}
      finally{sending.current=false;setBusy(false);}
      return;
    }
    const sessionId = job?.sessionId || selected?.sessionId;
    if (sessionId && !confirmed) {setPendingTakeover(true);return;}
    sending.current = true;setBusy(true);setError('');
    const epoch = ++navigation.current;
    const data = { provider, cwd, sessionId, text: draft, attachments: attachments.map((a) => a.id), model:provider==='copilot'?(model||'auto'):provider==='codex'?(codexEffort.options.length?codexEffort.modelId||model:model):(model||'sonnet'), mode: "default", ...(provider==='claude'?{maxBudgetUsd:budget}:provider==='codex'?{codexAccess,reasoningEffort:codexEffort.value||codexEffort.defaultValue||undefined}:{}), takeoverConfirmed: confirmed };
    const signature = JSON.stringify(data);
    const id = retry.current?.signature === signature ? retry.current.id : crypto.randomUUID();retry.current = { signature, id };
    try {
      const next = await api<JobView>('/jobs', { ...data, id });
      if (epoch !== navigation.current) return;
      // Freeze the displayed history before the next turn; the server saves full history independently.
      if (job && job.errorCode!=='codex_thread_busy') setHistory((old) => [...old, ...job.messages]);
      if(provider==='codex')submissions.current!.set(next.id,{key:currentDraftKey(),text:draft,attachments});
      drafts.current!.delete(currentDraftKey());
      setRejectedDrafts(old=>{const next={...old};delete next[currentDraftKey()];return next;});
      setJob(next);setTakeover(true);setDraft('');setAttachments([]);retry.current = null;nearBottom.current = true;
    } catch (e) {if (epoch === navigation.current) setError((e as Error).message);} finally {sending.current = false;setBusy(false);}
  }
  async function upload(files: FileList | File[] | null) {
    if (!files || !connection || uploading) return;
    setUploading(true);setError('');
    const epoch = navigation.current;
    try {
      if (files.length + attachments.length > 10) throw new Error(t("Можно прикрепить до 10 файлов"));
      for (const file of Array.from(files)) {
        const a = await api<Attachment>('/uploads', { cwd, name: file.name, base64: await fileBase64(file) });
        if (epoch === navigation.current) setAttachments((old) => [...old, {...a,file}]);
      }
    } catch (e) {setError((e as Error).message);} finally {setUploading(false);if (fileInput.current) fileInput.current.value = '';}
  }
  function startDemo() {setDemo(true);setSessions(demoSessions);setHealth({ name: t("Рабочий компьютер"), roots: ['D:\\Projects\\my-app'], version: '0.10.0', protocol: 1 });setCwd('D:\\Projects\\my-app');setSelected(demoSessions[0]);setHistory(demoMessages);}
  // Leaving on the phone also removes it from the PC's device list; an unreachable or older PC is not a blocker.
  async function disconnect() {try {if(workspaceConnection&&!workspaceConnection.deviceId)await request(workspaceConnection,'/workspace-logout',{}).catch(()=>{});if(connection?.deviceId)await Promise.race([request(connection,'/devices/self/forget',{}).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);await saveConnection(null);clearOffline();try{localStorage.removeItem("pocket-own-profile");}catch{}clearChatCache();persistPosition.current=()=>{};clearPositions();onDisconnect();}catch(e){setError((e as Error).message);}}
  if(workspacePasswordRequest)return <WorkspacePassword busy={busy} error={error} onCancel={()=>{setWorkspacePasswordRequest(null);setError('');}} onSubmit={password=>void joinWorkspace(workspacePasswordRequest,password)}/>;
  // Without a reachable PC the phone still checks, downloads and offers the latest release itself.
  if(!health&&embedded)return <div className="desktop-empty" role="status">{error||t("Loading...")}{error&&<button className="secondary" onClick={()=>void connect(embedded.connection)}>{t("Retry")}</button>}</div>;
  if (!health) return <><Connect initial={saved} onConnect={connect} onDemo={startDemo} busy={busy} error={error} /><Updates connection={null} expanded={false} /></>;
  const visible = sessions.filter((s) => `${s.customTitle || ""} ${s.summary} ${s.cwd}`.toLowerCase().includes(search.toLowerCase()));
  const workspacePicker = (location:'sidebar'|'header'|'settings') => <label className={`workspace-picker workspace-picker-${location}`}>{location==='settings'&&<span>{t("Провайдер")}</span>}<select aria-label={t("Провайдер")} value={provider} disabled={demo} onChange={event=>setProvider(event.target.value as WorkspaceProvider)}><option value="claude">Claude</option><option value="codex">Codex</option><option value="copilot">GitHub Copilot</option></select></label>;
  const chatStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status));
  const chatStatusLabel=chatStatus?t(({needs_input:'Waiting for input',error:'Error',running:'Running',done:'Completed'} as const)[chatStatus]):'';
  const chatStatusDot=chatStatus?<span className={'chat-tab-status chat-tab-status-'+chatStatus} aria-hidden="true"/>:null;
  return <div className={`app ${embedded?'embedded-chat':''} ${mobileChat ? 'show-chat' : ''} ${readingMode&&tab==='chats'?'reading-mode':''}`}>

    {taskInboxOpen&&connection&&<TaskNotificationInbox feed={taskFeed} onClose={()=>setTaskInboxOpen(false)} onOpen={async item=>{const generation=taskOpenGeneration.current;if(item.provider!=='jira')throw Error('Task provider unavailable');const issue=await request<JiraIssue>(connection,'/jira/issue?'+new URLSearchParams({site:item.scope,key:item.key,provider}));if(generation!==taskOpenGeneration.current)throw Error('Task navigation cancelled');setTaskTarget({id:item.id,site:item.scope,issue});setTab('jobs');setMobileChat(true);}}/>}
    {(activityOpen||activityDragging)&&<ActivityDrawer surfaceRef={activitySurface} dragging={activityDragging} reveal={activityDistance.current} items={activity.items} loading={activity.loading} error={activity.error} busy={busy||uploading||Boolean(activityTarget)} onRetry={activity.refresh} onOpen={openActivity} onClose={()=>setActivityOpen(false)}/>}
    {readingMode&&tab==='chats' && <button className="icon-button reading-exit" aria-label={t("Выйти из режима чтения")} title={t("Выйти из режима чтения")} onClick={()=>toggleReadingMode(false)}><EyeOff size={21}/></button>}
    <ActivityHandle count={activity.count} disabled={demo} onOpen={()=>setActivityOpen(true)} onDrag={distance=>{activityDistance.current=distance;setActivityDragging(true);activitySurface.current?.style.setProperty('--activity-reveal',`${distance}px`);}} onDragEnd={open=>{setActivityDragging(false);setActivityOpen(open);}}/>
    <aside className="sidebar">
      <div className="chat-list-actions">{workspacePicker('sidebar')}
      </div>
      <nav className="desktop-tabs"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => {setTab('jobs');setMobileChat(true);}}><ClipboardList size={17} />{(locale().startsWith('ru')?'Доска':'Board')}</button><button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={17} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}><BookOpen size={17} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} onClick={()=>{setTab('changelog');setMobileChat(true);}}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={17} />{t("Настройки")}</button></nav>
      <div className="search"><Search size={16} /><input aria-label={t("Найти чат")} placeholder={t("Найти в чатах")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="session-list"><div className="list-label">{t("ВАШИ ЧАТЫ ")}<span>{visible.length}</span></div>
        <button className={`session-row ${!selected&&!job?'selected':''}`} aria-label="New" disabled={busy||uploading} onClick={()=>newChat()}><MessageSquare size={16}/><div><strong>New</strong></div></button>
        {jobs.filter((j) => j.status === 'running' && !sessions.some((s) => s.sessionId === j.sessionId)).map((j) => <button className="session-row" key={j.id} onClick={() => void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: t("Текущая задача"), cwd: j.cwd, lastModified: j.startedAt }, j)}><span className="pulse-dot" /><div><strong>{t("Текущая задача")}</strong><small>{basename(j.cwd)}</small></div></button>)}
        {visible.map((s) => <button className={`session-row ${selected?.sessionId === s.sessionId ? 'selected' : ''}`} disabled={busy || uploading} key={s.sessionId} onClick={() => void openSession(s)}><MessageSquare size={16} /><div><strong>{s.customTitle || s.summary || t("Без названия")}</strong><small>{s.source === 'desktop' ? 'Desktop · ' : ''}{basename(s.cwd || '')}{s.archived ? t(" · Архив") : ''}<span>·</span>{new Date(s.lastModified).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</small></div>{jobs.some((j) => j.sessionId === s.sessionId && j.status === 'running') && <span className="pulse-dot" />}</button>)}
        {!visible.length && <div className="empty-list"><MessageSquare size={26} /><p>{search ? t("Ничего не найдено") : t("Здесь появятся чаты {0} из разрешённых папок.",engineName)}</p></div>}
      </div></aside>
    <main className="workspace">{!embedded&&!readingMode&&<BoardNotifications connection={workspaceConnection||connection} onOpen={target=>{setNoticeTarget(target);setLocalBoards(!workspaceConnection);setWorkspaceScanner(false);setTab('workspace');}}/>}
      {reviewOpen && connection && reviewCwd && <Review key={reviewContext} connection={connection} cwd={reviewCwd} initialMode={availableReview?.mode} onClose={()=>setReviewOpen(false)}/>}
      {agentPanel && connection && parentChatId && <Subagents key={`${provider}-${parentChatId}`} connection={connection} provider={provider} parentId={parentChatId} initialAgent={agentPanel.initial} initialAgentId={agentPanel.initial?.id} onClose={()=>setAgentPanel(null)}/>}
      {outputsOpen && connection && <ChatOutputs provider={provider} sessionId={parentChatId||undefined} key={`${provider}:${parentChatId||cwd}`} connection={connection} cwd={cwd} messages={outputMessages} onClose={()=>setOutputsOpen(false)} hasMore={hasMore!==null&&historyWindow.current<5000} loadingMore={loadingOlder} onLoadMore={()=>void extendHistory()} />}
      {tab==='chats'?<>
        <ChatHeader title={selected?.customTitle||selected?.summary||t('Новый разговор')} project={basename(selected?.cwd||cwd)} provider={engineName} branch={selected?.gitBranch}
          onBack={()=>embedded?embedded.onBack():setMobileChat(false)}
          review={availableReview?{disabled:!connection||demo||!!selected?.readOnly,open:()=>setReviewOpen(true)}:undefined}
          outputs={hasOutputs||Boolean(selected)?{disabled:!connection||demo||loading,open:()=>setOutputsOpen(true)}:undefined}
          reading={outputMessages.length>0||Boolean(job?.partial)?{disabled:loading||!history.length&&!job,open:()=>toggleReadingMode(true)}:undefined}/>
        {!selected&&!job&&<div className="chat-start-context"><label className="project-picker"><Folder size={14}/><select aria-label={t('Папка проекта')} title={cwd} value={cwd} disabled={busy||uploading} onChange={event=>newChat(event.target.value)}>{!projectRoots.includes(cwd)&&<option value={cwd}>{basename(cwd)}</option>}{projectRoots.map(root=><option key={root} value={root}>{basename(root)}</option>)}</select></label>{workspacePicker('header')}</div>}
      </>:tab==='workspace'?<header className="chat-header" data-section="board"><h1>{t("Доска")}</h1></header>:tab==='jobs'?null:<header className="chat-header" data-section={tab}>
        {tab==='terminal'&&<button className="icon-button mobile-back" aria-label={t("К списку чатов")} onClick={() => embedded?embedded.onBack():setMobileChat(false)}><ArrowLeft size={21} /></button>}
        <div className="header-title">{(!embedded&&(tab==='terminal')) && <label className="project-picker"><Folder size={14}/><select aria-label={t("Папка проекта")} title={cwd} value={cwd} disabled={busy||uploading} onChange={event=>newChat(event.target.value)}>{!projectRoots.includes(cwd)&&<option value={cwd}>{basename(cwd)}</option>}{projectRoots.map(root=><option key={root} value={root}>{basename(root)}</option>)}</select></label>}<strong>{tab==='connection'?'Connection':tab==='settings'?t("Настройки"):tab==='files'?t("Правила"):tab==='changelog'?t("История изменений"):tab==='terminal'?t("Терминал"):selected?.customTitle||selected?.summary||t("Новый разговор")}</strong></div>

        
        {(!embedded&&(tab==='terminal'))&&workspacePicker('header')}
      </header>}
      {offline&&<div className="network-banner" role="status">{locale().startsWith('ru')?'Офлайн · сохранённые данные, только просмотр':'Offline · saved data, read-only'}</div>}
      {demo && <div className="demo-banner">{t("Демо · пример интерфейса, без подключения к Claude")}<button onClick={() => void disconnect()}>{t("Подключить ПК →")}</button></div>}
      {historyError && tab==='chats' && <div className="network-banner" role="status">{t("История не обновилась: ")}{t(historyError)}</div>}
      {networkError && !hostRestarting && <div className="network-banner" role="status"><RefreshCw size={14} />{t(networkError)}</div>}
      {!canRun && !demo && tab==='chats' && connection && <div className="network-banner" role="status">{providerInfo?.error ? t(providerInfo.error) : providerInfo ? t("{0} недоступен. Установите приложение и войдите в аккаунт на ПК.",engineName) : t("Обновите сервер на ПК, чтобы включить рабочее пространство Codex.")}</div>}
      <Updates connection={connection} expanded={tab === 'settings'&&settingsPage === 'updates'} />
      {tab === 'connection' ? <Connect initial={saved?.workspaceOnly?null:saved} onConnect={connect} busy={busy} error={error}/> : tab === 'workspace' ? connection?<WorkBoards focusTarget={noticeTarget} compactContext local connection={connection} roots={projectRoots} workspaces={personalBoards} onChat={setBoardLaunch}/>:<div className="center-message">{t('Подключитесь к ПК в настройках')}</div> : tab === 'jobs' ? (embedded?connection:workspaceConnection)?<WorkBoards focusTarget={noticeTarget} connection={(embedded?connection:workspaceConnection)!} roots={projects||health.roots} workspaces={projectSpaces} onChat={setBoardLaunch}/>:null : tab === 'terminal' ? provider !== 'claude' ? <div className="center-message">{t("Терминал доступен в рабочем пространстве Claude. С Codex можно работать в чате.")}</div> : connection && !demo && !selected?.readOnly ? <LiveTerminal connection={connection} cwd={cwd} sessionId={selected?.sessionId} /> : <div className="center-message">{t("Живой терминал доступен после подключения к ПК.")}</div> : (tab === 'files'||tab==='changelog') ? (connection||workspaceConnection) ? <DocumentLibrary connection={(connection||workspaceConnection)!} kind={tab==='files'?'rules':'changelog'}/> : <div className="center-message">{t("Файлы доступны после подключения к ПК.")}</div> : tab === 'settings' ? <SettingsPanel connectionPanel={<Connect initial={saved?.workspaceOnly?null:saved} onConnect={connect} busy={busy} error={error}/>} workspaceSelector={workspacePicker('settings')} page={settingsPage} onPage={setSettingsPage} provider={provider} connection={connection} computerName={health.name} networkError={networkError} roots={projectRoots} cwd={cwd} onProject={root=>{newChat(root);setTab('settings');setSettingsPage('workspace');}} appearance={appearanceSettings} codexAccess={codexAccess} onCodexAccess={setCodexAccess} budget={budget} onBudget={setBudget} onDisconnect={()=>void disconnect()}/> : <>
        <div className="conversation" ref={scroll} style={{overflowAnchor:'none'}} onScroll={() => {const el = scroll.current!;if(!el.getClientRects().length||tab!=='chats')return;const previous=lastScrollTop.current;nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;setShowScrollActions(fromStart||!nearBottom.current);lastScrollTop.current = el.scrollTop;rememberPosition();acknowledgeVisibleActivity();if(fromStart?el.scrollTop>previous&&nearBottom.current:el.scrollTop<previous&&el.scrollTop<=40)void extendHistory();}}>
          <div className="conversation-inner">{selected && !demo && <p className="muted history-meta" role="status">{selected.source === 'desktop' ? `${engineName} Desktop · ` : ''}{job ? t("Продолжение с телефона") : t("История обновляется каждые 3 секунды")}</p>}{selected?.readOnly && <p className="info-card">{t("Только просмотр. Чтобы продолжить чат и работать с файлами, запустите сервер с папкой этого проекта: ")}{cwd}</p>}<div className="conversation-date"><span />{demo ? t("ПРИМЕР РАЗГОВОРА") : t("РАБОЧЕЕ ПРОСТРАНСТВО")}<span /></div>
            {loading && <div className="center-message">{t("Загружаем историю с ПК…")}</div>}
            {!loading && !history.length && !job && !selected && <div className="welcome"><div className="welcome-symbol">✳</div><h1>{t("Что создадим сегодня?")}</h1><p>{t("Файлы, инструменты и контекст вашего ПК.")}<br />{t("Теперь под рукой.")}</p><div className="suggestions">{[t("Изучи структуру проекта"), t("Помоги найти и исправить ошибку"), t("Составь план новой функции")].map((t) => <button key={t} onClick={() => setDraft(t)}>{t}<ArrowUp size={15} /></button>)}</div></div>}
            {!loading && selected && !history.length && !job && <p className="muted">{t("В локальной истории пока нет сообщений. Проверьте, что этот чат открыт в {0} на ПК.",engineName)}</p>}
            {selected&&!loading&&<p className="history-page-status muted" role="status" aria-live="polite">{loadingOlder?(locale().startsWith('ru')?'Загружаем сообщения…':'Loading messages…'):historyError?(locale().startsWith('ru')?'Не удалось обновить историю':'History could not be refreshed'):fromStart||hasMore===null?(locale().startsWith('ru')?'Начало чата':'Beginning of chat'):(locale().startsWith('ru')?'Выше есть ещё сообщения · прокрутите вверх':'More messages above · scroll up')}{historyError&&hasMore!==null&&<button className="text-button" onClick={()=>void extendHistory()}>{locale().startsWith('ru')?'Повторить загрузку':'Retry loading'}</button>}</p>}
            <MessageList key={`${provider}-history`} provider={provider} messages={history} toolResults={toolResults} runningMessages={runningMessages} agents={agentMap} onSubagent={connection&&parentChatId ? openSubagent : undefined}/>
            {hasMore !== null && historyWindow.current >= 5000 && <p className="muted" role="status">{t("Достигнут предел окна: 5000 сообщений")}</p>}
            {job&&job.errorCode!=='codex_thread_busy' && <MessageList key={`${provider}-${job.id}`} provider={provider} messages={job.messages} toolResults={toolResults} runningMessages={runningMessages} agents={agentMap} onSubagent={connection&&parentChatId ? openSubagent : undefined}/>}
            {agentMap.size>0 && connection && parentChatId && <div className="subagent-activity"><button className="secondary" onClick={()=>setAgentPanel({})}>{t('Субагенты · {0}',agentMap.size)}{[...agentMap.values()].some(agent=>agent.status==='running')?' · '+t('Работают: {0}',[...agentMap.values()].filter(agent=>agent.status==='running').length):''}</button></div>}
            {job?.partial && <Message key={provider} provider={provider} message={{ id: 'partial', role: 'assistant', blocks: [{ type: 'text', text: job.partial }] }} />}
            {job?.approvals.map((a) => <ApprovalCard key={`${provider}-${a.id}`} provider={provider} approval={a} decide={async (allow, answers) => {await api(`/jobs/${job.id}/approvals/${a.id}`, { allow, answers });}} />)}
            {running && <div className="working"><span className="pulse-dot" />{job.approvals.length ? t("{0} ждёт вашего решения",engineName) : t("{0} работает на компьютере…",engineName)}</div>}
            {job?.error && job.errorCode!=='codex_thread_busy' && <div className="error">{t(job.error)}</div>}{job?.status === 'stopped' && <p className="muted">{t("Задача остановлена. Можно отправить новое сообщение.")}</p>}
            {job?.status === 'done' && <div className="turn-complete" role="status"><ShieldCheck size={13} />{t(" Готово ")}{job.cost !== undefined && <span>· ${job.cost.toFixed(4)}</span>}</div>}
            <div ref={bottom} />
          </div>
        </div>
        <div className="chat-scroll-actions" hidden={!showScrollActions && !fromStart} style={!showScrollActions && !fromStart ? { display: 'none' } : undefined}><button className="secondary" disabled={loading || busy} onClick={() => void jumpHistory(true)}><ArrowUp size={16} />{t("В начало чата")}</button><button className="secondary" disabled={loading || busy} onClick={() => void jumpHistory(false)}>{t("К новым сообщениям ↓")}</button></div>
        {Boolean(job?.pendingInputIds?.length)&&<p className="followup-status" role="status">{t(running?"Queued follow-ups: {0}":"Unprocessed follow-ups: {0}",job!.pendingInputIds!.length)}</p>}
        <div className="composer-area">{error && <div className="error" role="alert">{t(error)}<button aria-label={t("Закрыть ошибку")} className="icon-button" onClick={() => setError('')}><X size={14} /></button></div>}
          {(rejectedDraft || job?.errorCode==='codex_thread_busy') && <div className="error" role="alert"><p>{t(codexBusyMessage)}</p>{rejectedDraft && <><p>{rejectedDraft.restored?t("Сообщение и вложения возвращены в черновик. Нажмите «Отправить», когда чат освободится на ПК."):t("Новый черновик сохранён. Неотправленное сообщение и вложения можно добавить к нему.")}</p>{!rejectedDraft.restored && <button className="secondary" disabled={busy||running||uploading} onClick={addRejectedDraft}>{t("Добавить неотправленное сообщение в черновик")}</button>}</>}</div>}
          <div className="composer">{attachments.length > 0 && <AttachmentTray attachments={attachments} disabled={busy} onRemove={id=>setAttachments(old=>old.filter(a=>a.id!==id))}/>}
            <div className="composer-input"><textarea aria-label={t("Сообщение {0}",engineName)} placeholder={demo ? t("Подключите ПК, чтобы отправлять сообщения") : t("Что нужно сделать?")} value={draft} onChange={(e) => setDraft(e.target.value)} onPaste={e=>{const files=Array.from(e.clipboardData.files);if(files.length){e.preventDefault();if(!uploading)void upload(files);}}} disabled={demo || busy || selected?.readOnly} onKeyDown={(e) => {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault();void send();}}} />
            {connection&&!demo&&<UsageIndicator key={provider+connection.url+connection.token} connection={connection} provider={provider} models={[model|| (provider==='claude'?'sonnet':providerInfo?.models?.find(item=>item.isDefault||providerInfo.models?.length===1)?.id||''),providerInfo?.models?.find(item=>item.id===model||!model&&(item.isDefault||providerInfo.models?.length===1))?.name||'']} onOpen={()=>{setSettingsPage('usage');setTab('settings');setMobileChat(true);}}/>}</div>
            <div className="composer-tools"><input hidden ref={fileInput} type="file" multiple onChange={(e) => void upload(e.target.files)} /><button className="icon-button" aria-label={t("Прикрепить файлы")} disabled={demo || uploading || busy || selected?.readOnly} onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><select aria-label={t("Модель {0}",engineName)} value={model} disabled={busy||running} onChange={(e) => setModel(e.target.value)}><option value="">{provider==='claude'?'Sonnet':provider==='copilot'?'Auto':providerInfo?.models?.find(item=>item.isDefault)?.name||(providerInfo?.models?.length===1?providerInfo.models[0].name:'\u2014')}</option>{(provider === 'claude' ? [{id:'sonnet',name:'Sonnet'},{id:'opus',name:'Opus'},{id:'haiku',name:'Haiku'}] : providerInfo?.models || []).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{provider==='codex'&&<EffortPicker {...codexEffort} disabled={busy||running||uploading||selected?.readOnly}/>}<span className="composer-spacer" />{running && <button className="icon-button stop-button" aria-label={t("Остановить {0}",engineName)} onClick={async () => {try {await api(`/jobs/${job!.id}/stop`, {});} catch (e) {setError((e as Error).message);}}}><Square size={16} /></button>}<button className="send-button" aria-label={t("Отправить сообщение")} disabled={demo || !canRun || selected?.readOnly || busy || loading || uploading || !draft.trim() && !attachments.length} onClick={() => void send()}><ArrowUp size={21} /></button></div>
          </div>
        </div>
      </>}
    </main>
    <nav className="mobile-nav"><button className={tab==='workspace'?'active':''} onClick={()=>{setTab('workspace');setMobileChat(true);}}><Folder size={20}/>{t("Доска")}</button><button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={20} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => {setTab('files');setMobileChat(true);}}><BookOpen size={20} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} onClick={()=>{setTab('changelog');setMobileChat(true);}}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={20} />{t("Настройки")}</button></nav>
    {pendingTakeover && <div className="modal-backdrop"><section ref={confirmation} className="confirm-modal" role="dialog" aria-modal="true" aria-label={t("Продолжить чат с телефона?")}><Terminal size={28} /><h2>{t("Продолжить чат с телефона?")}</h2><p>{t("Сначала дождитесь завершения ответа в {0} на ПК. Одновременная работа с одной историей может вызвать конфликт.",engineName)}</p><button className="primary" onClick={() => {setPendingTakeover(false);setTakeover(true);void send(true);}}>{t("На ПК завершено — продолжить")}</button><button className="text-button" onClick={() => setPendingTakeover(false)}>{t("Отмена")}</button></section></div>}
  </div>;
}
