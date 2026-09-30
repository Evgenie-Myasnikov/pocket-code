import { t, locale } from "./i18n";import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ArrowUp, ArrowDown, CornerDownLeft, Paperclip, Terminal as TerminalIcon, Square, Plus } from 'lucide-react';
import { request, fileBase64, type Connection } from './api';
export type TerminalInfo = {id: string;cwd: string;sessionId?: string;status: 'running' | 'exited';startedAt: number;cols: number;rows: number;exitCode?: number;};
type Output = {cursor: number;reset: boolean;data: string;status: string;exitCode?: number;cols: number;rows: number;};
export function LiveTerminal({ connection, cwd, sessionId }: {connection: Connection;cwd: string;sessionId?: string;}) {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]),[active, setActive] = useState<TerminalInfo | null>(null);
  const [text, setText] = useState(''),[error, setError] = useState(''),[busy, setBusy] = useState(false),[confirmed, setConfirmed] = useState(false);
  const [network, setNetwork] = useState(''),[resume, setResume] = useState(false);
  const host = useRef<HTMLDivElement>(null),picker = useRef<HTMLInputElement>(null);
  const terminal = useRef<Terminal | null>(null),command = useRef<{data: string;id: string;clear: boolean;} | null>(null),sending = useRef(false),createId = useRef(crypto.randomUUID());
  const api = <T,>(route: string, data?: unknown) => request<T>(connection, route, data);
  useEffect(() => {
    let valid = true,timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {const list = await request<TerminalInfo[]>(connection, '/terminals');if (valid) {setTerminals(list);}}
      catch (e) {if (valid) setNetwork((e as Error).message);}
      if (valid) timer = setTimeout(refresh, 4000);
    }
    void refresh();return () => {valid = false;clearTimeout(timer);};
  }, [connection]);
  useEffect(() => {
    if (!active || !host.current) return;
    let valid = true,timer: ReturnType<typeof setTimeout>,cursor = -1;
    const view = new Terminal({ cols: active.cols, rows: active.rows, scrollback: 2000, disableStdin: true, screenReaderMode: true,
      fontSize: window.innerWidth < 760 ? 10 : 13, fontFamily: 'Consolas, monospace',
      theme: { background: '#111812', foreground: '#dae4d3', cursor: '#c3dda8', selectionBackground: '#4e634480' } });
    terminal.current = view;view.open(host.current);
    async function poll() {
      try {
        const output = await request<Output>(connection, `/terminals/${active!.id}/output?cursor=${cursor}`);
        if (!valid) return;
        if (view.cols !== output.cols || view.rows !== output.rows) view.resize(output.cols, output.rows);
        if (output.reset) view.reset();
        await new Promise<void>((resolve) => view.write(output.data, resolve));
        cursor = output.cursor;setNetwork('');
        if (output.status === 'exited') {setActive((old) => old ? { ...old, status: 'exited', exitCode: output.exitCode } : old);return;}
      } catch (e) {if (valid) setNetwork((e as Error).message);}
      if (valid) timer = setTimeout(poll, 350);
    }
    void poll();return () => {valid = false;clearTimeout(timer);terminal.current = null;view.dispose();};
  }, [connection, active?.id]);
  async function create() {
    if (busy || resume && !confirmed) return;
    setBusy(true);setError('');
    try {
      const next = await api<TerminalInfo>('/terminals', { id: createId.current, cwd, sessionId: resume ? sessionId : undefined, takeoverConfirmed: confirmed });
      setActive(next);setTerminals((old) => [...old.filter((t) => t.id !== next.id), next]);createId.current = crypto.randomUUID();
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function input(data: string, clear = false) {
    if (!active || sending.current) return;
    sending.current = true;setBusy(true);setError('');
    if (!command.current) command.current = { data, id: crypto.randomUUID(), clear };
    try {
      await api(`/terminals/${active.id}/input`, command.current);const clearText = command.current.clear;command.current = null;if (clearText) setText('');
    } catch (e) {setError((e as Error).message + t(" Нажмите «Повторить ввод», чтобы проверить доставку."));} finally
    {sending.current = false;setBusy(false);}
  }
  const pending = Boolean(command.current);
  return <section className="terminal-panel"><div className="terminal-heading"><div><div className="eyebrow">{t("ПРЯМОЕ ПОДКЛЮЧЕНИЕ · БЕЗ REMOTE CONTROL")}</div><h2>{t("Живой Claude Code")}</h2></div><TerminalIcon size={24} /></div>
    {terminals.length > 0 && <div className="terminal-tabs">{terminals.map((terminal) => <button className={active?.id === terminal.id ? 'selected' : ''} key={terminal.id} disabled={busy || pending} onClick={() => {setActive(terminal);setText('');setError('');}}><span className={terminal.status === 'running' ? 'status-light' : ''} />{terminal.cwd.split(/[\\/]/).pop()} · {new Date(terminal.startedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}{terminal.status === 'exited' && t(" · завершён")}</button>)}</div>}
    {!active ? <div className="terminal-start"><p>{t("Настоящий процесс Claude Code на вашем ПК: команды, инструменты, меню и подтверждения. Тот же терминал можно открыть в браузере ПК и на телефоне.")}</p><code>{cwd}</code>
      {sessionId && !sessionId.startsWith('pending-') && <><label className="checkbox-label"><input type="checkbox" checked={resume} onChange={(e) => {setResume(e.target.checked);createId.current = crypto.randomUUID();}} />{t("Продолжить выбранный сохранённый чат")}</label>{resume && <label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{t("Я завершил этот чат в прежнем терминале на ПК")}</label>}</>}
      <button className="primary" disabled={busy || resume && !confirmed} onClick={() => void create()}><Plus size={17} />{t("Запустить Claude на ПК")}</button><p className="muted">{t("Уже открытое постороннее окно терминала подключить нельзя. Здесь запускается новый процесс или продолжается сохранённый чат.")}</p></div> : <>
      <div className="terminal-status"><span className="status-light" />{active.status === 'running' ? t("Процесс на ПК · общий экран для всех устройств") : t("Процесс завершён · код {0}", active.exitCode ?? '—')}<button className="text-button" disabled={busy || pending} onClick={() => {setActive(null);setText('');}}>{t("К запуску")}</button></div>
      <div className="terminal-viewport"><div ref={host} /></div>
      <div className="terminal-keys">{[{ label: 'Esc', data: '\x1b' }, { label: 'Tab', data: '\t' }, { label: '↑', data: '\x1b[A' }, { label: '↓', data: '\x1b[B' }, { label: '←', data: '\x1b[D' }, { label: '→', data: '\x1b[C' }, { label: 'Enter', data: '\r' }, { label: 'Ctrl+C', data: '\x03' }].map((key) => <button key={key.label} disabled={busy || pending || active.status !== 'running'} onClick={() => void input(key.data)}>{key.label}</button>)}</div>
      <textarea className="terminal-input" aria-label={t("Текст для живого терминала")} placeholder={t("Сообщение или /команда…")} value={text} disabled={busy || pending || active.status !== 'running'} onChange={(e) => setText(e.target.value)} />
      <div className="terminal-actions"><input hidden type="file" ref={picker} onChange={async (e) => {const file = e.target.files?.[0];if (!file) return;setBusy(true);setError('');try {const result = await api<{reference: string;}>(`/terminals/${active.id}/attachment`, { name: file.name, base64: await fileBase64(file) });setText((old) => old + '\n' + result.reference);} catch (e) {setError((e as Error).message);} finally {setBusy(false);if (picker.current) picker.current.value = '';}}} /><button className="secondary" aria-label={t("Файл в терминал")} disabled={busy || pending || active.status !== 'running'} onClick={() => picker.current?.click()}><Paperclip size={16} /></button><button className="secondary" disabled={busy || pending || active.status !== 'running'} onClick={async () => {setBusy(true);try {await api(`/terminals/${active.id}/stop`, {});} catch (e) {setError((e as Error).message);} finally {setBusy(false);}}}><Square size={14} />{t("Завершить")}</button><button className="primary" disabled={busy || active.status !== 'running' || !text.trim() && !pending} onClick={() => void input(pending ? command.current!.data : '\x1b[200~' + text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '') + '\x1b[201~\r', true)}>{pending ? t("Повторить ввод") : t("Отправить")}<CornerDownLeft size={16} /></button></div>
      <p className="muted terminal-hint">{t("Стрелки и Enter управляют меню Claude. Ctrl+C прерывает действие. Прокручивайте экран по горизонтали, если строка не помещается. Терминал продолжает работать после закрытия приложения.")}</p>
    </>}{network && <div className="error">{t(network)}</div>}{error && <div className="error" role="alert">{t(error)}</div>}
  </section>;
}
