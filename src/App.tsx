import { Review } from './Review';
import {useBackAction,useBackNavigation,useModal} from './navigation';
import { preferences, preferredRoot, savePreferredRoot, savePreferences, selectedWorkspace, saveSelectedWorkspace, type WorkspaceProvider } from './preferences';
import { useWorkspaceState, useWorkspaceRef } from './workspace-state';
import { Updates } from './Updates';
import { useLanguage } from './i18n';
import { LanguageSelector } from './Language';
import { t, locale } from "./i18n";import { useEffect, useState, useRef } from 'react';
import { ArrowUp, ArrowLeft, Plus, Search, MessageSquare, Folder, Settings, Terminal, Wifi, ChevronDown, Paperclip, Square, X, GitBranch, RefreshCw, Laptop, LogOut, ShieldCheck, ClipboardList } from 'lucide-react';
import { Connect } from './Connect';
import { AppearanceSettings, useAppearance } from './Appearance';
import { Message, ApprovalCard } from './Messages';
import { JiraJobs, JiraSettings } from './Jira';
import { Files } from './Files';
import { LiveTerminal } from './LiveTerminal';
import { fileBase64, loadConnection, request, saveConnection, type Connection } from './api';
import { demoMessages, demoSessions } from './demo';
import type { ChatMessage, JobView } from '../server/types';

type Session = {sessionId: string;summary: string;customTitle?: string;cwd?: string;lastModified: number;gitBranch?: string;source?: string;readOnly?: boolean;archived?: boolean;provider?: WorkspaceProvider;};
type Health = {name: string;roots: string[];version: string;protocol: number;};
type ProviderInfo = {id: WorkspaceProvider;name: string;available: boolean;authenticated?: boolean;models?: {id:string;name:string}[];error?: string;};
type Attachment = {id: string;name: string;size: number;};
const basename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;
export function App() {
  useBackNavigation();
  const [generation, setGeneration] = useState(0);
  return <WorkspaceApp key={generation} onDisconnect={() => setGeneration(value => value + 1)} />;
}
function WorkspaceApp({onDisconnect}: {onDisconnect():void}) {
  useLanguage();
  const appearanceSettings = useAppearance();
  const [provider, setProvider] = useState<WorkspaceProvider>(selectedWorkspace);
  const [providers, setProviders] = useState<ProviderInfo[]>([{id:'claude',name:'Claude',available:true}]);
  const providerInfo = providers.find(item => item.id === provider);
  const engineName = provider === 'codex' ? 'Codex' : 'Claude';
  const canRun = providerInfo?.available === true && providerInfo.authenticated !== false;
  const useStateForWorkspace = <T,>(initial:T | ((provider:WorkspaceProvider)=>T)) => useWorkspaceState(provider, initial);
  const useRefForWorkspace = <T,>(initial:T) => useWorkspaceRef(provider, initial);
  const [reviewOpen,setReviewOpen] = useStateForWorkspace(false);
  const [showScrollActions, setShowScrollActions] = useStateForWorkspace(false);
  const [fromStart, setFromStart] = useStateForWorkspace(false);
  const lastScrollTop = useRefForWorkspace(0);
  const [connection, setConnection] = useState<Connection | null>(null),[saved, setSaved] = useState<Connection | null>(null);
  const [health, setHealth] = useState<Health | null>(null),[sessions, setSessions] = useStateForWorkspace<Session[]>([]),[jobs, setJobs] = useStateForWorkspace<JobView[]>([]);
  const [selected, setSelected] = useStateForWorkspace<Session | null>(null),[history, setHistory] = useStateForWorkspace<ChatMessage[]>([]),[job, setJob] = useStateForWorkspace<JobView | null>(null);
  const [cwd, setCwd] = useStateForWorkspace(''),[tab, setTab] = useStateForWorkspace<'chats' | 'files' | 'settings' | 'terminal' | 'jobs'>('chats'),[mobileChat, setMobileChat] = useStateForWorkspace(false);
  const [draft, setDraft] = useStateForWorkspace(''),[search, setSearch] = useStateForWorkspace(''),[model, setModel] = useStateForWorkspace(id=>preferences(id).model),[mode, setMode] = useStateForWorkspace(id=>preferences(id).mode);
  const [error, setError] = useStateForWorkspace(''),[networkError, setNetworkError] = useStateForWorkspace(''),[busy, setBusy] = useStateForWorkspace(false),[loading, setLoading] = useStateForWorkspace(false);
  const [demo, setDemo] = useState(false),[attachments, setAttachments] = useStateForWorkspace<Attachment[]>([]),[uploading, setUploading] = useStateForWorkspace(false);
  const [takeover, setTakeover] = useStateForWorkspace(false),[pendingTakeover, setPendingTakeover] = useStateForWorkspace(false),[budget, setBudget] = useStateForWorkspace(id=>preferences(id).budget);
  const confirmation=useRef<HTMLElement|null>(null);
  useModal(confirmation,pendingTakeover,()=>setPendingTakeover(false));
  useBackAction(()=>{
    if(tab!=='chats'){setTab('chats');setMobileChat(true);return true;}
    if(mobileChat){setMobileChat(false);return true;}
    return false;
  });
  const drafts=useRefForWorkspace<Map<string,{text:string;attachments:Attachment[]}>|null>(null);
  if(!drafts.current)drafts.current=new Map();
  const currentDraftKey=()=>job?.sessionId||selected?.sessionId||`new:${cwd}`;
  const rememberDraft=()=>{drafts.current!.set(currentDraftKey(),{text:draft,attachments});};
  const restoreDraft=(key:string)=>{const value=drafts.current!.get(key);setDraft(value?.text||'');setAttachments(value?.attachments||[]);};
  const [hasMore, setHasMore] = useStateForWorkspace<number | null>(null);
  useEffect(()=>saveSelectedWorkspace(provider),[provider]);
  useEffect(()=>savePreferences(provider,{model,mode,budget}),[provider,model,mode,budget]);
  useEffect(()=>{if(connection&&health&&!cwd)setCwd(preferredRoot(connection.url,health.roots,provider));},[connection,health,cwd,provider]);
  useEffect(()=>{if(connection&&health?.roots.includes(cwd))savePreferredRoot(connection.url,cwd,provider);},[connection,cwd,health,provider]);
  useEffect(()=>setReviewOpen(false),[connection,cwd]);
  const historyWindow = useRefForWorkspace(100);
  const [historyError, setHistoryError] = useStateForWorkspace('');
  const bottom = useRefForWorkspace<HTMLDivElement|null>(null),scroll = useRefForWorkspace<HTMLDivElement|null>(null),fileInput = useRefForWorkspace<HTMLInputElement|null>(null);
  const navigation = useRefForWorkspace(0),sending = useRefForWorkspace(false),nearBottom = useRefForWorkspace(true);
  const retry = useRefForWorkspace<{signature: string;id: string;} | null>(null);
  const running = job?.status === 'running';
  const api = <T,>(endpoint: string, data?: unknown) => request<T>(connection!, endpoint, data);
  async function connect(c: Connection) {
    setBusy(true);setError('');
    try {
      const h = await request<Health>(c, '/health');
      if (h.protocol !== 1) throw new Error(t("Обновите приложение и сервер до одной версии"));
      await saveConnection(c);setSaved(c);setConnection(c);setHealth(h);setCwd(preferredRoot(c.url,h.roots,provider));setDemo(false);
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  useEffect(() => {loadConnection().then((c) => {if (c) {setSaved(c);void connect(c);}}).catch(() => setError(t("Не удалось прочитать сохранённое подключение. Введите ключ снова.")));}, []);
  useEffect(() => {
    if (!connection || demo) return;
    let cancelled = false;
    async function refreshProviders() {
      try {
        const list = await request<ProviderInfo[]>(connection!, '/providers');
        if (!cancelled && Array.isArray(list)) setProviders(list.filter(item => item.id === 'claude' || item.id === 'codex'));
      } catch { /* Older bridge versions support the existing Claude workspace. */ }
    }
    void refreshProviders();const timer = setInterval(() => void refreshProviders(),30000);
    return () => {cancelled=true;clearInterval(timer);};
  },[connection,demo]);
  useEffect(()=>{if(provider==='codex' && model && providerInfo?.models?.length && !providerInfo.models.some(item=>item.id===model))setModel('');},[provider,providerInfo?.models,model]);
  useEffect(() => {
    if (!connection || demo || !providerInfo) return;
    let cancelled = false,timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const [s, j] = await Promise.all([request<Session[]>(connection!, `/sessions?provider=${provider}`), request<JobView[]>(connection!, `/jobs?provider=${provider}`)]);
        if (!cancelled) {
          const scopedSessions=s.filter(item=>!item.provider || item.provider===provider),scopedJobs=j.filter(item=>!item.provider || item.provider===provider);
          setSessions(scopedSessions);setJobs(scopedJobs);setSelected(old=>old?scopedSessions.find(item=>item.sessionId===old.sessionId)||old:null);setNetworkError('');
        }
      } catch (e) {if (!cancelled) setNetworkError((e as Error).message);}
      if (!cancelled) timer = setTimeout(refresh, 5000);
    }
    void refresh();return () => {cancelled = true;clearTimeout(timer);};
  }, [connection, demo, provider, Boolean(providerInfo)]);
  useEffect(() => {
    if (!connection || !job || demo || job.status !== 'running') return;
    let cancelled = false,timer: ReturnType<typeof setTimeout>,revision = -1;
    async function poll() {
      let finished = false;
      try {
        const updated = await request<JobView | null>(connection!, `/jobs/${job!.id}?revision=${revision}`);
        if (!cancelled) {setNetworkError('');if (updated) {revision = updated.revision;setJob(updated);finished = updated.status !== 'running';}}
      } catch (e) {if (!cancelled) setNetworkError((e as Error).message);}
      if (!cancelled && !finished) timer = setTimeout(poll, 900);
    }
    void poll();return () => {cancelled = true;clearTimeout(timer);};
  }, [connection, job?.id, job?.status, demo, provider]);
  useEffect(() => {
    if (!connection || !selected || job || demo || loading || busy || tab !== 'chats') return;
    let cancelled = false,timer: ReturnType<typeof setTimeout>;
    const epoch = navigation.current;
    async function sync() {
      try {
        const data = await request<{messages: ChatMessage[];previous: number | null;next: number | null;}>(connection!, `/sessions/${encodeURIComponent(selected!.sessionId)}/messages?provider=${provider}&window=${historyWindow.current}${fromStart ? '&from=start' : ''}`);
        if (!cancelled && epoch === navigation.current && !sending.current) {setHistory(data.messages);setHasMore(fromStart ? data.next : data.previous);setHistoryError('');}
      } catch (e) {if (!cancelled) setHistoryError((e as Error).message);}
      if (!cancelled) timer = setTimeout(sync, 3000);
    }
    timer = setTimeout(sync, 3000);
    return () => {cancelled = true;clearTimeout(timer);};
  }, [connection, selected?.sessionId, job?.id, demo, loading, busy, tab, fromStart, provider]);
  useEffect(() => {
    // Keep the live answer until the host has flushed it to session history.
    // Only then can normal desktop history polling take over without duplicates.
    if (!connection || demo || job?.status !== 'done' || !job.sessionId || busy || loading || fromStart || tab !== 'chats') return;
    const completed = job, lastAnswer = [...completed.messages].reverse().find(message => message.role === 'assistant');
    if (!lastAnswer) return;
    const epoch = navigation.current;
    let cancelled = false, timer:ReturnType<typeof setTimeout>;
    async function syncCompleted() {
      try {
        const data = await request<{messages:ChatMessage[];previous:number|null}>(connection!, `/sessions/${encodeURIComponent(completed.sessionId!)}/messages?provider=${provider}&window=${historyWindow.current}`);
        if (cancelled || epoch !== navigation.current || sending.current) return;
        if (data.messages.some(message => message.id === lastAnswer!.id)) {
          setHistory(data.messages);setHasMore(data.previous);setHistoryError('');setJob(null);
          setSelected(old => old?.sessionId === completed.sessionId ? old : sessions.find(session => session.sessionId === completed.sessionId) || {sessionId:completed.sessionId!,provider,cwd:completed.cwd,summary:t("Текущая задача"),lastModified:completed.startedAt});
          return;
        }
      } catch (error) {if (!cancelled && epoch === navigation.current) setHistoryError((error as Error).message);}
      if (!cancelled && epoch === navigation.current) timer = setTimeout(syncCompleted,3000);
    }
    void syncCompleted();return () => {cancelled=true;clearTimeout(timer);};
  },[connection,provider,job?.id,job?.status,demo,busy,loading,fromStart,tab]);
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=lastScrollTop.current;},[provider,tab]);
  useEffect(() => {if (nearBottom.current) bottom.current?.scrollIntoView({ behavior: 'smooth' });}, [history.length, job?.revision]);
  async function loadHistory(s: Session, active: JobView | null, epoch: number, older = false, beginning = fromStart) {
    if (older) historyWindow.current = Math.min(5000, historyWindow.current + 100);
    const data = await api<{messages: ChatMessage[];previous: number | null;next: number | null;}>(`/sessions/${encodeURIComponent(s.sessionId)}/messages?provider=${provider}&window=${historyWindow.current}${beginning ? '&from=start' : ''}${active ? `&end=${active.baseMessageCount}` : ''}`);
    if (epoch !== navigation.current) return;
    setHistory(data.messages);setHasMore(beginning ? data.next : data.previous);setHistoryError('');
  }
  async function jumpHistory(beginning: boolean) {
    if (loading || busy) return;
    const epoch = ++navigation.current;
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
  async function openSession(s: Session, activeJob?: JobView) {
    if (busy || uploading) return;
    rememberDraft();
    const epoch = ++navigation.current;setSelected(s);setCwd(s.cwd || health!.roots[0]);setMobileChat(true);setTab('chats');
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    setHistory([]);setJob(null);restoreDraft(activeJob?.sessionId||s.sessionId);setError('');setTakeover(false);setHasMore(null);nearBottom.current = true;
    if (demo) {setHistory(demoMessages);return;}
    setLoading(true);
    try {
      const active = activeJob || jobs.find((j) => j.sessionId === s.sessionId && j.status === 'running');
      const full = active ? await api<JobView>(`/jobs/${active.id}`) : null;
      if (epoch !== navigation.current) return;
      setJob(full);setTakeover(Boolean(full));
      if (!s.sessionId.startsWith('pending-')) await loadHistory(s, full, epoch, false, false);
    } catch (e) {if (epoch === navigation.current) setError((e as Error).message);} finally {if (epoch === navigation.current) setLoading(false);}
  }
  function newChat(project = cwd) {
    if (busy || uploading) return;
    rememberDraft();navigation.current++;setSelected(null);setHistory([]);setJob(null);restoreDraft(`new:${project}`);setError('');setHasMore(null);
    historyWindow.current = 100;setHistoryError('');setFromStart(false);setShowScrollActions(false);lastScrollTop.current = 0;
    setCwd(project);setMobileChat(true);setTab('chats');setTakeover(true);setLoading(false);
  }
  async function send(confirmed = takeover) {
    if (sending.current || running || loading || uploading || demo || !canRun || selected?.readOnly || !draft.trim() && !attachments.length) return;
    const sessionId = job?.sessionId || selected?.sessionId;
    if (sessionId && !confirmed) {setPendingTakeover(true);return;}
    sending.current = true;setBusy(true);setError('');
    const epoch = ++navigation.current;
    const data = { provider, cwd, sessionId, text: draft, attachments: attachments.map((a) => a.id), model, mode, ...(provider==='claude'?{maxBudgetUsd:budget}:{}), takeoverConfirmed: confirmed };
    const signature = JSON.stringify(data);
    const id = retry.current?.signature === signature ? retry.current.id : crypto.randomUUID();retry.current = { signature, id };
    try {
      const next = await api<JobView>('/jobs', { ...data, id });
      if (epoch !== navigation.current) return;
      // Freeze the displayed history before the next turn; the server saves full history independently.
      if (job) setHistory((old) => [...old, ...job.messages]);
      drafts.current!.delete(currentDraftKey());
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
        if (epoch === navigation.current) setAttachments((old) => [...old, a]);
      }
    } catch (e) {setError((e as Error).message);} finally {setUploading(false);if (fileInput.current) fileInput.current.value = '';}
  }
  function startDemo() {setDemo(true);setSessions(demoSessions);setHealth({ name: t("Рабочий компьютер"), roots: ['D:\\Projects\\my-app'], version: '0.10.0', protocol: 1 });setCwd('D:\\Projects\\my-app');setSelected(demoSessions[0]);setHistory(demoMessages);}
  async function disconnect() {try {await saveConnection(null);onDisconnect();}catch(e){setError((e as Error).message);}}
  if (!health) return <Connect initial={saved} onConnect={connect} onDemo={startDemo} busy={busy} error={error} />;
  const visible = sessions.filter((s) => `${s.customTitle || ""} ${s.summary} ${s.cwd}`.toLowerCase().includes(search.toLowerCase()));
  const workspacePicker = (location:'sidebar'|'header') => <label className={`workspace-picker workspace-picker-${location}`}><span>{t("Рабочее пространство")}</span><select aria-label={t("Рабочее пространство")} value={provider} disabled={demo} onChange={event=>setProvider(event.target.value as WorkspaceProvider)}><option value="claude">Claude</option><option value="codex">Codex</option></select></label>;
  return <div className={`app ${mobileChat ? 'show-chat' : ''}`}>
    <aside className="sidebar"><div className="brand"><span className="logo"><Terminal size={21} /></span><strong>Pocket<span>Code</span></strong><span className="version">BETA</span></div>
      {workspacePicker('sidebar')}
      <div className="host-card"><div className="host-icon"><Laptop size={20} /></div><div><strong>{health.name}</strong><span><i className={networkError ? 'offline' : ''} />{demo ? t("Демонстрация") : networkError ? t("Нет связи") : t("Компьютер подключён")}</span></div><Wifi size={16} /></div>
      <button className="primary new-chat" disabled={busy || uploading} onClick={() => newChat()}><Plus size={18} />{t("Новый чат")}<span>↗</span></button>
      <button className="terminal-entry secondary" disabled={busy || uploading} onClick={() => {setTab('terminal');setMobileChat(true);}}><Terminal size={17} />{t("Живой терминал")}<span>CLI</span></button><nav className="desktop-tabs"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => {setTab('jobs');setMobileChat(true);}}><ClipboardList size={17} />Jobs</button><button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}><MessageSquare size={17} />{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}><Folder size={17} />{t("Файлы")}</button></nav>
      <div className="search"><Search size={16} /><input aria-label={t("Найти чат")} placeholder={t("Найти в чатах")} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="session-list"><div className="list-label">{t("ВАШИ ЧАТЫ ")}<span>{visible.length}</span></div>
        {jobs.filter((j) => j.status === 'running' && !sessions.some((s) => s.sessionId === j.sessionId)).map((j) => <button className="session-row" key={j.id} onClick={() => void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: t("Текущая задача"), cwd: j.cwd, lastModified: j.startedAt }, j)}><span className="pulse-dot" /><div><strong>{t("Текущая задача")}</strong><small>{basename(j.cwd)}</small></div></button>)}
        {visible.map((s) => <button className={`session-row ${selected?.sessionId === s.sessionId ? 'selected' : ''}`} disabled={busy || uploading} key={s.sessionId} onClick={() => void openSession(s)}><MessageSquare size={16} /><div><strong>{s.customTitle || s.summary || t("Без названия")}</strong><small>{s.source === 'desktop' ? 'Desktop · ' : ''}{basename(s.cwd || '')}{s.archived ? t(" · Архив") : ''}<span>·</span>{new Date(s.lastModified).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}</small></div>{jobs.some((j) => j.sessionId === s.sessionId && j.status === 'running') && <span className="pulse-dot" />}</button>)}
        {!visible.length && <div className="empty-list"><MessageSquare size={26} /><p>{search ? t("Ничего не найдено") : t("Здесь появятся чаты {0} из разрешённых папок.",engineName)}</p></div>}
      </div><div className="sidebar-footer"><ShieldCheck size={15} /><span>{t("Работа остаётся на вашем ПК")}</span><button aria-label={t("Настройки")} className="icon-button" onClick={() => setTab('settings')}><Settings size={18} /></button></div>
    </aside>
    <main className="workspace">
      {reviewOpen && connection && <Review key={provider} connection={connection} cwd={cwd} onClose={()=>setReviewOpen(false)}/>}
      <header className="chat-header"><button className="icon-button mobile-back" aria-label={t("К списку чатов")} onClick={() => setMobileChat(false)}><ArrowLeft size={21} /></button><div className="header-title"><label className="project-picker"><Folder size={14}/><select aria-label={t("Папка проекта")} title={cwd} value={cwd} disabled={busy||uploading} onChange={event=>newChat(event.target.value)}>{!health.roots.includes(cwd)&&<option value={cwd}>{basename(cwd)}</option>}{health.roots.map(root=><option key={root} value={root}>{basename(root)}</option>)}</select></label><strong>{tab === 'jobs' ? 'Jobs' : tab === 'settings' ? t("Настройки") : tab === 'files' ? t("Файлы проекта") : selected?.customTitle || selected?.summary || t("Новый разговор")}</strong></div>{workspacePicker('header')}<span className="branch"><GitBranch size={13} />{selected?.gitBranch || 'local'}</span><button className="secondary review-button" aria-label="Review" disabled={!connection||demo||selected?.readOnly} onClick={()=>setReviewOpen(true)}>Review</button><button className="icon-button" aria-label={t("Файлы проекта")} onClick={() => setTab(tab === 'files' ? 'chats' : 'files')}><Folder size={19} /></button></header>
      {demo && <div className="demo-banner">{t("Демо · пример интерфейса, без подключения к Claude")}<button onClick={() => void disconnect()}>{t("Подключить ПК →")}</button></div>}
      {historyError && <div className="network-banner" role="status">{t("История не обновилась: ")}{t(historyError)}</div>}
      {networkError && <div className="network-banner" role="status"><RefreshCw size={14} />{t(networkError)}</div>}
      {!canRun && !demo && <div className="network-banner" role="status">{providerInfo?.error ? t(providerInfo.error) : providerInfo ? t("{0} недоступен. Установите приложение и войдите в аккаунт на ПК.",engineName) : t("Обновите сервер на ПК, чтобы включить рабочее пространство Codex.")}</div>}
      <Updates connection={connection} expanded={tab === 'settings'} />
      {tab === 'jobs' ? <JiraJobs key={provider} provider={provider} connection={connection} roots={health.roots} jobs={jobs} budget={budget} onSettings={() => setTab('settings')} onOpen={(j) => {void openSession({ sessionId: j.sessionId || `pending-${j.id}`, summary: j.jira ? `${j.jira.key}: ${j.jira.summary}` : t("Задача {0}",engineName), cwd: j.cwd, lastModified: j.startedAt }, j);}} /> : tab === 'terminal' ? provider === 'codex' ? <div className="center-message">{t("Терминал доступен в рабочем пространстве Claude. С Codex можно работать в чате.")}</div> : connection && !demo && !selected?.readOnly ? <LiveTerminal connection={connection} cwd={cwd} sessionId={selected?.sessionId} /> : <div className="center-message">{t("Живой терминал доступен после подключения к ПК.")}</div> : tab === 'files' ? connection && !demo && !selected?.readOnly ? <Files key={provider} connection={connection} root={cwd} onProject={newChat} /> : <div className="center-message">{t("Файлы доступны после подключения к ПК.")}</div> : tab === 'settings' ? <section className="settings-panel"><LanguageSelector /><JiraSettings connection={connection} /><AppearanceSettings {...appearanceSettings} /><div className="eyebrow">{t("ВАШ РАБОЧИЙ КОМПЬЮТЕР")}</div><h2>{health.name}</h2><p className="muted">{connection?.url || t("Демонстрационный режим")}</p><label>{t("Папка для новых чатов")}<select value={health.roots.includes(cwd) ? cwd : ''} onChange={(e) => newChat(e.target.value)}>{!health.roots.includes(cwd) && <option value="">{cwd}</option>}{health.roots.map((r) => <option key={r}>{r}</option>)}</select></label>{provider==='claude' && <><label>{t("Лимит стоимости одного запроса, $")}<input type="number" min="0.1" max="100" step="0.1" value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></label><p className="muted">{t("Оценка Agent SDK. Фактическая оплата зависит от способа входа в Claude. Лимит применяется к следующему сообщению.")}</p></>}<div className="info-card"><ShieldCheck size={20} /><p>{t("Для интернета используйте Tailscale на ПК и телефоне или HTTPS. В домашнем Wi-Fi HTTP не шифрует трафик; Tailscale шифрует соединение в обеих сетях.")}</p></div><p className="muted">{t("Чаты продолжаются через {0} на ПК. Перед продолжением старого чата дождитесь завершения ответа на ПК. Действующие задачи не останавливаются при отключении телефона.",engineName)}</p><button className="secondary" onClick={() => void disconnect()}><LogOut size={17} />{t("Отключить и забыть ключ")}</button></section> : <>
        <div className="conversation" ref={scroll} onScroll={() => {const el = scroll.current!;nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;if (nearBottom.current && !fromStart) setShowScrollActions(false);else if (el.scrollTop < lastScrollTop.current - 2) setShowScrollActions(true);lastScrollTop.current = el.scrollTop;}}>
          <div className="conversation-inner">{selected && !demo && <p className="muted" role="status">{selected.source === 'desktop' ? `${engineName} Desktop · ` : ''}{job ? t("Продолжение с телефона") : t("История обновляется каждые 3 секунды")}</p>}{selected?.readOnly && <p className="info-card">{t("Только просмотр. Чтобы продолжить чат и работать с файлами, запустите сервер с папкой этого проекта: ")}{cwd}</p>}<div className="conversation-date"><span />{demo ? t("ПРИМЕР РАЗГОВОРА") : t("РАБОЧЕЕ ПРОСТРАНСТВО")}<span /></div>
            {loading && <div className="center-message">{t("Загружаем историю с ПК…")}</div>}
            {!loading && !history.length && !job && !selected && <div className="welcome"><div className="welcome-symbol">✳</div><h1>{t("Что создадим сегодня?")}</h1><p>{t("Файлы, инструменты и контекст вашего ПК.")}<br />{t("Теперь под рукой.")}</p><div className="suggestions">{[t("Изучи структуру проекта"), t("Помоги найти и исправить ошибку"), t("Составь план новой функции")].map((t) => <button key={t} onClick={() => setDraft(t)}>{t}<ArrowUp size={15} /></button>)}</div></div>}
            {!loading && selected && !history.length && !job && <p className="muted">{t("В локальной истории пока нет сообщений. Проверьте, что этот чат открыт в {0} на ПК.",engineName)}</p>}
            {history.map((m, i) => <Message key={`${provider}-${m.id}-${i}`} provider={provider} message={m} />)}
            {hasMore !== null && <button className="secondary" disabled={loading || historyWindow.current >= 5000} onClick={async () => {setLoading(true);try {await loadHistory(selected!, job, navigation.current, true);} catch (e) {setError((e as Error).message);} finally {setLoading(false);}}}>{historyWindow.current >= 5000 ? t("Достигнут предел окна: 5000 сообщений") : fromStart ? t("Загрузить следующие сообщения") : t("Загрузить предыдущие сообщения")}</button>}
            {job?.messages.map((m, i) => <Message key={`${provider}-${job.id}-${m.id}-${i}`} provider={provider} message={m} />)}
            {job?.partial && <Message key={provider} provider={provider} message={{ id: 'partial', role: 'assistant', blocks: [{ type: 'text', text: job.partial }] }} />}
            {job?.approvals.map((a) => <ApprovalCard key={`${provider}-${a.id}`} provider={provider} approval={a} decide={async (allow, answers) => {await api(`/jobs/${job.id}/approvals/${a.id}`, { allow, answers });}} />)}
            {running && <div className="working"><span className="pulse-dot" />{job.approvals.length ? t("{0} ждёт вашего решения",engineName) : t("{0} работает на компьютере…",engineName)}</div>}
            {job?.error && <div className="error">{t(job.error)}</div>}{job?.status === 'stopped' && <p className="muted">{t("Задача остановлена. Можно отправить новое сообщение.")}</p>}
            {job?.status === 'done' && <div className="turn-complete" role="status"><ShieldCheck size={13} />{t(" Готово ")}{job.cost !== undefined && <span>· ${job.cost.toFixed(4)}</span>}</div>}
            <div ref={bottom} />
          </div>
        </div>
        <div className="chat-scroll-actions" hidden={!showScrollActions && !fromStart} style={!showScrollActions && !fromStart ? { display: 'none' } : undefined}><button className="secondary" disabled={loading || busy} onClick={() => void jumpHistory(true)}><ArrowUp size={16} />{t("В начало чата")}</button><button className="secondary" disabled={loading || busy} onClick={() => void jumpHistory(false)}>{t("К новым сообщениям ↓")}</button></div>
        <div className="composer-area">{error && <div className="error" role="alert">{t(error)}<button aria-label={t("Закрыть ошибку")} className="icon-button" onClick={() => setError('')}><X size={14} /></button></div>}
          <div className="composer">{attachments.length > 0 && <div className="attachment-list">{attachments.map((a) => <span className="attachment-chip" key={a.id}><Paperclip size={13} />{a.name}<button className="icon-button" aria-label={t("Убрать {0}", a.name)} onClick={() => setAttachments((old) => old.filter((x) => x.id !== a.id))}><X size={13} /></button></span>)}</div>}
            <textarea aria-label={t("Сообщение {0}",engineName)} placeholder={demo ? t("Подключите ПК, чтобы отправлять сообщения") : t("Что нужно сделать?")} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={demo || busy || selected?.readOnly} onKeyDown={(e) => {if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault();void send();}}} />
            <div className="composer-tools"><input hidden ref={fileInput} type="file" multiple onChange={(e) => void upload(e.target.files)} /><button className="icon-button" aria-label={t("Прикрепить файлы")} disabled={demo || uploading || busy || running || selected?.readOnly} onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><select aria-label={t("Модель {0}",engineName)} value={model} onChange={(e) => setModel(e.target.value)}><option value="">{t("По умолчанию")}</option>{(provider === 'claude' ? [{id:'sonnet',name:'Sonnet'},{id:'opus',name:'Opus'},{id:'haiku',name:'Haiku'}] : providerInfo?.models || []).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="mode-select" aria-label={t("Режим работы")} value={mode} onChange={(e) => setMode(e.target.value)}><option value="default">{t("Обычный")}</option><option value="plan">{t("План")}</option></select><span className="composer-spacer" />{running ? <button className="send-button stop-button" aria-label={t("Остановить {0}",engineName)} onClick={async () => {try {await api(`/jobs/${job!.id}/stop`, {});} catch (e) {setError((e as Error).message);}}}><Square size={16} /></button> : <button className="send-button" aria-label={t("Отправить сообщение")} disabled={demo || !canRun || selected?.readOnly || busy || loading || uploading || !draft.trim() && !attachments.length} onClick={() => void send()}><ArrowUp size={21} /></button>}</div>
          </div><div className="composer-caption" role="status"><span className={`status-light ${networkError ? "offline" : ""}`} />{networkError ? t("Связь потеряна · повторяем подключение") : uploading ? t("Передаём файлы на ПК…") : running ? job?.approvals.length ? t("Ожидается ваше решение") : t("{0} работает",engineName) : t("{0} · подключён к ПК",engineName)}<span className="desktop-only">{t("Ctrl + Enter для отправки")}</span></div>
        </div>
      </>}
    </main>
    <nav className="mobile-nav"><button className={tab === 'jobs' ? 'active' : ''} onClick={() => {setTab('jobs');setMobileChat(true);}}><ClipboardList size={20} />Jobs</button><button className={tab === 'terminal' ? 'active' : ''} onClick={() => {setTab('terminal');setMobileChat(true);}}><Terminal size={20} />{t("Терминал")}</button><button className={tab === 'chats' ? 'active' : ''} onClick={() => {setTab('chats');setMobileChat(false);}}><MessageSquare size={20} />{t("Чаты")}</button><button className={tab === 'files' ? 'active' : ''} onClick={() => {setTab('files');setMobileChat(true);}}><Folder size={20} />{t("Файлы")}</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => {setTab('settings');setMobileChat(true);}}><Settings size={20} />{t("Настройки")}</button></nav>
    {pendingTakeover && <div className="modal-backdrop"><section ref={confirmation} className="confirm-modal" role="dialog" aria-modal="true" aria-label={t("Продолжить чат с телефона?")}><Terminal size={28} /><h2>{t("Продолжить чат с телефона?")}</h2><p>{t("Сначала дождитесь завершения ответа в {0} на ПК. Одновременная работа с одной историей может вызвать конфликт.",engineName)}</p><button className="primary" onClick={() => {setPendingTakeover(false);setTakeover(true);void send(true);}}>{t("На ПК завершено — продолжить")}</button><button className="text-button" onClick={() => setPendingTakeover(false)}>{t("Отмена")}</button></section></div>}
  </div>;
}
