import type {ChainDeletePreview} from './markdown-chain';
import type {MarkdownChainScope} from './markdown-chain';
import {setCustomAccount,useCustomAccount,useCustomModels} from './custom-account';
import {ClaudeEngineUpdate,claudeOutdated} from './ClaudeEngineUpdate';
import {chatTitle} from './chat-title';
import {MessageBranch,type BranchTarget} from './MessageBranch';
import {createPortal} from 'react-dom';
import {userAttachmentBlocks} from './user-attachments';
import {ChatActions,type ChatActionTarget} from './ChatActions';
import {ChatListActions} from './ChatListActions';
import {AssistantChatProvider} from './AssistantChat';
import {ChatHistorySkeleton} from './ChatHistorySkeleton';
import {ThreadPrimitive} from '@assistant-ui/react';
import {matchingBoardSelection,type BoardSelection} from './board-selection-context';
import {boardImageMime,boardImageFile,takeBoardImageDrag,takeQueuedBoardImages,type BoardImage} from './board-image-drag';
import {prepareBoardConversation,attachBoardConversation,currentBoardConversation,boardChatLane} from './board-conversation';
import {boardConversationHost} from './board-conversation-host';
import {captureTextAnchor,restoreTextAnchor} from './chat-text-anchor';
import {chatHistoryRequest,readHistoryView,writeHistoryView,recentTranscript,rememberTranscript,transcriptScope,legacyTranscriptScope} from './chat-history-cache';
import './compact-ui.css';
import {ProviderPicker} from './ProviderPicker';
import {ChatSidePanel,SidePreview,type SidePanelTab} from './ChatSidePanel';
import {FilePreview} from './Files';
import {FileWithChanges} from './FileChanges';
import type {FileChange} from './turn-changes';
import {FolderChip} from './FolderChip';
import {HeaderModelMenu} from './HeaderModelMenu';
import {MobileNavigation} from './MobileNavigation';
import {watchWindowTheme} from './window-theme';
import {ChatRunStatus,RunStatusDot,relativeTime,fullTime,dayGroup,dayGroupLabel,runStatusLabel,type RunStatus} from './run-status';
import {providerName} from './ActivityList';
import {useClaudeAccess} from './claude-access';
import {RunningAction,elapsed} from './RunningAction';
import {useDetailMode,setDetailMode} from './detail-mode';
import {turnChanges as computeTurnChanges} from './turn-changes';
import {PlanBar,latestPlan} from './PlanBar';
import './section-header.css';
import {ChatComposer} from './ChatComposer';
import type {MarkdownChainControls} from './MarkdownChainPanel';
import {withLiveWrites} from './live-write-messages';
import {uniqueMessages} from './turn-transcript';
import {ChatGenerationFooter} from './ChatGenerationFooter';
import {ProjectFolderPicker} from './ProjectFolderPicker';
import {TasksPage} from './TasksPage';
import {ChatChainLink} from './ChatChainLink';
import {OutboxShelf,type OutboxItem} from './OutboxShelf';
import {AccessModeChip,type AccessMode} from './AccessModeChip';
import {useComposerPreferences,enterSends as enterSendsPreference,approvalTimeout} from './composer-preferences';
import type {ClaudeAccess} from './claude-access';
import type {CodexAccess} from './preferences';
import {ChatOverlay} from './ChatOverlay';
import {ModelPicker,useClaudeModels} from './ModelPicker';
import {useChatReturn} from './use-chat-return';
import {WorkspacePassword} from './WorkspacePassword';
import type {BoardNoticeTarget} from './BoardNotifications';
import {loadLinkedBoard} from './board-link';
import {savedWorkspaces,rememberWorkspace,workspaceJoinId,type WorkspaceAccess} from './workspace-access';
import {clearOffline} from './offline-data';
import {clearReviewViewed} from './review-viewed';
import {WorkspaceIdentity} from './WorkspaceIdentity';
import {TaskRunPanel} from './TaskRunPanel';
import {useTaskRun,taskRunStageLabel,taskDisplayStage} from './task-run-ui';
import {ChatHeader} from './ChatHeader';
import {WorkBoards,type BoardChat,type BoardRevealTarget} from './WorkBoards';
import {BoardChatSheetGrip} from './BoardChatSheet';
import {useProjectWorkspaces} from './project-workspaces';
import {version as packageVersion} from '../package.json';
import {positionKey,savePosition,flushPositions,clearPositions,type ChatPosition} from './chat-position';
import {UsageIndicator} from './UsageIndicator';
import {LimitAlert} from './LimitAlert';
import './composer-controls.css';
import {shareMessages,shareSnapshot} from './chat-snapshot';
import {startVisiblePoll} from './visible-poll';
import {ConnectionStatus} from './ConnectionStatus';
import {getReachability,hostDown,hostGate,retryNow,setPrimaryHost,useReachability} from './reachability';
import {chatCacheScope,readChatCache,writeChatCache,clearChatCache,forgetChatTranscripts,type RemovedTranscripts} from './chat-cache';
import {useChatErasures} from './use-chat-erasures';


import {attachmentReady,type DraftAttachment} from './AttachmentTray';
import { Review, Subagents, ChatOutputs, DocumentLibrary } from './lazy-panels';
import type {ActivityFeed} from './ActivityList';
import {useActivity} from './useActivity';
import {useChatNotifications,useRunNotifications,type WatchedChat} from './chat-notifications';
import {EffortPicker,useCodexEffort,type EffortModel} from './EffortPicker';


import {extractChatOutputs} from './chat-outputs';
import {useBackAction,useBackNavigation} from './navigation';
import { preferences, preferredRoot, savePreferredRoot, savePreferences, selectedWorkspace, saveSelectedWorkspace, clampBudget, type WorkspaceProvider, type PreferenceChange } from './preferences';
import { useWorkspaceState, useWorkspaceRef } from './workspace-state';
import { Updates } from './Updates';
import { useLanguage } from './i18n';
import { LanguageSelector } from './Language';
import { t, locale } from "./i18n";import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { BookOpen, FileText, Plus, Search, MessageSquare, Folder, Settings, X, RefreshCw, ShieldCheck, ListChecks, ClipboardList, EyeOff, MoreHorizontal, Laptop, ArrowDown, LoaderCircle, LayoutDashboard } from 'lucide-react';
import { Connect, type ConnectedPc } from './Connect';
import { connectionProblem as classifyProblem, type ConnectionProblem } from './connection-errors';
import { useAppearance } from './Appearance';
import {SettingsPanel,type SettingsPage} from './SettingsPanel';
import {useLiveSettings} from './live-settings';
import { MessageList, ApprovalCard } from './Messages';

import type { DocumentKind } from './DocumentLibrary';

import { fileBase64, loadConnection, normalizeUrl, pairDevice, request, saveConnection, type Connection } from './api';
import { demoMessages, demoSessions } from './demo';
import type { ChatMessage, JobView, SubagentView,ActivityItem } from '../server/types';

import type {BoardLink,Session} from './session';
type Health = {name: string;roots: string[];version: string;protocol: number;hostId?:string;routes?:string[]};
// Remembers across the remount that the PC revoked this phone, so the next screen can say why it is empty.
const revokedKey='pocket-code-revoked';
function readRevoked(){try{return localStorage.getItem(revokedKey);}catch{return null;}}
function setRevoked(name:string|null){try{if(name===null)localStorage.removeItem(revokedKey);else localStorage.setItem(revokedKey,name);}catch{/* The notice is optional. */}}
/** A cached /health answer means the PC was not reached, even though the request returned. */
async function freshHealth(c:Connection){let stale=false;const mark=()=>{stale=true;};window.addEventListener('pocket-offline-read',mark);try{return {health:await request<Health>(c,'/health'),stale};}finally{window.removeEventListener('pocket-offline-read',mark);}}
// Switching from a new desktop chat remounts the workspace for the same native host.
const desktopHealth=new WeakMap<Connection,Health>();
// The cache scope of that host is a digest; computing it once lets a reopened chat start with its connection in place.
const desktopScope=new WeakMap<Connection,string>();
type ProviderInfo = {id: WorkspaceProvider;name: string;available: boolean;authenticated?: boolean;models?: EffortModel[];error?: string;};
/** The provider list a PC reported last: a chat opened later can be written to at once instead of waiting for the next check. */
const knownProviders=new Map<string,ProviderInfo[]>();
const defaultProviders=():ProviderInfo[]=>[{id:'claude',name:'Claude',available:true}];
type Attachment = DraftAttachment;
export type ChatDraft = {text: string;attachments: Attachment[];};
type RejectedDraft = ChatDraft & {restored: boolean;};
/** A message the host refused because the turn was ending; it is sent as it was written, never the current draft. */
type PendingSend = {jobId: string;key: string;text: string;attachments: Attachment[];boardSelection?:BoardSelection|null;
  /** Written while the chat was still opening; it leaves as soon as the chat is ready, as a follow-up when a turn is running. */
  opening?:boolean;};
const codexBusyMessage = 'This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
const budgetRangeMessage='Лимит стоимости запроса вне диапазона $0.10–$100. Измените его в настройках доступа Claude.';
/** A failure that only says the PC cannot be reached; the connection status line already tells it, so screens do not repeat it. */
const connectivityError=(error:unknown)=>{const problem=(error as {problem?:string}|null)?.problem;return problem==='unreachable'||problem==='tls'||problem==='cleartext'||hostDown(getReachability());};
const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
export type EmbeddedChat={taskDrawer?:HTMLElement;tasksPage?:{initialId?:string;initialRoot?:string;project?:string};onTaskProject?(root:string):void;/** Shown as a provider picker inside a new chat; the host switches provider and keeps the new chat. */onProvider?(value:WorkspaceProvider):void;/** Rules and changelog of the chat's folder open in the host window. */onDocuments?(kind:'rules'|'changelog',root:string):void;/** Opens a section of the PC window's Settings (Providers holds API connections and the local model). */onOpenSettings?(section:'providers'):void;onOpenTasks?(initialId?:string,owner?:MarkdownChainScope):void;onTaskDraft?(root:string,prompt?:string):void;taskDraft?:{root:string;prompt:string};onTaskDraftUsed?():void;draftStore?:Map<string,Map<string,ChatDraft>>;onTaskProvider?(provider:WorkspaceProvider):void;activity?:ActivityFeed;visible?:boolean;connection:Connection;provider:WorkspaceProvider;session?:Session;cwd:string;jobId?:string;boardSelection?:BoardSelection|null;boardChat?:BoardChat;draft?:string;onBoard?(target:BoardNoticeTarget):void;onRevealBoardSelection?(target:BoardRevealTarget):void;onCreated?(session:Session,job:JobView):void;onNewBoardChat?(target:BoardChat):void;onBack():void};
function focusLatestMessage(transcript: HTMLElement) {
  const latest = transcript.querySelector<HTMLElement>('.conversation-inner > article.message:last-of-type');
  const target = latest ?? transcript.querySelector<HTMLElement>('.conversation-inner');
  target?.focus({preventScroll: true});
}

export function App({embedded}:{embedded?:EmbeddedChat}={}) {
  useBackNavigation();
  // The phone shell paints its status bar, navigation bar and theme-color from the same palette; inside the Windows window DesktopApp owns the frame.
  useEffect(()=>embedded?undefined:watchWindowTheme(),[Boolean(embedded)]);
  const [generation, setGeneration] = useState(0);
  return <WorkspaceApp key={generation} embedded={embedded} onDisconnect={() => setGeneration(value => value + 1)} />;
}
function WorkspaceApp({onDisconnect,embedded}: {onDisconnect():void;embedded?:EmbeddedChat}) {
  const language=useLanguage();
  const appearanceSettings = useAppearance(!embedded);
  const [provider, setProvider] = useState<WorkspaceProvider>(()=>embedded?.provider||selectedWorkspace());
  // A chat reopened in the PC window starts from what its host already answered: connection, cache scope, health and providers.
  const warm=embedded&&desktopHealth.has(embedded.connection)&&desktopScope.has(embedded.connection)?embedded.connection:null;
  const [providers, setProviders] = useState<ProviderInfo[]>(()=>embedded&&knownProviders.get(embedded.connection.url)||defaultProviders());
  const providerInfo = providers.find(item => item.id === provider);
  const engineName = provider==='copilot'?'Copilot':provider === 'codex' ? 'Codex' : 'Claude';

  const [cacheScope,setCacheScope]=useState(()=>warm?desktopScope.get(warm)!:'');
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
  const [connection, setConnection] = useState<Connection | null>(warm),[saved, setSaved] = useState<Connection | null>(null);
  const [connecting,setConnecting]=useState(false),[connectionError,setConnectionError]=useState(''),[connectionProblem,setConnectionProblem]=useState<ConnectionProblem|undefined>();
  const [connected,setConnected]=useState(Boolean(warm)),[paired,setPaired]=useState(false),[restoring,setRestoring]=useState(!embedded),[lastContact,setLastContact]=useState(0),[revokedFrom,setRevokedFrom]=useState(readRevoked);
  const disconnecting=useRef(false),pcName=useRef('');
  useChatErasures(!embedded?connection:null);
  const [workspaceConnection,setWorkspaceConnection]=useState<Connection|null>(null),[workspaceScanner,setWorkspaceScanner]=useState(false);
  const projectSpaces=useProjectWorkspaces(embedded?connection:workspaceConnection);
  const personalBoards=useProjectWorkspaces(connection);const [localBoards,setLocalBoards]=useState(true);
  const [offline,setOffline]=useState(false);
  useEffect(()=>{const stale=()=>setOffline(true),fresh=()=>{setOffline(false);setLastContact(Date.now());};window.addEventListener('pocket-offline-read',stale);window.addEventListener('pocket-online-read',fresh);return()=>{window.removeEventListener('pocket-offline-read',stale);window.removeEventListener('pocket-online-read',fresh);};},[]);
  // One reachability model for every screen: requests report into it and one probe with backoff runs while the PC is away.
  const reach=useReachability(),unreachable=offline||hostDown(reach),gate=hostGate(connection?.url);
  const [providersLoaded,setProvidersLoaded]=useState(false);
  const canRun = !unreachable && !!connection && (!embedded||connected) && providerInfo?.available === true && providerInfo.authenticated !== false && !connection?.workspaceId;
  const [boardChat,setBoardChat]=useState<BoardChat|null>(embedded?.boardChat||null);
  const [boardMissing,setBoardMissing]=useStateForWorkspace(false);
  const [boardSelection,setBoardSelection]=useState<BoardSelection|null>(null);
  const [boardVisited,setBoardVisited]=useState(false),[boardReveal,setBoardReveal]=useState<BoardRevealTarget|null>(null);
  const selectionContextFile=useRef<{key:string;attachment:Attachment}|null>(null);
  const boardContextFile=useRef<Attachment|null>(null);
  useEffect(()=>{boardContextFile.current=null;},[boardChat?.boardId,boardChat?.prompt]);
  const [noticeTarget,setNoticeTarget]=useState<BoardNoticeTarget|null>(null);
  const [boardLaunch,setBoardLaunch]=useState<BoardChat|null>(null);
  const [taskPanel,setTaskPanel]=useState(false);
  const [workspaceAccesses,setWorkspaceAccesses]=useState<WorkspaceAccess[]>([]);
  const [health, setHealth] = useState<Health | null>(embedded?desktopHealth.get(embedded.connection)??null:{name:'Offline',roots:[],version:packageVersion,protocol:1}),[sessions, setSessions] = useStateForWorkspace<Session[]>([]),[jobs, setJobs] = useStateForWorkspace<JobView[]>([]);
  const [selected, setSelected] = useStateForWorkspace<Session | null>(null),[history, setHistory] = useStateForWorkspace<ChatMessage[]>([]),[job, setJob] = useStateForWorkspace<JobView | null>(null);
  const [projects, setProjects] = useState<string[] | null>(null);
  const projectRoots = (projects || health?.roots || []);
  const [projectReady, setProjectReady] = useStateForWorkspace(false);
  const projectChosen = useRefForWorkspace(false);
  const [chatAction,setChatAction]=useState<ChatActionTarget|null>(null);
  const [cwd, setCwd] = useStateForWorkspace('');
  // Device navigation survives initial pairing/reconnection. Transcript state remains PC-scoped.
  // The phone starts on Chats, where chats that wait for the person are listed first; Back from there leaves the app.
  const [localTab,setTab]=useState<'tasks' | 'chats' | 'files' | 'changelog' | 'settings' | 'connection' | 'workspace'>('chats'),[docView,setDocView]=useState<DocumentKind>('rules');
  const tab=embedded?.tasksPage?'tasks':localTab;
  const [taskChainId,setTaskChainId]=useState<string>();
  const [taskSelection,setTaskSelection]=useState<{scope:string;root:string}>();
  const taskProject=embedded?.tasksPage?.project||(taskSelection?.scope===cacheScope?taskSelection.root:'');
  function setTaskProject(root:string){
    setTaskSelection({scope:cacheScope,root});
    embedded?.onTaskProject?.(root);
  }
  const [localTaskDraft,setLocalTaskDraft]=useState<{root:string;prompt:string}>();
  const [linkedRoot,setLinkedRoot]=useState<string>();
  function openTasks(id?:string,owner?:MarkdownChainScope){
    setLinkedRoot(owner?.cwd);
    if(owner && !embedded){
      if(owner.provider==='claude')setCustomAccount(owner.account||'');
      setProvider(owner.provider);
    }
    if(id)setTaskProject(owner?.cwd??cwd);
    if(embedded?.onOpenTasks){embedded.onOpenTasks(id,owner);return;}
    setTaskChainId(id);setTab('tasks');setMobileChat(true);
  }
  useEffect(()=>{if(tab==='workspace')setBoardVisited(true);},[tab]);
  const [mobileChat,setMobileChat]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [chatViewOpen,setChatViewOpen]=useStateForWorkspace(false);
  useEffect(()=>{if(tab==='chats')setChatViewOpen(mobileChat);},[tab,mobileChat]);
  const returnToChats=()=>{setTab('chats');setMobileChat(boardChat?.context?false:chatViewOpen);};
  const liveSettings=useLiveSettings();
  const [settingsPage,setSettingsPage]=useState<SettingsPage>('index'),[settingsSubpage,setSettingsSubpage]=useState<'access'|null>(null);
  const [draft, setDraft] = useStateForWorkspace(''),[search, setSearch] = useStateForWorkspace(''),[lastModel, setLastModel] = useStateForWorkspace(id=>preferences(id).model);
  // Each chat keeps its own model, like its access mode; the last choice is the default of a new chat. Effort follows the model.
  const [modelChoices,setModelChoices] = useStateForWorkspace<Record<string,string>>({});
  const modelKey=job?.sessionId||selected?.sessionId||`new:${cwd}`,model=modelChoices[modelKey]??lastModel;
  const setModel=(value:string)=>{setModelChoices(old=>({...old,[modelKey]:value}));setLastModel(value);};
  const codexEffort=useCodexEffort(provider==='codex'?providerInfo?.models:undefined,model);
  const claudeAccess=useClaudeAccess();
  const [codexAccess,setCodexAccess]=useStateForWorkspace(id=>preferences(id).codexAccess);
  const [error, setError] = useStateForWorkspace(''),[networkError, setNetworkError] = useStateForWorkspace(''),[busy, setBusy] = useStateForWorkspace(false),[loading, setLoading] = useStateForWorkspace(false);
  const [demo, setDemo] = useState(false),[attachments, setAttachments] = useStateForWorkspace<Attachment[]>([]);
  // Each file has its own card; navigation and sending wait while any of them is still uploading.
  const uploading=attachments.some(item=>item.status==='uploading');
  const composerPreferences=useComposerPreferences();
  const claudeCatalog=useClaudeModels(demo?null:connection,provider,cwd);
  // A custom provider runs this Claude agent with its own URL, key and model catalog.
  const selectedAccount=useCustomAccount(),customAccount=embedded?.taskDrawer?(embedded.session?.account||''):selectedAccount,account=provider==='claude'&&!demo?customAccount:'',customModels=useCustomModels(demo?null:connection,account);
  const claudeDefaultModel=claudeCatalog.models.find(item=>item.isDefault)?.id||'sonnet';
  const claudeEffort=useCodexEffort(provider==='claude'?claudeCatalog.models:undefined,model,'claude');
  const localActivity=useActivity(demo||embedded?.activity?null:connection);
  const activity=embedded?.activity||localActivity;
  const [activityTarget,setActivityTarget]=useState<{item:ActivityItem;connection:Connection}|null>(null);
  const [notificationTarget,setNotificationTarget]=useState<(WatchedChat & {account?:string})|null>(null);
  useRunNotifications(demo||connection?.workspaceId?null:connection,locale().startsWith('ru')?'ru':'en',false,!!embedded?.taskDrawer);
  useChatNotifications(connection,demo?null:tab==='chats'?(mobileChat&&(selected||job)?{provider,sessionId:job?.sessionId||selected?.sessionId,jobId:job?.id,cwd,title:selected?.customTitle||selected?.summary||engineName}:null):undefined,locale().startsWith('ru')?'ru':'en',chat=>{
    if(chat.provider!=='claude'&&chat.provider!=='codex'&&chat.provider!=='copilot')return;
    setNotificationTarget(chat);setProvider(chat.provider);
  },!!embedded?.taskDrawer,openTasks);
  useEffect(()=>{
    if(!notificationTarget||notificationTarget.provider!==provider||!connection)return;
    if(busy||uploading)return;
    const target=notificationTarget;setNotificationTarget(null);
    void openSession({sessionId:target.sessionId||`pending-${target.jobId}`,cwd:target.cwd,summary:target.title,provider,account:target.account,lastModified:Date.now()},target.jobId?{id:target.jobId,sessionId:target.sessionId}:undefined);
  },[notificationTarget,provider,connection,busy,uploading]);
  useEffect(()=>{setActivityTarget(null);},[connection]);
  const [takeover, setTakeover] = useStateForWorkspace(false),[budget, setBudget] = useStateForWorkspace(id=>preferences(id).budget);
  useBackAction(()=>{
    if(activityTarget){setActivityTarget(null);return true;}
    if(readingMode&&tab==='chats'){toggleReadingMode(false);return true;}
    if(tab==='settings'&&settingsPage!=='index'){setSettingsPage('index');return true;}
    if(!embedded&&boardChat?.context&&tab==='chats'&&mobileChat){setTab('workspace');return true;}
    if(embedded?.tasksPage)return false;
    if(tab!=='chats'){returnToChats();return true;}
    if(!embedded&&mobileChat){setMobileChat(false);return true;}
    return false;
  });
  useBackAction(()=>{if(readingMode)toggleReadingMode(false);else setTab('workspace');return true;},30,Boolean(!embedded&&boardChat?.context&&tab==='chats'&&mobileChat));
  const drafts=useRefForWorkspace<Map<string,ChatDraft>|null>(null);
  if(embedded?.draftStore){
    const key=JSON.stringify([cacheScope,provider,account]);
    if(!embedded.draftStore.has(key))embedded.draftStore.set(key,new Map());
    drafts.current=embedded.draftStore.get(key)!;
  }else if(!drafts.current)drafts.current=new Map();
  const submissions=useRefForWorkspace<Map<string,ChatDraft & {key:string}>|null>(null);
  if(!submissions.current)submissions.current=new Map();
  const [rejectedDrafts,setRejectedDrafts]=useStateForWorkspace<Record<string,RejectedDraft>>({});
  const currentDraftKey=()=>job?.sessionId||selected?.sessionId||`new:${cwd}`;
  const [outgoing,setOutgoing]=useStateForWorkspace<{key:string;text:string;files:Attachment[]}|null>(null);
  const draftLocation=useRefForWorkspace(currentDraftKey());
  draftLocation.current=currentDraftKey();
  const visibleOutgoing=outgoing?.key===currentDraftKey()?outgoing:null;
  const rejectedDraft=rejectedDrafts[currentDraftKey()];
  const embeddedDraftReady=useRef(false);
  const rememberDraft=()=>{if(embedded&&!embeddedDraftReady.current)return;drafts.current!.set(currentDraftKey(),{text:draft,attachments});};
  const drawerDraft=useRef(rememberDraft);
  drawerDraft.current=rememberDraft;
  useEffect(()=>()=>{if(embedded?.taskDrawer)drawerDraft.current();},[embedded?.taskDrawer]);
  const restoreDraft=(key:string)=>{const value=drafts.current!.get(key);setDraft(value?.text||'');setAttachments(value?.attachments||[]);};
  function openActivity(item:ActivityItem){
    if(!connection||busy||uploading)return;
    rememberDraft();setActivityTarget({item,connection});setProvider(item.provider);
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
  const pendingPosition=useRefForWorkspace<(ChatPosition & {focusFrom?: HTMLButtonElement})|null>(null);
  const paging=useRefForWorkspace<symbol|null>(null);
  const historyExpanded=useRefForWorkspace(false);
  const scrollAnchor=useRefForWorkspace<{height:number;top:number;epoch:number;prepend:boolean;messageId?:string;offset?:number}|null>(null);
  useEffect(()=>{if(!embedded?.taskDrawer)saveSelectedWorkspace(provider);},[provider,embedded?.taskDrawer]);
  useEffect(()=>savePreferences(provider,{model:lastModel,mode:"default",budget,codexAccess}),[provider,lastModel,budget,codexAccess]);
  // Desktop settings change the device defaults while this chat stays mounted; follow them instead of saving stale values back.
  useEffect(()=>{const handle=(event:Event)=>{const change=(event as CustomEvent<PreferenceChange>).detail;if(!change||change.provider!==provider)return;if(change.budget!==undefined)setBudget(clampBudget(change.budget));if(change.codexAccess)setCodexAccess(change.codexAccess);};window.addEventListener('pocket-code-preferences',handle);return()=>window.removeEventListener('pocket-code-preferences',handle);},[provider,setBudget,setCodexAccess]);
  useEffect(()=>{
    if (!connection || !health) return;
    if (projects !== null && !projectReady) {
      if (!projectChosen.current) setCwd(preferredRoot(connection.url, projectRoots, provider));
      setProjectReady(true);
    } else if (!cwd) setCwd(preferredRoot(connection.url, health.roots, provider));
  },[connection,health,projects,projectReady,cwd,provider]);
  useEffect(()=>{if(!embedded?.taskDrawer&&connection&&projectReady&&projects?.includes(cwd))savePreferredRoot(connection.url,cwd,provider);},[connection,cwd,projects,projectReady,provider]);
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
  // Last confirmed contact with the running job; without it the screen says "status unknown" instead of pretending to stream.
  const jobContact = useRefForWorkspace({at:0,failures:0});
  const [runLost,setRunLost] = useStateForWorkspace<number|null>(null);
  const runUnknown = running && (runLost!==null || unreachable);
  const [sessionsLoaded,setSessionsLoaded] = useStateForWorkspace(false);
  // Effects that outlive a list refresh read the current chats, not the list from when they started.
  const sessionsNow=useRef(sessions);sessionsNow.current=sessions;
  /** Follow-ups written while the PC was away; they leave in order when it answers again (kept in memory, for at most a day). */
  const [offlineQueue,setOfflineQueue] = useStateForWorkspace<(PendingSend&{id:string;at:number})[]>([]);
  // Only a chat this phone already continues can wait for the PC; a new chat or a takeover needs the PC to answer first.
  const canQueue = unreachable && !demo && !!connection && !selected?.readOnly && (running&&!!job || takeover && !!(job?.sessionId||selected?.sessionId));
  // The PC answers, but this chat is still being confirmed (its first answers after opening): a message can already be sent.
  // It waits beside the composer and leaves by itself; a provider that needs sign-in or a PC that is away is not "warming".
  const warming = !canRun && !unreachable && !demo && !connectionError && !connection?.workspaceId && (embedded ? !connection||!connected||!providerInfo : !!connection&&(connecting||!providerInfo));
  useEffect(()=>{if(!running)setStopping(false);},[running,job?.id]);
  /** Put a message back into a chat's draft, after anything already typed there. */
  function mergeDraft(key:string,text:string,files:Attachment[],stored=false){
    const merge=(current:ChatDraft):ChatDraft=>{const combined=[...current.attachments,...files.filter(item=>!current.attachments.some(old=>old.id===item.id))];if(combined.length>10)setError(t("Можно прикрепить до 10 файлов"));return {text:current.text.trim()?(text.trim()?current.text.replace(/\s+$/,'')+'\n\n'+text:current.text):text,attachments:combined.slice(0,10)};};
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
    setModelChoices(old=>Object.hasOwn(old,from)&&!Object.hasOwn(old,job.sessionId!)?(({[from]:moved,...rest})=>({...rest,[job.sessionId!]:moved}))(old):old);
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
    ...(pendingSend&&pendingSend.key===currentDraftKey()?[{id:'pending',text:pendingSend.text,attachments:pendingSend.attachments.length,caption:pendingSend.opening?t('Отправится, как только чат откроется'):t('Отправится, когда {0} закончит ход',engineName),onEdit:()=>releasePending(),onRemove:()=>setPendingSend(null),removeLabel:t('Не отправлять')}]:[]),
    ...(job?.queued||[]).map(item=>({id:item.id,text:item.text,attachments:item.attachments,caption:running?t('После завершения ответа'):t('Не доставлено'),
      // The files of a queued message live only in the screen that sent it; never withdraw it without them.
      onEdit:async()=>{const files=sentFollowups.current!.get(item.id);if(item.attachments&&!files){setError(t('Файлы этого сообщения остались на устройстве, с которого оно отправлено. Оно уйдёт после ответа как есть.'));return;}if(await withdrawQueued(item.id))mergeDraft(currentDraftKey(),item.text,files||[]);},
      onRemove:()=>void withdrawQueued(item.id),
      // "Send now" stops the turn and sends this message first, as it was written.
      onSendNow:async()=>{const current=job,files=sentFollowups.current!.get(item.id);if(item.attachments&&!files){setError(t('Файлы этого сообщения остались на устройстве, с которого оно отправлено. Оно уйдёт после ответа как есть.'));return;}if(!current||!await withdrawQueued(item.id))return;setPendingSend({jobId:current.id,key:currentDraftKey(),text:item.text,attachments:files||[]});if(current.status==='running'){setStopping(true);try{await api(`/jobs/${current.id}/stop`,{});}catch(e){setStopping(false);setError((e as Error).message);}}}})),
  ...offlineQueue.filter(item=>item.key===currentDraftKey()).map(item=>({id:item.id,text:item.text,attachments:item.attachments.length,caption:t('Отправится, когда ПК будет на связи'),
    onEdit:()=>{setOfflineQueue(old=>old.filter(other=>other.id!==item.id));mergeDraft(item.key,item.text,item.attachments);},onRemove:()=>setOfflineQueue(old=>old.filter(other=>other.id!==item.id)),removeLabel:t('Не отправлять')}))];
  /** Up in an empty field brings back the last message the person wrote. */
  const recallLast=()=>{for(const message of [...outputMessages].reverse()){if(message.role!=='user')continue;const text=message.blocks.filter(block=>block.type==='text').map(block=>block.text||'').join('\n').trim();if(text&&!text.startsWith('<task-notification'))return text;}return undefined;};
  // While the run status is unknown, Esc retries the connection like the Stop button instead of sending a stop the PC cannot receive.
  const keyActions=useRef({stop:()=>{}});keyActions.current={stop:()=>{if(runUnknown)retryNow();else void stopRun();}};
  useEffect(()=>{
    // Windows: Esc stops the run; Ctrl+Shift+M, I and E open the access, model and effort pickers of this chat; Ctrl+Shift+D opens Review.
    if(!embedded||embedded.taskDrawer)return;
    const key=(event:KeyboardEvent)=>{
      const root=scroll.current?.closest<HTMLElement>('.app');if(!root||!root.getClientRects().length||event.defaultPrevented)return;
      if(document.querySelector('[aria-modal="true"],dialog[open],.access-menu,.model-custom,.chat-menu'))return;
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
    if(!pending||!canRun||busy||uploading||loading||pending.key!==currentDraftKey())return;
    // A message written while the chat was opening leaves as soon as it is ready, as a follow-up when a turn is running.
    if(!pending.opening&&(running||job&&job.id!==pending.jobId))return;
    setPendingSend(null);
    void send({text:pending.text,attachments:pending.attachments,boardSelection:pending.opening?pending.boardSelection:undefined,restore:true});
  },[canRun,busy,running,uploading,loading,job?.id,job?.status,selected?.sessionId,pendingSend]);
  const releaseWaiting=useRef(releasePending);releaseWaiting.current=releasePending;
  useEffect(()=>{
    if(!pendingSend?.opening)return;
    // The chat finished opening but cannot take messages (sign-in needed, the PC went away): the text returns to the field.
    if(!loading&&!warming&&!canRun&&!busy){releaseWaiting.current();return;}
    const timer=setTimeout(()=>{releaseWaiting.current();setError(t('Чат не открылся вовремя. Сообщение возвращено в поле ввода.'));},30000);
    return()=>clearTimeout(timer);
  },[pendingSend,loading,warming,canRun,busy]);
  useEffect(()=>{
    // When the PC answers again, waiting follow-ups of this chat leave one at a time; older than a day they return to the draft instead.
    const next=offlineQueue.find(item=>item.key===currentDraftKey());
    if(!next||!canRun||busy||uploading||loading||pendingSend||sending.current)return;
    setOfflineQueue(old=>old.filter(item=>item.id!==next.id));
    if(Date.now()-next.at>86400000){mergeDraft(next.key,next.text,next.attachments);return;}
    void send({text:next.text,attachments:next.attachments,boardSelection:next.boardSelection,restore:true});
  },[canRun,busy,uploading,loading,offlineQueue,pendingSend,job?.id,selected?.sessionId]);
  function acknowledgeVisibleActivity(){
    const element=scroll.current;
    if(!element||!element.getClientRects().length||element.closest('[inert]')||document.visibilityState==='hidden'||tab!=='chats'||loading||loadingOlder||error||historyError||activityTarget||reviewOpen||agentPanel||outputsOpen)return;
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
  useEffect(()=>{acknowledgeActivity.current();},[activity.items,job?.revision,loading,loadingOlder,history,provider,tab,mobileChat,activityTarget,reviewOpen,agentPanel,outputsOpen,error,historyError]);
  useEffect(()=>{const visible=()=>{if(document.visibilityState!=='hidden')requestAnimationFrame(()=>acknowledgeActivity.current());};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[]);
  const parentChatId = job?.sessionId || selected?.sessionId;
  const taskRun=useTaskRun(demo?null:connection,provider,cwd,job?.id,parentChatId,boardChat?.taskRun||embedded?.boardChat?.taskRun);
  useEffect(()=>setTaskPanel(false),[taskRun?.id]);
  const outputMessages=useMemo(()=>uniqueMessages([...history,...(job?.errorCode!=='codex_thread_busy'?job?.messages||[]:[])]),[history,job?.messages,job?.errorCode]);
  const jobTranscript=useMemo(()=>withLiveWrites(job?.status==='running'&&job.reasoningPreviews?.length?[...job.messages,...job.reasoningPreviews]:job?.messages||[],job?.status==='running'?job.writePreviews:undefined),[job?.messages,job?.reasoningPreviews,job?.writePreviews,job?.status]);
  const runningMessages=useMemo(()=>job?.status==='running'?new Set(jobTranscript):null,[jobTranscript,job?.status]);
  const transcript=useMemo(()=>job?.errorCode==='codex_thread_busy'||!jobTranscript.length?history:uniqueMessages([...history,...jobTranscript]),[history,jobTranscript,job?.errorCode]);
  const toolResults=useMemo(()=>{const blocks=outputMessages.flatMap(message=>message.blocks),calls=new Set(blocks.filter(b=>b.type==='tool_use').map(b=>b.id));return new Map(blocks.filter(b=>b.type==='tool_result'&&b.tool_use_id&&calls.has(b.tool_use_id)).map(b=>[b.tool_use_id!,b]));},[outputMessages]);
  const detail=useDetailMode();
  const resultRoot=!selected?.readOnly&&!demo?(selected?.cwd||job?.cwd||cwd):undefined;
  const changesByTurn=useMemo(()=>resultRoot?computeTurnChanges(outputMessages,toolResults,running,resultRoot):undefined,[outputMessages,toolResults,running,resultRoot]);
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
      if(document.visibilityState!=='hidden'&&gate()&&document.querySelector('.workspace')?.getClientRects().length)try{
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
  /** A task follow-up joins the unsent draft instead of replacing it; repeating the same step does not duplicate it. */
  const [branchTarget,setBranchTarget]=useState<BranchTarget|null>(null);
  const branchPrepared=useRef<{target:BranchTarget;sessionId:string|null}|null>(null);
  const appendDraft=(text:string)=>setDraft(current=>!current.trim()?text:current.includes(text.trim())?current:current.replace(/\s+$/,'')+'\n\n'+text);
  useEffect(()=>{
    setAgentPanel(null);setAgentList([]);setOutputsOpen(false);
    if(!connection||demo||tab!=='chats'||!parentChatId||parentChatId.startsWith('pending-'))return;
    let cancelled=false;
    async function pollAgents(){
      try{const data=await request<{agents:SubagentView[]}>(connection!,`/sessions/${encodeURIComponent(parentChatId!)}/subagents?provider=${provider}`);if(!cancelled)setAgentList(old=>shareSnapshot(old,Array.isArray(data.agents)?data.agents.filter(agent=>agent&&typeof agent.id==='string'&&typeof agent.name==='string'):[]));}
      catch{/* Main chat remains usable if an older bridge or provider cannot expose child histories. */}
    }
    const stop=startVisiblePoll(pollAgents,6000,true,document,hostGate(connection.url));return()=>{cancelled=true;stop();};
  },[connection,provider,parentChatId,tab,demo]);
  const historyScope=transcriptScope(cacheScope,connection,selected?selected.account:job?.account??account);
  function clearDeniedHistory(failure:unknown,sessionId:string,pendingJob=false){
    const status=(failure as {status?:number}).status;
    if(!connection||!(status===401||status===403||status===404&&!pendingJob))return;
    void forgetChatTranscripts(connection,provider,[sessionId],'unavailable');
    setHistory([]);setJob(null);setHasMore(null);
  }
  const api = <T,>(endpoint:string,data?:unknown):Promise<T>=>data===undefined&&/^\/sessions\/[^/]+\/messages\?/.test(endpoint)?chatHistoryRequest(connection!,endpoint,historyScope) as Promise<T>:request<T>(connection!,endpoint,data);
  const [libraryRevision,setLibraryRevision]=useState(0);
  // Provider workspaces stay mounted on mobile. A deletion may be confirmed by a chain in a different lane.
  const removalHandlers=useRef(new Map<string,(detail:RemovedTranscripts)=>void>());
  const activeSurface=useRef({provider,tab});
  useLayoutEffect(()=>{activeSurface.current={provider,tab};},[provider,tab]);
  const hostScope=transcriptScope(cacheScope,connection);
  useLayoutEffect(()=>{removalHandlers.current.clear();},[hostScope]);
  useLayoutEffect(()=>{
    if(!hostScope)return;
    removalHandlers.current.set(provider,detail=>{
      const ids=new Set(detail.ids);
      setSessions(old=>old.filter(item=>!ids.has(item.sessionId)));
      setJobs(old=>old.filter(item=>!item.sessionId||!ids.has(item.sessionId)));
      if(detail.reason==='deleted'){
        setLibraryRevision(revision=>revision+1);
        for(const id of ids)drafts.current?.delete(id);
        setPendingSend(old=>old&&ids.has(old.key)?null:old);
        setOfflineQueue(old=>old.some(item=>ids.has(item.key))?old.filter(item=>!ids.has(item.key)):old);
        if(parentChatId&&ids.has(parentChatId)){
          navigation.current++;paging.current=null;pendingPosition.current=null;scrollAnchor.current=null;
          setSelected(null);setHistory([]);setJob(null);setHasMore(null);setLoading(false);setLoadingOlder(false);
          restoreDraft(`new:${cwd}`);setHistoryError('');setError('');setTakeover(false);setChatViewOpen(false);
          setReviewOpen(false);setOutputsOpen(false);setAgentPanel(null);setReadingMode(false);
          if(activeSurface.current.provider===provider){
            setBoardChat(null);setBoardMissing(false);setBranchTarget(null);
            if(!embedded&&activeSurface.current.tab==='chats')setMobileChat(false);
          }
        }
      }
    });
  },[hostScope,provider,parentChatId,cwd,Boolean(embedded)]);
  useEffect(()=>{
    const onRemoved=(event:Event)=>{
      const detail=(event as CustomEvent<RemovedTranscripts>).detail;
      if(detail.hostScope===hostScope)removalHandlers.current.get(detail.provider)?.(detail);
    };
    window.addEventListener('pocket-chat-transcripts-removed',onRemoved);
    return()=>window.removeEventListener('pocket-chat-transcripts-removed',onRemoved);
  },[hostScope]);
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
  useEffect(()=>{if(embedded?.taskDrawer||!connection?.deviceId)return;const beat=()=>request(connection,'/devices/heartbeat',{}).then(()=>setLastContact(Date.now())).catch(()=>{});const stopBeat=startVisiblePoll(beat,15000,true,document,hostGate(connection.url));const revoked=(event:Event)=>{if((event as CustomEvent).detail===connection.deviceId)void disconnect('revoked');};window.addEventListener('pocket-device-revoked',revoked);return()=>{stopBeat();window.removeEventListener('pocket-device-revoked',revoked);};},[connection]);
  // Another known route (Wi-Fi, Tailscale, tunnel) can replace an unreachable one without a new QR.
  async function reachableRoute(c:Connection){for(const url of c.routes||[]){if(url===c.url)continue;try{const next={...c,url:normalizeUrl(url)},{stale}=await freshHealth(next);if(!stale)return next;}catch{/* Try the next route. */}}return null;}
  function cancelConnect(){++connectEpoch.current;setConnecting(false);setRestoring(false);}
  async function connect(c: Connection,restored=false) {
    const epoch=++connectEpoch.current;
    // A host that already answered this window stays usable while it is checked again.
    const known=Boolean(embedded&&desktopHealth.has(embedded.connection));
    setConnecting(true);setConnectionError('');setConnectionProblem(undefined);if(!known)setConnected(false);
    if(!restored&&(c.pairing||c.url!==saved?.url||c.token!==saved?.token))setPaired(false);
    try {
      if(c.workspaceOnly||c.workspaceInvite)throw Error(t('Для личных чатов ПК используйте QR подключения. Приглашение WorkSpace открывает только общие доски.'));
      const original=c;c=await pairDevice(c,packageVersion);if(epoch!==connectEpoch.current)return;
      const scope=await chatCacheScope(c),access=workspaceConnection||original.workspaceAccess,accesses=workspaceAccesses.length?workspaceAccesses:savedWorkspaces(original);
      const stored={...c,...(access?{workspaceAccess:access}:{}),workspaceAccesses:accesses};
      if(!embedded)await saveConnection(stored);
      if(epoch!==connectEpoch.current)return;
      if(scope!==cacheScope){rememberPosition();rememberDraft();setProjects(null);setProviders(knownProviders.get(c.url)||defaultProviders());setBoardChat(null);setBoardLaunch(null);setActivityTarget(null);}
      if(embedded)desktopScope.set(embedded.connection,scope);
      setCacheScope(scope);setSaved(c);setConnection(c);setDemo(false);
      if(!embedded){const host=c;setPrimaryHost(host.url,()=>request(host,'/health'));}
      const {health:h,stale}=await freshHealth(c);if(epoch!==connectEpoch.current)return;if(h.protocol!==1){if(embedded){desktopHealth.delete(embedded.connection);setHealth(null);}throw Object.assign(Error(t('Обновите приложение и сервер до одной версии')),{problem:'incompatible'});}setHealth(h);
      if(embedded&&!stale)desktopHealth.set(embedded.connection,h);
      if(stale){setPaired(true);const alternate=await reachableRoute(c);if(alternate&&epoch===connectEpoch.current){void connect(alternate,true);return;}if(epoch===connectEpoch.current){setConnectionProblem('unreachable');setOffline(true);}return;}
      setConnected(true);setPaired(true);setLastContact(Date.now());setRevoked(null);setRevokedFrom(null);
      // The PC name, identity and other routes are kept so the next start can name the PC and fall back to another route.
      if(!embedded&&(h.name!==c.name||h.hostId!==c.hostId||h.routes&&JSON.stringify(h.routes)!==JSON.stringify(c.routes))){const next={...stored,name:h.name,...(h.hostId?{hostId:h.hostId}:{}),...(h.routes?{routes:h.routes}:{})};await saveConnection(next);if(epoch===connectEpoch.current)setSaved(next);}
    }catch(e){if(epoch===connectEpoch.current){const problem=classifyProblem(e);if(problem==='unreachable'&&!c.pairing){const alternate=await reachableRoute(c);if(alternate&&epoch===connectEpoch.current){void connect(alternate,true);return;}}if(epoch===connectEpoch.current){setConnected(false);setConnectionError((e as Error).message);setConnectionProblem(problem);if(problem==='unreachable')setOffline(true);}}}finally{if(epoch===connectEpoch.current){setConnecting(false);if(restored)setRestoring(false);}}
  }
  // The PC answered again: one pass re-reads /health and clears every connection-class error; gated polls refresh on the same event.
  const recover=useRef(()=>{});recover.current=()=>{
    const c=connection;if(!c||embedded||connecting)return;const epoch=connectEpoch.current;
    void freshHealth(c).then(({health:h,stale})=>{if(stale||epoch!==connectEpoch.current||h.protocol!==1)return;setHealth(h);setConnected(true);setPaired(true);setOffline(false);setConnectionError('');setConnectionProblem(undefined);setNetworkError('');setHistoryError('');setLastContact(Date.now());}).catch(()=>{});
  };
  useEffect(()=>{const handle=()=>recover.current();window.addEventListener('pocket-recovered',handle);return()=>window.removeEventListener('pocket-recovered',handle);},[]);
  useEffect(()=>()=>{if(!embedded)setPrimaryHost('',null);},[]);
  // An embedded chat opened while the PC host restarts or updates keeps retrying instead of waiting for a manual Retry.
  useEffect(()=>{if(!embedded||connected||connecting||!connectionError)return;const timer=setTimeout(()=>void connect(embedded.connection),3000);return()=>clearTimeout(timer);},[Boolean(embedded),connected,connecting,connectionError]);
  useEffect(()=>{if(embedded){void connect(embedded.connection);return;}loadConnection().then(c=>{if(!c){setRestoring(false);return;}setSaved(c);if(c.workspaceOnly){setRestoring(false);setTab('settings');setSettingsPage('connection');}else{setPaired(true);void connect(c,true);}}).catch(()=>{setRestoring(false);setConnectionError(t('Не удалось восстановить подключение. Отсканируйте QR-код ПК снова.'));});},[]);
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
  useEffect(()=>{if(!boardChat?.conversation||!job)return;try{// The host learns the board's current chat as soon as its session exists, so other devices resume this one.
      if(attachBoardConversation(boardChat.conversation,provider,job.sessionId,job.id)&&boardChat.context&&connection&&job.sessionId&&!job.sessionId.startsWith('pending-'))void boardConversationHost(connection).write(boardChat.root,boardChat.boardId,{provider,sessionId:job.sessionId},boardChatLane(provider,account));}catch{setError(t('Не удалось сохранить привязку чата доски.'));}},[boardChat?.conversation?.key,boardChat?.conversation?.generation,provider,job?.id,job?.sessionId]);
  useEffect(()=>{if(embedded&&!embedded.session&&job?.sessionId&&(!boardChat?.conversation||currentBoardConversation(boardChat.conversation)))embedded.onCreated?.({sessionId:job.sessionId,cwd:job.cwd,summary:job.messages.find(m=>m.role==='user')?.blocks.find(b=>b.type==='text')?.text||'New',lastModified:job.startedAt,...(job.account?{account:job.account}:{})},job);},[job?.sessionId]);
  const embeddedTarget=embedded?.session?.sessionId||'new:'+embedded?.cwd;
  const embeddedOpened=useRef<string|null>(null);
  const [readyChatTarget,setReadyChatTarget]=useState<string>();
  useEffect(()=>{if(!embedded||!health||!connection||busy||uploading||embeddedOpened.current===embeddedTarget)return;embeddedOpened.current=embeddedTarget;
    // The chat this view has just created is already on screen with its running turn: reopening it would clear and reload it.
    if(embedded.session&&job?.sessionId===embedded.session.sessionId&&!selected){setSelected(embedded.session);return;}
   setBoardChat(embedded.boardChat||null);projectChosen.current=true;setCwd(embedded.cwd);
    if(embedded.session){void openSession(embedded.session,embedded.jobId?{id:embedded.jobId,sessionId:embedded.session.sessionId}:undefined,embedded.boardChat).then(()=>{if(embeddedOpened.current===embeddedTarget&&embedded.boardChat?.followUp)appendDraft(embedded.boardChat.prompt);});}
    else {
      newChat(embedded.cwd,embedded.boardChat);
      if(embedded.boardChat)setDraft(embedded.boardChat.context?t('Discuss this board with me.'):embedded.boardChat.prompt);
      else if(embedded.draft)setDraft(embedded.draft);
    }
    embeddedDraftReady.current=true;setReadyChatTarget(embeddedTarget);
  },[health,connection,embeddedTarget,busy,uploading]);
  // The desktop keeps this chat mounted when the board opens the same task chat again: a later follow-up still reaches the draft.
  const lastBoardChat=useRef(embedded?.boardChat);
  useEffect(()=>{const next=embedded?.boardChat;if(!next||next===lastBoardChat.current)return;lastBoardChat.current=next;if(embeddedOpened.current&&next.followUp)appendDraft(next.prompt);},[embedded?.boardChat]);
  useEffect(() => {
    setProvidersLoaded(false);
    if (!connection || demo) return;
    let cancelled = false,recheck:ReturnType<typeof setTimeout>|undefined;
    async function refreshProviders() {
      try {
        const list = await request<ProviderInfo[]>(connection!, '/providers');
        if (!cancelled && Array.isArray(list)) {
          const known=list.filter(item => item.id === 'claude' || item.id === 'codex'||item.id==='copilot');
          // A provider whose check has not finished yet is asked again shortly; it never replaces a state the PC already confirmed.
          const checking=known.some(item=>(item as {access?:string}).access==='checking');
          const previous=knownProviders.get(connection!.url);
          const merged=checking&&previous?known.map(item=>(item as {access?:string}).access==='checking'?previous.find(old=>old.id===item.id)||item:item):known;
          knownProviders.set(connection!.url,merged);
          setProviders(old=>shareSnapshot(old,merged));setProvidersLoaded(true);
          if(checking){clearTimeout(recheck);recheck=setTimeout(()=>void refreshProviders(),3000);}
        }
      } catch { /* Older bridge versions support the existing Claude workspace. */ }
    }
    const stop=startVisiblePoll(refreshProviders,30000,true,document,hostGate(connection.url));window.addEventListener('pocket-code-providers',refreshProviders);
    return () => {cancelled=true;clearTimeout(recheck);stop();window.removeEventListener('pocket-code-providers',refreshProviders);};
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
    const stop=startVisiblePoll(refreshProjects,15000,true,document,hostGate(connection.url));
    return () => { cancelled = true;stop(); };
  }, [connection, health, demo]);
  useEffect(()=>{if(provider!=='claude' && model && providerInfo?.models?.length && !providerInfo.models.some(item=>item.id===model))setModel('');},[provider,providerInfo?.models,model]);
  useEffect(()=>{
    if(!cacheScope||demo)return;
    const cached=readChatCache<Session[]>(cacheScope,provider,'sessions');
    if(Array.isArray(cached)){setSessions(cached);setSessionsLoaded(true);}
  },[cacheScope,provider,demo]);
  useLayoutEffect(()=>{
    if(historyScope&&!demo&&parentChatId&&!loading&&!fromStart&&!historyError&&!error)
      rememberTranscript(historyScope,provider,parentChatId,outputMessages,historyWindow.current,hasMore,job?.id);
  },[historyScope,provider,demo,parentChatId,outputMessages,loading,fromStart,historyError,error,hasMore,job?.id]);
  useEffect(()=>{
    if(!historyScope||demo||!selected||loading||fromStart||historyError||error)return;
    const timer=setTimeout(()=>writeChatCache(historyScope,provider,'chat:'+selected.sessionId,outputMessages.slice(-200)),400);
    return()=>clearTimeout(timer);
  },[historyScope,provider,demo,selected?.sessionId,outputMessages,loading,fromStart,historyError,error]);
  useEffect(()=>{
    if(!historyScope||demo||!selected||loading||historyError||error)return;
    const timer=setTimeout(()=>void writeHistoryView(historyScope,provider,selected.sessionId,{messages:history,window:historyWindow.current,fromStart,hasMore}),800);
    return()=>clearTimeout(timer);
  },[historyScope,provider,demo,selected?.sessionId,history,loading,fromStart,hasMore,historyError,error]);
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
          setSessions(old=>shareSnapshot(old,scopedSessions));if(scopedJobs)setJobs(old=>shareSnapshot(old,scopedJobs));setSelected(old=>old?shareSnapshot(old,scopedSessions.find(item=>item.sessionId===old.sessionId&&(item.account||'')===(old.account||''))||old):null);setNetworkError('');setSessionsLoaded(true);
        }
      } catch (e) {if (!cancelled) setNetworkError(connectivityError(e)?'':(e as Error).message);}
    }
    const stop=startVisiblePoll(refresh,5000,true,document,hostGate(connection.url));return () => {cancelled = true;stop();};
  }, [connection, demo, provider, Boolean(providerInfo),cacheScope,libraryRevision]);
  useEffect(() => {
    if (!connection || !job || demo || job.status !== 'running') return;
    let cancelled = false,revision = -1,transcript = -1;
    async function poll() {
      let finished = false;
      try {
        // `messages` names the transcript this screen holds, so a streaming answer sends only its new text.
        const updated = await request<JobView | null>(connection!, `/jobs/${job!.id}?revision=${revision}&messages=${transcript}`);
        if (!cancelled) {setNetworkError('');jobContact.current={at:Date.now(),failures:0};setRunLost(null);if (updated) {revision = updated.revision;transcript = updated.messagesRevision ?? -1;setJob(old=>updated.messagesUnchanged&&old?.id===updated.id?shareSnapshot(old,{...updated,messages:old.messages,messagesUnchanged:undefined}):shareSnapshot(old,updated));finished = updated.status !== 'running';}}
      } catch (e) {if (!cancelled) {setNetworkError(connectivityError(e)?'':(e as Error).message);
        // After two missed polls the run is shown as "status unknown" instead of a live "writing" state.
        if(++jobContact.current.failures>=2)setRunLost(jobContact.current.at);}}
      return !finished;
    }
    jobContact.current={at:Date.now(),failures:0};setRunLost(null);
    const stop=startVisiblePoll(poll,900,true,document,hostGate(connection.url));return () => {cancelled = true;stop();};
  }, [connection, job?.id, job?.status, demo, provider]);
  useEffect(() => {
    // A stopped or failed turn never hands over to history (that waits for "done"), so its chat keeps syncing:
    // replies written from the PC or another device still appear. Messages are merged by ID, without duplicates.
    // A finished turn with no answer (a slash command) has nothing to hand over either.
    const settled = job?.status === 'stopped' || job?.status === 'error' || job?.status === 'done' && !job.messages.some(message => message.role === 'assistant'), target = settled && job?.sessionId || selected?.sessionId;
    if (!connection || !target || target.startsWith('pending-') || job && job.errorCode !== 'codex_thread_busy' && !settled || demo || loading || loadingOlder || busy || tab !== 'chats') return;
    let cancelled = false;
    const epoch = navigation.current;
    async function sync() {
      // A bounded tail response can omit pages already loaded for reading. Keep
      // that snapshot until the reader returns to the latest end.
      if(historyExpanded.current&&(fromStart||!nearBottom.current))return;
      try {
        const window=historyWindow.current;
        const data = await chatHistoryRequest(connection!, `/sessions/${encodeURIComponent(target!)}/messages?provider=${provider}&window=${window}${fromStart ? '&from=start' : ''}`,historyScope);
        if(data.stale)return;
        if (!cancelled && epoch === navigation.current && !sending.current && !paging.current && window===historyWindow.current && !(historyExpanded.current&&(fromStart||!nearBottom.current))) {setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore((fromStart ? data.next : data.previous)??null);setHistoryError('');}
      } catch (e) {if (!cancelled&&epoch===navigation.current){clearDeniedHistory(e,target!);setHistoryError((e as Error).message);}}
    }
    const stop=startVisiblePoll(sync,3000,false,document,hostGate(connection.url));
    return () => {cancelled = true;stop();};
  }, [connection, historyScope, selected?.sessionId, job?.id, job?.errorCode, job?.status, job?.sessionId, demo, loading, loadingOlder, busy, tab, fromStart, provider]);
  useEffect(() => {
    // Keep the live answer until the host has flushed it to session history.
    // Only then can normal desktop history polling take over without duplicates.
    if (!connection || demo || job?.status !== 'done' || !job.sessionId || busy || loading || loadingOlder || fromStart || tab !== 'chats') return;
    const completed = job, lastAnswer = [...completed.messages].reverse().find(message => message.role === 'assistant');
    if (!lastAnswer) return;
    const epoch = navigation.current;
    let cancelled = false;
    async function syncCompleted() {
      if(historyExpanded.current&&(fromStart||!nearBottom.current))return;
      try {
        const window=historyWindow.current;
        const data = await chatHistoryRequest(connection!, `/sessions/${encodeURIComponent(completed.sessionId!)}/messages?provider=${provider}&window=${window}`,historyScope);
        if(data.stale)return;
        if (cancelled || epoch !== navigation.current || sending.current || paging.current || window!==historyWindow.current || historyExpanded.current&&(fromStart||!nearBottom.current)) return;
        if (data.messages.some(message => message.id === lastAnswer!.id)) {
          setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore(data.previous??null);setHistoryError('');setJob(null);
          setSelected(old => old?.sessionId === completed.sessionId ? old : sessionsNow.current.find(session => session.sessionId === completed.sessionId&&(session.account||'')===(completed.account||'')) || {sessionId:completed.sessionId!,provider,cwd:completed.cwd,summary:t("Текущая задача"),lastModified:completed.startedAt,account:completed.account});
          return false;
        }
      } catch (error) {if (!cancelled && epoch === navigation.current){clearDeniedHistory(error,completed.sessionId!,true);setHistoryError((error as Error).message);}}
    }
    const stop=startVisiblePoll(syncCompleted,3000,true,document,hostGate(connection.url));return () => {cancelled=true;stop();};
  },[connection,provider,historyScope,job?.id,job?.status,demo,busy,loading,loadingOlder,fromStart,tab]);
  // A hidden chat (display:none) loses its scroll offset. Before the first paint after it is shown again,
  // land on the latest message when the chat was following it, otherwise where the person was reading.
  const chatShown=tab==='chats'&&(embedded?embedded.visible!==false:mobileChat);
  useLayoutEffect(()=>{const el=scroll.current;if(!chatShown||!el||loading||!el.getClientRects().length)return;el.scrollTop=nearBottom.current&&!readingMode?el.scrollHeight:lastScrollTop.current;lastScrollTop.current=el.scrollTop;setShowScrollActions(fromStart||el.scrollHeight-el.scrollTop-el.clientHeight>=80);},[provider,chatShown]);
  useLayoutEffect(()=>{
    const position=pendingPosition.current,el=scroll.current;
    if(!position||!el||loading&&!history.length&&!job?.messages.length&&!job?.partial||tab!=='chats')return;
    pendingPosition.current=null;
    const message=position.messageId?[...el.querySelectorAll<HTMLElement>('[data-message-id]')].find(node=>node.dataset.messageId===position.messageId):null;
    const textTop=message&&position.textAnchor?restoreTextAnchor(el,message,position.textAnchor):undefined;
    el.scrollTop=position.bottom?el.scrollHeight:textTop!==undefined?textTop:message&&position.offset!==undefined?el.scrollTop+message.getBoundingClientRect().top-el.getBoundingClientRect().top-position.offset:position.top;
    lastScrollTop.current=el.scrollTop;nearBottom.current=position.bottom;setShowScrollActions(!position.bottom||fromStart);
    if(position.focusFrom&&(document.activeElement===position.focusFrom||document.activeElement===document.body))focusLatestMessage(el);
  },[loading,history,job,provider,tab]);
  useChatReturn(selected?positionKey(historyScope,provider,selected.sessionId):'',tab==='chats'&&(embedded?embedded.visible!==false:mobileChat),running,!loading&&!busy&&!paging.current,()=>{void jumpHistory(false);});
  function rememberPosition(){const el=scroll.current;if(!el||loading||!selected||error||historyError||!el.getClientRects().length)return;const top=el.getBoundingClientRect().top,message=[...el.querySelectorAll<HTMLElement>('[data-message-id]')].find(node=>node.getBoundingClientRect().bottom>top);savePosition(positionKey(historyScope,provider,selected.sessionId),{top:el.scrollTop,window:historyWindow.current,fromStart,bottom:nearBottom.current,messageId:message?.dataset.messageId,textAnchor:message?captureTextAnchor(el,message):undefined,offset:message?message.getBoundingClientRect().top-top:undefined});}
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
    if(!message||anchor.offset===undefined)return;
    // Markdown can finish its layout after the history commit.
    const adjust=()=>{el.scrollTop+=message.getBoundingClientRect().top-el.getBoundingClientRect().top-anchor.offset!;lastScrollTop.current=el.scrollTop;};
    const observer=new ResizeObserver(adjust),content=el.querySelector('.conversation-inner');
    if(content)observer.observe(content);
    const cancel=()=>{observer.disconnect();clearTimeout(timer);for(const event of ['wheel','touchstart','keydown','pointerdown'])el.removeEventListener(event,cancel);};
    const timer=setTimeout(cancel,500);
    for(const event of ['wheel','touchstart','keydown','pointerdown'])el.addEventListener(event,cancel,{passive:true});
    return cancel;
  },[history,provider,readingMode]);
  useLayoutEffect(() => {if (!loading && nearBottom.current && !readingMode) bottom.current?.scrollIntoView({ behavior: 'auto' });}, [loading, selected?.sessionId, provider]);
  // The transcript follows new output through the assistant-ui viewport while the reader is at the latest message.
  const followLatest=(!loading||outputMessages.length>0||Boolean(job?.partial))&&!readingMode&&tab==='chats'&&(embedded?embedded.visible!==false:mobileChat);
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
      nearBottom.current=false;historyWindow.current=nextWindow;historyExpanded.current=true;
      setHistory(old=>shareMessages(old,uniqueMessages(provider==='codex'?(fromStart?[...old,...data.messages]:[...data.messages,...old]):data.messages).slice(fromStart?0:-5000,fromStart?5000:undefined)));
      setHasMore(fromStart?data.next:data.previous);setHistoryError('');
    } catch(e) {if(epoch===navigation.current){clearDeniedHistory(e,selected.sessionId);setHistoryError((e as Error).message);}}
    finally {if(paging.current===requestId){paging.current=null;setLoadingOlder(false);}}
  }
  async function loadHistory(s: Session, active: JobView | null, epoch: number, older = false, beginning = fromStart, warm=false) {
    if (older) historyWindow.current = Math.min(5000, historyWindow.current + 100);
    if(active?.errorCode==='codex_thread_busy')active=null;
    const scope=transcriptScope(cacheScope,connection,s.account??account);
    const data = await chatHistoryRequest(connection!,`/sessions/${encodeURIComponent(s.sessionId)}/messages?provider=${provider}&window=${historyWindow.current}${beginning ? '&from=start' : ''}${active ? `&end=${active.baseMessageCount}` : ''}`,scope,cached=>{if(warm||epoch!==navigation.current||historyExpanded.current&&(fromStart||!nearBottom.current))return;setHistory(old=>shareMessages(old,uniqueMessages(cached.messages)));setHasMore(beginning?cached.next??null:cached.previous??null);});
    if (epoch !== navigation.current || warm&&data.stale || historyExpanded.current&&(fromStart||!nearBottom.current)) return;
    if(warm&&!nearBottom.current)captureScrollAnchor(false);
    setHistory(old=>shareMessages(old,uniqueMessages(data.messages)));setHasMore((beginning ? data.next : data.previous)??null);setHistoryError('');
  }
  async function jumpHistory(beginning: boolean, focusFrom?: HTMLButtonElement) {
    if (loading || busy) return;
    pendingPosition.current=null;historyExpanded.current=false;
    const epoch = ++navigation.current;
    paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
    nearBottom.current = false;setLoading(true);
    try {
      if (selected && !demo) {historyWindow.current = 100;await loadHistory(selected, job, epoch, false, beginning);}
      if (epoch !== navigation.current) return;
      setFromStart(beginning);setShowScrollActions(beginning);
      // Restore in the existing layout effect, before paint. A delayed RAF could
      // override a user's next scroll and prevent loading the following page.
      pendingPosition.current={top:0,window:100,fromStart:beginning,bottom:!beginning,focusFrom};
    } catch (e) {if(connectivityError(e))setHistoryError((e as Error).message);else setError((e as Error).message);} finally
    {if (epoch === navigation.current) setLoading(false);}
  }
  async function launchBoardChat(target:BoardChat,replace=false){try{const next=await prepareBoardConversation(connection!,target,provider,replace,boardConversationHost(connection!),account);if(embedded){embedded.onNewBoardChat?.(next);}else setBoardLaunch(next);}catch{setError(t('Не удалось сохранить привязку чата доски.'));}}
  useEffect(()=>{if(!boardLaunch||!health||busy||uploading)return;const target=boardLaunch,resuming=Boolean(target.context&&target.conversation?.generation===boardChat?.conversation?.generation&&target.boardId===boardChat?.boardId);if(!connection||target.connectionUrl&&target.connectionUrl!==connection.url){setError(t('Подключите ПК этой доски через Connection, чтобы открыть её чат.'));setBoardLaunch(null);return;}const targetProvider=target.taskRun?.provider||target.note.chat?.provider;if(targetProvider&&targetProvider!==provider){setProvider(targetProvider);return;}setBoardLaunch(null);setBoardChat(target);if(target.note.chat){void openSession({sessionId:target.note.chat.sessionId,cwd:target.root,summary:target.note.title,lastModified:Date.now()},target.resumeJobId?{id:target.resumeJobId,sessionId:target.note.chat.sessionId}:undefined,target);if(target.followUp)appendDraft(target.prompt);}else{newChat(target.root,target);if(!resuming)setDraft(target.context?t('Discuss this board with me.'):target.prompt);}},[boardLaunch,provider,health,busy,uploading]);
  // A chat started from a board keeps that link in the host chat library, so every chat list marks it and can open the board.
  const boardLinkOf=(target:BoardChat):BoardLink=>({id:target.boardId,root:target.root,title:(target.context?.name||target.note.title||t('Доска')).slice(0,200),kind:target.context?'discussion':target.taskRun?'task':'note',...(target.context?{}:{noteId:target.note.id})});
  const [linkedBoards,setLinkedBoards]=useState<Record<string,BoardLink>>({});
  const linkedSessions=useRef(new Set<string>());
  // A session that has just started may not be listed by its provider yet; the link is retried instead of being lost.
  const [linkAttempt,setLinkAttempt]=useState(0),linkRetries=useRef(new Map<string,number>()),linkTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(linkTimer.current),[]);
  useEffect(()=>{const sessionId=job?.sessionId||selected?.sessionId;if(!boardChat||!connection||demo||!sessionId||sessionId.startsWith('pending-'))return;
    const link=boardLinkOf(boardChat),key=provider+':'+sessionId+':'+link.id;if(linkedSessions.current.has(key))return;linkedSessions.current.add(key);
    setLinkedBoards(old=>({...old,[sessionId]:link}));
    void request(connection,`/sessions/${encodeURIComponent(sessionId)}/manage`,{provider,action:'board',board:link}).catch(()=>{linkedSessions.current.delete(key);const tries=(linkRetries.current.get(key)||0)+1;linkRetries.current.set(key,tries);if(tries<=8){clearTimeout(linkTimer.current);linkTimer.current=setTimeout(()=>setLinkAttempt(value=>value+1),1500*tries);}});
  },[job?.sessionId,selected?.sessionId,boardChat,connection,provider,demo,linkAttempt]);
  // The PC window shows files a turn made or changed as tabs of one side panel beside the chat (after the Strata preview sidebar).
  const docked=Boolean(embedded?.onProvider&&!embedded.taskDrawer);
  const [sideExpanded,setSideExpanded]=useState(false),[previews,setPreviews]=useState<{id:string;root:string;path:string;change?:FileChange}[]>([]),[preview,setPreview]=useState(''),[previewRevision,setPreviewRevision]=useState(0);
  useEffect(()=>{setPreviews([]);setPreview('');setSideExpanded(false);},[parentChatId,provider]);
  const sideTab=preview&&previews.some(item=>item.id===preview)?preview:null;
  const sideTabs:SidePanelTab[]=previews.map(item=>({id:item.id,kind:'file' as const,label:item.path.split(/[\\/]/).pop()||item.path,title:item.path}));
  function closeSide(){setPreview('');setSideExpanded(false);}
  const openPreview=useCallback((root:string,path:string,change?:FileChange)=>{const id='file:'+path.toLowerCase();setPreviews(old=>old.some(item=>item.id===id)?old.map(item=>item.id===id&&change?{...item,change}:item):[...old,{id,root,path,change}].slice(-12));setPreview(id);},[]);
  function closePreview(id:string){const rest=previews.filter(item=>item.id!==id);setPreviews(rest);if(preview===id){setPreview(rest.at(-1)?.id||'');if(!rest.length)setSideExpanded(false);}}
  const activePreview=previews.find(item=>item.id===sideTab);
  // The header offers Rules and Changelog only for a folder that has them.
  const docsRoot=embedded?.onDocuments&&connection&&!demo?(selected?.cwd||cwd):'';
  const [folderDocs,setFolderDocs]=useState<{root:string;kinds:('rules'|'changelog')[]}>({root:'',kinds:[]});
  useEffect(()=>{if(!docsRoot||!connection)return;let live=true;
    request<{documents:{kind:'rules'|'changelog';builtIn?:boolean}[]}>(connection,'/project-docs?'+new URLSearchParams({cwd:docsRoot})).then(index=>{if(!live)return;const kinds=(['rules','changelog'] as const).filter(kind=>index?.documents?.some(item=>item.kind===kind&&!item.builtIn));setFolderDocs({root:docsRoot,kinds});}).catch(()=>{if(live)setFolderDocs({root:docsRoot,kinds:[]});});
    return()=>{live=false;};},[docsRoot,connection?.url,connection?.token]);
  const headerDocs=docsRoot&&folderDocs.root===docsRoot?folderDocs.kinds.map(kind=>({kind,open:()=>embedded!.onDocuments!(kind,docsRoot)})):[];
  const chatBoard=boardChat?boardLinkOf(boardChat):selected?(linkedBoards[selected.sessionId]||selected.board):undefined;
  async function openChatBoard(link:BoardLink){
    if(!connection)return;
    try{
      const board=await loadLinkedBoard(connection,link);
      const target:BoardNoticeTarget={board,connection,noteId:link.noteId||'',message:'',requestId:Date.now()};
      if(embedded?.onBoard)embedded.onBoard(target);else{setNoticeTarget(target);setLocalBoards(true);setTab('workspace');}
    }catch{setError(t('Доска этого чата недоступна.'));}
  }
  useEffect(()=>{if(!boardChat||boardChat.context||boardChat.taskRun||!job?.sessionId||!connection)return;const target=boardChat;setBoardChat(null);void (async()=>{try{const b=await request<any>(connection,'/boards/'+target.boardId);await request(connection,'/boards/'+b.id,{revision:b.revision,versions:b.versions,notes:b.notes.map((n:any)=>n.id===target.note.id?{...n,chat:{provider,sessionId:job.sessionId}}:n)});}catch(e){setError((e as Error).message);}})();},[job?.sessionId,boardChat,connection]);
  async function openSession(s: Session, activeJob?: Pick<JobView,'id'|'sessionId'>,context?:BoardChat) {
    if (busy || uploading) return;
    setReviewOpen(false);setReviewPaths(undefined);
    rememberPosition();rememberDraft();setBoardChat(context||null);setBoardMissing(false);releasePending(true);setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;
    historyExpanded.current=false;
    // A chat continues with the provider it was started with: the PC's Claude sign-in or its custom provider.
    // Chats opened from a running task, a notification, a board or a new turn arrive without the account: look it up, and keep the current provider when it is unknown.
    if(provider==='claude'&&!demo){const owner=jobs.find(j=>activeJob&&j.id===activeJob.id||j.sessionId===s.sessionId),listed=sessions.find(x=>x.sessionId===s.sessionId),owned=s.account??(owner?.account||listed?.account||(owner||listed?'':customAccount));s={...s,account:owned};if(owned!==customAccount)setCustomAccount(owned);}
    const epoch = ++navigation.current;setSelected(s);projectChosen.current=true;setCwd(s.cwd || health!.roots[0]);setMobileChat(true);setTab('chats');
    const savedPosition:ChatPosition={top:0,window:200,fromStart:false,bottom:true};pendingPosition.current=savedPosition;
    historyWindow.current = savedPosition?.window||200;setHistoryError('');setFromStart(savedPosition?.fromStart||false);setShowScrollActions(savedPosition?!savedPosition.bottom:false);lastScrollTop.current = savedPosition?.top||0;
    const scope=transcriptScope(cacheScope,connection,s.account??account);
    const warm=scope&&!demo?recentTranscript(scope,provider,s.sessionId):undefined;
    const active=activeJob||jobs.find(j=>j.sessionId===s.sessionId&&j.status==='running')||(warm?.jobId?{id:warm.jobId}:undefined);
    const legacy=legacyTranscriptScope(connection,provider,scope);
    const cached=warm?.messages??(scope&&!demo?(readChatCache<ChatMessage[]>(scope,provider,'chat:'+s.sessionId)??(legacy?readChatCache<ChatMessage[]>(legacy,provider,'chat:'+s.sessionId):null)):null);
    if(warm){historyWindow.current=Math.max(200,warm.window);historyExpanded.current=warm.window>200;}
    setHistory(Array.isArray(cached)?cached:[]);setJob(null);restoreDraft(activeJob?.sessionId||s.sessionId);setError('');setTakeover(false);setHasMore(warm?.hasMore??null);nearBottom.current = savedPosition?.bottom??true;
    if (demo) {setHistory(demoMessages);return;}
    setLoading(true);
    let full:JobView|null=null;
    try {
      const view=scope&&!warm?await readHistoryView(scope,provider,s.sessionId,legacy):undefined;
      if(epoch!==navigation.current)return;
      if(view&&view.fromStart===(savedPosition?.fromStart||false)&&Array.isArray(view.messages)){historyWindow.current=Math.max(historyWindow.current,view.window);historyExpanded.current=view.window>200||view.messages.length>200;setHistory(view.messages);setHasMore(view.hasMore);}
      if(active){try{full=await api<JobView>(`/jobs/${active.id}`);}catch(e){if(s.sessionId.startsWith('pending-')||(e as {status?:number}).status!==404)throw e;}}
      if (epoch !== navigation.current) return;
      if(full&&((full.provider||'claude')!==provider||provider==='claude'&&(full.account||'')!==(s.account||'')))throw Object.assign(new Error(t('Чат относится к другому рабочему пространству.')),{status:403});
      // Keep cached preceding turns while the base page refreshes. The live job
      // owns its message IDs, so remove only overlaps instead of blanking history.
      if(full){const liveIds=new Set(full.messages.map(message=>message.id));setHistory(old=>old.filter(message=>!liveIds.has(message.id)));}
      setJob(full);setTakeover(Boolean(full));
      const resolved=full?.sessionId?{...s,sessionId:full.sessionId,cwd:full.cwd}:s;
      if(resolved.sessionId!==s.sessionId){setSelected(resolved);setPendingSend(old=>old?.opening&&old.key===s.sessionId?{...old,key:resolved.sessionId}:old);}
      if (!resolved.sessionId.startsWith('pending-')) await loadHistory(resolved, full, epoch, false, savedPosition?.fromStart||false,Boolean(warm));
    } catch (e) {if (epoch === navigation.current) {clearDeniedHistory(e,s.sessionId,Boolean(full));if(context?.conversation&&(e as {status?:number}).status===404)setBoardMissing(true);if(connectivityError(e))setHistoryError((e as Error).message);else setError((e as Error).message);}} finally {if (epoch === navigation.current) setLoading(false);}
  }
  function newChat(project = cwd,context?:BoardChat) {
    if (busy || uploading) return;
    rememberPosition();
    rememberDraft();setBoardChat(context||null);setBoardMissing(false);releasePending(true);setReadingMode(false);paging.current=null;setLoadingOlder(false);scrollAnchor.current=null;navigation.current++;setSelected(null);setHistory([]);setJob(null);restoreDraft(`new:${project}`);setError('');setHasMore(null);
    historyExpanded.current=false;historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    pendingPosition.current=null;projectChosen.current=true;setCwd(project);setMobileChat(true);setTab('chats');setTakeover(true);setLoading(false);
  }
  function requestBranch(id:string,regenerate:boolean){
    if(running||busy||loading||selected?.readOnly||selected?.scheduled)return;
    const sourceId=job?.sessionId||selected?.sessionId;if(!sourceId)return;
    let index=outputMessages.findIndex(m=>m.id===id);
    if(regenerate)while(index>=0&&outputMessages[index].role!=='user')index--;
    if(index<0||outputMessages[index].role!=='user'){setError(language==='ru'?'Загрузите более ранние сообщения.':'Load earlier messages to find the original request.');return;}
    branchPrepared.current=null;setBranchTarget({message:outputMessages[index],history:outputMessages.slice(0,index),sourceId,regenerate});
  }
  async function submitBranch(text:string){
    const target=branchTarget;if(!target||running||busy||loading)return false;
    const epoch=navigation.current,files:Attachment[]=[];
    // Re-upload retained attachments before creating a branch; missing files fail visibly.
    for(const block of userAttachmentBlocks(target.message.blocks)){
      if(block.type==='text')continue;
      let name='',base64='';
      if(block.attachmentPath){const artifact=await api<{name:string;data?:string;text?:string}>(`/message-attachment?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(block.attachmentPath)}`);name=artifact.name;base64=artifact.data||await fileBase64(new File([artifact.text??''],name));}
      else if(block.source?.data||block.data){const mime=block.source?.media_type||block.mimeType||'application/octet-stream';name='attachment.'+(mime==='image/jpeg'?'jpg':mime.split('/')[1]||'bin');base64=block.source?.data||block.data!;}
      else throw Error(language==='ru'?'Вложение недоступно. Создайте новый чат и прикрепите файл повторно.':'Attachment unavailable. Start a new chat and reattach it.');
      files.push(await api<Attachment>('/uploads',{cwd,name,base64}));
    }
    if(epoch!==navigation.current)return false;
    if(branchPrepared.current?.target!==target){const result=await api<{sessionId:string|null}>(`/sessions/${encodeURIComponent(target.sourceId)}/branch`,{provider,messageId:target.message.id});branchPrepared.current={target,sessionId:result.sessionId};}
    if(epoch!==navigation.current)return false;
    return Boolean(await send({text,attachments:files,boardSelection:null,branch:{sessionId:branchPrepared.current.sessionId,history:target.history}}));
  }
  function launchOptions(){
    const timeout=approvalTimeout(composerPreferences);
    const common={provider,cwd,mode:'default',...(timeout?{approvalTimeoutMinutes:timeout}:{})};
    if(provider==='copilot')return {...common,model:model||'auto'};
    if(provider==='codex')return {...common,
      model:codexEffort.options.length?codexEffort.modelId||model:model,
      codexAccess:chatAccess as CodexAccess,reasoningEffort:codexEffort.value||codexEffort.defaultValue||undefined};
    return {...common,model:account?customModels.model:(model||claudeDefaultModel),
      mode:chatAccess==='plan'?'plan':'default',claudeAccess:chatAccess==='plan'?claudeAccess:chatAccess as ClaudeAccess,
      maxBudgetUsd:clampBudget(budget),...(account?{account}:{claudeEffort:claudeEffort.value||undefined})};
  }
  const pinnedRoot=embedded?.tasksPage?.initialId?embedded.tasksPage.initialRoot:taskChainId?linkedRoot:undefined;
  const taskCwd=tab==='tasks'?(pinnedRoot||taskProject||cwd||projectRoots[0]||''):cwd;
  const chainScope={cwd:taskCwd,provider,...(account?{account}:{})};
  const chainQuery=new URLSearchParams(chainScope).toString();
  const drawerDrafts=useRef(new Map<string,Map<string,ChatDraft>>());
  const chainControls:MarkdownChainControls|undefined=connection&&!connection.workspaceId&&!demo&&taskCwd?{
    cwd:taskCwd,canStart:canRun,
    list:()=>api('/task-chains?'+chainQuery),
    audit:id=>api('/task-chains/'+encodeURIComponent(id)+'?'+chainQuery+'&audit=1'),
    detail:id=>api('/task-chains/'+encodeURIComponent(id)+'?'+chainQuery),
    start:input=>api('/task-chains',{...launchOptions(),...chainScope,...input}),
    previewDeletion:id=>api('/task-chains/'+encodeURIComponent(id)+'?'+chainQuery+'&deletePreview=1&eraseOriginals=1'),
    remove:async(id,chats)=>{
      const result=await api<ChainDeletePreview & {ok:boolean}>('/task-chains/'+encodeURIComponent(id)+(chats?'/delete-chats':'/delete'),{...chainScope,...(chats?{chats,eraseOriginals:true}:{})});
      if(chats&&result?.eraseOriginals===true&&Array.isArray(result.chats)){
        for(const owner of new Set(result.chats.map(chat=>chat.provider))){
          const ids=result.chats.filter(chat=>chat.provider===owner).map(chat=>chat.sessionId);
          await forgetChatTranscripts(connection,owner,ids);
        }
      }
      return result;
    },
    stop:id=>api('/task-chains/'+encodeURIComponent(id)+'/stop',chainScope),
    renderChat:(step,close,actions)=>{
      if(!step.sessionId&&!step.jobId)return;
      const executor=step.executor??{provider,account};
      const target:Session={sessionId:step.sessionId||'pending-'+step.jobId,cwd:step.launchCwd||step.worktreeCwd||taskCwd,provider:executor.provider,summary:step.title,lastModified:Date.now(),account:executor.account||''};
      const live=step.sessionId&&jobs.find(run=>(run.provider||'claude')===executor.provider&&(run.account||'')===(executor.account||'')&&run.sessionId===step.sessionId&&run.status==='running');
      const active=live?live.id:(!step.sessionId||step.status==='running'||step.status==='waiting'?step.jobId:undefined);
      return <WorkspaceApp key={JSON.stringify([executor.provider,target.account,target.sessionId])}
        onDisconnect={close} embedded={{taskDrawer:actions,connection,provider:executor.provider,session:target,
          jobId:active,cwd:target.cwd!,activity,draftStore:embedded?.draftStore||drawerDrafts.current,onOpenTasks:close,onBack:close}}/>;
    }
  }:undefined;
  const newTaskChat=taskCwd!==cwd||!!selected?.readOnly||boardMissing;
  const taskDraft=newTaskChat?drafts.current!.get('new:'+taskCwd):{text:draft,attachments};
  const draftPrefix=taskDraft?.text?taskDraft.text+'\n\n':'';
  const taskFileInstruction=t('Выполни по порядку задачи из вложенного файла markdown-tasks.md.');
  const taskTextRoom=Math.max(0,100000-draftPrefix.length);
  const selectionForDraft=matchingBoardSelection(embedded?embedded.boardSelection:boardSelection,connection,cwd,boardChat?.boardId);
  const taskFileRoom=(taskDraft?.attachments.length||0)+(!newTaskChat&&selectionForDraft?.ids.length?1:0)<10&&taskTextRoom>=taskFileInstruction.length;
  function appendTaskPrompt(prompt:string){
    const draftPrefix=draft?draft+'\n\n':'';
    const fileRoom=attachments.length+(selectionForDraft?.ids.length?1:0)<10&&100000-draftPrefix.length>=taskFileInstruction.length;
    if(fileRoom&&draftPrefix.length+prompt.length>60000){
      upload([new File([prompt],'markdown-tasks.md',{type:'text/markdown'})]);
      setDraft(draftPrefix+taskFileInstruction);
    }else{
      setDraft(draftPrefix+prompt);
    }
    setTab('chats');setMobileChat(true);
    requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.prompt-composer textarea')?.focus({preventScroll:true}));
  }
  function prepareTaskDraft(prompt:string){
    if(!connection||busy||uploading)return;
    if(newTaskChat){
      rememberDraft();
      if(embedded?.onTaskDraft)embedded.onTaskDraft(taskCwd,prompt);
      else{newChat(taskCwd);setLocalTaskDraft({root:taskCwd,prompt});}
    }else{
      appendTaskPrompt(prompt);embedded?.onTaskDraft?.(cwd);
    }
  }
  const pendingTaskDraft=embedded?.taskDraft||localTaskDraft;
  useEffect(()=>{
    if(!pendingTaskDraft||!connection||!cwd||cwd!==pendingTaskDraft.root||selected||job||busy||uploading)return;
    if(embedded&&readyChatTarget!==embeddedTarget)return;
    appendTaskPrompt(pendingTaskDraft.prompt);
    if(embedded)embedded.onTaskDraftUsed?.();else setLocalTaskDraft(undefined);
  },[pendingTaskDraft,connection,cwd,selected,job,busy,uploading,embeddedTarget,readyChatTarget]);
  /** Sends the draft, or a waiting message exactly as it was written. Typing during the request is kept. */
  /** restore: a queued message that could not be delivered returns to the draft instead of being lost. */
  async function send(payload?: {text:string;attachments:Attachment[];boardSelection?:BoardSelection|null;branch?:{sessionId:string|null;history:ChatMessage[]};restore?:boolean}) {
    if(boardMissing)return;
    const text=payload?payload.text:draft,files=[...(payload?payload.attachments:attachments)],ids=files.map(item=>item.id);
    const selection=matchingBoardSelection(payload?payload.boardSelection:embedded?embedded.boardSelection:boardSelection,connection,cwd,payload?payload.boardSelection?.boardId:boardChat?.boardId);
    async function appendSelection(){
      if(!selection)return;if(ids.length>=10)throw Error(t('Выделению доски нужно одно свободное место для вложения.'));
      const stamp=JSON.stringify([connection?.url,connection?.token,cwd,job?.id,selected?.sessionId,selection.content]);
      if(selectionContextFile.current?.key!==stamp){const file=new File([selection.content],'Board selection.txt',{type:'text/plain'});const attachment=await api<Attachment>('/uploads',{cwd,name:file.name,base64:await fileBase64(file)});selectionContextFile.current={key:stamp,attachment:{...attachment,file}};}
      const attachment=selectionContextFile.current!.attachment;files.push(attachment);ids.push(attachment.id);
    }
    const key=currentDraftKey();
    const consume=()=>{if(payload)return;setDraft(current=>current===text?'':current.startsWith(text)?current.slice(text.length).trimStart():current);setAttachments(old=>old.filter(item=>!ids.includes(item.id)));drafts.current!.delete(key);};
    // Without the PC a follow-up to a chat this phone already continues waits in "Waiting to send"; nothing else asks for a takeover first.
    if (!payload && unreachable && canQueue && !sending.current && !uploading && (text.trim() || files.length) && files.every(attachmentReady)) {setOfflineQueue(old=>[...old,{id:crypto.randomUUID(),at:Date.now(),jobId:job?.id||'',key,text,attachments:files,boardSelection:selection}]);consume();return;}
    // A chat that is still opening (its history is loading, the PC's first answers are on their way) takes the message at once:
    // it waits beside the composer and leaves by itself when the chat is ready.
    if (!payload && (loading || warming) && !pendingSend && !sending.current && !uploading && !demo && !selected?.readOnly && !selected?.scheduled && (text.trim() || files.length) && files.every(attachmentReady)) {setPendingSend({jobId:job?.id||'',key,text,attachments:files,boardSelection:selection,opening:true});consume();setError('');return;}
    if (sending.current || loading || uploading || demo || !canRun || selected?.readOnly || selected?.scheduled || !text.trim() && !files.length || !files.every(attachmentReady)) return;
    const submittedFiles=[...files], store=drafts.current!;
    let accepted=false;
    const visible=!payload||Boolean(payload.restore);
    if(visible){
      consume();
      nearBottom.current=true;
      setOutgoing({key,text,files:submittedFiles});
      requestAnimationFrame(()=>bottom.current?.scrollIntoView({block:'end'}));
    }
    function finishSubmission(){
      if(!visible)return;
      setOutgoing(null);
      if(accepted)return;
      const restoreText=(current:string)=>[text,current].filter(Boolean).join('\n\n');
      const restoreFiles=(current:Attachment[])=>[...submittedFiles,...current.filter(item=>!submittedFiles.some(sent=>sent.id===item.id))];
      if(draftLocation.current===key){
        setDraft(restoreText);
        setAttachments(restoreFiles);
      }else{
        const stored=store.get(key);
        store.set(key,{text:restoreText(stored?.text||''),attachments:restoreFiles(stored?.attachments||[])});
      }
    }
    if(running&&job){
      sending.current=true;setBusy(true);setError('');
      const epoch=navigation.current;
      try{
        await appendSelection();if(epoch!==navigation.current)return;
        const data={text,attachments:ids},signature=JSON.stringify({jobId:job.id,...data});
        const id=retry.current?.signature===signature?retry.current.id:crypto.randomUUID();retry.current={signature,id};
        const next=await api<JobView>(`/jobs/${job.id}/messages`,{...data,id});
        accepted=true;
        if(epoch!==navigation.current)return;
        setJob(next);sentFollowups.current!.set(id,files);retry.current=null;nearBottom.current=true;
      }catch(error){
        if(provider==='claude'&&epoch===navigation.current&&(error as {status?:number}).status===409){
          try{
            const latest=await api<JobView>(`/jobs/${job.id}`);
            if(epoch===navigation.current){
              setJob(latest);
              // The SDK can close input before the final status is observable. This exact message
              // waits beside the composer and is sent after this job ends; the field is free at once.
              setPendingSend({jobId:job.id,key,text,attachments:files});accepted=true;retry.current=null;
              return;
            }
          }catch{/* Preserve the original rejection when refreshing fails. */}
        }
        if(epoch===navigation.current)setError(connectivityError(error)?t('Не отправлено: нет связи с ПК. Сообщение осталось в поле ввода.'):(error as Error).message);
      }
      finally{finishSubmission();sending.current=false;setBusy(false);}
      return;
    }
    const sessionId = payload?.branch ? payload.branch.sessionId||undefined : job?.sessionId || selected?.sessionId;
    sending.current = true;setBusy(true);setError('');
    const epoch = ++navigation.current;
    // The chat's access chip overrides the device default from Settings; Plan is a Claude mode of its own.
    try{await appendSelection();}catch(e){setError((e as Error).message);finishSubmission();sending.current=false;setBusy(false);return;}
    if(epoch!==navigation.current){finishSubmission();sending.current=false;setBusy(false);return;}
    if(boardChat?.context&&!sessionId&&!payload?.branch){
      try{
        if(ids.length>=10)throw new Error('Board context needs one attachment slot.');
        if(!boardContextFile.current){const file=new File([boardChat.prompt],'Board context.txt',{type:'text/plain'});boardContextFile.current=await api<Attachment>('/uploads',{cwd,name:file.name,base64:await fileBase64(file)});}
        ids.push(boardContextFile.current.id);
      }catch(e){setError((e as Error).message);finishSubmission();sending.current=false;setBusy(false);return;}
      if(epoch!==navigation.current){finishSubmission();sending.current=false;setBusy(false);return;}
    }
    const data = {...launchOptions(),sessionId,...(taskRun&&!payload?.branch?{taskRunId:taskRun.id}:{}),text,attachments:ids,takeoverConfirmed:true};
    const signature = JSON.stringify(data);
    const id = retry.current?.signature === signature ? retry.current.id : crypto.randomUUID();retry.current = { signature, id };
    try {
      const next = await api<JobView>('/jobs', { ...data, id });
      accepted=true;
      if (epoch !== navigation.current) return;
      // Freeze the displayed history before the next turn; the server saves full history independently.
      if(payload?.branch){setHistory(payload.branch.history);setSelected(sessionId?{sessionId,cwd,summary:text.slice(0,200),lastModified:Date.now(),...(account?{account}:{})}:null);setHasMore(null);setBoardChat(null);rememberDraft();if(embedded&&next.sessionId)embedded.onCreated?.({sessionId:next.sessionId,cwd,summary:text.slice(0,200),lastModified:Date.now(),...(next.account?{account:next.account}:{})},next);}
      else if (job && job.errorCode!=='codex_thread_busy') setHistory((old) => [...old, ...job.messages]);
      if(provider==='codex')submissions.current!.set(next.id,{key,text,attachments:files});
      setRejectedDrafts(old=>{const next={...old};delete next[key];return next;});
      setJob(next);setTakeover(true);retry.current = null;nearBottom.current = true;
      if(sessionId)for(const item of activity.items)if(item.status==='error'&&item.provider===provider&&item.sessionId===sessionId)activity.markViewed(item);
      return true;
    } catch (e) {if (epoch === navigation.current) setError(connectivityError(e)?t('Не отправлено: нет связи с ПК. Сообщение осталось в поле ввода.'):(e as Error).message);} finally {finishSubmission();sending.current = false;setBusy(false);}
  }
  /** Updates one draft file wherever its draft is kept, so a finished upload is never lost. */
  function patchAttachment(id:string,change:(item:Attachment)=>Attachment){
    setAttachments(old=>old.map(item=>item.id===id?change(item):item));
    for(const [key,value] of drafts.current!)if(value.attachments.some(item=>item.id===id))drafts.current!.set(key,{...value,attachments:value.attachments.map(item=>item.id===id?change(item):item)});
  }
  // Uploads run one after another; files added meanwhile (paste, drop, picker) wait in line with their own card.
  const uploadQueue=useRefForWorkspace<Promise<void>>(Promise.resolve());
  const boardImageLoads=useRefForWorkspace(new Map<string,()=>Promise<File>>());
  function enqueueUpload(item:Attachment,root:string,load?:()=>Promise<File>){
    uploadQueue.current=uploadQueue.current.then(async()=>{
      try{const file=load?await load():item.file!;const uploaded=await api<Attachment>('/uploads',{cwd:root,name:file.name,base64:await fileBase64(file)});boardImageLoads.current.delete(item.id);patchAttachment(item.id,()=>({...uploaded,file,...(item.pastedText?{pastedText:true}:{})}));}
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
  function retryUpload(id:string){const item=attachments.find(a=>a.id===id);if(!item||!item.file&&!boardImageLoads.current.has(id))return;const next:Attachment={...item,status:'uploading',error:undefined};patchAttachment(id,()=>next);enqueueUpload(next,cwd,boardImageLoads.current.get(id));}
  function uploadBoardImages(images:BoardImage[]){
    if(!connection||!images.length||!boardChat?.context||boardChat.root!==cwd||selected?.readOnly||boardMissing)return;
    const room=Math.max(0,10-attachments.length);if(images.length>room)setError(t('Можно прикрепить до 10 файлов'));
    const cards=images.slice(0,room).map(image=>({id:'local-'+crypto.randomUUID(),name:image.caption||basename(image.path),size:0,status:'uploading' as const,image}));
    setAttachments(old=>[...old,...cards.map(({image,...card})=>card)]);
    for(const {image,...card} of cards){const load=()=>boardImageFile(connection,cwd,image);boardImageLoads.current.set(card.id,load);enqueueUpload(card,cwd,load);}
  }
  useEffect(()=>{
    if(!connection||!boardChat?.context||boardChat.root!==cwd)return;
    const attach=()=>uploadBoardImages(takeQueuedBoardImages(connection,cwd,boardChat.boardId));attach();window.addEventListener('pocket-board-images',attach);return()=>window.removeEventListener('pocket-board-images',attach);
  },[connection?.url,connection?.token,boardChat?.boardId,cwd,attachments.length]);
  async function insertPastedText(id:string){
    const item=attachments.find(a=>a.id===id);if(!item?.file)return;
    try{const text=await item.file.text();setDraft(current=>current.trim()?current.replace(/\s+$/,'')+'\n\n'+text:text);setAttachments(old=>old.filter(a=>a.id!==id));}catch(e){setError((e as Error).message);}
  }
  function startDemo() {setDemo(true);setTab('chats');setMobileChat(true);setSessions(demoSessions);setHealth({ name: t("Рабочий компьютер"), roots: ['D:\\Projects\\my-app'], version: '0.10.0', protocol: 1 });setCwd('D:\\Projects\\my-app');setSelected(demoSessions[0]);setHistory(demoMessages);}
  // Leaving on the phone also removes it from the PC's device list; an unreachable or older PC is not a blocker.
  // A revoked key is not sent again: the PC already removed it, and a second 401 would restart this flow.
  async function disconnect(reason:'user'|'revoked'='user') {if(disconnecting.current)return;disconnecting.current=true;++connectEpoch.current;try {if(workspaceConnection&&!workspaceConnection.deviceId)await request(workspaceConnection,'/workspace-logout',{}).catch(()=>{});if(reason==='user'&&connection?.deviceId)await Promise.race([request(connection,'/devices/self/forget',{}).catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);await saveConnection(null);setPrimaryHost('',null);clearOffline();clearReviewViewed();try{localStorage.removeItem("pocket-own-profile");}catch{}clearChatCache();persistPosition.current=()=>{};clearPositions();setRevoked(reason==='revoked'?pcName.current:null);onDisconnect();}catch(e){disconnecting.current=false;setError((e as Error).message);}}
  if(workspacePasswordRequest)return <WorkspacePassword busy={busy} error={error} onCancel={()=>{setWorkspacePasswordRequest(null);setError('');}} onSubmit={password=>void joinWorkspace(workspacePasswordRequest,password)}/>;
  // Without a reachable PC the phone still checks, downloads and offers the latest release itself.
  if(!health&&embedded){const failure=error||connectionError;return <div className="desktop-empty" role="status">{failure||t("Loading...")}{failure&&!connecting&&<button className="secondary" onClick={()=>void connect(embedded.connection)}>{t("Retry")}</button>}</div>;}
  if (!health) return <><Connect initial={saved} onConnect={connect} onDemo={startDemo} busy={connecting} error={connectionError} /><Updates connection={null} expanded={false} /></>;
  pcName.current=saved?.name||(connected?health?.name||'':'');
  // Until a PC answers once, Board and Chats explain how to pair instead of showing empty lists.
  const onboardingVisible=!embedded&&!demo&&(!connection||!paired)&&(tab==='workspace'||tab==='chats');
  const connectionScreen=onboardingVisible||tab==='connection'||tab==='settings'&&settingsPage==='connection';
  const pcStatus:ConnectedPc|null=connection&&connected&&health&&!connection.workspaceOnly?{name:health.name,url:connection.url,version:health.version,online:!unreachable&&!networkError,lastContact,check:async()=>{const start=performance.now(),{stale}=await freshHealth(connection);if(stale)throw Error(t('ПК не ответил. Проверьте сеть и повторите.'));setOffline(false);setLastContact(Date.now());return Math.round(performance.now()-start);}}:null;
  const connectView=(onboarding=false)=><Connect initial={saved?.workspaceOnly?null:saved} onConnect={c=>void connect(c)} busy={connecting} error={connectionError} problem={connectionProblem} status={pcStatus} onDisconnect={()=>void disconnect()} onCancel={cancelConnect} onUpdates={()=>{setSettingsPage('updates');setTab('settings');setMobileChat(true);}} revoked={revokedFrom} onboarding={onboarding} restoring={restoring} target={saved?.name} onDemo={onboarding?startDemo:undefined}/>;
  const visible = sessions.filter((s) => (provider!=='claude'||(s.account||'')===account) && `${s.customTitle || ""} ${s.summary} ${s.cwd}`.toLowerCase().includes(search.toLowerCase()));
  // In Settings the provider is a segmented control above the AI account rows (one control, no second Back).
  const workspacePicker = (location:'sidebar'|'header'|'settings') => location==='settings'?<div className="workspace-picker workspace-picker-settings segmented" role="radiogroup" aria-label={t("Провайдер")}>{([['claude','Claude'],['codex','Codex'],['copilot','Copilot']] as const).map(([id,name])=><button key={id} type="button" role="radio" aria-checked={provider===id} disabled={demo} onClick={()=>setProvider(id)}>{name}</button>)}</div>:<ProviderPicker value={provider} onChange={setProvider} disabled={demo||busy||uploading} connection={connection||undefined}/>;
  const chatStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status));
  const chatStatusLabel=chatStatus?t('Чаты')+': '+runStatusLabel(chatStatus):'';
  const chatStatusDot=chatStatus?<RunStatusDot status={chatStatus} className={'chat-tab-status chat-tab-status-'+chatStatus}/>:null;
  // Status of chats other than the open one, shown on the conversation's Back arrow.
  const otherStatus=(['needs_input','error','running','done'] as const).find(status=>activity.items.some(item=>item.status===status&&!(item.provider===provider&&(item.id===job?.id||item.sessionId&&item.sessionId===(job?.sessionId||selected?.sessionId)))));
  const showSection=(next:typeof tab,page?:SettingsPage)=>{if(next==='tasks'){openTasks();return;}if(next==='files')setDocView('rules');else if(next==='changelog')setDocView('changelog');if(next==='chats'){returnToChats();return;}if(page)setSettingsPage(page);else if(next==='settings')setSettingsPage('index');setTab(next);setMobileChat(true);};
  // Before pairing, Chats shows the connection steps under a plain section header, not an empty conversation.
  const boardPane=Boolean(!embedded&&connection&&(boardVisited||tab==='workspace'));
  const boardSheet=Boolean(boardPane&&boardChat?.context&&tab==='chats'&&mobileChat);
  const contentTab=boardPane&&tab==='workspace'&&boardChat?.context?'chats':tab;
  const chatSurface=contentTab==='chats'&&!onboardingVisible;
  const inConversation=tab==='chats'&&chatSurface&&mobileChat;
  const tabBar=!embedded&&!(readingMode&&tab==='chats')&&!inConversation;
  // Chats that wait for the person come from every provider, so a waiting Codex chat is visible while Claude is selected.
  const waiting=activity.items.filter(item=>!item.taskChat&&(item.status==='needs_input'||item.status==='error'));
  const sessionStatus=(sessionId:string):RunStatus|undefined=>{const active=jobs.find(j=>j.sessionId===sessionId&&j.status==='running');if(active)return active.approvals?.length?'needs_input':'running';return activity.items.find(item=>item.provider===provider&&item.sessionId===sessionId)?.status;};
  const providerAttention=(id:WorkspaceProvider)=>waiting.filter(item=>item.provider===id).length;
  const providerChips=<ProviderPicker connection={connection||undefined} value={provider} onChange={setProvider} disabled={demo||busy||uploading} attention={providerAttention}/>;
  const grouped=visible.reduce<{group:'today'|'yesterday'|'earlier';items:Session[]}[]>((list,session)=>{const group=dayGroup(session.lastModified),last=list.at(-1);if(last?.group===group)last.items.push(session);else list.push({group,items:[session]});return list;},[]);
  const sessionRow=(s:Session)=>{const status=sessionStatus(s.sessionId);return <div className="chat-list-entry" key={s.sessionId}><button data-running={status==='running'||undefined} className={`session-row ${selected?.sessionId === s.sessionId ? 'selected' : ''}`} aria-current={selected?.sessionId===s.sessionId&&mobileChat?'true':undefined} disabled={busy || uploading} key={s.sessionId} onContextMenu={event=>{event.preventDefault();setChatAction({session:s,x:event.clientX,y:event.clientY,running:status==='running'||status==='needs_input'});}} onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();const r=event.currentTarget.getBoundingClientRect();setChatAction({session:s,x:r.left,y:r.bottom,running:status==='running'||status==='needs_input'});}}} onClick={() => void openSession(s)}>{s.board?<LayoutDashboard size={16} aria-label={t('Чат доски: {0}',s.board.title)}/>:<MessageSquare size={16} />}<div><strong>{s.customTitle || s.summary || t("Без названия")}</strong><small>{s.board?s.board.title+' · ':''}{s.source === 'desktop' ? 'Desktop · ' : ''}{basename(s.cwd || '')}{s.archived ? t(" · Архив") : ''}<span aria-hidden="true">·</span>{status?<ChatRunStatus status={status}/>:<time dateTime={new Date(s.lastModified).toISOString()} title={fullTime(s.lastModified)}>{relativeTime(s.lastModified)}</time>}</small></div></button><ChatListActions session={s} connection={demo?null:connection} provider={provider} jobId={jobs.find(run=>run.sessionId===s.sessionId)?.id} running={status==='running'||status==='needs_input'} disabled={!connection||demo} open={chatAction?.session.sessionId===s.sessionId} onOpen={setChatAction} onClose={()=>setChatAction(null)}/></div>;};
  return <SidePreview.Provider value={docked?openPreview:null}><AssistantChatProvider connection={connection} messages={outputMessages} partial={job?.partial||''} running={running&&!runUnknown} disabled={demo||!!selected?.readOnly||!!selected?.scheduled||boardMissing} onSend={async text=>{await send({text,attachments:[],boardSelection:matchingBoardSelection(embedded?embedded.boardSelection:boardSelection,connection,cwd,boardChat?.boardId)});}} onBranch={requestBranch} branchDisabled={running||busy||loading||!canRun||!!selected?.readOnly||boardMissing} onStop={stopRun} onDraft={appendDraft}><div className={`app ${boardPane?'has-board-stage':''} ${boardSheet?'board-chat-sheet-open':''} ${embedded?'embedded-chat':''} ${mobileChat||onboardingVisible ? 'show-chat' : ''} ${tabBar?'has-tabbar':''} ${tab==='chats'&&(mobileChat||embedded)?'chat-edge-to-edge':''} ${readingMode&&tab==='chats'?'reading-mode':''}`}>

    {readingMode&&tab==='chats' && <button className="icon-button reading-exit" aria-label={t("Выйти из режима чтения")} title={t("Выйти из режима чтения")} onClick={()=>toggleReadingMode(false)}><EyeOff size={20}/></button>}
    <aside className="sidebar">
      <div className="chat-list-actions"><h1>{t("Чаты")}</h1>
        {connection&&<button className="new-chat-button" disabled={busy||uploading} onClick={()=>newChat()}><Plus size={20}/>{t("Новый чат")}</button>}
      </div>
      <nav className="desktop-tabs"><button className={tab==='tasks'?'active':''} aria-current={tab==='tasks'?'page':undefined} onClick={()=>openTasks()}><ListChecks size={16}/>{t('Задачи')}</button><button className={tab === 'workspace' ? 'active' : ''} onClick={() => {setTab('workspace');setMobileChat(true);}}><ClipboardList size={16} />{t('Доска')}</button><button className={tab === 'chats' ? 'active' : ''} onClick={returnToChats} aria-label={t("Чаты")} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={16} />{chatStatusDot}</span>{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => {setDocView('rules');setTab('files');}}><BookOpen size={16} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} onClick={()=>{setDocView('changelog');setTab('changelog');setMobileChat(true);}}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setSettingsPage('index');setTab('settings');setMobileChat(true);}}><Settings size={16} />{t("Настройки")}</button></nav>
      {connection&&!demo&&<ConnectionStatus offline={offline}/>}
      {providerChips}
      <div className="search"><Search size={16} /><input aria-label={t("Найти чат")} placeholder={t("Найти чат")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="session-list">
        {waiting.length>0&&!search&&<section className="session-group session-group-waiting" aria-labelledby="waiting-chats"><h2 className="list-label" id="waiting-chats">{t('Ждут вас')}<span>{waiting.length}</span></h2>
          {waiting.map(item=><button className="session-row" key={item.provider+':'+item.id} disabled={busy||uploading||Boolean(activityTarget)} onClick={()=>openActivity(item)}><MessageSquare size={16}/><div><strong>{item.title||t('Новый разговор')}</strong><small>{providerName(item.provider)} · {basename(item.cwd)}<span aria-hidden="true">·</span><ChatRunStatus status={item.status}/></small></div></button>)}</section>}
        {jobs.filter((j) => !j.taskChat && j.status === 'running' && (provider!=='claude'||(j.account||'')===account) && !sessions.some((s) => s.sessionId === j.sessionId)).map((j) => <button className="session-row" key={j.id} onClick={() => void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: t("Текущая задача"), cwd: j.cwd, lastModified: j.startedAt }, j)}><MessageSquare size={16}/><div><strong>{t("Текущая задача")}</strong><small>{basename(j.cwd)}<span aria-hidden="true">·</span><ChatRunStatus status={j.approvals?.length?'needs_input':'running'}/></small></div></button>)}
        {grouped.map(group=><section className="session-group" key={group.group} aria-label={dayGroupLabel(group.group)}><h2 className="list-label">{dayGroupLabel(group.group)}<span>{group.items.length}</span></h2>{group.items.map(sessionRow)}</section>)}
        {/* "No chats yet" only after the PC answered; before that a skeleton, or why the list cannot load. */}
        {!visible.length && connection && !search && !demo && !sessionsLoaded ? unreachable ? <div className="empty-list" role="status"><MessageSquare size={32} /><p>{t('Список чатов загрузится, когда ПК будет на связи.')}</p><button className="secondary" onClick={()=>retryNow()}>{t('Повторить')}</button></div> : <div className="loading-skeleton" role="status" aria-label={t('Загружаем чаты…')}><span/><span/><span/></div>
        : !visible.length && <div className="empty-list"><MessageSquare size={32} /><p>{search ? t("Ничего не найдено") : connection ? t("Здесь появятся чаты {0} из разрешённых папок.",engineName) : t('Подключите ПК, чтобы видеть чаты.')}</p>{!connection&&!search&&!demo&&<button className="primary" onClick={()=>setMobileChat(true)}>{t('Подключить компьютер')}</button>}</div>}
      </div></aside>
    {boardPane&&<div className="mobile-board-stage" hidden={tab!=='workspace'&&!boardSheet}><WorkBoards key={JSON.stringify([connection!.url,connection!.token,Boolean(connection!.desktop),connection!.workspaceId||'',personalBoards.selected])} active={tab==='workspace'||boardSheet} revealTarget={boardReveal} onSelection={setBoardSelection} focusTarget={noticeTarget} compactContext local connection={connection!} roots={projectRoots} workspaces={personalBoards} onChat={target=>void launchBoardChat(target)}/></div>}
    <main hidden={boardPane&&tab==='workspace'} data-run-unknown={runUnknown||undefined} className={`workspace ${chatSurface?'chat-canvas':''}`} onDragOver={event=>{if(boardChat?.context&&event.dataTransfer.types.includes(boardImageMime)){event.preventDefault();event.dataTransfer.dropEffect='copy';}}} onDrop={event=>{if(!connection||!boardChat?.context||!event.dataTransfer.types.includes(boardImageMime))return;event.preventDefault();const image=takeBoardImageDrag(event.dataTransfer,connection,cwd);if(image&&!selected?.readOnly&&!boardMissing)uploadBoardImages([image]);}}>
      {boardSheet&&<BoardChatSheetGrip/>}
      {/* Review must escape the board chat's stacking context and phone sheet clipping.
          Keep it inside the desktop shell to inherit its resizable sidebar width. */}
      {!docked&&reviewOpen && tab==='chats' && (!embedded||embedded.visible!==false) && connection && reviewCwd && createPortal(<Review key={reviewContext} connection={connection} cwd={reviewCwd} taskRunId={taskRun?.id} initialMode={availableReview?.mode} onlyPaths={reviewPaths} onQuote={quoteToDraft} onClose={()=>{setReviewOpen(false);setReviewPaths(undefined);}}/>,document.querySelector('.desktop-app')||document.body)}
      {taskPanel&&taskRun&&connection&&<TaskRunPanel key={taskRun.id} connection={connection} initial={taskRun} onClose={()=>setTaskPanel(false)} onChat={(_run,followUp)=>{setTaskPanel(false);if(followUp)appendDraft(followUp);}} onBoard={target=>{if(embedded?.onBoard)embedded.onBoard(target);else{setNoticeTarget(target);setLocalBoards(true);setTab('workspace');}}}/>}
      {!docked&&agentPanel && connection && parentChatId && <Subagents key={`${provider}-${parentChatId}`} connection={connection} provider={provider} parentId={parentChatId} initialAgent={agentPanel.initial} initialAgentId={agentPanel.initial?.id} onClose={()=>setAgentPanel(null)}/>}
      {!docked&&outputsOpen && connection && <ChatOutputs provider={provider} sessionId={parentChatId||undefined} key={`${provider}:${parentChatId||cwd}`} connection={connection} cwd={cwd} messages={outputMessages} onClose={()=>setOutputsOpen(false)} hasMore={hasMore!==null&&historyWindow.current<5000} loadingMore={loadingOlder} onLoadMore={()=>void extendHistory()} />}
      {docked&&activePreview&&connection&&embedded?.visible!==false&&<ChatSidePanel tabs={sideTabs} active={activePreview.id} expanded={sideExpanded} onSelect={setPreview} onExpand={()=>setSideExpanded(value=>!value)} onClose={closeSide} onCloseTab={closePreview} onRefresh={()=>setPreviewRevision(value=>value+1)}>
        <FileWithChanges key={activePreview.id} change={activePreview.change}><FilePreview docked connection={connection} root={activePreview.root} path={activePreview.path} scoped revision={previewRevision} onClose={()=>closePreview(activePreview.id)}/></FileWithChanges>
      </ChatSidePanel>}
      <ChatOverlay edge="top" enabled={chatSurface}>{chatSurface?<>
        <ChatHeader model={docked&&connection&&!boardChat?.context?<HeaderModelMenu connection={connection} provider={provider} onProvider={embedded?.onProvider&&!selected&&!job&&!taskRun?embedded.onProvider:undefined} models={(account?customModels.models:provider==='claude'?claudeCatalog.models:providerInfo?.models)||[]} model={account?customModels.model:model} onModel={account?customModels.setModel:setModel} onManage={()=>embedded?.onOpenSettings?.('providers')} disabled={busy||running||uploading||Boolean(selected?.readOnly)}/>:undefined} panel={docked?{open:Boolean(sideTab),available:previews.length>0,toggle:()=>{if(sideTab)closeSide();else if(previews.length)setPreview(previews.at(-1)!.id);}}:undefined} docs={headerDocs} actionsHost={embedded?.taskDrawer} board={chatBoard?{title:chatBoard.title,disabled:!connection||demo,open:()=>void openChatBoard(chatBoard)}:undefined} hideContext hideBack={Boolean(embedded)} backLabel={!embedded&&boardChat?.context?(language==='ru'?'К доске':'Back to board'):undefined} contextMenuOnly={Boolean(embedded&&boardChat?.context)} close={embedded&&boardChat?.context?{label:language==='ru'?'Закрыть чат доски':'Close board chat',open:()=>embedded.onBack()}:undefined} newBoardChat={boardChat?.conversation?{disabled:busy||uploading,open:()=>void launchBoardChat(boardChat,true)}:undefined} title={selected?.customTitle||(boardChat?.context?boardChat.note.title:chatTitle(selected?.summary||(!job&&taskRun?.title)||undefined,t('Новый разговор')))} project={basename(taskRun?.projectPath||selected?.cwd||cwd)} provider={engineName} branch={selected?.gitBranch}
          status={!embedded&&otherStatus?{value:otherStatus,label:t('Другие чаты: {0}',runStatusLabel(otherStatus))}:undefined} onBack={()=>embedded?embedded.onBack():boardChat?.context?setTab('workspace'):setMobileChat(false)}
          context={undefined}
          review={availableReview||taskRun?{disabled:!connection||demo||!!selected?.readOnly,open:()=>{setReviewPaths(undefined);setReviewOpen(true);},stats:availableReview&&availableReview.files!==undefined?{added:availableReview.added||0,removed:availableReview.removed||0,files:availableReview.files}:undefined}:undefined}
          outputs={hasOutputs?{disabled:!connection||demo||loading,open:()=>setOutputsOpen(true)}:undefined}
          subagents={agentMap.size>0&&parentChatId?{count:agentMap.size,running:[...agentMap.values()].filter(agent=>agent.status==='running').length,disabled:!connection||demo,open:()=>setAgentPanel({})}:undefined}
          reading={outputMessages.length>0||Boolean(job?.partial)?{disabled:loading||!history.length&&!job,open:()=>toggleReadingMode(true)}:undefined}
          top={selected&&!demo?{disabled:loading||busy,open:()=>void jumpHistory(true)}:undefined} detail={{value:detail,set:setDetailMode}}/>
      </>:tab==='workspace'?<header className="chat-header" data-section="board"><h1>{t("Доска")}</h1></header>:tab==='tasks'?null:<header className="chat-header" data-section={tab}>
        <div className="header-title"><h1>{tab==='connection'||tab==='chats'?t('Подключение к ПК'):tab==='settings'?t("Настройки"):docView==='files'?t('Файлы'):docView==='rules'?t("Правила"):t("История изменений")}</h1></div>
      </header>}
      {connection&&!connectionScreen&&!demo&&!embedded&&<ConnectionStatus offline={offline} hostError={networkError?t(networkError):''}/>}
      {/* The Windows window shows reachability above the chat; a host error from a chat read still needs its own line here. */}
      {embedded&&networkError&&!connectionScreen&&<div className="network-banner" role="status"><RefreshCw size={14} />{t(networkError)}</div>}
      {demo && <div className="demo-banner">{t("Демо · пример интерфейса, без подключения к Claude")}<button onClick={() => void disconnect()}>{t("Подключить ПК →")}</button></div>}
      {/* Only a PC that answered /providers can say a provider is missing or signed out; an unreachable PC is the status line's job. */}
      {!canRun && !demo && !unreachable && providersLoaded && tab==='chats' && connection && !connection.workspaceId && <div className="network-banner" role="status">{providerInfo?.error ? t(providerInfo.error) : providerInfo ? t("{0} недоступен. Установите приложение и войдите в аккаунт на ПК.",engineName) : t("Обновите сервер на ПК, чтобы включить {0}.",engineName)}</div>}
      <Updates connection={connection} expanded={tab === 'settings'&&settingsPage === 'updates'} />
      {tab==='chats'&&!readingMode&&chainControls&&connection&&(job?.id||selected?.sessionId)&&<ChatChainLink
        key={[cacheScope,chainQuery,job?.id,selected?.sessionId].join('|')} connection={connection} onOpen={openTasks}
        query={chainQuery+'&'+new URLSearchParams({...job?.id?{jobId:job.id}:{},...selected?.sessionId&&!selected.sessionId.startsWith('pending-')?{sessionId:selected.sessionId}:{}})}/>}
      {tab==='chats'&&taskRun&&!readingMode&&(history.length||job||selected)&&<button className="chat-task-entry" onClick={()=>setTaskPanel(true)}>{taskRun.title} · <span className={'task-stage-text task-stage-'+taskDisplayStage(taskRun)}>{taskRunStageLabel(taskRun)}</span></button>}
      </ChatOverlay>
      {contentTab === 'tasks' ? <TasksPage key={JSON.stringify([cacheScope,provider,account,taskCwd,embedded?.tasksPage?.initialId||taskChainId])}
        initialId={embedded?embedded.tasksPage?.initialId:taskChainId} controls={chainControls}
        improveScope={chainControls&&connection?{connection,cwd:taskCwd,provider}:undefined}
        onPrepareDraft={connection&&!busy&&!uploading?prepareTaskDraft:undefined} maxDraftLength={taskFileRoom?1024*1024:taskTextRoom}
        unavailable={!connection||demo||connection.workspaceId?t('Подключитесь к ПК в настройках'):undefined}
        scopePicker={connection&&!demo&&!connection.workspaceId&&<div className="tasks-scope">
          {/* The PC window chooses the provider and model here with the same menu as the chat header. */}
          {docked?<HeaderModelMenu connection={connection} provider={provider} onProvider={value=>{rememberDraft();setTaskProject(taskCwd);setTaskChainId(undefined);(embedded?.onTaskProvider||setProvider)(value);}} models={(account?customModels.models:provider==='claude'?claudeCatalog.models:providerInfo?.models)||[]} model={account?customModels.model:model} onModel={account?customModels.setModel:setModel} onManage={()=>embedded?.onOpenSettings?.('providers')} disabled={busy||uploading}/>
          :<ProviderPicker connection={connection} value={provider} onChange={value=>{rememberDraft();setTaskProject(taskCwd);setTaskChainId(undefined);(embedded?.onTaskProvider||setProvider)(value);}} disabled={busy||uploading}/>}
          {/* Any folder the AI works in, not only a Git project. */}
          <div className="project-folder-field"><span>{t('Рабочая папка')}</span>
            <ProjectFolderPicker label={t('Рабочая папка')} value={taskCwd} paths={[...new Set([...projectRoots,...(taskCwd?[taskCwd]:[]),...(cwd?[cwd]:[])])]} onChange={root=>{
              setTaskChainId(undefined);if(embedded?.tasksPage?.initialId)embedded.onOpenTasks?.();setTaskProject(root);
            }}/>
          </div>
        </div>}/> : contentTab === 'connection' ? connectView() : onboardingVisible ? connectView(true) : contentTab === 'workspace' ? (boardPane?null:<div className="center-message">{t('Подключитесь к ПК в настройках')}</div>) : (contentTab === 'files'||contentTab==='changelog') ? (connection||workspaceConnection) ? <DocumentLibrary connection={(connection||workspaceConnection)!} kind={docView} onKind={setDocView} onChat={connection?(root,prompt)=>{if(busy||uploading)return;newChat(root);setDraft(prompt);}:undefined} onFolderChat={connection?path=>newChat(path):undefined}/> : <div className="center-message">{t("Файлы доступны после подключения к ПК.")}</div> : contentTab === 'settings' ? <SettingsPanel connectionPanel={connectView()} online={!!pcStatus?.online} workspaceSelector={workspacePicker('settings')} page={settingsPage} onPage={page=>{setSettingsSubpage(null);setSettingsPage(page);}} subpageRequest={settingsSubpage} provider={provider} connection={connection} computerName={health.name} networkError={networkError} roots={projectRoots} cwd={cwd} onProject={root=>{newChat(root);setTab('settings');setSettingsPage('workspace');}} appearance={appearanceSettings} codexAccess={codexAccess} onCodexAccess={setCodexAccess} budget={budget} onBudget={setBudget}/> : <>
        <ThreadPrimitive.Viewport className="conversation" ref={scroll} autoScroll={followLatest} scrollToBottomOnInitialize={false} scrollToBottomOnThreadSwitch={false} style={{overflowAnchor:'none'}} onScroll={() => {const el = scroll.current!;if(!el.getClientRects().length||tab!=='chats')return;const previous=lastScrollTop.current;nearBottom.current = el.scrollHeight-el.scrollTop-el.clientHeight<80;setShowScrollActions(fromStart||!nearBottom.current);lastScrollTop.current = el.scrollTop;markScrolling();rememberPosition();acknowledgeVisibleActivity();if(fromStart?el.scrollTop>previous&&nearBottom.current:el.scrollTop<previous&&el.scrollTop<=40)void extendHistory();}}>
          <div className="conversation-inner" tabIndex={-1}>{selected&&!demo&&unreachable&&history.length>0&&<p className="muted history-meta" role="status">{t("Офлайн · сохранённая копия")}</p>}{selected?.readOnly && <p className="info-card">{t("Только просмотр. Чтобы продолжить чат и работать с файлами, запустите сервер с папкой этого проекта: ")}{cwd}</p>}{demo&&<div className="conversation-date"><span />{t("ПРИМЕР РАЗГОВОРА")}<span /></div>}
            {/* A chat just started already shows its message and the running turn: no placeholder over them, so nothing jumps. */}
            {loading && (!history.length&&!job?.messages?.length&&!job?.partial&&!pendingSend?<ChatHistorySkeleton/>:history.length?<p className="history-page-status muted" role="status">{t("Загружаем историю с ПК…")}</p>:null)}
            {!loading && !visibleOutgoing && !history.length && !job && !selected && taskRun && <section className="task-chat-card" aria-label={t('Задача')}><button type="button" className={'task-chat-stage task-stage-text task-stage-'+taskDisplayStage(taskRun)} onClick={()=>setTaskPanel(true)}>{taskRunStageLabel(taskRun)}</button><h2>{taskRun.title}</h2>{taskRun.worktree&&<p className="task-chat-branch"><code>{taskRun.worktree.branch}</code></p>}{(taskRun.noteSnapshot?.description||'').trim()&&<p className="task-chat-criteria">{(taskRun.noteSnapshot?.description||'').trim().split('\n').slice(0,4).join('\n')}</p>}<p className="muted">{t('Проверьте подготовленный запрос и отправьте его, чтобы агент начал. Сам он не отправляется.')}</p></section>}
            {!loading && selected && !history.length && !job && (unreachable||historyError&&hostDown(reach)?<div className="offline-empty muted" role="status"><p>{embedded?t('История чата загрузится, когда локальный сервер будет доступен.'):t("Этот чат ещё не сохранён на телефоне. Он загрузится, когда ПК будет доступен.")}</p><button className="secondary" onClick={()=>{retryNow();if(selected)void openSession(selected);}}>{t("Повторить")}</button></div>:<p className="muted">{t("В локальной истории пока нет сообщений. Проверьте, что этот чат открыт в {0} на ПК.",engineName)}</p>)}
            {selected&&!loading&&(history.length>0||!unreachable)&&(loadingOlder||historyError||hasMore!==null&&(unreachable||!fromStart))&&<p className="history-page-status muted" role="status" aria-live="polite">{loadingOlder?<span className="history-loading"><LoaderCircle size={16} aria-hidden="true"/>{t('Загружаем сообщения…')}</span>:historyError?<>{t('Не удалось обновить историю')}{!unreachable&&<small className="history-error-reason">{t(historyError)}</small>}</>:unreachable?t('Остальная история загрузится, когда ПК будет на связи'):t('Выше есть ещё сообщения · прокрутите вверх')}{historyError&&hasMore!==null&&!unreachable&&<button className="text-button" onClick={()=>void extendHistory()}>{t('Повторить загрузку')}</button>}</p>}
            {hasMore !== null && historyWindow.current >= 5000 && <p className="muted" role="status">{t("Достигнут предел окна: 5000 сообщений")}</p>}
            <MessageList connection={connection} cwd={cwd} key={`${provider}-${navigation.current}`} jobId={job?.id} provider={provider} messages={transcript} partialText={job?.errorCode!=='codex_thread_busy'?job?.partial:undefined} streaming={running&&!runUnknown} toolResults={toolResults} runningMessages={runningMessages} agents={agentMap} onSubagent={connection&&parentChatId ? openSubagent : undefined} mode={detail} turnChanges={changesByTurn} resultRoot={resultRoot} onReview={docked?undefined:openTurnReview}/>
            {job?.expiredApprovals?.map((item,index)=><p key={`expired-${index}`} className="approval-expired transcript-event" role="status">{t('Время ожидания истекло — агенту отправлен отказ')} · {item.tool}</p>)}
            {job?.approvals.map((a) => <ApprovalCard key={`${provider}-${a.id}`} provider={provider} approval={a} autoOpenQuestions={a.id===job.approvals.find(item=>item.tool==='AskUserQuestion')?.id} decide={async (allow, answers, extra) => {await api(`/jobs/${job.id}/approvals/${a.id}`, { allow, answers, ...extra });if(allow&&a.tool==='ExitPlanMode'&&extra?.mode){const key=currentDraftKey(),mode=extra.mode;setAccessChoices(old=>({...old,[key]:mode}));}}} />)}
            {job?.error && job.errorCode!=='codex_thread_busy' && <div className="error-banner">{t(job.error)}{provider==='claude'&&claudeOutdated(job.error)&&<ClaudeEngineUpdate connection={connection} compact/>}</div>}{job?.status === 'stopped' && <p className="muted">{t("Задача остановлена. Можно отправить новое сообщение.")}</p>}
            {job?.status === 'done' && <div className="turn-complete" role="status"><ShieldCheck size={14} />{t(" Готово ")}{turnEnd?.id===job.id&&<><span>· <time dateTime={new Date(turnEnd.at).toISOString()}>{new Date(turnEnd.at).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}</time></span><span className="turn-duration">· {elapsed(turnEnd.at-job.startedAt)}</span></>}{job.cost !== undefined && <span>· ${job.cost.toFixed(4)}</span>}</div>}
            {visibleOutgoing&&<article className="message user" aria-busy="true"><div className="user-message-content">
              {visibleOutgoing.files.map(file=><div key={file.id}>{file.name}</div>)}
              <div style={{whiteSpace:'pre-wrap'}}>{visibleOutgoing.text}</div>
            </div></article>}
            <div ref={bottom} />
          </div>
        </ThreadPrimitive.Viewport>
        {(showScrollActions||fromStart)&&!readingMode&&<button className="scroll-latest" data-scrolling={scrolling||undefined} aria-label={unseen?t('К новым сообщениям: {0}',unseen):t('К новым сообщениям')} title={t('К новым сообщениям')} disabled={loading || busy} onClick={event=>{
          const transcript=scroll.current;
          const keyboardTrigger=event.detail===0?event.currentTarget:undefined;
          if(fromStart||historyExpanded.current||!transcript){void jumpHistory(false,keyboardTrigger);return;}
          nearBottom.current=true;
          transcript.scrollTo({top:transcript.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
          lastScrollTop.current=transcript.scrollTop;
          if(keyboardTrigger)focusLatestMessage(transcript);
          setShowScrollActions(false);
        }}><ArrowDown size={20} aria-hidden="true"/>{unseen>0&&<span className="scroll-latest-count" aria-hidden="true">{unseen>99?'99+':unseen}</span>}</button>}
        <ChatOverlay edge="bottom">
        {/* Hosts without the queue view still report how many follow-ups wait. */}
        {Boolean(job?.pendingInputIds?.length)&&!job?.queued&&<p className="followup-status" role="status">{t(running?"Queued follow-ups: {0}":"Unprocessed follow-ups: {0}",job!.pendingInputIds!.length)}</p>}
        <div className="composer-area">{boardChat?.context&&<div className="board-context-chip">{boardChat.context.name}</div>}{plan&&!readingMode&&(running||plan.some(item=>item.status!=='completed'))&&<PlanBar items={plan}/>}
          {!readingMode&&<OutboxShelf items={outbox} busy={busy}/>}
          {/* Only lost contact needs a notice here; action details stay in the transcript. */}
          {running&&job&&runUnknown&&!job.approvals.length&&!readingMode&&<RunningAction job={job} stopping={stopping} stopHint={Boolean(embedded)&&!runUnknown} lostAt={runUnknown?runLost??jobContact.current.at:undefined}/>}{!error&&connection&&!demo&&!readingMode&&!job?.approvals.length&&<LimitAlert provider={provider} onOpen={()=>{setSettingsPage('usage');setTab('settings');setMobileChat(true);}}/>}{error &&<div className="error-banner" role="alert">{t(error)}{!embedded&&t(error)===t(budgetRangeMessage)&&<button className="text-button" onClick={()=>{setError('');setSettingsSubpage('access');setSettingsPage('workspace');setTab('settings');setMobileChat(true);}}>{t('Открыть настройки бюджета')}</button>}<button aria-label={t("Закрыть ошибку")} className="icon-button" onClick={() => setError('')}><X size={14} /></button></div>}
          {(rejectedDraft || job?.errorCode==='codex_thread_busy') && <div className="error-banner" role="alert"><p>{t(codexBusyMessage)}</p>{rejectedDraft && <><p>{rejectedDraft.restored?t("Сообщение и вложения возвращены в черновик. Нажмите «Отправить», когда чат освободится на ПК."):t("Новый черновик сохранён. Неотправленное сообщение и вложения можно добавить к нему.")}</p>{!rejectedDraft.restored && <button className="secondary" disabled={busy||running||uploading} onClick={addRejectedDraft}>{t("Добавить неотправленное сообщение в черновик")}</button>}</>}</div>}
          {!readingMode&&(()=>{const folder=!selected&&!job&&!taskRun&&!boardChat?.context?{
              label:language==='ru'?'Папка чата':'Chat folder',value:cwd,paths:projects||health.roots,disabled:busy||uploading||demo,
              onChange:(root:string)=>{void api('/chat-library/projects',{cwd:root}).then(()=>{projectChosen.current=true;setCwd(root);window.dispatchEvent(new Event('pocket-chat-project-added'));}).catch(e=>setError(e.message));}
            }:undefined;return folder?<FolderChip {...folder}/>:null;})()}
          <ChatComposer improveScope={connection&&!connection.workspaceId&&!demo&&cwd?{connection,cwd,provider}:undefined} scopeKey={JSON.stringify([cacheScope,account,provider,cwd,job?.sessionId||selected?.sessionId,tab,embedded?.visible])} onRevealBoardSelection={id=>{const selection=matchingBoardSelection(embedded?embedded.boardSelection:boardSelection,connection,cwd,boardChat?.boardId);if(!selection?.ids.includes(id))return;const target={boardId:selection.boardId,root:selection.root,objectId:id,requestId:Date.now()};if(embedded)embedded.onRevealBoardSelection?.(target);else{setBoardReveal(target);setTab('workspace');setMobileChat(true);}}} boardSelection={matchingBoardSelection(embedded?embedded.boardSelection:boardSelection,connection,cwd,boardChat?.boardId)} text={draft} onText={setDraft} label={t("Сообщение {0}",engineName)}
            placeholder={demo?t("Подключите ПК, чтобы отправлять сообщения"):t("Что нужно сделать?")}
            disabled={demo||selected?.readOnly||boardMissing||Boolean(embedded&&readyChatTarget!==embeddedTarget)} uploading={uploading} busy={busy} stopping={stopping}
            mode={canQueue?'later':running?provider==='codex'?'steer':'queue':'send'} blockedReason={unreachable&&!canQueue&&!demo&&connection?t('Нет связи с ПК · черновик сохранится'):undefined} enterSends={enterSendsPreference(composerPreferences,Boolean(embedded))} keyHint={Boolean(embedded)}
            canSend={!(demo||boardMissing||!(canRun||canQueue||warming)||selected?.readOnly||busy||(loading||warming)&&Boolean(pendingSend)||uploading||!attachments.every(attachmentReady)||!draft.trim()&&!attachments.length)}
            onBoardImage={connection&&boardChat?.context?data=>{const image=takeBoardImageDrag(data,connection,cwd);if(image)uploadBoardImages([image]);else setError(t('Это изображение относится к другой доске или подключению.'));}:undefined}
            attachments={attachments} onRemove={id=>{boardImageLoads.current.delete(id);setAttachments(old=>old.filter(a=>a.id!==id));}} onFiles={(files,options)=>upload(files,options)} onRetry={retryUpload} onInsertText={id=>void insertPastedText(id)} onRecall={recallLast} onSend={()=>void send()}
            stopLabel={runUnknown?t("Повторить связь"):t("Остановить {0}",engineName)} stopRetry={runUnknown} onStop={running?runUnknown?()=>retryNow():()=>void stopRun():undefined}
            controls={<>{!docked&&embedded?.onProvider&&!selected&&!job&&!taskRun&&!boardChat?.context&&<ProviderPicker connection={connection||undefined} value={provider} onChange={embedded.onProvider} disabled={busy||uploading}/>}{(provider==='claude'||provider==='codex')&&<AccessModeChip provider={provider} value={chatAccess} onChange={value=>void changeAccess(value)} running={running} liveChange={provider==='claude'} disabled={demo||Boolean(selected?.readOnly)}/>}{docked?null:account?<ModelPicker provider="custom" name={engineName} models={customModels.models} value={customModels.model} onChange={customModels.setModel} disabled={busy||running||uploading||selected?.readOnly} disabledHint={running?t('Модель можно сменить после хода'):undefined}/>:<ModelPicker provider={provider} name={engineName} models={provider==='claude'?claudeCatalog.models:providerInfo?.models} value={model} onChange={setModel} disabled={busy||running||uploading||selected?.readOnly} disabledHint={running?t('Модель можно сменить после хода'):undefined} unavailable={provider==='claude'&&claudeCatalog.unavailable}/>}{(provider==='codex'||provider==='claude'&&!account)&&<EffortPicker provider={engineName} {...(provider==='claude'?claudeEffort:codexEffort)} disabled={busy||running||uploading||selected?.readOnly} disabledHint={running?t('Модель можно сменить после хода'):undefined}/>}</>}
            usage={connection&&!demo&&<UsageIndicator key={provider+connection.url+connection.token} connection={connection} provider={provider} models={[...(provider==='claude'?claudeCatalog.models.filter(item=>item.id===(model||claudeDefaultModel)).flatMap(item=>[item.id,item.name,item.resolvedModel||'']):[]),model||(provider==='claude'?'sonnet':providerInfo?.models?.find(item=>item.isDefault||providerInfo.models?.length===1)?.id||''),providerInfo?.models?.find(item=>item.id===model||!model&&(item.isDefault||providerInfo.models?.length===1))?.name||'']}/>}/>
          {!readingMode&&connection&&!demo&&<ChatGenerationFooter key={JSON.stringify([connection.url,connection.token,provider,account,selected?.sessionId])} connection={connection} provider={provider} account={account} sessionId={selected?.sessionId} job={job}/>}
        </div></ChatOverlay>
      </>}
    </main>
    {tabBar&&(()=>{const barTab=tab;return <nav className="mobile-tabbar" aria-label={t('Основные разделы')}><button className={barTab==='chats'?'active':''} aria-current={barTab==='chats'?'page':undefined} onClick={()=>showSection('chats')} aria-label={t("Чаты")} aria-description={chatStatusLabel||undefined} title={chatStatusLabel||undefined}><span className="chat-tab-icon"><MessageSquare size={24}/>{chatStatusDot}</span>{t("Чаты")}</button><button className={barTab==='tasks'?'active':''} aria-current={barTab==='tasks'?'page':undefined} onClick={()=>openTasks()}><ListChecks size={24}/>{t('Задачи')}</button><button className={barTab==='workspace'?'active':''} aria-current={barTab==='workspace'?'page':undefined} onClick={()=>showSection('workspace')}><ClipboardList size={24}/>{t("Доска")}</button><button className={['files','changelog','settings','connection'].includes(barTab)?'active':''} aria-current={['files','changelog','settings','connection'].includes(barTab)?'page':undefined} aria-haspopup="dialog" aria-expanded={moreOpen} aria-description={liveSettings.update?t('Доступно обновление'):undefined} onClick={()=>setMoreOpen(true)}><span className="chat-tab-icon"><MoreHorizontal size={24}/>{liveSettings.update&&<span className="settings-badge tab-badge" aria-hidden="true"/>}</span>{t("Ещё")}</button></nav>;})()}
    {!embedded&&<MobileNavigation open={moreOpen} onClose={()=>setMoreOpen(false)}><nav className="mobile-nav" onClick={event=>{if((event.target as HTMLElement).closest('button'))setMoreOpen(false);}}><button className={tab === 'files' ? 'active' : ''} aria-current={tab==='files'?'page':undefined} onClick={() => showSection('files')}><BookOpen size={20} />{t("Правила")}</button><button className={tab==='changelog'?'active':''} aria-current={tab==='changelog'?'page':undefined} onClick={()=>showSection('changelog')}><FileText size={20}/>{t("История изменений")}</button><button className={tab === 'settings'&&settingsPage!=='connection' ? 'active' : ''} aria-current={tab==='settings'&&settingsPage!=='connection'?'page':undefined} aria-description={liveSettings.update?t('Доступно обновление'):undefined} onClick={() => showSection('settings')}><Settings size={20} />{t("Настройки")}{liveSettings.update&&<span className="settings-badge" aria-hidden="true"/>}</button><button className={tab==='settings'&&settingsPage==='connection'?'active':''} aria-current={tab==='settings'&&settingsPage==='connection'?'page':undefined} onClick={()=>showSection('settings','connection')}><Laptop size={20}/><span className="mobile-nav-label">{t("Подключение к ПК")}<small>{pcStatus?(pcStatus.online?pcStatus.name:t('Нет связи · {0}',pcStatus.name)):saved?.name&&!saved.workspaceOnly?t('Нет связи · {0}',saved.name):t('Не подключено')}</small></span></button></nav></MobileNavigation>}
    {chatAction&&connection&&<ChatActions key={provider+chatAction.session.sessionId+chatAction.x+chatAction.y} target={chatAction} provider={provider} jobId={jobs.find(run=>run.sessionId===chatAction.session.sessionId)?.id} managementDisabled={busy||uploading||demo} connection={connection} onClose={()=>setChatAction(null)} onChanged={(session,deleted)=>{setSessions(old=>deleted?old.filter(s=>s.sessionId!==session.sessionId):old.map(s=>s.sessionId===session.sessionId?session:s));if(selected?.sessionId===session.sessionId){if(deleted){newChat();setMobileChat(false);}else setSelected(session);}}}/>}
    {branchTarget&&<MessageBranch connection={canRun&&connection?connection:undefined} cwd={cwd} provider={provider} key={branchTarget.sourceId+branchTarget.message.id} target={branchTarget} onClose={()=>setBranchTarget(null)} onSubmit={submitBranch}/>}
  </div></AssistantChatProvider></SidePreview.Provider>;
}
