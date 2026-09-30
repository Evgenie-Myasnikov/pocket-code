import { t, locale, getLanguage } from "./i18n";import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { RefreshCw, Play, ExternalLink, Link2 } from 'lucide-react';
import { request, type Connection } from './api';
import type { JiraIssue, JiraSite } from '../server/jira';
import type { JobView } from '../server/types';
import type { QueueItem } from '../server/jira-queue';
import './jira.css';

const Login = registerPlugin<{
  prepare(): Promise<{redirectUrl: string;}>;
  open(options: {url: string;state: string;language: string;}): Promise<{code: string;state: string;issuer?: string;}>;
  cancel(): Promise<void>;
}>('JiraLogin');
type Status = {error?: string;source?: 'claude';connected: boolean;sites: JiraSite[];};
export function JiraSettings({ connection }: {connection: Connection | null;}) {
  const [status, setStatus] = useState<Status | null>(null),[busy, setBusy] = useState(false),[error, setError] = useState('');
  const attempt = useRef(0);
  useEffect(() => {
    let cancelled = false;
    if (connection) request<Status>(connection, '/jira/status').then((s) => {if (!cancelled) {setStatus(s);setError(s.error || "");}}).catch((e) => {if (!cancelled) setError(e.message);});
    return () => {cancelled = true;attempt.current++;void Login.cancel().catch(() => {});};
  }, [connection]);
  async function connect() {
    if (!connection || busy) return;
    if (status?.source === 'claude') {setBusy(true);setError('');try {const next = await request<Status>(connection, '/jira/connect-existing', {});setStatus(next);setError(next.error || "");} catch(e) {setError((e as Error).message);} finally {setBusy(false);}return;}
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
    <p className="muted">{status?.source === "claude" ? t("Jira подключена через существующий Atlassian MCP в Claude на ПК. Отдельный вход не нужен.") : t("Войдите в Atlassian на телефоне. В Jobs появятся все задачи, назначенные на вас, включая завершённые.")}</p>
    {status?.connected && <p className="jira-connected">{t("Подключено · ")}{status.sites.map((s) => s.name).join(', ') || t("Нет доступных сайтов Jira")}</p>}
    {busy && <p role="status">{status?.source === "claude" ? t("Читаем Jira через Claude на ПК…") : t("Завершите вход в браузере и вернитесь в Pocket Code. Ожидаем до 5 минут.")}</p>}
    {error && <p className="error" role="alert">{t(error)}</p>}
    {!status?.connected && !busy && <button className="primary" disabled={!connection} onClick={() => void connect()}><Link2 size={16} />{status?.source === "claude" ? t("Использовать подключение Claude") : "Connect"}</button>}
    {(status?.connected || busy || error) && <button className="secondary" onClick={() => void disconnect()}>{busy ? t("Отменить вход") : status?.connected ? t("Отключить Jira") : t("Сбросить вход")}</button>}
    <p className="muted">{status?.source === "claude" ? t("Чтение задач использует Claude на ПК и его лимиты. Отключение здесь не отключает коннектор в Claude.") : t("Доступ хранится на ПК в защищённом хранилище Windows. Отключение удаляет его из Pocket Code; разрешение Atlassian можно отозвать в настройках аккаунта.")}</p>
  </section>;
}
const stateLabels = { running: 'Claude работает', done: 'Работа завершена', error: 'Ошибка выполнения', stopped: 'Остановлено' };
export function JiraJobs({ connection, roots, jobs, budget, onOpen, onSettings }: {connection: Connection | null;roots: string[];jobs: JobView[];budget: number;onOpen(job: JobView): void;onSettings(): void;}) {
  const [status, setStatus] = useState<Status | null>(null),[site, setSite] = useState(''),[issues, setIssues] = useState<JiraIssue[]>([]);
  const [next, setNext] = useState<string | null>(null),[error, setError] = useState(''),[busy, setBusy] = useState(false),[starting, setStarting] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set()),[batchBusy, setBatchBusy] = useState(false);
  const batchId = useRef<{signature: string;id: string;} | null>(null);
  const [queue, setQueue] = useState<{paused: boolean;items: QueueItem[];} | null>(null);
  const [cwd, setCwd] = useState(roots[0] || ''),[mode, setMode] = useState<'default' | 'plan'>('default'),[updated, setUpdated] = useState(0),[selected, setSelected] = useState<JiraIssue | null>(null);
  const epoch = useRef(0),loading = useRef(false),alive = useRef(true),startId = useRef<{signature: string;id: string;} | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {alive.current = true;return () => {alive.current = false;epoch.current++;};}, []);
  useEffect(() => {
    if (!connection) return;
    let cancelled = false,timer: ReturnType<typeof setTimeout>;
    async function poll() {try {const data = await request<{paused: boolean;items: QueueItem[];}>(connection!, '/jira/queue');if (!cancelled) setQueue(data);} catch {}if (!cancelled) timer = setTimeout(poll, 2000);}
    void poll();return () => {cancelled = true;clearTimeout(timer);};
  }, [connection]);
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    request<Status>(connection, '/jira/status').then((s) => {if (!cancelled) {setStatus(s);setError(s.error || '');setSite(s.sites[0]?.id || '');}}).catch((e) => {if (!cancelled) setError(e.message);});
    return () => {cancelled = true;};
  }, [connection]);
  async function refresh(cursor?: string) {
    if (!connection || !site || loading.current) return;
    loading.current = true;setBusy(true);const current = epoch.current;
    try {
      const data = await request<{issues: JiraIssue[];next: string | null;}>(connection, `/jira/issues?site=${encodeURIComponent(site)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      if (!alive.current || current !== epoch.current) return;
      setIssues((old) => cursor ? [...new Map([...old, ...data.issues].map((i) => [i.key, i])).values()] : data.issues);
      setNext(data.next);setError('');setUpdated(Date.now());
      setSelected((old) => old ? data.issues.find((i) => i.key === old.key) || old : null);
    } catch (e) {if (alive.current && current === epoch.current) setError((e as Error).message);} finally
    {loading.current = false;if (alive.current) {setBusy(false);if (current !== epoch.current) void refreshRef.current();}}
  }
  refreshRef.current = () => refresh();
  useEffect(() => {
    ++epoch.current;setIssues([]);setNext(null);setSelected(null);setChecked(new Set());
    void refreshRef.current();const timer = setInterval(() => void refreshRef.current(), 60000);
    return () => {clearInterval(timer);epoch.current++;};
  }, [site]);
  async function selectAll() {
    if (!connection || !site || batchBusy || busy) return;
    const current = epoch.current;setBatchBusy(true);setError('');
    try {
      let cursor: string | null = null;const all = new Map<string, JiraIssue>(),cursors = new Set<string>();
      do {
        const data: {issues: JiraIssue[];next: string | null;} = await request(connection, `/jira/issues?site=${encodeURIComponent(site)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        if (!alive.current || current !== epoch.current) return;
        for (const issue of data.issues) all.set(issue.key, issue);
        if (all.size > 5000) throw new Error(t("Найдено более 5000 задач. Выберите меньшую пачку."));
        cursor = data.next;
        if (cursor && cursors.has(cursor)) throw new Error(t("Jira повторила страницу. Попробуйте обновить список."));
        if (cursor) cursors.add(cursor);
      } while (cursor);
      setIssues([...all.values()]);setNext(null);setChecked(new Set(all.keys()));setUpdated(Date.now());
    } catch (e) {if (alive.current) setError((e as Error).message);} finally
    {if (alive.current) setBatchBusy(false);}
  }
  async function enqueue() {
    if (!connection || !checked.size || batchBusy || !cwd) return;
    setBatchBusy(true);setError('');
    const body = { site, keys: [...checked].sort(), cwd, mode, maxBudgetUsd: budget },signature = JSON.stringify(body);
    if (batchId.current?.signature !== signature) batchId.current = { signature, id: crypto.randomUUID() };
    try {const data = await request<{paused: boolean;items: QueueItem[];}>(connection, '/jira/queue', { ...body, batchId: batchId.current.id });if (alive.current) {setQueue(data);setChecked(new Set());batchId.current = null;}}
    catch (e) {if (alive.current) setError((e as Error).message);} finally
    {if (alive.current) setBatchBusy(false);}
  }
  async function control(action: 'pause' | 'resume' | 'clear') {
    if (!connection) return;
    try {setQueue(await request(connection, '/jira/queue/control', { action }));} catch (e) {setError((e as Error).message);}
  }
  async function start(issue: JiraIssue) {
    if (!connection || starting || !cwd) return;
    setStarting(issue.key);setError('');
    const signature = JSON.stringify({ site, key: issue.key, cwd, mode });
    if (startId.current?.signature !== signature) startId.current = { signature, id: crypto.randomUUID() };
    try {
      const job = await request<JobView>(connection, '/jira/start', { id: startId.current.id, site, key: issue.key, cwd, mode, maxBudgetUsd: budget });
      startId.current = null;if (alive.current) onOpen(job);
    } catch (e) {if (alive.current) setError((e as Error).message);} finally
    {if (alive.current) setStarting('');}
  }
  const related = (key: string) => jobs.filter((j) => j.jira?.site === site && j.jira.key === key).sort((a, b) => b.startedAt - a.startedAt)[0];
  return <section className="jobs-panel"><div className="jobs-heading"><div><div className="eyebrow">JIRA → CLAUDE</div><h2>Jobs</h2></div><button className="secondary" disabled={busy || !site} onClick={() => void refresh()}><RefreshCw size={16} />{t("Обновить")}</button></div>
    {error && <p role="alert" className="error">{t(error)}</p>}
    {!connection || status?.connected === false ? <div className="jira-empty"><h3>{t("Подключите Jira")}</h3><p>{t("Войдите через Connect в настройках, чтобы загрузить назначенные вам задачи.")}</p><button className="primary" onClick={onSettings}>{t("Открыть настройки Jira")}</button></div> : !status ? <p className="muted">{t("Проверяем подключение Jira…")}</p> : <>
      {!status.sites.length && <p className="muted">{t("У аккаунта нет доступных сайтов Jira. Проверьте доступ Atlassian MCP и подключитесь повторно в настройках.")}</p>}
      {status.sites.length > 1 && <label>{t("Сайт Jira")}<select value={site} onChange={(e) => setSite(e.target.value)}>{status.sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <p className="muted">{t("Все задачи, назначенные на вас · ")}{updated ? t("обновлено {0}", new Date(updated).toLocaleTimeString(locale())) : t("загрузка…")}</p>
      <div className="jobs-run-options"><label>{t("Папка проекта для Claude")}<select aria-label={t("Папка проекта для Claude")} value={cwd} disabled={!!starting} onChange={(e) => setCwd(e.target.value)}>{roots.map((r) => <option key={r}>{r}</option>)}</select></label><label>{t("Действие")}<select value={mode} onChange={(e) => setMode(e.target.value as 'default' | 'plan')}><option value="default">{t("Выполнить задачу")}</option><option value="plan">{t("Сначала составить план")}</option></select></label></div>
      <div className="jira-batch"><button className="secondary" disabled={busy || batchBusy || !site} onClick={() => void selectAll()}>{batchBusy ? t("Подождите…") : t("Выбрать все задачи")}</button><button className="text-button" disabled={!checked.size || batchBusy} onClick={() => setChecked(new Set())}>{t("Снять выбор")}</button><button className="primary" disabled={!checked.size || batchBusy || !cwd} onClick={() => void enqueue()}>{t("Отправить выбранные (")}{checked.size})</button></div>
      {queue && queue.items.length > 0 && <section className="jira-queue" aria-label={t("Очередь задач")}><h3>{t("Очередь · ")}{queue.paused ? t("на паузе") : t("в работе")}</h3><p>{queue.items.filter((i) => i.status === 'queued').length}{t(" ожидают · ")}{queue.items.filter((i) => i.status === 'running').length}{t(" выполняется · ")}{queue.items.filter((i) => i.status === 'done').length}{t(" завершено")}</p><div className="jira-batch"><button className="secondary" onClick={() => void control(queue.paused ? 'resume' : 'pause')}>{queue.paused ? t("Продолжить очередь") : t("Пауза очереди")}</button><button className="text-button" onClick={() => void control('clear')}>{t("Убрать ожидающие")}</button></div><p className="muted">{t("Пауза действует после текущей задачи. После перезапуска сервера продолжение нужно включить вручную.")}</p>{queue.items.filter((i) => i.status === 'running' || i.status === 'error').slice(-10).map((i) => <p key={i.id}>{i.key} · {i.status === 'running' ? t("Claude работает") : t(i.error || "Ошибка")}{i.jobId && jobs.some((j) => j.id === i.jobId) && <button className="text-button" onClick={() => onOpen(jobs.find((j) => j.id === i.jobId)!)}>{t("Открыть чат")}</button>}</p>)}</section>}
      <div className="jira-issues">{issues.map((issue) => {
          const job = related(issue.key);
          return <article className="jira-issue" key={issue.key}><div className="jira-issue-meta"><label className="jira-check"><input type="checkbox" aria-label={t("Выбрать {0}", issue.key)} checked={checked.has(issue.key)} disabled={batchBusy} onChange={(e) => setChecked((old) => {const next = new Set(old);e.target.checked ? next.add(issue.key) : next.delete(issue.key);return next;})} />{issue.key}</label><span>{issue.status}</span><span>{issue.priority}</span></div><button className="jira-issue-title" onClick={() => setSelected(selected?.key === issue.key ? null : issue)}>{issue.summary}</button>
          {selected?.key === issue.key && <div className="jira-description"><p>{issue.description || t("Без описания")}</p><a href={issue.url} target="_blank" rel="noreferrer">{t("Открыть в Jira ")}<ExternalLink size={13} /></a></div>}
          <div className="jira-issue-actions">{job && <button className="secondary" onClick={() => onOpen(job)}>{t(stateLabels[job.status])}{t(" · Открыть")}</button>}<button className="primary" disabled={!!starting || !cwd || job?.status === 'running'} onClick={() => void start(issue)}><Play size={14} />{starting === issue.key ? t("Запускаем…") : job ? t("Запустить ещё раз") : t("Взять в работу")}</button></div>
        </article>;
        })}</div>
      {!busy && site && !issues.length && <p className="muted">{t("Назначенных вам задач не найдено.")}</p>}
      {busy && <p role="status">{t("Загружаем задачи…")}</p>}{next && <button className="secondary" disabled={busy} onClick={() => void refresh(next)}>{t("Загрузить ещё задачи")}</button>}
      <p className="muted">{t("«Взять в работу» запускает Claude в выбранной папке. Его ответ и запросы разрешений откроются в чате. Статус Jira автоматически не меняется.")}</p>
    </>}
  </section>;
}
