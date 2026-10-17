import {MobileNavigation} from './MobileNavigation';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime,dayGroup,dayGroupLabel,runStatusLabel,type RunStatus} from './run-status';
import {providerName} from './ActivityList';
import {useTranscriptFollow,transcriptFollowing} from './use-transcript-follow';
import {useClaudeAccess} from './claude-access';
import {RunningAction,elapsed} from './RunningAction';
import {useDetailMode,setDetailMode} from './detail-mode';
import {turnChanges as computeTurnChanges} from './turn-changes';
import {PlanBar,latestPlan} from './PlanBar';
import './section-header.css';
import {ChatComposer} from './ChatComposer';
import {OutboxShelf,type OutboxItem} from './OutboxShelf';
import {AccessModeChip,type AccessMode} from './AccessModeChip';
import {useComposerPreferences,enterSends as enterSendsPreference,approvalTimeout} from './composer-preferences';
import type {ClaudeAccess} from './claude-access';
import type {CodexAccess} from './preferences';
import {ChatOverlay} from './ChatOverlay';
import {ModelPicker,useClaudeModels} from './ModelPicker';
import {useChatReturn} from './use-chat-return';
import {WorkspacePassword} from './WorkspacePassword';
import {InboxButton,NotificationInbox,useBoardNotices,type BoardNoticeTarget} from './BoardNotifications';
import {savedWorkspaces,rememberWorkspace,workspaceJoinId,type WorkspaceAccess} from './workspace-access';
import {clearOffline} from './offline-data';
import {clearReviewViewed} from './review-viewed';
import {WorkspaceIdentity} from './WorkspaceIdentity';
import {TaskRunPanel} from './TaskRunPanel';
import {useTaskRun,taskStageLabel} from './task-run-ui';
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


import {attachmentReady,type DraftAttachment} from './AttachmentTray';
import { Review } from './Review';
import type {ActivityFeed} from './ActivityList';
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
import { BookOpen, FileText, ArrowUp, Plus, Search, MessageSquare, Folder, Settings, Terminal, X, RefreshCw, ShieldCheck, ClipboardList, EyeOff, MoreHorizontal, Laptop, ArrowDown } from 'lucide-react';
import { Connect, type ConnectedPc } from './Connect';
import { connectionProblem as classifyProblem, type ConnectionProblem } from './connection-errors';
import { useAppearance } from './Appearance';
import {SettingsPanel,type SettingsPage} from './SettingsPanel';
import { PartialMessage, MessageList, ApprovalCard } from './Messages';

import { DocumentLibrary } from './DocumentLibrary';

import { fileBase64, loadConnection, normalizeUrl, pairDevice, request, saveConnection, type Connection } from './api';
import { demoMessages, demoSessions } from './demo';
import type { ChatMessage, JobView, SubagentView,ActivityItem } from '../server/types';

import type {Session} from './session';
type Health = {name: string;roots: string[];version: string;protocol: number;hostId?:string;routes?:string[]};
// Remembers across the remount that the PC revoked this phone, so the next screen can say why it is empty.
const revokedKey='pocket-code-revoked';
function readRevoked(){try{return localStorage.getItem(revokedKey);}catch{return null;}}
function setRevoked(name:string|null){try{if(name===null)localStorage.removeItem(revokedKey);else localStorage.setItem(revokedKey,name);}catch{/* The notice is optional. */}}
/** A cached /health answer means the PC was not reached, even though the request returned. */
async function freshHealth(c:Connection){let stale=false;const mark=()=>{stale=true;};window.addEventListener('pocket-offline-read',mark);try{return {health:await request<Health>(c,'/health'),stale};}finally{window.removeEventListener('pocket-offline-read',mark);}}
type ProviderInfo = {id: WorkspaceProvider;name: string;available: boolean;authenticated?: boolean;models?: EffortModel[];error?: string;};
type Attachment = DraftAttachment;
type Draft = {text: string;attachments: Attachment[];};
type RejectedDraft = Draft & {restored: boolean;};
/** A message the host refused because the turn was ending; it is sent as it was written, never the current draft. */
type PendingSend = {jobId: string;key: string;text: string;attachments: Attachment[];};
const codexBusyMessage = 'This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
const uniqueMessages = (messages:ChatMessage[]) => [...new Map(messages.map(message=>[message.id,message])).values()];
const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
export type EmbeddedChat={activity?:ActivityFeed;inboxOpen?:boolean;visible?:boolean;connection:Connection;provider:WorkspaceProvider;session?:Session;cwd:string;jobId?:string;boardChat?:BoardChat;onBoard?(target:BoardNoticeTarget):void;onCreated?(session:Session,job:JobView):void;onBack():void};
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
  const [reviewAvailability,setReviewAvailability]=useStateForWorkspace<{key:string;mode:'working'|'branch';added?:number;removed?:number;files?:number}|null>(null);
  const [outputsOpen,setOutputsOpen] = useStateForWorkspace(false);
  const [agentPanel,setAgentPanel] = useStateForWorkspace<{initial?:SubagentView}|null>(null);
  const [agentList,setAgentList] = useStateForWorkspace<SubagentView[]>([]);
  const [readingMode,setReadingMode] = useStateForWorkspace(false);
  const [showScrollActions, setShowScrollActions] = useStateForWorkspace(false);
  const [fromStart, setFromStart] = useStateForWorkspace(false);
  const lastScrollTop = useRefForWorkspace(0);
  const [connection, setConnection] = useState<Connection | null>(null),[saved, setSaved] = useState<Connection | null>(null);
  const [connecting,setConnecting]=useState(false),[connectionError,setConnectionError]=useState(''),[connectionProblem,setConnectionProblem]=useState<ConnectionProblem|undefined>();
  const [connected,setConnected]=useState(false),[paired,setPaired]=useState(false),[restoring,setRestoring]=useState(!embedded),[lastContact,setLastContact]=useState(0),[revokedFrom,setRevokedFrom]=useState(readRevoked);
  const disconnecting=useRef(false),pcName=useRef('');
  const [workspaceConnection,setWorkspaceConnection]=useState<Connection|null>(null),[workspaceScanner,setWorkspaceScanner]=useState(false);
  const projectSpaces=useProjectWorkspaces(embedded?connection:workspaceConnection);
  const personalBoards=useProjectWorkspaces(connection);const [localBoards,setLocalBoards]=useState(true);
  const [offline,setOffline]=useState(false);
  useEffect(()=>{const stale=()=>setOffline(true),fresh=()=>{setOffline(false);setLastContact(Date.now());};window.addEventListener('pocket-offline-read',stale);window.addEventListener('pocket-online-read',fresh);return()=>{window.removeEventListener('pocket-offline-read',stale);window.removeEventListener('pocket-online-read',fresh);};},[]);
  const canRun = !offline && !!connection && providerInfo?.available === true && providerInfo.authenticated !== false && !connection?.workspaceId;
  const [boardChat,setBoardChat]=useState<BoardChat|null>(embedded?.boardChat||null);
  const [noticeTarget,setNoticeTarget]=useState<BoardNoticeTarget|null>(null);
  const [boardLaunch,setBoardLaunch]=useState<BoardChat|null>(null);
  const [taskPanel,setTaskPanel]=useState(false);
  const [workspaceAccesses,setWorkspaceAccesses]=useState<WorkspaceAccess[]>([]);
  const [health, setHealth] = useState<Health | null>(embedded?null:{name:'Offline',roots:[],version:packageVersion,protocol:1}),[sessions, setSessions] = useStateForWorkspace<Session[]>([]),[jobs, setJobs] = useStateForWorkspace<JobView[]>([]);
  const [selected, setSelected] = useStateForWorkspace<Session | null>(null),[history, setHistory] = useStateForWorkspace<ChatMessage[]>([]),[job, setJob] = useStateForWorkspace<JobView | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const projectRoots = (projects || health?.roots || []);
  const [projectReady, setProjectReady] = useStateForWorkspace(false);
  const projectChosen = useRefForWorkspace(false);
  const [cwd, setCwd] = useStateForWorkspace('');
  // Device navigation survives initial pairing/reconnection. Transcript state remains PC-scoped.
  // The phone starts on Chats, where chats that wait for the person are listed first; Back from there leaves the app.
  const [tab,setTab]=useState<'chats' | 'files' | 'changelog' | 'settings' | 'connection' | 'workspace'>('chats');
  const [mobileChat,setMobileChat]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false),[inboxOpen,setInboxOpen]=useState(false);
  const [chatViewOpen,setChatViewOpen]=useStateForWorkspace(false);
  useEffect(()=>{if(tab==='chats')setChatViewOpen(mobileChat);},[tab,mobileChat]);
  const returnToChats=()=>{setTab('chats');setMobileChat(chatViewOpen);};
  const [settingsPage,setSettingsPage]=useState<SettingsPage>('index');
  const [draft, setDraft] = useStateForWorkspace(''),[search, setSearch] = useStateForWorkspace(''),[model, setModel] = useStateForWorkspace(id=>preferences(id).model);
  const codexEffort=useCodexEffort(provider==='codex'?providerInfo?.models:undefined,model);
  const claudeAccess=useClaudeAccess();
  const [codexAccess,setCodexAccess]=useStateForWorkspace(id=>preferences(id).codexAccess);
  const [error, setError] = useStateForWorkspace(''),[networkError, setNetworkError] = useStateForWorkspace(''),[busy, setBusy] = useStateForWorkspace(false),[loading, setLoading] = useStateForWorkspace(false);
  const [hostRestarting,setHostRestarting] = useState(false);
  useEffect(()=>{const handle=(event:Event)=>setHostRestarting(!!(event as CustomEvent).detail?.active);window.addEventListener('pocket-code-host-update-restarting',handle);return()=>window.removeEventListener('pocket-code-host-update-restarting',handle);},[]);
  const [demo, setDemo] = useState(false),[attachments, setAttachments] = useStateForWorkspace<Attachment[]>([]);
  // Each file has its own card; navigation and sending wait while any of them is still uploading.
  const uploading=attachments.some(item=>item.status==='uploading');
  const composerPreferences=useComposerPreferences();
  const claudeCatalog=useClaudeModels(demo?null:connection,provider,cwd);
  const claudeEffort=useCodexEffort(provider==='claude'?claudeCatalog.models:undefined,model,'claude');
  const localActivity=useActivity(demo||embedded?.activity?null:connection);
  const activity=embedded?.activity||localActivity;
  const notices=useBoardNotices(embedded?null:workspaceConnection||connection);
  const activityOpen=inboxOpen,setActivityOpen=setInboxOpen,[activityTarget,setActivityTarget]=useState<{item:ActivityItem;connection:Connection}|null>(null);
  const [notificationTarget,setNotificationTarget]=useState<WatchedChat|null>(null);
  useRunNotifications(demo||connection?.workspaceId?null:connection,locale().startsWith('ru')?'ru':'en');
  useChatNotifications(connection,demo?null:tab==='chats'?(mobileChat&&(selected||job)?{provider,sessionId:job?.sessionId||selected?.sessionId,jobId:job?.id,cwd,title:selected?.customTitle||selected?.summary||engineName}:null):undefined,locale().startsWith('ru')?'ru':'en',chat=>{
    if(chat.provider!=='claude'&&chat.provider!=='codex'&&chat.provider!=='copilot')return;
    setNotificationTarget(chat);setProvider(chat.provider);
  });
  useEffect(()=>{
    if(!notificationTarget||notificationTarget.provider!==provider||!connection)return;
    if(busy||uploading)return;
    const target=notificationTarget;setNotificationTarget(null);
    void openSession({sessionId:target.sessionId||`pending-${target.jobId}`,cwd:target.cwd,summary:target.title,provider,lastModified:Date.now()},target.jobId?{id:target.jobId,sessionId:target.sessionId}:undefined);
  },[notificationTarget,provider,connection,busy,uploading]);
  useEffect(()=>{setActivityOpen(false);setActivityTarget(null);},[connection]);
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
    if(busy||uploading)return;
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
  useEffect(()=>{if(connection&&projectReady&&projects?.includes(cwd))savePreferredRoot(connection.url,cwd,provider);},[connection,cwd,projects,projectReady,provider]);
  useEffect(()=>{if(tab!=='chats')setReadingMode(false);},[provider,tab]);
  const historyWindow = useRefForWorkspace(100);
  const [historyError, setHistoryError] = useStateForWorkspace('');
  const bottom = useRefForWorkspace<HTMLDivElement|null>(null),scroll = useRefForWorkspace<HTMLDivElement|null>(null);
  const navigation = useRefForWorkspace(0),sending = useRefForWorkspace(false),nearBottom = useRefForWorkspace(true);
  const retry = useRefForWorkspace<{signature: string;id: string;} | null>(null);
  const [pendingSend,setPendingSend] = useStateForWorkspace<PendingSend|null>(null);
  const sentFollowups = useRefForWorkspace<Map<string,Attachment[]>|null>(null);
  if(!sentFollowups.current)sentFollowups.current=new Map();
  const [stopping,setStopping] = useStateForWorkspace(false);
  const [accessChoices,setAccessChoices] = useStateForWorkspace<Record<string,AccessMode>>({});
  const running = job?.status === 'running';
  useEffect(()=>{if(!running)setStopping(false);},[running,job?.id]);
  /** Put a message back into a chat's draft, after anything already typed there. */
  function mergeDraft(key:string,text:string,files:Attachment[],stored=false){
    const merge=(current:Draft):Draft=>{const combined=[...current.attachments,...files.filter(item=>!current.attachments.some(old=>old.id===item.id))];if(combined.length>10)setError(t("Можно прикрепить до 10 файлов"));return {text:current.text.trim()?(text.trim()?current.text.replace(/\s+$/,'')+'\n\n'+text:current.text):text,attachments:combined.slice(0,10)};};
    if(!stored&&key===currentDraftKey()){const next=merge({text:draft,attachments});setDraft(next.text);setAttachments(next.attachments);}
    else drafts.current!.set(key,merge(drafts.current!.get(key)||{text:'',attachments:[]}));
  }
  /** "Edit", Stop and leaving the chat return a waiting message to the draft instead of sending it later. */
  /** stored: the chat is being left, so the message goes into its saved draft rather than the visible field. */
  function releasePending(stored=false){const pending=pendingSend;if(!pending)return;setPendingSend(null);mergeDraft(pending.key,pending.text,pending.attachments,stored);}
  // Settings hold the device default; the composer chip overrides it for this chat only.
  const defaultAccess:AccessMode=provider==='claude'?claudeAccess:provider==='codex'?codexAccess:'default';
  const chatAccess:AccessMode=accessChoices[currentDraftKey()]??defaultAccess;
  async function changeAccess(value:AccessMode){
    const key=currentDraftKey();setAccessChoices(old=>({...old,[key]:value}));
    // Claude applies Ask, Edits and Plan inside the running turn; Full and other providers start with the next message.
    if(provider==='claude'&&running&&job&&value!=='bypassPermissions'&&(value==='default'||value==='acceptEdits'||value==='plan'))try{setJob(await api<JobView>(`/jobs/${job.id}/mode`,{mode:value}));}catch(e){setError((e as Error).message);}
  }
  useEffect(()=>{
    // A new chat keeps the mode chosen before its first message.
    if(!job?.sessionId)return;const from=`new:${job.cwd}`;
    setAccessChoices(old=>old[from]&&!old[job.sessionId!]?(({[from]:moved,...rest})=>({...rest,[job.sessionId!]:moved}))(old):old);
  },[job?.sessionId]);
  useEffect(()=>{
    // An approved plan switches the chat to the mode chosen on the plan card.
    if(provider!=='claude'||!job?.permissionMode||job.status!=='running')return;const key=job.sessionId||`new:${job.cwd}`,mode=job.permissionMode;
    setAccessChoices(old=>old[key]===mode||!old[key]&&mode===defaultAccess?old:{...old,[key]:mode});
  },[job?.permissionMode]);
  async function stopRun(){
    if(!job||stopping)return;
    setStopping(true);releasePending();
    try{await api(`/jobs/${job.id}/stop`,{});}catch(e){setStopping(false);setError((e as Error).message);}
  }
  /** A queued follow-up is withdrawn from the host before it is edited, removed or sent another way. */
  async function withdrawQueued(id:string){
    if(!job)return null;
    try{const next=await api<JobView>(`/jobs/${job.id}/messages/${id}/cancel`,{});setJob(next);return next;}catch(e){setError((e as Error).message);return null;}
  }
  const outbox:OutboxItem[]=[
    ...(pendingSend&&pendingSend.key===currentDraftKey()?[{id:'pending',text:pendingSend.text,attachments:pendingSend.attachments.length,caption:t('Отправится, когда {0} закончит ход',engineName),onEdit:()=>releasePending(),onRemove:()=>setPendingSend(null),removeLabel:t('Не отправлять')}]:[]),
    ...(job?.queued||[]).map(item=>({id:item.id,text:item.text,attachments:item.attachments,caption:running?t('После завершения ответа'):t('Не доставлено'),
      onEdit:async()=>{if(await withdrawQueued(item.id))mergeDraft(currentDraftKey(),item.text,sentFollowups.current!.get(item.id)||[]);},
      onRemove:()=>void withdrawQueued(item.id),
      // "Send now" stops the turn and sends this message first, as it was written.
      onSendNow:async()=>{const current=job;if(!current||!await withdrawQueued(item.id))return;setPendingSend({jobId:current.id,key:currentDraftKey(),text:item.text,attachments:sentFollowups.current!.get(item.id)||[]});if(current.status==='running'){setStopping(true);try{await api(`/jobs/${current.id}/stop`,{});}catch(e){setStopping(false);setError((e as Error).message);}}}}))];
  /** Up in an empty field brings back the last message the person wrote. */
  const recallLast=()=>{for(const message of [...outputMessages].reverse()){if(message.role!=='user')continue;const text=message.blocks.filter(block=>block.type==='text').map(block=>block.text||'').join('\n').trim();if(text&&!text.startsWith('<task-notification'))return text;}return undefined;};
  const keyActions=useRef({stop:()=>{}});keyActions.current={stop:()=>void stopRun()};
  useEffect(()=>{
    // Windows: Esc stops the run; Ctrl+Shift+M, I and E open the access, model and effort pickers of this chat; Ctrl+Shift+D opens Review.
    if(!embedded)return;
    const key=(event:KeyboardEvent)=>{
      const root=scroll.current?.closest<HTMLElement>('.app');if(!root||!root.getClientRects().length||event.defaultPrevented)return;
      if(document.querySelector('[aria-modal="true"],dialog[open],.access-menu,.chat-menu'))return;
      if(event.key==='Escape'&&running&&!reviewOpen&&!agentPanel&&!outputsOpen&&!taskPanel){event.preventDefault();keyActions.current.stop();return;}
      if(!(event.ctrlKey||event.metaKey)||!event.shiftKey||event.altKey)return;
      if(event.code==='KeyD'){const button=root.querySelector<HTMLButtonElement>('.review-button:not(:disabled)');if(button){event.preventDefault();button.click();}return;}
      const target=event.code==='KeyM'?root.querySelector<HTMLElement>('.access-chip'):event.code==='KeyI'?root.querySelector<HTMLElement>('.composer-models .model-picker select'):event.code==='KeyE'?root.querySelector<HTMLElement>('.composer-models .effort-picker'):null;
      if(!target)return;event.preventDefault();target.focus();
      if(target instanceof HTMLSelectElement)try{target.showPicker();}catch{/* Focus is enough where the picker cannot open. */}else target.click();
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[embedded,running,reviewOpen,agentPanel,outputsOpen,taskPanel]);
  useEffect(()=>{
    const pending=pendingSend;
    if(!pending||!canRun||busy||running||uploading||loading||pending.key!==currentDraftKey()||job&&job.id!==pending.jobId)return;
    setPendingSend(null);
    void send(true,{text:pending.text,attachments:pending.attachments});
  },[canRun,busy,running,uploading,loading,job?.id,job?.status,pendingSend]);
  function acknowledgeVisibleActivity(){
    const element=scroll.current;
    if(!element||!element.getClientRects().length||element.closest('[inert]')||document.visibilityState==='hidden'||tab!=='chats'||loading||loadingOlder||error||historyError||activityOpen||embedded?.inboxOpen||activityTarget||reviewOpen||agentPanel||outputsOpen||pendingTakeover)return;
    if(element.scrollHeight-element.scrollTop-element.clientHeight>80)return;
    for(const item of activity.items){
      // An error stays until the task is restarted, the person writes in the chat or hides it explicitly.
      if(item.provider!==provider||item.status==='running'||item.status==='needs_input'||item.status==='error')continue;
      const viewedJob=job?.id===item.id&&job.status===item.status;
      const viewedHistory=item.status==='done'&&item.sessionId===selected?.sessionId&&item.resultMessageId&&history.some(message=>message.id===item.resultMessageId);
      if(viewedJob||viewedHistory)activity.markViewed(item);
    }
  }
  const acknowledgeActivity=useRef(acknowledgeVisibleActivity);acknowledgeActivity.current=acknowledgeVisibleActivity;
  useEffect(()=>{acknowledgeActivity.current();},[activity.items,job?.revision,loading,loadingOlder,history,provider,tab,mobileChat,activityOpen,embedded?.inboxOpen,activityTarget,reviewOpen,agentPanel,outputsOpen,pendingTakeover,error,historyError]);
  useEffect(()=>{const visible=()=>{if(document.visibilityState!=='hidden')requestAnimationFrame(()=>acknowledgeActivity.current());};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[]);
  const parentChatId = job?.sessionId || selected?.sessionId;
  const taskRun=useTaskRun(demo?null:connection,provider,cwd,job?.id,parentChatId,boardChat?.taskRun||embedded?.boardChat?.taskRun);
  useEffect(()=>setTaskPanel(false),[taskRun?.id]);
  const outputMessages=useMemo(()=>uniqueMessages([...history,...(job?.errorCode!=='codex_thread_busy'?job?.messages||[]:[])]),[history,job?.messages,job?.errorCode]);
  const runningMessages=useMemo(()=>job?.status==='running'?new Set(job.messages):null,[job?.messages,job?.status]);
  const toolResults=useMemo(()=>{const blocks=outputMessages.flatMap(message=>message.blocks),calls=new Set(blocks.filter(b=>b.type==='tool_use').map(b=>b.id));return new Map(blocks.filter(b=>b.type==='tool_result'&&b.tool_use_id&&calls.has(b.tool_use_id)).map(b=>[b.tool_use_id!,b]));},[outputMessages]);
  const detail=useDetailMode(embedded?'detailed':'brief');
  const changesByTurn=useMemo(()=>computeTurnChanges(outputMessages,toolResults,running),[outputMessages,toolResults,running]);
  const plan=useMemo(()=>latestPlan(outputMessages),[outputMessages]);
  // New replies since the person scrolled away from the end, counted for the round "latest" button.
  const seenLast=useRef(''),lastMessageId=outputMessages.at(-1)?.id||'';
  if(!showScrollActions&&!fromStart)seenLast.current=lastMessageId;
  const unseen=showScrollActions&&!fromStart&&seenLast.current?outputMessages.slice(outputMessages.findIndex(message=>message.id===seenLast.current)+1||outputMessages.length).filter(message=>message.role==='assistant'&&message.blocks.some(block=>block.type==='text'&&block.text)).length:0;
  const [scrolling,setScrolling]=useState(false),scrollIdle=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const markScrolling=()=>{setScrolling(true);clearTimeout(scrollIdle.current);scrollIdle.current=setTimeout(()=>setScrolling(false),700);};
  useEffect(()=>()=>clearTimeout(scrollIdle.current),[]);
  // The end of a turn is timed only when this screen saw it run, so a reopened chat never shows a made-up duration.
  const [turnEnd,setTurnEnd]=useState<{id:string;at:number}|null>(null),sawRunning=useRef('');
  useEffect(()=>{if(!job)return;if(job.status==='running')sawRunning.current=job.id;else if(sawRunning.current===job.id){sawRunning.current='';setTurnEnd({id:job.id,at:Date.now()});}},[job?.id,job?.status]);
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
        const value=await request<{available:boolean;mode:'working'|'branch';added?:number;removed?:number;files?:number}>(connection,`/review/availability?cwd=${encodeURIComponent(reviewCwd)}`);
        if(!cancelled)setReviewAvailability(old=>value.available&&(value.mode==='working'||value.mode==='branch')?(old&&old.key===reviewContext&&old.mode===value.mode&&old.added===value.added&&old.removed===value.removed&&old.files===value.files?old:{key:reviewContext,mode:value.mode,added:value.added,removed:value.removed,files:value.files}):null);
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
  const reviewReady=Boolean((availableReview||taskRun)&&connection&&!demo&&!selected?.readOnly);
  // A turn's chip opens Review on that turn's files first ("last turn"), with all changes one tap away.
  const [reviewPaths,setReviewPaths]=useState<string[]|undefined>();
  const openTurnReview=useMemo(()=>reviewReady?(changes?:{files:string[]})=>{setReviewPaths(changes?.files.length?changes.files:undefined);setReviewOpen(true);}:undefined,[reviewReady,setReviewOpen]);
  const quoteToDraft=useCallback((text:string)=>setDraft(current=>current.trim()?current.replace(/\s+$/,'')+'\n\n'+text+'\n':text+'\n'),[setDraft]);
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
  useEffect(()=>{if(!connection?.deviceId)return;const beat=()=>void request(connection,'/devices/heartbeat',{}).then(()=>setLastContact(Date.now())).catch(()=>{});beat();const timer=setInterval(beat,15000);const revoked=(event:Event)=>{if((event as CustomEvent).detail===connection.deviceId)void disconnect('revoked');};window.addEventListener('pocket-device-revoked',revoked);return()=>{clearInterval(timer);window.removeEventListener('pocket-device-revoked',revoked);};},[connection]);
  // Another known route (Wi-Fi, Tailscale, tunnel) can replace an unreachable one without a new QR.
  async function reachableRoute(c:Connection){for(const url of c.routes||[]){if(url===c.url)continue;try{const next={...c,url:normalizeUrl(url)},{stale}=await freshHealth(next);if(!stale)return next;}catch{/* Try the next route. */}}return null;}
  function cancelConnect(){++connectEpoch.current;setConnecting(false);setRestoring(false);}
  async function connect(c: Connection,restored=false) {
    const epoch=++connectEpoch.current;
    setConnecting(true);setConnectionError('');setConnectionProblem(undefined);setConnected(false);
    if(!restored&&(c.pairing||c.url!==saved?.url||c.token!==saved?.token))setPaired(false);
    try {
      if(c.workspaceOnly||c.workspaceInvite)throw Error(t('Для личных чатов ПК используйте QR подключения. Приглашение WorkSpace открывает только общие доски.'));
      const original=c;c=await pairDevice(c,packageVersion);if(epoch!==connectEpoch.current)return;
      const scope=await chatCacheScope(c),access=workspaceConnection||original.workspaceAccess,accesses=workspaceAccesses.length?workspaceAccesses:savedWorkspaces(original);
      const stored={...c,...(access?{workspaceAccess:access}:{}),workspaceAccesses:accesses};
      if(!embedded)await saveConnection(stored);
      if(epoch!==connectEpoch.current)return;
      if(scope!==cacheScope){rememberPosition();rememberDraft();setProjects(null);setProviders([]);setBoardChat(null);setBoardLaunch(null);setActivityTarget(null);}
      setCacheScope(scope);setSaved(c);setConnection(c);setDemo(false);
      const {health:h,stale}=await freshHealth(c);if(epoch!==connectEpoch.current)return;if(h.protocol!==1)throw Object.assign(Error(t('Обновите приложение и сервер до одной версии')),{problem:'incompatible'});setHealth(h);
      if(stale){setPaired(true);const alternate=await reachableRoute(c);if(alternate&&epoch===connectEpoch.current){void connect(alternate,true);return;}if(epoch===connectEpoch.current){setConnectionProblem('unreachable');setOffline(true);}return;}
      setConnected(true);setPaired(true);setLastContact(Date.now());setRevoked(null);setRevokedFrom(null);
      // The PC name, identity and other routes are kept so the next start can name the PC and fall back to another route.
      if(!embedded&&(h.name!==c.name||h.hostId!==c.hostId||h.routes&&JSON.stringify(h.routes)!==JSON.stringify(c.routes))){const next={...stored,name:h.name,...(h.hostId?{hostId:h.hostId}:{}),...(h.routes?{routes:h.routes}:{})};await saveConnection(next);if(epoch===connectEpoch.current)setSaved(next);}
    }catch(e){if(epoch===connectEpoch.current){const problem=classifyProblem(e);if(problem==='unreachable'&&!c.pairing){const alternate=await reachableRoute(c);if(alternate&&epoch===connectEpoch.current){void connect(alternate,true);return;}}if(epoch===connectEpoch.current){setConnectionError((e as Error).message);setConnectionProblem(problem);if(problem==='unreachable')setOffline(true);}}}finally{if(epoch===connectEpoch.current){setConnecting(false);if(restored)setRestoring(false);}}
  }
  useEffect(()=>{if(embedded){void connect(embedded.connection);return;}loadConnection().then(c=>{if(!c){setRestoring(false);return;}setSaved(c);if(c.workspaceOnly){setRestoring(false);setTab('settings');setSettingsPage('connection');}else{setPaired(true);void connect(c,true);}}).catch(()=>{setRestoring(false);setConnectionError(locale().startsWith('ru')?'Не удалось восстановить подключение. Отсканируйте QR-код ПК снова.':'Could not restore the connection. Scan the PC QR code again.');});},[]);
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
  useTranscriptFollow(scroll,nearBottom,!loading&&!readingMode&&tab==='chats'&&(embedded?embedded.visible!==false:mobileChat),provider+':'+(selected?.sessionId||'new'));
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
      // Restore in the existing layout effect, before paint. A delayed RAF could
      // override a user's next scroll and prevent loading the following page.
      pendingPosition.current={top:0,window:100,fromStart:beginning,bottom:!beginning};
    } catch (e) {setError((e as Error).message);} finally
    {if (epoch === navigation.current) setLoading(false);}
  }
  useEffect(()=>{if(!boardLaunch||!health||busy||uploading)return;const target=boardLaunch;if(!connection||target.connectionUrl&&target.connectionUrl!==connection.url){setError(t('Подключите ПК этой доски через Connection, чтобы открыть её чат.'));setBoardLaunch(null);return;}const targetProvider=target.taskRun?.provider||target.note.chat?.provider;if(targetProvider&&targetProvider!==provider){setProvider(targetProvider);return;}setBoardLaunch(null);setBoardChat(target);if(target.note.chat)void openSession({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now()});else{newChat(target.root);setDraft(target.prompt);}},[boardLaunch,provider,health,busy,uploading]);
  useEffect(()=>{if(!boardChat||boardChat.taskRun||!job?.sessionId||!connection)return;const target=boardChat;setBoardChat(null);void (async()=>{try{const b=await request<any>(connection,'/boards/'+target.boardId);await request(connection,'/boards/'+b.id,{revision:b.revision,versions:b.versions,notes:b.notes.map((n:any)=>n.id===target.note.id?{...n,chat:{provider,sessionId:job.sessionId}}:n)});}catch(e){setError((e as Error).message);}})();},[job?.sessionId,boardChat,connection]);
  async function openSession(s: Session, activeJob?: Pick<JobView,'id'|'sessionId'>) {
    if (busy || uploading) return;
    rememberPosition();rememberDraft();releasePending(true);setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
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
    rememberDraft();releasePending(true);setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;navigation.current++;setSelected(null);setHistory([]);setJob(null);restoreDraft(`new:${project}`);setError('');setHasMore(null);
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    pendingPosition.current=null;projectChosen.current=true;setCwd(project);setMobileChat(true);setTab('chats');setTakeover(true);setLoading(false);
  }
  /** Sends the draft, or a waiting message exactly as it was written. Typing during the request is kept. */
  async function send(confirmed = takeover, payload?: {text:string;attachments:Attachment[]}) {
    const text=payload?payload.text:draft,files=payload?payload.attachments:attachments,ids=files.map(item=>item.id);
    if (sending.current || loading || uploading || demo || !canRun || selected?.readOnly || !text.trim() && !files.length || !files.every(attachmentReady)) return;
    const key=currentDraftKey();
    const consume=()=>{if(payload)return;setDraft(current=>current===text?'':current.startsWith(text)?current.slice(text.length).trimStart():current);setAttachments(old=>old.filter(item=>!ids.includes(item.id)));drafts.current!.delete(key);};
    if(running&&job){
      sending.current=true;setBusy(true);setError('');
      const epoch=navigation.current,data={text,attachments:ids},signature=JSON.stringify({jobId:job.id,...data});
      const id=retry.current?.signature===signature?retry.current.id:crypto.randomUUID();retry.current={signature,id};
      try{
        const next=await api<JobView>(`/jobs/${job.id}/messages`,{...data,id});
        if(epoch!==navigation.current)return;
        setJob(next);consume();sentFollowups.current!.set(id,files);retry.current=null;nearBottom.current=true;
      }catch(error){
        if(provider==='claude'&&epoch===navigation.current&&(error as {status?:number}).status===409){
          try{
            const latest=await api<JobView>(`/jobs/${job.id}`);
            if(epoch===navigation.current){
              setJob(latest);
              // The SDK can close input before the final status is observable. This exact message
              // waits beside the composer and is sent after this job ends; the field is free at once.
              setPendingSend({jobId:job.id,key,text,attachments:files});consume();retry.current=null;
              return;
            }
          }catch{/* Preserve the original rejection when refreshing fails. */}
        }
        if(epoch===navigation.current)setError((error as Error).message);
      }
      finally{sending.current=false;setBusy(false);}
      return;
    }
    const sessionId = job?.sessionId || selected?.sessionId;
    if (sessionId && !confirmed) {setPendingTakeover(true);return;}
    sending.current = true;setBusy(true);setError('');
    const epoch = ++navigation.current;
    // The chat's access chip overrides the device default from Settings; Plan is a Claude mode of its own.
    const access=chatAccess,timeout=approvalTimeout(composerPreferences);
    const data = { provider, cwd, sessionId, ...(taskRun?{taskRunId:taskRun.id}:{}), text, attachments: ids, model:provider==='copilot'?(model||'auto'):provider==='codex'?(codexEffort.options.length?codexEffort.modelId||model:model):(model||'sonnet'), mode: provider==='claude'&&access==='plan'?'plan':'default', ...(provider==='claude'?{maxBudgetUsd:Number.isFinite(budget)&&budget>=0.1?Math.min(100,budget):5,claudeAccess:access==='plan'?claudeAccess:access as ClaudeAccess,claudeEffort:claudeEffort.value||undefined}:provider==='codex'?{codexAccess:access as CodexAccess,reasoningEffort:codexEffort.value||codexEffort.defaultValue||undefined}:{}), ...(timeout?{approvalTimeoutMinutes:timeout}:{}), takeoverConfirmed: confirmed };
    const signature = JSON.stringify(data);
    const id = retry.current?.signature === signature ? retry.current.id : crypto.randomUUID();retry.current = { signature, id };
    try {
      const next = await api<JobView>('/jobs', { ...data, id });
      if (epoch !== navigation.current) return;
      // Freeze the displayed history before the next turn; the server saves full history independently.
      if (job && job.errorCode!=='codex_thread_busy') setHistory((old) => [...old, ...job.messages]);
      if(provider==='codex')submissions.current!.set(next.id,{key,text,attachments:files});
      setRejectedDrafts(old=>{const next={...old};delete next[key];return next;});
      setJob(next);setTakeover(true);consume();retry.current = null;nearBottom.current = true;
      if(sessionId)for(const item of activity.items)if(item.status==='error'&&item.provider===provider&&item.sessionId===sessionId)activity.markViewed(item);
    } catch (e) {if (epoch === navigation.current) setError((e as Error).message);} finally {sending.current = false;setBusy(false);}
  }
  /** Updates one draft file wherever its draft is kept, so a finished upload is never lost. */
  function patchAttachment(id:string,change:(item:Attachment)=>Attachment){
    setAttachments(old=>old.map(item=>item.id===id?change(item):item));
    for(const [key,value] of drafts.current!)if(value.attachments.some(item=>item.id===id))drafts.current!.set(key,{...value,attachments:value.attachments.map(item=>item.id===id?change(item):item)});
  }
  // Uploads run one after another; files added meanwhile (paste, drop, picker) wait in line with their own card.
  const uploadQueue=useRefForWorkspace<Promise<void>>(Promise.resolve());
  function enqueueUpload(item:Attachment,root:string){
    uploadQueue.current=uploadQueue.current.then(async()=>{
      try{const uploaded=await api<Attachment>('/uploads',{cwd:root,name:item.name,base64:await fileBase64(item.file!)});patchAttachment(item.id,()=>({...uploaded,file:item.file,...(item.pastedText?{pastedText:true}:{})}));}
      catch(e){patchAttachment(item.id,old=>({...old,status:'failed',error:(e as Error).message}));}
    });
  }
  function upload(files: File[], options?: {pastedText?:boolean}) {
    if (!connection || !files.length) return;
    const room=10-attachments.length;
    if(files.length>room){setError(t("Можно прикрепить до 10 файлов"));files=files.slice(0,Math.max(0,room));if(!files.length)return;}
    const cards:Attachment[]=files.map(file=>({id:'local-'+crypto.randomUUID(),name:file.name,size:file.size,file,status:'uploading',...(options?.pastedText?{pastedText:true}:{})}));
    setAttachments(old=>[...old,...cards]);
    for(const card of cards)enqueueUpload(card,cwd);
  }
  function retryUpload(id:string){const item=attachments.find(a=>a.id===id);if(!item?.file)return;const next:Attachment={...item,status:'uploading',error:undefined};patchAttachment(id,()=>next);enqueueUpload(next,cwd);}
  async function insertPastedText(id:string){
    const item=attachments.find(a=>a.id===id);if(!item?.file)return;
    try{const text=await item.file.text();setDraft(current=>current.trim()?current.replace(/\s+$/,'')+'\n\n'+text:text);setAttachments(old=>old.filter(a=>a.id!==id));}catch(e){setError((e as Error).message);}
  }
  function startDemo() {setDemo(true);setTab('chats');setMobileChat(true);setSessions(demoSessions);setHealth({ name: t("Рабочий компьютер"), roots: ['D:\\Projects\\my-app'], version: '0.10.0', protocol: 1 });setCwd('D:\\Projects\\my-app');setSelected(demoSessions[0]);setHistory(demoMessages);}
  // Leaving on the phone also removes it from the PC's device list; an unreachable or older PC is not a blocker.
  // A revoked key is not sent again: the PC already removed it, and a second 401 would restart this flow.
  async function disconnect(reason:'user'|'revoked'='user') {if(disconnecting.current)return;disconnecting.current=true;++connectEpoch.current;try {if(workspaceConnection&&!workspaceConnection.deviceId)await request(workspaceConnection,'/workspace-logout',{}).catch(()=>{});if(reason==='user'&&connection?.deviceId)await Promise.race([request(connection,'/devices/self/forget',{}).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);await saveConnection(null);clearOffline();clearReviewViewed();try{localStorage.removeItem("pocket-own-profile");}catch{}clearChatCache();persistPosition.current=()=>{};clearPositions();setRevoked(reason==='revoked'?pcName.current:null);onDisconnect();}catch(e){disconnecting.current=false;setError((e as Error).message);}}
  if(workspacePasswordRequest)return <WorkspacePassword busy={busy} error={error} onCancel={()=>{setWorkspacePasswordRequest(null);setError('');}} onSubmit={password=>void joinWorkspace(workspacePasswordRequest,password)}/>;
  // Without a reachable PC the phone still checks, downloads and offers the latest release itself.
  if(!health&&embedded)return <div className="desktop-empty" role="status">{error||t("Loading...")}{error&&<button className="secondary" onClick={()=>void connect(embedded.connection)}>{t("Retry")}</button>}</div>;
  if (!health) return <><Connect initial={saved} onConnect={connect} onDemo={startDemo} busy={connecting} error={connectionError} /><Updates connection={null} expanded={false} /></>;
  pcName.current=saved?.name||(connected?health?.name||'':'');
  // Until a PC answers once, Board and Chats explain how to pair instead of showing empty lists.
  const onboardingVisible=!embedded&&!demo&&(!connection||!paired)&&(tab==='workspace'||tab==='chats');
  const connectionScreen=onboardingVisible||tab==='connection'||tab==='settings'&&settingsPage==='connection';
  const pcStatus:ConnectedPc|null=connection&&connected&&health&&!connection.workspaceOnly?{name:health.name,url:connection.url,version:health.version,online:!offline&&!networkError,lastContact,check:async()=>{const start=performance.now(),{stale}=await freshHealth(connection);if(stale)throw Error(t('ПК не ответил. Проверьте сеть и повторите.'));setOffline(false);setLastContact(Date.now());return Math.round(performance.now()-start);}}:null;
  const connectView=(onboarding=false)=><Connect initial={saved?.workspaceOnly?null:saved} onConnect={c=>void connect(c)} busy={connecting} error={connectionError} problem={connectionProblem} status={pcStatus} onDisconnect={()=>void disconnect()} onCancel={cancelConnect} onUpdates={()=>{setSettingsPage('updates');setTab('settings');setMobileChat(true);}} revoked={revokedFrom} onboarding={onboarding} restoring={restoring} target={saved?.name} onDemo={onboarding?startDemo:undefined}/>;
  const visible = sessions.filter((s) => `${s.customTitle || ""} ${s.summary} ${s.cwd}`.toLowerCase().includes(search.toLowerCase()));
  const workspacePicker = (location:'sidebar'|'header'|'settings') => <label className={`workspace-picker workspace-picker-${location}`}>{location==='settings'&&<span>{t("Провайдер")}</span>}<select aria-label={t("Провайдер")} value={provider} disabled={demo} onChange={event=>setProvider(event.target.value as WorkspaceProvider)}><option value="claude">Claude</option><option value="codex">Codex</option><option value="copilot">GitHub Copilot</option></select></label>;
  const chatStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status));
  const chatStatusLabel=chatStatus?t('Чаты')+': '+runStatusLabel(chatStatus):'';
  const chatStatusDot=chatStatus?<RunStatusDot status={chatStatus} className={'chat-tab-status chat-tab-status-'+chatStatus}/>:null;
  // Status of chats other than the open one, shown on the conversation's Back arrow.
  const otherStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status&&!(item.provider===provider&&(item.id===job?.id||item.sessionId&&item.sessionId===(job?.sessionId||selected?.sessionId)))));
  const openInbox=()=>setInboxOpen(true);
  const bell=(variant:'icon'|'tab')=>!embedded&&!readingMode?<InboxButton notices={notices} activity={activity} open={inboxOpen} onOpen={openInbox} variant={variant}/>:null;
  const openNotice=(target:BoardNoticeTarget)=>{setNoticeTarget(target);setLocalBoards(!workspaceConnection);setWorkspaceScanner(false);setTab('workspace');setMobileChat(true);};
  const showSection=(next:typeof tab,page?:SettingsPage)=>{if(next==='chats'){returnToChats();return;}if(page)setSettingsPage(page);else if(next==='settings')setSettingsPage('index');setTab(next);setMobileChat(true);};
  // Before pairing, Chats shows the connection steps under a plain section header, not an empty conversation.
  const chatSurface=tab==='chats'&&!onboardingVisible;
  const inConversation=chatSurface&&mobileChat;
  const tabBar=!embedded&&!readingMode&&!inConversation;
  // Chats that wait for the person come from every provider, so a waiting Codex chat is visible while Claude is selected.
  const waiting=activity.items.filter(item=>item.status==='needs_input'||item.status==='error');
  const sessionStatus=(sessionId:string):RunStatus|undefined=>{const active=jobs.find(j=>j.sessionId===sessionId&&j.status==='running');if(active)return active.approvals?.length?'needs_input':'running';return activity.items.find(item=>item.provider===provider&&item.sessionId===sessionId)?.status;};
  const providerAttention=(id:WorkspaceProvider)=>waiting.filter(item=>item.provider===id).length;
  const providerChips=<div className="provider-chips" role="group" aria-label={t('Провайдер')}>{(['claude','codex','copilot'] as const).map(id=>{const count=providerAttention(id);return <button key={id} aria-pressed={provider===id} disabled={demo||busy||uploading} onClick={()=>setProvider(id)}>{providerName(id)}{count>0&&<b aria-label={t('Ждут вас: {0}',count)}>{count}</b>}</button>;})}</div>;
  const grouped=visible.reduce<{group:'today'|'yesterday'|'earlier';items:Session[]}[]>((list,session)=>{const group=dayGroup(session.lastModified),last=list.at(-1);if(last?.group===group)last.items.push(session);else list.push({group,items:[session]});return list;},[]);
  const sessionRow=(s:Session)=>{const status=sessionStatus(s.sessionId);return <button className={`session-row ${selected?.sessionId === s.sessionId ? 'selected' : ''}`} aria-current={selected?.sessionId===s.sessionId&&mobileChat?'true':undefined} disabled={busy || uploading} key={s.sessionId} onClick={() => void openSession(s)}><MessageSquare size={16} /><div><strong>{s.customTitle || s.summary || t("Без названия")}</strong><small>{s.source === 'desktop' ? 'Desktop · ' : ''}{basename(s.cwd || '')}{s.archived ? t(" · Архив") : ''}<span aria-hidden="true">·</span>{status?<ChatRunStatus status={status}/>:<time dateTime={new Date(s.lastModified).toISOString()} title={fullTime(s.lastModified)}>{relativeTime(s.lastModified)}</time>}</small></div></button>;};
  return <div className={`app ${embedded?'embedded-chat':''} ${mobileChat||onboardingVisible ? 'show-chat' : ''} ${tabBar?'has-tabbar':''} ${tab==='chats'&&(mobileChat||embedded)?'chat-edge-to-edge':''} ${readingMode&&tab==='chats'?'reading-mode':''}`}>

    {readingMode&&tab==='chats' && <button className="icon-button reading-exit" aria-label={t("Выйти из режима чтения")} title={t("Выйти из режима чтения")} onClick={()=>toggleReadingMode(false)}><EyeOff size={21}/></button>}
    <aside className="sidebar">
      <div className="chat-list-actions"><h1>{t("Чаты")}</h1>
        {connection&&<button className="new-chat-button" disabled={busy||uploading} onClick={()=>newChat()}><Plus size={20}/>{t("Новый чат")}</button>}
        {bell('icon')}
      </div>
      <nav className="desktop-tabs"><button className={tab === 'workspace' ? 'active' : ''} onClick={() => {setTab('workspace');setMobileChat(true);}}><ClipboardList size={17} />{t('Доска')}</button><button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-label={t("Чаты")} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={17} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}><BookOpen size={17} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} onClick={()=>{setTab('changelog');setMobileChat(true);}}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={17} />{t("Настройки")}</button></nav>
      {providerChips}
      <div className="search"><Search size={16} /><input aria-label={t("Найти чат")} placeholder={t("Найти чат")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="session-list">
        {waiting.length>0&&!search&&<section className="session-group session-group-waiting" aria-labelledby="waiting-chats"><h2 className="list-label" id="waiting-chats">{t('Ждут вас')}<span>{waiting.length}</span></h2>
          {waiting.map(item=><button className="session-row" key={item.provider+':'+item.id} disabled={busy||uploading||Boolean(activityTarget)} onClick={()=>openActivity(item)}><MessageSquare size={16}/><div><strong>{item.title||t('Новый разговор')}</strong><small>{providerName(item.provider)} · {basename(item.cwd)}<span aria-hidden="true">·</span><ChatRunStatus status={item.status}/></small></div></button>)}</section>}
        {jobs.filter((j) => j.status === 'running' && !sessions.some((s) => s.sessionId === j.sessionId)).map((j) => <button className="session-row" key={j.id} onClick={() => void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: t("Текущая задача"), cwd: j.cwd, lastModified: j.startedAt }, j)}><MessageSquare size={16}/><div><strong>{t("Текущая задача")}</strong><small>{basename(j.cwd)}<span aria-hidden="true">·</span><ChatRunStatus status={j.approvals?.length?'needs_input':'running'}/></small></div></button>)}
        {grouped.map(group=><section className="session-group" key={group.group} aria-label={dayGroupLabel(group.group)}><h2 className="list-label">{dayGroupLabel(group.group)}<span>{group.items.length}</span></h2>{group.items.map(sessionRow)}</section>)}
        {!visible.length && <div className="empty-list"><MessageSquare size={26} /><p>{search ? t("Ничего не найдено") : connection ? t("Здесь появятся чаты {0} из разрешённых папок.",engineName) : t('Подключите ПК, чтобы видеть чаты.')}</p>{!connection&&!search&&!demo&&<button className="primary" onClick={()=>setMobileChat(true)}>{t('Подключить компьютер')}</button>}</div>}
      </div></aside>
    <main className={`workspace ${chatSurface?'chat-canvas':''}`}>
      {reviewOpen && connection && reviewCwd && <Review key={reviewContext} connection={connection} cwd={reviewCwd} taskRunId={taskRun?.id} initialMode={availableReview?.mode} onlyPaths={reviewPaths} onQuote={quoteToDraft} onClose={()=>{setReviewOpen(false);setReviewPaths(undefined);}}/>}
      {taskPanel&&taskRun&&connection&&<TaskRunPanel key={taskRun.id} connection={connection} initial={taskRun} onClose={()=>setTaskPanel(false)} onBoard={target=>{if(embedded?.onBoard)embedded.onBoard(target);else{setNoticeTarget(target);setLocalBoards(true);setTab('workspace');}}}/>}
      {agentPanel && connection && parentChatId && <Subagents key={`${provider}-${parentChatId}`} connection={connection} provider={provider} parentId={parentChatId} initialAgent={agentPanel.initial} initialAgentId={agentPanel.initial?.id} onClose={()=>setAgentPanel(null)}/>}
      {outputsOpen && connection && <ChatOutputs provider={provider} sessionId={parentChatId||undefined} key={`${provider}:${parentChatId||cwd}`} connection={connection} cwd={cwd} messages={outputMessages} onClose={()=>setOutputsOpen(false)} hasMore={hasMore!==null&&historyWindow.current<5000} loadingMore={loadingOlder} onLoadMore={()=>void extendHistory()} />}
      <ChatOverlay edge="top" enabled={chatSurface}>{chatSurface?<>
        <ChatHeader notifications={bell('icon')} title={selected?.customTitle||selected?.summary||t('Новый разговор')} project={basename(taskRun?.projectPath||selected?.cwd||cwd)} provider={engineName} branch={selected?.gitBranch}
          status={!embedded&&otherStatus?{value:otherStatus,label:t('Другие чаты: {0}',runStatusLabel(otherStatus))}:undefined} onBack={()=>embedded?embedded.onBack():setMobileChat(false)}
          context={!selected&&!job&&!taskRun?<>{workspacePicker('header')}<span aria-hidden="true">·</span><label className="project-picker"><Folder size={13} aria-hidden="true"/><select aria-label={t('Папка проекта')} title={cwd} value={cwd} disabled={busy||uploading} onChange={event=>newChat(event.target.value)}>{!projectRoots.includes(cwd)&&<option value={cwd}>{basename(cwd)}</option>}{projectRoots.map(root=><option key={root} value={root}>{basename(root)}</option>)}</select></label></>:undefined}
          review={availableReview||taskRun?{disabled:!connection||demo||!!selected?.readOnly,open:()=>{setReviewPaths(undefined);setReviewOpen(true);},stats:availableReview&&availableReview.files!==undefined?{added:availableReview.added||0,removed:availableReview.removed||0,files:availableReview.files}:undefined}:undefined}
          outputs={hasOutputs?{disabled:!connection||demo||loading,open:()=>setOutputsOpen(true)}:undefined}
          subagents={agentMap.size>0&&parentChatId?{count:agentMap.size,running:[...agentMap.values()].filter(agent=>agent.status==='running').length,disabled:!connection||demo,open:()=>setAgentPanel({})}:undefined}
          reading={outputMessages.length>0||Boolean(job?.partial)?{disabled:loading||!history.length&&!job,open:()=>toggleReadingMode(true)}:undefined}
          top={selected&&!demo?{disabled:loading||busy,open:()=>void jumpHistory(true)}:undefined} detail={{value:detail,set:setDetailMode}}/>
      </>:tab==='workspace'?<header className="chat-header" data-section="board"><h1>{t("Доска")}</h1></header>:<header className="chat-header" data-section={tab}>
        <div className="header-title"><h1>{tab==='connection'||tab==='chats'?t('Подключение к ПК'):tab==='settings'?t("Настройки"):tab==='files'?t("Правила"):t("История изменений")}</h1></div>
      </header>}
      {offline&&!connectionScreen&&<div className="network-banner" role="status">{locale().startsWith('ru')?'Офлайн · сохранённые данные, только просмотр':'Offline · saved data, read-only'}</div>}
      {demo && <div className="demo-banner">{t("Демо · пример интерфейса, без подключения к Claude")}<button onClick={() => void disconnect()}>{t("Подключить ПК →")}</button></div>}
      {historyError && tab==='chats' && <div className="network-banner" role="status">{t("История не обновилась: ")}{t(historyError)}</div>}
      {networkError && !hostRestarting && !connectionScreen && <div className="network-banner" role="status"><RefreshCw size={14} />{t(networkError)}</div>}
      {!canRun && !demo && !offline && tab==='chats' && connection && (providerInfo || provider==='codex') && <div className="network-banner" role="status">{providerInfo?.error ? t(providerInfo.error) : providerInfo ? t("{0} недоступен. Установите приложение и войдите в аккаунт на ПК.",engineName) : t("Обновите сервер на ПК, чтобы включить рабочее пространство Codex.")}</div>}
      <Updates connection={connection} expanded={tab === 'settings'&&settingsPage === 'updates'} />
      {tab==='chats'&&taskRun&&!readingMode&&<button className="chat-task-entry" onClick={()=>setTaskPanel(true)}>{taskRun.title} · {taskStageLabel(taskRun.stage,locale().startsWith('ru'))}</button>}
      </ChatOverlay>
      {tab === 'connection' ? connectView() : onboardingVisible ? connectView(true) : tab === 'workspace' ? connection?<WorkBoards focusTarget={noticeTarget} compactContext local connection={connection} roots={projectRoots} workspaces={personalBoards} onChat={setBoardLaunch}/>:<div className="center-message">{t('Подключитесь к ПК в настройках')}</div> : (tab === 'files'||tab==='changelog') ? (connection||workspaceConnection) ? <DocumentLibrary connection={(connection||workspaceConnection)!} kind={tab==='files'?'rules':'changelog'}/> : <div className="center-message">{t("Файлы доступны после подключения к ПК.")}</div> : tab === 'settings' ? <SettingsPanel connectionPanel={connectView()} online={!!pcStatus?.online} workspaceSelector={workspacePicker('settings')} page={settingsPage} onPage={setSettingsPage} provider={provider} connection={connection} computerName={health.name} networkError={networkError} roots={projectRoots} cwd={cwd} onProject={root=>{newChat(root);setTab('settings');setSettingsPage('workspace');}} appearance={appearanceSettings} codexAccess={codexAccess} onCodexAccess={setCodexAccess} budget={budget} onBudget={setBudget}/> : <>
        <div className="conversation" ref={scroll} style={{overflowAnchor:'none'}} onScroll={() => {const el = scroll.current!;if(!el.getClientRects().length||tab!=='chats')return;const previous=lastScrollTop.current;nearBottom.current = transcriptFollowing(el,previous,nearBottom.current);setShowScrollActions(fromStart||!nearBottom.current);lastScrollTop.current = el.scrollTop;markScrolling();rememberPosition();acknowledgeVisibleActivity();if(fromStart?el.scrollTop>previous&&nearBottom.current:el.scrollTop<previous&&el.scrollTop<=40)void extendHistory();}}>
          <div className="conversation-inner">{selected && !demo && <p className="muted history-meta" role="status">{selected.source === 'desktop' ? `${engineName} Desktop · ` : ''}{job ? t("Продолжение с телефона") : t("История обновляется каждые 3 секунды")}</p>}{selected?.readOnly && <p className="info-card">{t("Только просмотр. Чтобы продолжить чат и работать с файлами, запустите сервер с папкой этого проекта: ")}{cwd}</p>}{demo&&<div className="conversation-date"><span />{t("ПРИМЕР РАЗГОВОРА")}<span /></div>}
            {loading && <div className="center-message">{t("Загружаем историю с ПК…")}</div>}
            {!loading && !history.length && !job && !selected && <div className={'welcome'+(draft.trim()||attachments.length?' welcome-collapsed':'')}><div className="welcome-symbol">✳</div><h1>{t("Что создадим сегодня?")}</h1><p>{t("Файлы, инструменты и контекст вашего ПК.")}<br />{t("Теперь под рукой.")}</p><div className="suggestions">{[t("Изучи структуру проекта"), t("Помоги найти и исправить ошибку"), t("Составь план новой функции")].map((t) => <button key={t} onClick={() => setDraft(t)}>{t}<ArrowUp size={15} /></button>)}</div></div>}
            {!loading && selected && !history.length && !job && <p className="muted">{t("В локальной истории пока нет сообщений. Проверьте, что этот чат открыт в {0} на ПК.",engineName)}</p>}
            {selected&&!loading&&<p className="history-page-status muted" role="status" aria-live="polite">{loadingOlder?(locale().startsWith('ru')?'Загружаем сообщения…':'Loading messages…'):historyError?(locale().startsWith('ru')?'Не удалось обновить историю':'History could not be refreshed'):fromStart||hasMore===null?(locale().startsWith('ru')?'Начало чата':'Beginning of chat'):(locale().startsWith('ru')?'Выше есть ещё сообщения · прокрутите вверх':'More messages above · scroll up')}{historyError&&hasMore!==null&&<button className="text-button" onClick={()=>void extendHistory()}>{locale().startsWith('ru')?'Повторить загрузку':'Retry loading'}</button>}</p>}
            <MessageList connection={connection} cwd={cwd} key={`${provider}-history`} provider={provider} messages={history} toolResults={toolResults} runningMessages={runningMessages} agents={agentMap} onSubagent={connection&&parentChatId ? openSubagent : undefined} mode={detail} turnChanges={changesByTurn} onReview={openTurnReview}/>
            {hasMore !== null && historyWindow.current >= 5000 && <p className="muted" role="status">{t("Достигнут предел окна: 5000 сообщений")}</p>}
            {job&&job.errorCode!=='codex_thread_busy' && <MessageList connection={connection} cwd={cwd} key={`${provider}-${job.id}`} provider={provider} messages={job.messages} streaming={running} toolResults={toolResults} runningMessages={runningMessages} agents={agentMap} onSubagent={connection&&parentChatId ? openSubagent : undefined} mode={detail} turnChanges={changesByTurn} onReview={openTurnReview}/>}
            {job && <PartialMessage key={`${provider}-${job.id}-partial`} provider={provider} streaming={running} text={job.partial||''}/>}
            {job?.expiredApprovals?.map((item,index)=><p key={`expired-${index}`} className="approval-expired transcript-event" role="status">{t('Время ожидания истекло — агенту отправлен отказ')} · {item.tool}</p>)}
            {job?.approvals.map((a) => <ApprovalCard key={`${provider}-${a.id}`} provider={provider} approval={a} autoOpenQuestions={a.id===job.approvals.find(item=>item.tool==='AskUserQuestion')?.id} decide={async (allow, answers, extra) => {await api(`/jobs/${job.id}/approvals/${a.id}`, { allow, answers, ...extra });if(allow&&a.tool==='ExitPlanMode'&&extra?.mode){const key=currentDraftKey(),mode=extra.mode;setAccessChoices(old=>({...old,[key]:mode}));}}} />)}
            {job?.error && job.errorCode!=='codex_thread_busy' && <div className="error">{t(job.error)}</div>}{job?.status === 'stopped' && <p className="muted">{t("Задача остановлена. Можно отправить новое сообщение.")}</p>}
            {job?.status === 'done' && <div className="turn-complete" role="status"><ShieldCheck size={13} />{t(" Готово ")}{turnEnd?.id===job.id&&<><span>· <time dateTime={new Date(turnEnd.at).toISOString()}>{new Date(turnEnd.at).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}</time></span><span className="turn-duration">· {elapsed(turnEnd.at-job.startedAt)}</span></>}{job.cost !== undefined && <span>· ${job.cost.toFixed(4)}</span>}</div>}
            <div ref={bottom} />
          </div>
        </div>
        {(showScrollActions||fromStart)&&!readingMode&&<button className="scroll-latest" data-scrolling={scrolling||undefined} aria-label={unseen?t('К новым сообщениям: {0}',unseen):t('К новым сообщениям')} title={t('К новым сообщениям')} disabled={loading || busy} onClick={()=>{const el=scroll.current;if(fromStart||!el){void jumpHistory(false);return;}nearBottom.current=true;el.scrollTop=el.scrollHeight;lastScrollTop.current=el.scrollTop;setShowScrollActions(false);}}><ArrowDown size={20} aria-hidden="true"/>{unseen>0&&<span className="scroll-latest-count" aria-hidden="true">{unseen>99?'99+':unseen}</span>}</button>}
        <ChatOverlay edge="bottom">
        {/* Hosts without the queue view still report how many follow-ups wait. */}
        {Boolean(job?.pendingInputIds?.length)&&!job?.queued&&<p className="followup-status" role="status">{t(running?"Queued follow-ups: {0}":"Unprocessed follow-ups: {0}",job!.pendingInputIds!.length)}</p>}
        <div className="composer-area">{plan&&!readingMode&&(running||plan.some(item=>item.status!=='completed'))&&<PlanBar items={plan}/>}
          {!readingMode&&<OutboxShelf items={outbox} busy={busy}/>}
          {/* One status line above the composer; while a card asks for a decision, the card says it. */}
          {running&&job&&!job.approvals.length&&!readingMode&&<RunningAction job={job} stopping={stopping} stopHint={Boolean(embedded)}/>}{error && <div className="error" role="alert">{t(error)}<button aria-label={t("Закрыть ошибку")} className="icon-button" onClick={() => setError('')}><X size={14} /></button></div>}
          {(rejectedDraft || job?.errorCode==='codex_thread_busy') && <div className="error" role="alert"><p>{t(codexBusyMessage)}</p>{rejectedDraft && <><p>{rejectedDraft.restored?t("Сообщение и вложения возвращены в черновик. Нажмите «Отправить», когда чат освободится на ПК."):t("Новый черновик сохранён. Неотправленное сообщение и вложения можно добавить к нему.")}</p>{!rejectedDraft.restored && <button className="secondary" disabled={busy||running||uploading} onClick={addRejectedDraft}>{t("Добавить неотправленное сообщение в черновик")}</button>}</>}</div>}
          <ChatComposer text={draft} onText={setDraft} label={t("Сообщение {0}",engineName)}
            placeholder={demo?t("Подключите ПК, чтобы отправлять сообщения"):t("Что нужно сделать?")}
            disabled={demo||selected?.readOnly} uploading={uploading} busy={busy} stopping={stopping}
            mode={running?provider==='codex'?'steer':'queue':'send'} enterSends={enterSendsPreference(composerPreferences,Boolean(embedded))} keyHint={Boolean(embedded)}
            canSend={!(demo||!canRun||selected?.readOnly||busy||loading||uploading||!attachments.every(attachmentReady)||!draft.trim()&&!attachments.length)}
            attachments={attachments} onRemove={id=>setAttachments(old=>old.filter(a=>a.id!==id))} onFiles={(files,options)=>upload(files,options)} onRetry={retryUpload} onInsertText={id=>void insertPastedText(id)} onRecall={recallLast} onSend={()=>void send()}
            stopLabel={t("Остановить {0}",engineName)} onStop={running?()=>void stopRun():undefined}
            controls={<>{(provider==='claude'||provider==='codex')&&<AccessModeChip provider={provider} value={chatAccess} onChange={value=>void changeAccess(value)} running={running} liveChange={provider==='claude'} disabled={demo||Boolean(selected?.readOnly)}/>}<ModelPicker provider={provider} name={engineName} models={provider==='claude'?claudeCatalog.models:providerInfo?.models} value={model} onChange={setModel} disabled={busy||running||uploading||selected?.readOnly} disabledHint={running?t('Модель можно сменить после хода'):undefined} unavailable={provider==='claude'&&claudeCatalog.unavailable}/>{(provider==='codex'||provider==='claude')&&<EffortPicker provider={engineName} {...(provider==='claude'?claudeEffort:codexEffort)} disabled={busy||running||uploading||selected?.readOnly} disabledHint={running?t('Модель можно сменить после хода'):undefined}/>}</>}
            usage={connection&&!demo&&<UsageIndicator key={provider+connection.url+connection.token} connection={connection} provider={provider} models={[...(provider==='claude'?claudeCatalog.models.filter(item=>item.id===(model||'sonnet')).flatMap(item=>[item.id,item.name,item.resolvedModel||'']):[]),model||(provider==='claude'?'sonnet':providerInfo?.models?.find(item=>item.isDefault||providerInfo.models?.length===1)?.id||''),providerInfo?.models?.find(item=>item.id===model||!model&&(item.isDefault||providerInfo.models?.length===1))?.name||'']} onOpen={()=>{setSettingsPage('usage');setTab('settings');setMobileChat(true);}}/>}/>
        </div></ChatOverlay>
      </>}
    </main>
    {tabBar&&(()=>{/* While the inbox sheet is open it is the current place; the section under it is not also marked current. */const barTab=inboxOpen?'':tab;return <nav className="mobile-tabbar" aria-label={t('Основные разделы')}><button className={barTab==='chats'?'active':''} aria-current={barTab==='chats'?'page':undefined} onClick={()=>showSection('chats')} aria-label={t("Чаты")} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={22}/>{chatStatusDot}</span>{t("Чаты")}</button><button className={barTab==='workspace'?'active':''} aria-current={barTab==='workspace'?'page':undefined} onClick={()=>showSection('workspace')}><ClipboardList size={22}/>{t("Доска")}</button>{bell('tab')}<button className={['files','changelog','settings','connection'].includes(barTab)?'active':''} aria-current={['files','changelog','settings','connection'].includes(barTab)?'page':undefined} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={()=>setMoreOpen(true)}><MoreHorizontal size={22}/>{t("Ещё")}</button></nav>;})()}
    {!embedded&&<MobileNavigation open={moreOpen} onClose={()=>setMoreOpen(false)}><nav className="mobile-nav" onClick={event=>{if((event.target as HTMLElement).closest('button'))setMoreOpen(false);}}><button className={tab === 'files' ? 'active' : ''} aria-current={tab==='files'?'page':undefined} onClick={() => showSection('files')}><BookOpen size={20} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} aria-current={tab==='changelog'?'page':undefined} onClick={()=>showSection('changelog')}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings'&&settingsPage!=='connection' ? 'active' : ''} aria-current={tab==='settings'&&settingsPage!=='connection'?'page':undefined} onClick={() => showSection('settings')}><Settings size={20} />{t("Настройки")}</button><button className={tab==='settings'&&settingsPage==='connection'?'active':''} aria-current={tab==='settings'&&settingsPage==='connection'?'page':undefined} onClick={()=>showSection('settings','connection')}><Laptop size={20}/><span className="mobile-nav-label">{t("Подключение к ПК")}<small>{pcStatus?(pcStatus.online?pcStatus.name:t('Нет связи · {0}',pcStatus.name)):saved?.name&&!saved.workspaceOnly?t('Нет связи · {0}',saved.name):t('Не подключено')}</small></span></button></nav></MobileNavigation>}
    {!embedded&&<NotificationInbox open={inboxOpen} onClose={()=>setInboxOpen(false)} notices={notices} activity={activity} busy={busy||uploading||Boolean(activityTarget)} onOpenActivity={openActivity} onOpenNotice={openNotice}/>}
    {pendingTakeover && <div className="modal-backdrop"><section ref={confirmation} className="confirm-modal" role="dialog" aria-modal="true" aria-label={t("Продолжить чат с телефона?")}><Terminal size={28} /><h2>{t("Продолжить чат с телефона?")}</h2><p>{t("Сначала дождитесь завершения ответа в {0} на ПК. Одновременная работа с одной историей может вызвать конфликт.",engineName)}</p><button className="primary" onClick={() => {setPendingTakeover(false);setTakeover(true);void send(true);}}>{t("На ПК завершено — продолжить")}</button><button className="text-button" onClick={() => setPendingTakeover(false)}>{t("Отмена")}</button></section></div>}
  </div>;
}
