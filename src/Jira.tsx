import { t, locale, getLanguage } from "./i18n";import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { RefreshCw, Play, ExternalLink, Link2 } from 'lucide-react';
import { providerRequest, type Connection } from './api';
import type { JiraIssue, JiraSite } from '../server/jira';
import type { JobView } from '../server/types';
import type {CodexAccess} from './preferences';
import type { QueueItem } from '../server/jira-queue';
import './jira.css';
import {useModal} from './navigation';
import {JiraWorkflow,type JiraLink} from './JiraWorkflow';
import {useJiraRole,setJiraRole,jiraRoleLabel,jiraStartLabel,type JiraRole} from './jira-preferences';

const Login = registerPlugin<{
  prepare(): Promise<{redirectUrl: string;}>;
  open(options: {url: string;state: string;language: string;}): Promise<{code: string;state: string;issuer?: string;}>;
  cancel(): Promise<void>;
}>('JiraLogin');
type Status = {error?: string;source?: 'claude'|'codex'|'copilot';connected: boolean;sites: JiraSite[];};
export function JiraSettings({ connection,provider='claude' }: {connection: Connection | null;provider?:'claude'|'codex'|'copilot'}) {
  const request=providerRequest(provider);
  const role=useJiraRole();
  const [status, setStatus] = useState<Status | null>(null),[busy, setBusy] = useState(false),[error, setError] = useState('');
  const attempt = useRef(0);
  useEffect(() => {
    let cancelled = false;
    if (connection) request<Status>(connection, '/jira/status').then((s) => {if (!cancelled) {setStatus(s);setError(s.error || "");}}).catch((e) => {if (!cancelled) setError(e.message);});
    return () => {cancelled = true;attempt.current++;void Login.cancel().catch(() => {});};
  }, [connection,provider]);
  async function connect() {
    if (!connection || busy) return;
    if (Boolean(status?.source)) {setBusy(true);setError('');try {const next = await request<Status>(connection, '/jira/connect-existing', {});setStatus(next);setError(next.error || "");} catch(e) {setError((e as Error).message);} finally {setBusy(false);}return;}
    if (!Capacitor.isNativePlatform()) {setError(t("Вход Jira доступен в Android-приложении. Откройте на телефоне Настройки → Jira → Connect."));return;}
    const current = ++attempt.current;setBusy(true);setError('');
    try {
      const { redirectUrl } = await Login.prepare();
      const login = await request<{authorizationUrl: string;state: string;}>(connection, '/jira/connect', { redirectUrl });
      if (current !== attempt.current) return;
      const callback = await Login.open({ language: getLanguage(), url: login.authorizationUrl, state: login.state });
      if (current !== attempt.current) return;
      await request(connection, '/jira/finish', callback);
      if (current === attempt.current) setStatus(await request<Status>(connection, '/jira/status'));
    } catch (e) {if (current === attempt.current) setError((e as Error).message);} finally
    {if (current === attempt.current) {setBusy(false);void Login.cancel().catch(() => {});}}
  }
  async function disconnect() {
    if (!connection) return;
    ++attempt.current;setBusy(true);setError('');
    try {await Login.cancel().catch(() => {});await request(connection, '/jira/disconnect', {});setStatus({ connected: false, sites: [], source: status?.source });}
    catch (e) {setError((e as Error).message);} finally
    {setBusy(false);}
  }
  return <section className="jira-settings" aria-label={t("Подключение Jira")}><div className="eyebrow">{t("ИНТЕГРАЦИИ")}</div><h2>Jira</h2>
    <p className="muted">{status?.source === 'codex' ? (getLanguage()==='ru'?'Jira использует прямой Atlassian MCP через Codex на ПК, без обращения к модели.':'Jira uses direct Atlassian MCP through Codex on your PC, without a model turn.') : status?.source === "claude" ? t("Jira подключена через существующий Atlassian MCP в Claude на ПК. Отдельный вход не нужен.") : t("Войдите в Atlassian на телефоне. В Jobs появятся все задачи, назначенные на вас, включая завершённые.")}</p>
    <p className="muted">{getLanguage()==='ru'?'Общее подключение для Claude и Codex выбирается на ПК: окно с QR → Jira. AI для задачи выбирается отдельно.':'Choose the shared connection for Claude and Codex on your PC: QR window → Jira. The task AI is selected separately.'}</p>
    {status?.connected && <p className="jira-connected">{t("Подключено · ")}{status.sites.map((s) => s.name).join(', ') || t("Нет доступных сайтов Jira")}</p>}
    {busy && <p role="status">{status?.source === 'codex' ? (getLanguage()==='ru'?'Подключаем инструменты Jira в Codex…':'Connecting Jira tools in Codex…') : status?.source === "claude" ? t("Читаем Jira через Claude на ПК…") : t("Завершите вход в браузере и вернитесь в Pocket Code. Ожидаем до 5 минут.")}</p>}
    {error && <p className="error" role="alert">{t(error)}</p>}
    {!status?.connected && !busy && <button className="primary" disabled={!connection||!status} onClick={() => void connect()}><Link2 size={16} />{status?.source === 'codex' ? (getLanguage()==='ru'?'Использовать подключение Codex':'Use Codex connection') : status?.source === "claude" ? t("Использовать подключение Claude") : "Connect"}</button>}
    {(status?.connected || busy || error) && <button className="secondary" onClick={() => void disconnect()}>{busy ? t("Отменить вход") : status?.connected ? t("Отключить Jira") : t("Сбросить вход")}</button>}
    <p className="muted">{status?.source === 'codex' ? (getLanguage()==='ru'?'Отключение здесь не удаляет коннектор из Codex. При отсутствии доступа автоматического переключения на Claude нет.':'Disconnecting here does not remove the Codex connector. Unavailable access never silently falls back to Claude.') : status?.source === "claude" ? t("Чтение задач использует Claude на ПК и его лимиты. Отключение здесь не отключает коннектор в Claude.") : t("Доступ хранится на ПК в защищённом хранилище Windows. Отключение удаляет его из Pocket Code; разрешение Atlassian можно отозвать в настройках аккаунта.")}</p>
    <label className="jira-role-setting">{t('Роль в Jira')}<select value={role} onChange={event=>setJiraRole(event.target.value as JiraRole)}>{(['developer','reviewer','qa'] as const).map(item=><option key={item} value={item}>{t(jiraRoleLabel(item))}</option>)}</select></label><p className="muted">{t('Роль определяет доступные действия в задачах. Права вашего аккаунта Jira остаются прежними.')}</p>
  </section>;
}
export function JiraJobs({connection,roots,jobs,budget,onOpen,onSettings,provider='claude',codexAccess='full',onOpenLinked,notificationTarget,onNotificationOpened}:{notificationTarget?:{id:string;site:string;issue:JiraIssue}|null;onNotificationOpened?:()=>void;provider?:'claude'|'codex'|'copilot';codexAccess?:CodexAccess;connection:Connection|null;roots:string[];jobs:JobView[];budget:number;onOpen(job:JobView):void;onSettings():void;onOpenLinked?(link:JiraLink):void}){
 const request=providerRequest(provider);
  const role=useJiraRole();
  const [status,setStatus]=useState<Status|null>(null),[site,setSite]=useState(''),[issues,setIssues]=useState<JiraIssue[]>([]),[next,setNext]=useState<string|null>(null);
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[updated,setUpdated]=useState(0);
  const [filters,setFilters]=useState({project:'',status:'',type:''}),[filterDraft,setFilterDraft]=useState({project:'',status:'',type:''});
  const [suggestions,setSuggestions]=useState({project:[] as string[],status:[] as string[],type:[] as string[]});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[batchBusy,setBatchBusy]=useState(false),[controlBusy,setControlBusy]=useState(false);
  const [checked,setChecked]=useState<Map<string,JiraIssue>>(new Map()),[selecting,setSelecting]=useState(false),[selected,setSelected]=useState<JiraIssue|null>(null);
  const [queue,setQueue]=useState<{paused:boolean;items:QueueItem[]}|null>(null),[queueOpen,setQueueOpen]=useState(false),[batchOpen,setBatchOpen]=useState(false);
  const [cwd,setCwd]=useState(roots[0]||''),[mode,setMode]=useState<'default'|'plan'>('default');
  const epoch=useRef(0),loading=useRef<symbol|null>(null),alive=useRef(true),batchId=useRef<{signature:string;id:string}|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{}),dialog=useRef<HTMLElement|null>(null);
  useModal(dialog,batchOpen,()=>{if(!batchBusy)setBatchOpen(false);});
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
  useEffect(()=>{const timer=setTimeout(()=>setQuery(search.trim()),400);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    setStatus(null);setSite('');setChecked(new Map());setSelected(null);setQueue(null);setBatchOpen(false);setSelecting(false);epoch.current++;
    if(!connection)return;let cancelled=false;
    request<Status>(connection,'/jira/status').then(value=>{if(!cancelled){setStatus(value);setSite(value.sites[0]?.id||'');setError(value.error||'');}}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[connection,provider]);
  useEffect(()=>{setChecked(new Map());setSelected(null);setBatchOpen(false);batchId.current=null;setSuggestions({project:[],status:[],type:[]});setFilters({project:'',status:'',type:''});setFilterDraft({project:'',status:'',type:''});},[site]);
  useEffect(()=>{if(!notificationTarget||!status)return;if(site!==notificationTarget.site){setSite(notificationTarget.site);return;}setSelected(notificationTarget.issue);onNotificationOpened?.();},[notificationTarget,status,site]);
  useEffect(()=>{
    if(!connection)return;let cancelled=false,timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const value=await request<{paused:boolean;items:QueueItem[]}>(connection!,'/jira/queue'+('?provider='+provider));if(!cancelled)setQueue(value);}catch{/* Queue refresh must not block browsing issues. */}if(!cancelled)timer=setTimeout(poll,3000);}
    void poll();return()=>{cancelled=true;clearTimeout(timer);};
  },[connection,provider]);
  const issueUrl=(cursor?:string)=>{const params=new URLSearchParams({site});if(query)params.set('search',query);if(category)params.set('statusCategory',category);for(const [key,value] of Object.entries(filters))if(value)params.set(key,value);if(cursor)params.set('cursor',cursor);return '/jira/issues?'+params;};
  async function refresh(cursor?:string){
    if(!connection||!site||loading.current)return;
    const current=epoch.current,requestId=Symbol();loading.current=requestId;setBusy(true);
    try{
      let pageCursor=cursor,data:{issues:JiraIssue[];next:string|null},pages=0;const seen=new Set<string>();
      do{
        data=await request(connection,issueUrl(pageCursor));if(!alive.current||current!==epoch.current)return;
        if(data.next&&seen.has(data.next))throw new Error(t('Jira повторила страницу. Попробуйте обновить список.'));
        if(data.next)seen.add(data.next);pageCursor=data.next||undefined;pages++;
      }while(!data.issues.length&&data.next&&pages<20);
      setSuggestions(old=>({project:[...new Set([...old.project,...data.issues.map(i=>i.projectKey||i.key.split('-')[0])])].sort(),status:[...new Set([...old.status,...data.issues.map(i=>i.status)])].filter(Boolean).sort(),type:[...new Set([...old.type,...data.issues.map(i=>i.issueType||'')])].filter(Boolean).sort()}));
      setIssues(old=>[...new Map([...(cursor?old:[]),...data.issues].map(issue=>[issue.key,issue])).values()]);setNext(data.next);setUpdated(Date.now());setError('');
    }catch(e){if(alive.current&&current===epoch.current)setError((e as Error).message);}
    finally{if(loading.current===requestId){loading.current=null;if(alive.current)setBusy(false);}}
  }
  refreshRef.current=()=>refresh();
  useEffect(()=>{
    epoch.current++;loading.current=null;setChecked(new Map());setIssues([]);setNext(null);void refreshRef.current();
    const timer=setInterval(()=>void refreshRef.current(),60000);return()=>{clearInterval(timer);epoch.current++;};
  },[connection,site,query,category,filters]);
  async function selectAll(){
    if(!connection||!site||busy||batchBusy||search.trim()!==query)return;
    const current=epoch.current;setBatchBusy(true);setError('');
    try{
      let cursor:string|undefined;const all=new Map<string,JiraIssue>(),seen=new Set<string>();
      do{const data:{issues:JiraIssue[];next:string|null}=await request(connection,issueUrl(cursor));if(!alive.current||current!==epoch.current)return;
        data.issues.forEach(issue=>all.set(issue.key,issue));if(all.size>5000)throw new Error(t('Найдено более 5000 задач. Выберите меньшую пачку.'));
        cursor=data.next||undefined;if(cursor&&seen.has(cursor))throw new Error(t('Jira повторила страницу. Попробуйте обновить список.'));if(cursor)seen.add(cursor);
      }while(cursor);
      setIssues([...all.values()]);setNext(null);setChecked(old=>new Map([...old,...all]));setUpdated(Date.now());
    }catch(e){if(alive.current&&current===epoch.current)setError((e as Error).message);}finally{if(alive.current)setBatchBusy(false);}
  }
  async function enqueue(){
    if(!connection||!site||!checked.size||batchBusy||!cwd)return;
    const current=epoch.current;setBatchBusy(true);setError('');
    const body={provider,role,site,keys:[...checked.keys()].sort(),cwd,mode:role==='developer'?mode:'plan',maxBudgetUsd:budget,...(provider==='codex'?{codexAccess}:{})},signature=JSON.stringify(body);
    if(batchId.current?.signature!==signature)batchId.current={signature,id:crypto.randomUUID()};
    try{const value=await request<{paused:boolean;items:QueueItem[]}>(connection,'/jira/queue',{...body,batchId:batchId.current.id});if(alive.current&&current===epoch.current){setQueue(value);setQueueOpen(true);setChecked(new Map());setSelecting(false);setBatchOpen(false);batchId.current=null;}}
    catch(e){if(alive.current&&current===epoch.current)setError((e as Error).message);}finally{if(alive.current)setBatchBusy(false);}
  }
  async function control(action:'pause'|'resume'|'clear'){
    if(!connection||controlBusy)return;setControlBusy(true);
    try{setQueue(await request(connection,'/jira/queue/control',{action,provider}));}catch(e){setError((e as Error).message);}finally{if(alive.current)setControlBusy(false);}
  }
  const related=(key:string)=>jobs.filter(job=>job.jira?.site===site&&job.jira.key===key).sort((a,b)=>b.startedAt-a.startedAt)[0];
  if(connection&&selected)return <section className="jobs-panel"><JiraWorkflow connection={connection} site={site} issue={selected} provider={provider} codexAccess={codexAccess} role={role} roots={roots} budget={budget} jobs={jobs} onBack={()=>setSelected(null)} onOpen={onOpen} onOpenLinked={onOpenLinked} onChanged={issue=>{setSelected(old=>old?.key===issue.key?issue:old);setIssues(old=>old.map(item=>item.key===issue.key?issue:item));}}/></section>;
  return <section className="jobs-panel">
    {error&&!batchOpen&&<p className="error" role="alert">{t(error)}</p>}
    {!connection||status?.connected===false?<div className="jira-empty"><h3>{t('Подключите Jira')}</h3><p>{t('Войдите через Connect в настройках, чтобы загрузить назначенные вам задачи.')}</p><button className="primary" onClick={onSettings}>{t('Открыть настройки Jira')}</button></div>:!status?<p className="muted" role="status">{t('Проверяем подключение Jira…')}</p>:<>
      {!status.sites.length&&<p className="muted">{t('У аккаунта нет доступных сайтов Jira. Проверьте доступ Atlassian MCP и подключитесь повторно в настройках.')}</p>}
      {status.sites.length>1&&<details className="jira-site-picker"><summary>{t('Сайт Jira')}: {status.sites.find(item=>item.id===site)?.name}</summary><label>{t('Сайт Jira')}<select aria-label={t('Сайт Jira')} value={site} disabled={batchBusy} onChange={event=>setSite(event.target.value)}>{status.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></details>}
      <div className="jira-filters"><div className="jira-search-tools"><label>{t('Поиск задач')}<input type="search" value={search} disabled={batchBusy} placeholder={t('Ключ или название задачи')} onChange={event=>setSearch(event.target.value)}/></label><button className="icon-button" aria-label={t('Обновить задачи')} disabled={busy||!site} onClick={()=>void refresh()}><RefreshCw size={20}/></button></div><label>{t('Категория статуса')}<select value={category} disabled={batchBusy} onChange={event=>setCategory(event.target.value)}><option value="">{t('Все назначенные')}</option><option value="new">{t('К выполнению')}</option><option value="indeterminate">{t('В работе')}</option><option value="done">{t('Готово')}</option></select></label></div>
      <details className="jira-more-filters"><summary>{t('Фильтры Jira')}{Object.values(filters).filter(Boolean).length? ' · '+Object.values(filters).filter(Boolean).length:''}</summary><form onSubmit={event=>{event.preventDefault();setFilters({...filterDraft});}}><p className="muted">{t('Подсказки из загруженных задач. Можно ввести другое значение Jira.')}</p>{(['project','status','type'] as const).map(key=><label key={key}>{t(key==='project'?'Проект Jira':key==='status'?'Статус':'Тип задачи')}<input maxLength={100} list={'jira-filter-'+key} value={filterDraft[key]} disabled={batchBusy} onChange={event=>setFilterDraft(old=>({...old,[key]:event.target.value}))}/><datalist id={'jira-filter-'+key}>{suggestions[key].map(value=><option key={value} value={value}/>)}</datalist></label>)}<div className="jira-form-actions"><button className="secondary" type="submit" disabled={batchBusy}>{t('Применить фильтры')}</button><button className="text-button" type="button" disabled={batchBusy} onClick={()=>{setFilters({project:'',status:'',type:''});setFilterDraft({project:'',status:'',type:''});setCategory('');setSearch('');}}>{t('Сбросить фильтры')}</button></div></form></details>
      <div className="jira-list-toolbar"><p className="muted">{busy?t('Загружаем задачи…'):t('Найдено: {0}',issues.length)}{updated&&!busy?` · ${t('обновлено {0}',new Date(updated).toLocaleTimeString(locale()))}`:''}</p>{!selecting?<button className="text-button" disabled={!site||busy} onClick={()=>setSelecting(true)}>{t('Выбрать задачи')}</button>:<button className="text-button" disabled={batchBusy} onClick={()=>{setSelecting(false);setChecked(new Map());}}>{t('Отменить выбор')}</button>}</div>
      {selecting&&<div className="jira-selection-controls"><button className="secondary" disabled={busy||batchBusy||!site||search.trim()!==query} onClick={()=>void selectAll()}>{batchBusy?t('Подождите…'):t('Выбрать все найденные')}</button><button className="text-button" disabled={!checked.size||batchBusy} onClick={()=>setChecked(new Map())}>{t('Снять выбор')}</button></div>}
      {queue&&queue.items.length>0&&<details className="jira-queue" open={queueOpen} onToggle={event=>setQueueOpen(event.currentTarget.open)}><summary>{t('Очередь задач')} · {queue.items.filter(item=>item.status==='queued').length} {t('ожидают')} · {queue.paused?t('на паузе'):t('в работе')}</summary><p className="muted">{t('Пауза действует после текущей задачи. После перезапуска сервера продолжение нужно включить вручную.')}</p><div className="jira-batch"><button className="secondary" disabled={controlBusy} onClick={()=>void control(queue.paused?'resume':'pause')}>{queue.paused?t('Продолжить очередь'):t('Пауза очереди')}</button><button className="text-button" disabled={controlBusy} onClick={()=>void control('clear')}>{t('Убрать ожидающие')}</button></div>{queue.items.slice(-20).map(item=>{const linked=jobs.find(job=>job.id===item.jobId);return <div className="jira-queue-item" key={item.id}><span>{item.key} · {t(item.status==='queued'?'В очереди':item.status==='running'?'Выполняется':item.status==='done'?'Завершено':item.status==='stopped'?'Остановлено':'Ошибка')}</span>{item.error&&<p className="error">{t(item.error)}</p>}{(linked||item.sessionId&&onOpenLinked)&&<button className="text-button" onClick={()=>linked?onOpen(linked):onOpenLinked?.({provider,cwd:item.cwd,jobId:item.jobId,sessionId:item.sessionId})}>{t('Открыть чат')}</button>}</div>;})}</details>}
      <div className="jira-issues">{issues.map(issue=>{const job=related(issue.key);return <article className="jira-issue" key={issue.key}><div className="jira-issue-meta">{selecting?<label className="jira-check"><input type="checkbox" aria-label={t('Выбрать {0}',issue.key)} checked={checked.has(issue.key)} disabled={batchBusy} onChange={event=>setChecked(old=>{const value=new Map(old);event.target.checked?value.set(issue.key,issue):value.delete(issue.key);return value;})}/>{issue.key}</label>:<span>{issue.key}</span>}<span>{issue.issueType}</span><span>{issue.status}</span></div><button className="jira-issue-title" onClick={()=>setSelected(issue)}>{issue.summary}</button>{job?.status==='running'&&<p className="muted">{t('{0} работает',provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude')}</p>}</article>;})}</div>
      {busy&&<p role="status" className="muted">{t('Загружаем задачи…')}</p>}{!busy&&site&&!issues.length&&!next&&<p className="jira-empty">{t('По этому запросу задач не найдено.')}</p>}{next&&<button className="secondary jira-load-more" disabled={busy||batchBusy} onClick={()=>void refresh(next)}>{t('Загрузить ещё задачи')}</button>}
      {selecting&&checked.size>0&&<div className="jira-selection-bar"><span>{t('Выбрано: {0}',checked.size)}</span><button className="primary" disabled={batchBusy} onClick={()=>{setBatchOpen(true);setError('');}}>{t('Продолжить')}</button></div>}
    </>}
    {batchOpen&&<div className="modal-backdrop"><section ref={dialog} className="confirm-modal jira-batch-dialog" role="dialog" aria-modal="true" aria-label={t('Запустить выбранные задачи')}><h2>{t('Запустить задачи ({0})?',checked.size)}</h2><p>{t('Роль')}: <strong>{t(jiraRoleLabel(role))}</strong> · {t(jiraStartLabel(role))}</p><details><summary>{t('Выбранные задачи')}</summary><ul>{[...checked.values()].map(issue=><li key={issue.key}>{issue.key}: {issue.summary}</li>)}</ul></details><label>{t('Папка проекта для {0}',provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude')}<select aria-label={t('Папка проекта для {0}',provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude')} value={cwd} disabled={batchBusy} onChange={event=>setCwd(event.target.value)}>{roots.map(root=><option key={root}>{root}</option>)}</select></label>{role==='developer'?<label>{t('Действие')}<select value={mode} disabled={batchBusy} onChange={event=>setMode(event.target.value as 'default'|'plan')}><option value="default">{t('Выполнить задачу')}</option><option value="plan">{t('Сначала составить план')}</option></select></label>:<p className="muted">{t('Ревью и QA выполняются в режиме чтения. Агент анализирует проект без изменения файлов.')}</p>}<p className="muted">{t('Статус каждой задачи проверяется перед запуском. Недоступный шаг приостановит очередь. Одобрение ревью, QA и создание PR подтверждаются отдельно.')}</p>{error&&<p className="error" role="alert">{t(error)}</p>}<div className="jira-form-actions"><button className="text-button" disabled={batchBusy} onClick={()=>setBatchOpen(false)}>{t('Отмена')}</button><button className="primary" disabled={batchBusy||!cwd||!checked.size} onClick={()=>void enqueue()}>{batchBusy?t('Подождите…'):t('Запустить выбранные ({0})',checked.size)}</button></div></section></div>}
  </section>;
}
