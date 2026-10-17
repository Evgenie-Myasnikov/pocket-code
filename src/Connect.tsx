import { t, getLanguage, setLanguage, useLanguage } from "./i18n";import { useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ArrowUpRight, Laptop, ArrowRight, Copy, Unplug } from 'lucide-react';
import { type Connection } from './api';
import { parsePairingCode, readQrImage } from './pairing';
import { connectionKind } from './connection-kind';
import type { ConnectionProblem } from './connection-errors';
import { ScanLine, ImagePlus } from 'lucide-react';
import pkg from '../package.json';
import './pairing.css';
const QrScanner = registerPlugin<{scan(options: {language: string}): Promise<{value?: string;cancelled?: boolean;}>;}>('PairingScanner');
export type ConnectedPc={name:string;url:string;version?:string;online:boolean;lastContact:number;check():Promise<number>};
const routeLabel=(url:string)=>({Tailscale:'Tailscale',Local:t('Wi-Fi / локальная сеть'),Internet:t('Интернет'),Unknown:t('Неизвестный маршрут')} as Record<string,string>)[connectionKind(url)];
/** Shows enough of the address to recognise the route without exposing the full host on screen. */
export function maskedHost(url:string){try{const {hostname,port}=new URL(url),parts=hostname.split('.');const host=/^\d+(\.\d+){3}$/.test(hostname)?[parts[0],'•••','•••',parts[3]].join('.'):parts.length>2?parts[0].slice(0,3)+'…'+'.'+parts.slice(-2).join('.'):hostname;return host+(port?':'+port:'');}catch{return '';}}
const problemTitle:Record<ConnectionProblem,string>={unreachable:'ПК недоступен',auth:'Ключ подключения не подошёл',incompatible:'Версии приложения и ПК не совпадают','not-pocket-code':'По адресу ответил не Pocket Code',tls:'HTTPS не прошёл проверку',cleartext:'Android заблокировал HTTP'};
const routeChecks:Record<string,string[]>={Local:['Телефон и ПК подключены к одной сети Wi-Fi.','Pocket Code на ПК запущен и показывает «В сети».'],Tailscale:['Tailscale включён на телефоне и ПК.','Pocket Code на ПК запущен и показывает «В сети».'],Internet:['Pocket Code на ПК запущен, интернет-туннель подключён.','После перезапуска ПК адрес туннеля меняется: отсканируйте новый QR.'],Unknown:['Pocket Code на ПК запущен и показывает «В сети».']};
function ago(time:number){const seconds=Math.max(0,Math.round((Date.now()-time)/1000));return seconds<60?t('на связи {0} с назад',seconds):t('на связи {0} мин назад',Math.round(seconds/60));}
export function Connect({ initial, onConnect,onAlternateCode, onDemo, busy, error,problem,kind='connection',status,onDisconnect,onCancel,onUpdates,revoked,onboarding,restoring,target }: {initial?: Connection | null;onConnect: (c: Connection) => void;onAlternateCode?:(c:Connection)=>void;onDemo?: () => void;busy: boolean;error: string;problem?:ConnectionProblem;kind?:'connection'|'workspace';status?:ConnectedPc|null;onDisconnect?:()=>void;onCancel?:()=>void;onUpdates?:()=>void;revoked?:string|null;onboarding?:boolean;restoring?:boolean;target?:string;}) {
  const [scanned,setScanned]=useState<Connection|null>(null),[localError,setError]=useState('');
  const [scanning,setScanning]=useState(false),qrFile=useRef<HTMLInputElement>(null);
  const [replace,setReplace]=useState(false),[confirm,setConfirm]=useState(false),[ping,setPing]=useState(''),[copied,setCopied]=useState(false),[,setTick]=useState(0),[started,setStarted]=useState(0);
  const language=useLanguage();
  const native=Capacitor.isNativePlatform(),retry=scanned||initial,cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!status&&!busy)return;const timer=setInterval(()=>setTick(n=>n+1),busy?1000:5000);return()=>clearInterval(timer);},[!!status,busy]);
  useEffect(()=>{setStarted(busy?Date.now():0);},[busy]);
  useEffect(()=>{if(status)setReplace(false);},[status?.url]);
  useEffect(()=>{if(confirm)cancel.current?.focus();},[confirm]);
  function acceptCode(raw:string){const connection=parsePairingCode(raw);if(!!connection.workspaceInvite!==(kind==='workspace')){if(onAlternateCode){setScanned(null);onAlternateCode(connection);return;}throw Error(t(kind==='workspace'?'Это QR подключения к ПК. Откройте Настройки → Подключение к ПК.':'Это QR рабочей области. Используйте QR подключения к ПК из настроек компьютера.'));}setScanned(connection);onConnect(connection);}
  async function scan() {
    if (!native) {qrFile.current?.click();return;}
    setScanning(true);setError('');
    try {const result = await QrScanner.scan({language: getLanguage()});if (!result.cancelled && result.value) acceptCode(result.value);}
    catch (e) {setError((e as Error).message || t("Не удалось открыть камеру. Можно выбрать изображение QR-кода."));} finally
    {setScanning(false);}
  }
  async function check(){if(!status)return;setPing(t('Проверяем…'));try{setPing(t('Ответ за {0} мс',await status.check()));}catch(e){setPing(t((e as Error).message));}}
  // Diagnostics name the route and the failure class only: never the address or the key.
  async function copyDiagnostics(){const text=['Pocket Code '+pkg.version,'route: '+connectionKind((retry||status)?.url||''),'problem: '+(problem||'unknown'),'time: '+new Date().toISOString()].join('\n');try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{/* Clipboard can be unavailable. */}}
  const message=localError||error,route=connectionKind((retry||status)?.url||''),elapsed=started?Math.max(0,Math.round((Date.now()-started)/1000)):0;
  const scanAction=<button className="secondary" disabled={busy||scanning} onClick={()=>void scan()}><ScanLine size={16}/>{t(native?"Сканировать новый QR":"Выбрать изображение с QR")}</button>;
  return <div className="connect-page connect-compact">
    {status?<section className="connect-status" aria-label={t('Подключено к ПК')}><div className="connect-status-head"><Laptop size={26}/><div><strong>{status.name}</strong><span className={'connect-chip '+(status.online?'online':'offline')}><span className="connect-dot" aria-hidden="true"/>{status.online?t('Подключено'):t('Нет связи')} · {routeLabel(status.url)}</span></div></div>
      <dl><div><dt>{t('Адрес')}</dt><dd>{maskedHost(status.url)}</dd></div>{status.version&&<div><dt>{t('Версия ПК')}</dt><dd>{status.version}</dd></div>}{status.lastContact>0&&<div><dt>{t('Связь')}</dt><dd>{ago(status.lastContact)}</dd></div>}</dl>
      <div className="connect-status-check"><button className="secondary" disabled={busy} onClick={()=>void check()}>{t('Проверить связь')}</button>{ping&&<span role="status">{ping}</span>}</div></section>
    :<>{onboarding&&<div className="connect-language" role="group" aria-label={t('Язык интерфейса')}>{(['en','ru'] as const).map(value=><button key={value} className="text-button" aria-pressed={language===value} onClick={()=>setLanguage(value)}>{value.toUpperCase()}</button>)}</div>}<ScanLine className="connect-symbol" size={32}/><h2>{t(kind==='workspace'?'Присоединиться к рабочей области':'Подключить компьютер')}</h2>
      {revoked!==undefined&&revoked!==null&&kind==='connection'&&<div className="connect-notice" role="status"><Unplug size={18}/><div><strong>{revoked?t('{0} отключил этот телефон',revoked):t('ПК отключил этот телефон')}</strong><p>{t('Откройте на ПК Настройки → Подключение и отсканируйте текущий QR-код.')}</p></div></div>}
      {onboarding&&kind==='connection'&&!restoring?<ol className="connect-steps"><li>{t('Установите Pocket Code на ПК с Windows.')}</li><li>{t('На ПК откройте Настройки → Подключение и нажмите «Подключить».')}</li><li>{t('Отсканируйте QR-код с экрана ПК.')}</li>{native&&<li>{t('Разрешите уведомления, когда телефон спросит: Pocket Code сообщит, когда агент закончит работу или задаст вопрос.')}</li>}</ol>:!restoring&&<p className="muted">{t(kind==='workspace'?'Откройте приглашение WorkSpace на ПК и отсканируйте его QR-код.':'Откройте на ПК Настройки → Подключение и отсканируйте QR-код.')}</p>}</>}
    {busy||restoring&&!message?<div className="connect-progress" role="status"><span className="connect-spinner" aria-hidden="true"/><div><strong>{restoring?(target?t('Восстанавливаем связь с {0}…',target):t('Восстанавливаем связь с ПК…')):target?t('Подключаемся к {0}…',target):t("Подключаемся…")}</strong>{busy&&<small>{retry?routeLabel(retry.url)+' · ':''}{t('{0} с',elapsed)}</small>}{busy&&elapsed>=5&&route==='Internet'&&<small>{t('Если ПК просит подтвердить новое устройство, нажмите «Разрешить» на ПК.')}</small>}</div>{busy&&onCancel&&<button className="text-button" onClick={onCancel}>{t('Отмена')}</button>}</div>:<>
      {message&&<div className="error connect-problem" role="alert">{!localError&&problem&&<strong>{t(problemTitle[problem])}</strong>}<p>{t(message)}</p>
        {!localError&&problem==='unreachable'&&<><ul>{(routeChecks[route]||routeChecks.Unknown).map(item=><li key={item}>{t(item)}</li>)}</ul><div className="connect-problem-actions">{retry&&<button className="primary" disabled={scanning} onClick={()=>{setError('');onConnect(retry);}}>{t("Reconnect")}<ArrowRight size={18}/></button>}<button className="text-button" onClick={()=>void copyDiagnostics()}><Copy size={14}/>{copied?t('Скопировано'):t('Скопировать диагностику')}</button></div></>}
        {!localError&&problem==='incompatible'&&onUpdates&&<div className="connect-problem-actions"><button className="secondary" onClick={onUpdates}>{t('Как обновить')}</button></div>}
        {!localError&&problem&&problem!=='unreachable'&&problem!=='incompatible'&&<div className="connect-problem-actions">{scanAction}</div>}</div>}
      {(!status||replace)&&<div className="qr-connect">{native?<><button className="primary" disabled={busy || scanning} onClick={() => void scan()}><ScanLine size={20} />{scanning ? t("Читаем QR-код…") : t("Сканировать QR-код")}</button><button className="text-button" disabled={busy || scanning} onClick={() => qrFile.current?.click()}><ImagePlus size={15} />{t("QR из изображения")}</button></>:<button className="primary" disabled={busy || scanning} onClick={() => qrFile.current?.click()}><ImagePlus size={20} />{scanning ? t("Читаем QR-код…") : t("Выбрать изображение с QR")}</button>}</div>}
      {retry&&!message&&status&&!status.online&&<button className="secondary connect-button" disabled={scanning} onClick={()=>{setError('');onConnect(retry);}}>{t("Reconnect")}<ArrowRight size={18}/></button>}
    </>}
    <input hidden aria-label={t("Изображение QR-кода")} ref={qrFile} type="file" accept="image/*" onChange={async (e) => {const file = e.target.files?.[0];if (!file) return;setScanning(true);setError('');try {acceptCode(await readQrImage(file));} catch (e) {setError((e as Error).message || t("Не удалось прочитать QR-код"));} finally {setScanning(false);if (qrFile.current) qrFile.current.value = '';}}} />
    {status&&!busy&&<div className="connect-actions"><button className="secondary" aria-expanded={replace} onClick={()=>setReplace(value=>!value)}><ScanLine size={16}/>{t('Сменить ПК / новый QR')}</button>{onDisconnect&&<button className="secondary danger" onClick={()=>setConfirm(true)}><Unplug size={16}/>{t('Отключить…')}</button>}</div>}
    {onDemo&&!status&&!busy&&!restoring&&<button className="text-button demo-button" onClick={onDemo}>{t("Посмотреть интерфейс без подключения ")}<ArrowUpRight size={14} /></button>}
    {confirm&&status&&onDisconnect&&<div className="modal-backdrop" onKeyDown={event=>{if(event.key==='Escape')setConfirm(false);}}><section className="confirm-modal connect-confirm" role="dialog" aria-modal="true" aria-label={t('Отключить телефон от {0}?',status.name)}><Unplug size={28}/><h2>{t('Отключить телефон от {0}?',status.name)}</h2><p>{t('Кэш и черновики на телефоне удалятся. Чтобы подключиться снова, понадобится новый QR-код с ПК. Чаты останутся на ПК.')}</p><button ref={cancel} className="secondary" onClick={()=>setConfirm(false)}>{t('Отмена')}</button><button className="primary danger" onClick={()=>{setConfirm(false);onDisconnect();}}>{t('Отключить и забыть')}</button></section></div>}
  </div>;
}
