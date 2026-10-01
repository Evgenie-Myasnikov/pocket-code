import {shareMessages,shareSnapshot} from './chat-snapshot';
import {startVisiblePoll} from './visible-poll';
import {chatCacheScope,readChatCache,writeChatCache,clearChatCache} from './chat-cache';
import {TaskNotificationBell,TaskNotificationInbox,useTaskNotifications} from './TaskNotifications';
import type {JiraIssue} from '../server/jira';
import {AttachmentTray,type DraftAttachment} from './AttachmentTray';
import { Review } from './Review';
import {ActivityDrawer} from './ActivityDrawer';
import {ActivityHandle} from './ActivityHandle';
import {useJiraRole,jiraRoleLabel} from './jira-preferences';
import {useActivity} from './useActivity';
import {useChatNotifications,type WatchedChat} from './chat-notifications';
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
import { ArrowUp, ArrowLeft, Plus, Search, MessageSquare, Folder, Settings, Terminal, Wifi, ChevronDown, Paperclip, Square, X, GitBranch, RefreshCw, Laptop, LogOut, ShieldCheck, ClipboardList, Eye, EyeOff, PanelsTopLeft } from 'lucide-react';
import { Connect } from './Connect';
import { useAppearance } from './Appearance';
import {SettingsPanel,type SettingsPage} from './SettingsPanel';
import { Message, MessageList, ApprovalCard } from './Messages';
import { JiraJobs, JiraSettings } from './Jira';
import { ProjectDocs } from './ProjectDocs';
import { LiveTerminal } from './LiveTerminal';
import { fileBase64, loadConnection, request, saveConnection, type Connection } from './api';
import { demoMessages, demoSessions } from './demo';
import type { ChatMessage, JobView, SubagentView,ActivityItem } from '../server/types';

type Session = {sessionId: string;summary: string;customTitle?: string;cwd?: string;lastModified: number;gitBranch?: string;source?: string;readOnly?: boolean;archived?: boolean;provider?: WorkspaceProvider;};
type Health = {name: string;roots: string[];version: string;protocol: number;};
type ProviderInfo = {id: WorkspaceProvider;name: string;available: boolean;authenticated?: boolean;models?: EffortModel[];error?: string;};
type Attachment = DraftAttachment;
type Draft = {text: string;attachments: Attachment[];};
type RejectedDraft = Draft & {restored: boolean;};
const codexBusyMessage = 'This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
const uniqueMessages = (messages:ChatMessage[]) => [...new Map(messages.map(message=>[message.id,message])).values()];
const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
export function App() {
  useBackNavigation();
  const [generation, setGeneration] = useState(0);
  return <WorkspaceApp key={generation} onDisconnect={() => setGeneration(value => value + 1)} />;
}
function WorkspaceApp({onDisconnect}: {onDisconnect():void}) {
  useLanguage();
  const jiraRole=useJiraRole();
  const appearanceSettings = useAppearance();
  const [provider, setProvider] = useState<WorkspaceProvider>(selectedWorkspace);
  const [providers, setProviders] = useState<ProviderInfo[]>([{id:'claude',name:'Claude',available:true}]);
  const providerInfo = providers.find(item => item.id === provider);
  const engineName = provider === 'codex' ? 'Codex' : 'Claude';
  const canRun = providerInfo?.available === true && providerInfo.authenticated !== false;
  const useStateForWorkspace = <T,>(initial:T | ((provider:WorkspaceProvider)=>T)) => useWorkspaceState(provider, initial);
  const useRefForWorkspace = <T,>(initial:T) => useWorkspaceRef(provider, initial);
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
  const [cacheScope,setCacheScope]=useState('');
  const [health, setHealth] = useState<Health | null>(null),[sessions, setSessions] = useStateForWorkspace<Session[]>([]),[jobs, setJobs] = useStateForWorkspace<JobView[]>([]);
  const [selected, setSelected] = useStateForWorkspace<Session | null>(null),[history, setHistory] = useStateForWorkspace<ChatMessage[]>([]),[job, setJob] = useStateForWorkspace<JobView | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const projectRoots = projects || health?.roots || [];
  const [projectReady, setProjectReady] = useStateForWorkspace(false);
  const projectChosen = useRefForWorkspace(false);
  const [cwd, setCwd] = useStateForWorkspace(''),[tab, setTab] = useStateForWorkspace<'chats' | 'files' | 'settings' | 'terminal' | 'jobs'>('chats'),[mobileChat, setMobileChat] = useStateForWorkspace(false);
  const [chatViewOpen,setChatViewOpen]=useStateForWorkspace(false);
  useEffect(()=>{if(tab==='chats')setChatViewOpen(mobileChat);},[tab,mobileChat]);
  const returnToChats=()=>{setTab('chats');setMobileChat(chatViewOpen);};
  const [settingsPage,setSettingsPage]=useStateForWorkspace<SettingsPage>('index');
  const [draft, setDraft] = useStateForWorkspace(''),[search, setSearch] = useStateForWorkspace(''),[model, setModel] = useStateForWorkspace(id=>preferences(id).model);
  const codexEffort=useCodexEffort(provider==='codex'?providerInfo?.models:undefined,model);
  const [codexAccess,setCodexAccess]=useStateForWorkspace(id=>preferences(id).codexAccess);
  const [error, setError] = useStateForWorkspace(''),[networkError, setNetworkError] = useStateForWorkspace(''),[busy, setBusy] = useStateForWorkspace(false),[loading, setLoading] = useStateForWorkspace(false);
  const [hostRestarting,setHostRestarting] = useState(false);
  useEffect(()=>{const handle=(event:Event)=>setHostRestarting(!!(event as CustomEvent).detail?.active);window.addEventListener('pocket-code-host-update-restarting',handle);return()=>window.removeEventListener('pocket-code-host-update-restarting',handle);},[]);
  const [demo, setDemo] = useState(false),[attachments, setAttachments] = useStateForWorkspace<Attachment[]>([]),[uploading, setUploading] = useStateForWorkspace(false);
  const activity=useActivity(demo?null:connection);
  const taskFeed=useTaskNotifications(demo?null:connection,provider);
  const taskOpenGeneration=useRef(0);
  const [taskInboxOpen,setTaskInboxOpen]=useState(false),[taskTarget,setTaskTarget]=useState<{id:string;site:string;issue:JiraIssue}|null>(null);
  useEffect(()=>{taskOpenGeneration.current++;setTaskInboxOpen(false);setTaskTarget(null);},[connection,provider]);
  useEffect(()=>{if(!taskInboxOpen)taskOpenGeneration.current++;},[taskInboxOpen,connection]);
  const activitySurface=useRef<HTMLDivElement|null>(null),activityDistance=useRef(0);
  const [activityDragging,setActivityDragging]=useState(false);
  const [activityOpen,setActivityOpen]=useState(false),[activityTarget,setActivityTarget]=useState<{item:ActivityItem;connection:Connection}|null>(null);
  const [notificationTarget,setNotificationTarget]=useState<WatchedChat|null>(null);
  useChatNotifications(connection,demo?null:tab==='chats'?(mobileChat&&(selected||job)?{provider,sessionId:job?.sessionId||selected?.sessionId,jobId:job?.id,cwd,title:selected?.customTitle||selected?.summary||engineName}:null):undefined,locale().startsWith('ru')?'ru':'en',chat=>{
    if(chat.provider!=='claude'&&chat.provider!=='codex')return;
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
  useEffect(()=>{if(tab!=='chats')setReadingMode(false);if(provider==='codex'&&tab==='terminal')setTab('chats');},[provider,tab]);
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
  async function connect(c: Connection) {
    setBusy(true);setError('');
    try {
      const h = await request<Health>(c, '/health');
      if (h.protocol !== 1) throw new Error(t("Обновите приложение и сервер до одной версии"));
      const scope=await chatCacheScope(c);
      await saveConnection(c);setCacheScope(scope);setSaved(c);setConnection(c);setHealth(h);setDemo(false);
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  useEffect(() => {loadConnection().then((c) => {if (c) {setSaved(c);void connect(c);}}).catch(() => setError(t("Не удалось прочитать сохранённое подключение. Введите ключ снова.")));}, []);
  useEffect(() => {
    if (!connection || demo) return;
    let cancelled = false;
    async function refreshProviders() {
      try {
        const list = await request<ProviderInfo[]>(connection!, '/providers');
        if (!cancelled && Array.isArray(list)) setProviders(old=>shareSnapshot(old,list.filter(item => item.id === 'claude' || item.id === 'codex')));
      } catch { /* Older bridge versions support the existing Claude workspace. */ }
    }
    const stop=startVisiblePoll(refreshProviders,30000);
    return () => {cancelled=true;stop();};
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
  useEffect(()=>{if(provider==='codex' && model && providerInfo?.models?.length && !providerInfo.models.some(item=>item.id===model))setModel('');},[provider,providerInfo?.models,model]);
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
    if (!connection || demo || !providerInfo) return;
    let cancelled = false;
    let cachedSessions:Session[]|null=null;
    async function refresh() {
      try {
        const [s, j] = await Promise.all([request<Session[]>(connection!, `/sessions?provider=${provider}`), request<JobView[]>(connection!, `/jobs?provider=${provider}`)]);
        if (!cancelled) {
          const scopedSessions=s.filter(item=>!item.provider || item.provider===provider),scopedJobs=j.filter(item=>!item.provider || item.provider===provider);
          const cacheSnapshot=shareSnapshot(cachedSessions,scopedSessions.slice(0,300));
          if(cacheScope&&cacheSnapshot!==cachedSessions)writeChatCache(cacheScope,provider,'sessions',cacheSnapshot);
          cachedSessions=cacheSnapshot;
          setSessions(old=>shareSnapshot(old,scopedSessions));setJobs(old=>shareSnapshot(old,scopedJobs));setSelected(old=>old?shareSnapshot(old,scopedSessions.find(item=>item.sessionId===old.sessionId)||old):null);setNetworkError('');
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
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=lastScrollTop.current;},[provider,tab]);
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
      const data=await api<{messages:ChatMessage[];previous:number|null;next:number|null}>(`/sessions/${encodeURIComponent(selected.sessionId)}/messages?provider=${provider}&window=${nextWindow}${fromStart?'&from=start':''}${active?`&end=${active.baseMessageCount}`:''}`);
      if(epoch!==navigation.current||paging.current!==requestId)return;
      captureScrollAnchor(!fromStart);
      nearBottom.current=false;historyWindow.current=nextWindow;
      setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));
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
  async function openSession(s: Session, activeJob?: Pick<JobView,'id'|'sessionId'>) {
    if (busy || uploading) return;
    rememberDraft();setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
    const epoch = ++navigation.current;setSelected(s);projectChosen.current=true;setCwd(s.cwd || health!.roots[0]);setMobileChat(true);setTab('chats');
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    const cached=cacheScope&&!demo?readChatCache<ChatMessage[]>(cacheScope,provider,'chat:'+s.sessionId):null;
    setHistory(Array.isArray(cached)?cached:[]);setJob(null);restoreDraft(activeJob?.sessionId||s.sessionId);setError('');setTakeover(false);setHasMore(null);nearBottom.current = true;
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
      if (!resolved.sessionId.startsWith('pending-')) await loadHistory(resolved, full, epoch, false, false);
    } catch (e) {if (epoch === navigation.current) setError((e as Error).message);} finally {if (epoch === navigation.current) setLoading(false);}
  }
  function newChat(project = cwd) {
    if (busy || uploading) return;
    rememberDraft();setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;navigation.current++;setSelected(null);setHistory([]);setJob(null);restoreDraft(`new:${project}`);setError('');setHasMore(null);
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    projectChosen.current=true;setCwd(project);setMobileChat(true);setTab('chats');setTakeover(true);setLoading(false);
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
    const data = { provider, cwd, sessionId, text: draft, attachments: attachments.map((a) => a.id), model:provider==='codex'?(codexEffort.options.length?codexEffort.modelId||model:model):(model||'sonnet'), mode: "default", ...(provider==='claude'?{maxBudgetUsd:budget}:{codexAccess,reasoningEffort:codexEffort.value||codexEffort.defaultValue||undefined}), takeoverConfirmed: confirmed };
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
  async function upload(files: FileList | null) {
    if (!files || !connection) return;
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
  async function disconnect() {try {await saveConnection(null);clearChatCache();onDisconnect();}catch(e){setError((e as Error).message);}}
  if (!health) return <Connect initial={saved} onConnect={connect} onDemo={startDemo} busy={busy} error={error} />;
  const visible = sessions.filter((s) => `${s.customTitle || ""} ${s.summary} ${s.cwd}`.toLowerCase().includes(search.toLowerCase()));
  const workspacePicker = (location:'sidebar'|'header'|'settings') => <label className={`workspace-picker workspace-picker-${location}`}>{location==='settings'&&<span>{t("Рабочее пространство")}</span>}<select aria-label={t("Рабочее пространство")} value={provider} disabled={demo} onChange={event=>setProvider(event.target.value as WorkspaceProvider)}><option value="claude">Claude</option><option value="codex">Codex</option></select></label>;
  const chatStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status));
  const chatStatusLabel=chatStatus?t(({needs_input:'Waiting for input',error:'Error',running:'Running',done:'Completed'} as const)[chatStatus]):'';
  const chatStatusDot=chatStatus?<span className={'chat-tab-status chat-tab-status-'+chatStatus} aria-hidden="true"/>:null;
  return <div className={`app ${mobileChat ? 'show-chat' : ''} ${readingMode&&tab==='chats'?'reading-mode':''}`}>
    {taskInboxOpen&&connection&&<TaskNotificationInbox feed={taskFeed} onClose={()=>setTaskInboxOpen(false)} onOpen={async item=>{const generation=taskOpenGeneration.current;if(item.provider!=='jira')throw Error('Task provider unavailable');const issue=await request<JiraIssue>(connection,'/jira/issue?'+new URLSearchParams({site:item.scope,key:item.key,provider}));if(generation!==taskOpenGeneration.current)throw Error('Task navigation cancelled');setTaskTarget({id:item.id,site:item.scope,issue});setTab('jobs');setMobileChat(true);}}/>}
    {(activityOpen||activityDragging)&&<ActivityDrawer surfaceRef={activitySurface} dragging={activityDragging} reveal={activityDistance.current} items={activity.items} loading={activity.loading} error={activity.error} busy={busy||uploading||Boolean(activityTarget)} onRetry={activity.refresh} onOpen={openActivity} onClose={()=>setActivityOpen(false)}/>}
    {readingMode&&tab==='chats' && <button className="icon-button reading-exit" aria-label={t("Выйти из режима чтения")} title={t("Выйти из режима чтения")} onClick={()=>toggleReadingMode(false)}><EyeOff size={21}/></button>}
    <ActivityHandle count={activity.count} disabled={demo} onOpen={()=>setActivityOpen(true)} onDrag={distance=>{activityDistance.current=distance;setActivityDragging(true);activitySurface.current?.style.setProperty('--activity-reveal',`${distance}px`);}} onDragEnd={open=>{setActivityDragging(false);setActivityOpen(open);}}/>
    <aside className="sidebar">
      <div className="chat-list-actions">{workspacePicker('sidebar')}
      <button className="primary new-chat" disabled={busy || uploading} onClick={() => newChat()}><Plus size={18} />{t("Новый чат")}</button></div>
      {provider==='claude' && <button className="terminal-entry secondary" disabled={busy || uploading} onClick={() => {setTab('terminal');setMobileChat(true);}}><Terminal size={17} />{t("Живой терминал")}<span>CLI</span></button>}<nav className="desktop-tabs"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => {setTab('jobs');setMobileChat(true);}}><ClipboardList size={17} />{t("Задачи")}</button><button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={17} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}><Folder size={17} />{t("Проект")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={17} />{t("Настройки")}</button></nav>
      <div className="search"><Search size={16} /><input aria-label={t("Найти чат")} placeholder={t("Найти в чатах")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="session-list"><div className="list-label">{t("ВАШИ ЧАТЫ ")}<span>{visible.length}</span></div>
        {jobs.filter((j) => j.status === 'running' && !sessions.some((s) => s.sessionId === j.sessionId)).map((j) => <button className="session-row" key={j.id} onClick={() => void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: t("Текущая задача"), cwd: j.cwd, lastModified: j.startedAt }, j)}><span className="pulse-dot" /><div><strong>{t("Текущая задача")}</strong><small>{basename(j.cwd)}</small></div></button>)}
        {visible.map((s) => <button className={`session-row ${selected?.sessionId === s.sessionId ? 'selected' : ''}`} disabled={busy || uploading} key={s.sessionId} onClick={() => void openSession(s)}><MessageSquare size={16} /><div><strong>{s.customTitle || s.summary || t("Без названия")}</strong><small>{s.source === 'desktop' ? 'Desktop · ' : ''}{basename(s.cwd || '')}{s.archived ? t(" · Архив") : ''}<span>·</span>{new Date(s.lastModified).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</small></div>{jobs.some((j) => j.sessionId === s.sessionId && j.status === 'running') && <span className="pulse-dot" />}</button>)}
        {!visible.length && <div className="empty-list"><MessageSquare size={26} /><p>{search ? t("Ничего не найдено") : t("Здесь появятся чаты {0} из разрешённых папок.",engineName)}</p></div>}
      </div></aside>
    <main className="workspace">
      {reviewOpen && connection && reviewCwd && <Review key={reviewContext} connection={connection} cwd={reviewCwd} initialMode={availableReview?.mode} onClose={()=>setReviewOpen(false)}/>}
      {agentPanel && connection && parentChatId && <Subagents key={`${provider}-${parentChatId}`} connection={connection} provider={provider} parentId={parentChatId} initialAgent={agentPanel.initial} initialAgentId={agentPanel.initial?.id} onClose={()=>setAgentPanel(null)}/>}
      {outputsOpen && connection && <ChatOutputs key={`${provider}:${parentChatId||cwd}`} connection={connection} cwd={cwd} messages={outputMessages} onClose={()=>setOutputsOpen(false)} hasMore={hasMore!==null&&historyWindow.current<5000} loadingMore={loadingOlder} onLoadMore={()=>void extendHistory()} />}
      <header className="chat-header" data-section={tab}>
        {(tab==='chats'||tab==='terminal')&&<button className="icon-button mobile-back" aria-label={t("К списку чатов")} onClick={() => setMobileChat(false)}><ArrowLeft size={21} /></button>}
        <div className="header-title">{(tab==='chats'||tab==='terminal') && <label className="project-picker"><Folder size={14}/><select aria-label={t("Папка проекта")} title={cwd} value={cwd} disabled={busy||uploading} onChange={event=>newChat(event.target.value)}>{!projectRoots.includes(cwd)&&<option value={cwd}>{basename(cwd)}</option>}{projectRoots.map(root=><option key={root} value={root}>{basename(root)}</option>)}</select></label>}<strong>{tab==='jobs'?t("Задачи"):tab==='settings'?t("Настройки"):tab==='files'?t("Проект"):tab==='terminal'?t("Терминал"):selected?.customTitle||selected?.summary||t("Новый разговор")}</strong></div>
        {tab==='jobs'&&<><span className="tasks-header-role">{t(jiraRoleLabel(jiraRole))}</span><TaskNotificationBell count={taskFeed.inbox.unread} disabled={!connection||demo} onClick={()=>setTaskInboxOpen(true)}/></>}
        {(tab==='chats'||tab==='terminal')&&workspacePicker('header')}
        {tab==='chats' && <><span className="branch"><GitBranch size={13} />{selected?.gitBranch||'local'}</span>{availableReview&&<button className="secondary review-button" aria-label="Review" disabled={!connection||demo||selected?.readOnly} onClick={()=>setReviewOpen(true)}>Review</button>}{hasOutputs&&<button className="icon-button outputs-entry" disabled={!connection||demo||loading} aria-label={t("Результаты")} title={t("Результаты")} onClick={()=>setOutputsOpen(true)}><PanelsTopLeft size={20}/></button>}{(outputMessages.length>0||Boolean(job?.partial))&&<button className="icon-button reading-entry" disabled={loading||!history.length&&!job} aria-label={t("Режим чтения")} title={t("Режим чтения")} aria-pressed={readingMode} onClick={()=>toggleReadingMode(true)}><Eye size={20}/></button>}</>}
      </header>
      {demo && <div className="demo-banner">{t("Демо · пример интерфейса, без подключения к Claude")}<button onClick={() => void disconnect()}>{t("Подключить ПК →")}</button></div>}
      {historyError && tab==='chats' && <div className="network-banner" role="status">{t("История не обновилась: ")}{t(historyError)}</div>}
      {networkError && !hostRestarting && <div className="network-banner" role="status"><RefreshCw size={14} />{t(networkError)}</div>}
      {!canRun && !demo && <div className="network-banner" role="status">{providerInfo?.error ? t(providerInfo.error) : providerInfo ? t("{0} недоступен. Установите приложение и войдите в аккаунт на ПК.",engineName) : t("Обновите сервер на ПК, чтобы включить рабочее пространство Codex.")}</div>}
      <Updates connection={connection} expanded={tab === 'settings'&&settingsPage === 'updates'} />
      {tab === 'jobs' ? <JiraJobs notificationTarget={taskTarget} onNotificationOpened={()=>setTaskTarget(null)} key={provider} provider={provider} codexAccess={codexAccess} connection={connection} roots={projectRoots} jobs={jobs} budget={budget} onSettings={() => {setSettingsPage('jira');setTab('settings');setMobileChat(true);}} onOpenLinked={link => {if(link.sessionId)void openSession({sessionId:link.sessionId,cwd:link.cwd,provider:link.provider,summary:t("Задача {0}",engineName),lastModified:Date.now()});}} onOpen={(j) => {void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: j.jira ? `${j.jira.key}: ${j.jira.summary}` : t("Задача {0}",engineName), cwd: j.cwd, lastModified: j.startedAt }, j);}} /> : tab === 'terminal' ? provider === 'codex' ? <div className="center-message">{t("Терминал доступен в рабочем пространстве Claude. С Codex можно работать в чате.")}</div> : connection && !demo && !selected?.readOnly ? <LiveTerminal connection={connection} cwd={cwd} sessionId={selected?.sessionId} /> : <div className="center-message">{t("Живой терминал доступен после подключения к ПК.")}</div> : tab === 'files' ? connection && !demo && !selected?.readOnly ? <ProjectDocs key={`${provider}:${cwd}`} provider={provider} connection={connection} root={cwd} roots={projectRoots} onSelectProject={root=>{newChat(root);setTab('files');setMobileChat(true);}} onProject={newChat} /> : <div className="center-message">{t("Файлы доступны после подключения к ПК.")}</div> : tab === 'settings' ? <SettingsPanel workspaceSelector={workspacePicker('settings')} page={settingsPage} onPage={setSettingsPage} provider={provider} connection={connection} computerName={health.name} networkError={networkError} roots={projectRoots} cwd={cwd} onProject={root=>{newChat(root);setTab('settings');setSettingsPage('workspace');}} appearance={appearanceSettings} codexAccess={codexAccess} onCodexAccess={setCodexAccess} budget={budget} onBudget={setBudget} onDisconnect={()=>void disconnect()}/> : <>
        <div className="conversation" ref={scroll} style={{overflowAnchor:'none'}} onScroll={() => {const el = scroll.current!,previous=lastScrollTop.current;nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;if (nearBottom.current && !fromStart) setShowScrollActions(false);else if (el.scrollTop < previous - 2) setShowScrollActions(true);lastScrollTop.current = el.scrollTop;acknowledgeVisibleActivity();if(fromStart?el.scrollTop>previous&&nearBottom.current:el.scrollTop<previous&&el.scrollTop<=40)void extendHistory();}}>
          <div className="conversation-inner">{selected && !demo && <p className="muted history-meta" role="status">{selected.source === 'desktop' ? `${engineName} Desktop · ` : ''}{job ? t("Продолжение с телефона") : t("История обновляется каждые 3 секунды")}</p>}{selected?.readOnly && <p className="info-card">{t("Только просмотр. Чтобы продолжить чат и работать с файлами, запустите сервер с папкой этого проекта: ")}{cwd}</p>}<div className="conversation-date"><span />{demo ? t("ПРИМЕР РАЗГОВОРА") : t("РАБОЧЕЕ ПРОСТРАНСТВО")}<span /></div>
            {loading && <div className="center-message">{t("Загружаем историю с ПК…")}</div>}
            {!loading && !history.length && !job && !selected && <div className="welcome"><div className="welcome-symbol">✳</div><h1>{t("Что создадим сегодня?")}</h1><p>{t("Файлы, инструменты и контекст вашего ПК.")}<br />{t("Теперь под рукой.")}</p><div className="suggestions">{[t("Изучи структуру проекта"), t("Помоги найти и исправить ошибку"), t("Составь план новой функции")].map((t) => <button key={t} onClick={() => setDraft(t)}>{t}<ArrowUp size={15} /></button>)}</div></div>}
            {!loading && selected && !history.length && !job && <p className="muted">{t("В локальной истории пока нет сообщений. Проверьте, что этот чат открыт в {0} на ПК.",engineName)}</p>}
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
            <textarea aria-label={t("Сообщение {0}",engineName)} placeholder={demo ? t("Подключите ПК, чтобы отправлять сообщения") : t("Что нужно сделать?")} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={demo || busy || selected?.readOnly} onKeyDown={(e) => {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault();void send();}}} />
            <div className="composer-tools"><input hidden ref={fileInput} type="file" multiple onChange={(e) => void upload(e.target.files)} /><button className="icon-button" aria-label={t("Прикрепить файлы")} disabled={demo || uploading || busy || selected?.readOnly} onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><select aria-label={t("Модель {0}",engineName)} value={model} disabled={busy||running} onChange={(e) => setModel(e.target.value)}><option value="">{provider==='claude'?'Sonnet':providerInfo?.models?.find(item=>item.isDefault)?.name||(providerInfo?.models?.length===1?providerInfo.models[0].name:'\u2014')}</option>{(provider === 'claude' ? [{id:'sonnet',name:'Sonnet'},{id:'opus',name:'Opus'},{id:'haiku',name:'Haiku'}] : providerInfo?.models || []).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{provider==='codex'&&<EffortPicker {...codexEffort} disabled={busy||running||uploading||selected?.readOnly}/>}<span className="composer-spacer" />{running && <button className="icon-button stop-button" aria-label={t("Остановить {0}",engineName)} onClick={async () => {try {await api(`/jobs/${job!.id}/stop`, {});} catch (e) {setError((e as Error).message);}}}><Square size={16} /></button>}<button className="send-button" aria-label={t("Отправить сообщение")} disabled={demo || !canRun || selected?.readOnly || busy || loading || uploading || !draft.trim() && !attachments.length} onClick={() => void send()}><ArrowUp size={21} /></button></div>
          </div>
        </div>
      </>}
    </main>
    <nav className="mobile-nav"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => {setTab('jobs');setMobileChat(true);}}><ClipboardList size={20} />{t("Задачи")}</button>{provider==='claude' && <button className={tab === 'terminal' ? 'active' : ''} onClick={() => {setTab('terminal');setMobileChat(true);}}><Terminal size={20} />{t("Терминал")}</button>}<button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={20} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => {setTab('files');setMobileChat(true);}}><Folder size={20} />{t("Проект")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={20} />{t("Настройки")}</button></nav>
    {pendingTakeover && <div className="modal-backdrop"><section ref={confirmation} className="confirm-modal" role="dialog" aria-modal="true" aria-label={t("Продолжить чат с телефона?")}><Terminal size={28} /><h2>{t("Продолжить чат с телефона?")}</h2><p>{t("Сначала дождитесь завершения ответа в {0} на ПК. Одновременная работа с одной историей может вызвать конфликт.",engineName)}</p><button className="primary" onClick={() => {setPendingTakeover(false);setTakeover(true);void send(true);}}>{t("На ПК завершено — продолжить")}</button><button className="text-button" onClick={() => setPendingTakeover(false)}>{t("Отмена")}</button></section></div>}
  </div>;
}
