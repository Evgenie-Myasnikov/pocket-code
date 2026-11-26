import {useEffect,useRef,useState,type ReactNode} from 'react';
import {HelpTip,SettingRow,SettingsBlock,SettingsLine} from './SettingsRows';
import {RefreshCw,ExternalLink,CheckCircle2,AlertCircle,Server,KeyRound,ChevronDown,Loader2} from 'lucide-react';
import {request,type Connection} from './api';
import {desktopCall} from './desktop-bridge';
import {t,useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import {Notice} from './Notice';
import './provider-connections.css';
import type {DesktopState} from './desktop-bridge';
/** The Windows shell reports host states as codes; older shells still send their English sentence, kept as a fallback. */
export function hostStatusText(state:DesktopState){
  const code=state.statusCode;
  if(code==='connected')return state.status;
  if(code==='ready'||!code&&state.status==='Ready to connect')return t('Ожидаем локальный сервер…');
  if(code==='disconnected'||!code&&state.status==='Disconnected')return t('Локальный сервер остановлен.');
  if(code==='reconnecting'||!code&&state.status.startsWith('Host unavailable'))return t('Сервер ПК недоступен. Переподключаемся…');
  if(code==='starting'||!code&&state.status.startsWith('Starting the host'))return t('Запускаем сервер / восстанавливаем связь…');
  if(code==='preparing'||!code&&state.status.startsWith('Preparing the host'))return t('Готовим сервер. Первый запуск может занять несколько минут.');
  if(code==='mode-locked')return t('Остановите сервер, чтобы сменить режим подключения.');
  return code==='failed'?t('Сервер ПК не запустился: {0}',state.status):state.status;
}
function RetryIn({at}:{at:number}){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);const left=Math.max(0,Math.ceil((at-now)/1000));return <>{left?t('следующая попытка через {0} с',left):t('пробуем сейчас…')}</>;}
export function HostStatus({state}:{state:DesktopState}){useLanguage();const working=!state.online&&(state.statusCode==='reconnecting'||state.statusCode==='starting'||state.statusCode==='preparing');return <dl className="host-status"><div><dt><span className={'host-dot'+(state.online?' on':'')} aria-hidden="true"/>{t('Сервер ПК')}</dt><dd>{state.online?(state.hostBusy?t('В работе'):t('В сети')):working?<span className="host-status-working"><Loader2 size={14} aria-hidden="true" className="host-status-spin"/>{state.statusCode==='reconnecting'?t('Переподключение'):t('Запуск')}{state.statusCode==='reconnecting'&&state.nextRetryAt?<> · <RetryIn at={state.nextRetryAt}/></>:null}</span>:t('Не в сети')}</dd></div>{state.internet&&<div><dt><span className={'host-dot'+(state.tunnelOnline?' on':'')} aria-hidden="true"/>{t('Интернет-туннель')}</dt><dd>{state.tunnelOnline?t('Подключён'):t('Не подключён')}</dd></div>}</dl>;}

type Provider='claude'|'codex'|'copilot'|'gemini';
export type ProviderStatus={id:Provider;installed:boolean;version:string;server:string;authenticated:boolean|null;access?:string;busy:boolean;login:{state:string;reason?:string;method?:string};methods:string[]};
type Status=ProviderStatus;
const names={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot',gemini:'Gemini'};
const docs={claude:'https://code.claude.com/docs/en/authentication',codex:'https://developers.openai.com/codex/auth/',copilot:'https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli',gemini:'https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/authentication.md'};
/** Gemini CLI signs in inside its own window and has no sign-out command; its states come with what to do on the PC. */
const geminiNotice=(item:Status)=>item.id==='gemini'&&(!item.installed||item.authenticated===false||item.access==='models-unavailable');
function GeminiState({item}:{item:Status}){
 if(!geminiNotice(item))return null;
 if(!item.installed)return <Notice tone="warning">{t('Gemini CLI не установлен на ПК. Установите его командой npm install -g @google/gemini-cli и нажмите «Проверить провайдеры».')}</Notice>;
 if(item.access==='api-key-not-supported')return <Notice tone="warning">{t('Gemini CLI настроен на API-ключ. Pocket Code работает через аккаунт Google: запустите gemini на ПК, введите /auth и выберите Sign in with Google.')}</Notice>;
 if(item.authenticated===false)return <Notice tone="info">{t('Войдите в Gemini на ПК: нажмите «Вход через браузер» или запустите gemini в терминале, выберите Sign in with Google, затем закройте CLI командой /quit.')}</Notice>;
 if(item.access==='models-unavailable')return <Notice tone="warning">{t('Вход выполнен, но список моделей Gemini не прочитан. Чаты используют модель Gemini CLI по умолчанию.')}</Notice>;
 return null;
}
function ProviderAccountActions({item,waiting,starting,confirm,onConfirm,onCancel,onLogout}:{item:Status;waiting:boolean;starting:boolean;confirm:boolean;onConfirm:()=>void;onCancel:()=>void;onLogout:()=>void}){
 return <>
 {item.access==='models-unavailable'&&item.id!=='gemini'&&<Notice tone="warning">{t('Вход выполнен, но модели недоступны. Проверьте сеть, подписку Copilot и доступ организации.')}</Notice>}
 {item.id!=='gemini'&&item.authenticated&&(!confirm?<button className="secondary danger" disabled={item.busy||waiting||starting} onClick={onConfirm}>{t('Выйти из аккаунта')}</button>:<div className="confirm-inline" role="group" aria-label={t('Выход из аккаунта')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onCancel();}}}><p>{t('Выход из CLI на этом ПК затронет приложения, использующие тот же аккаунт. Чаты и настройки сохранятся.')}</p><div className="confirm-inline-actions"><button className="primary danger" disabled={item.busy||waiting||starting} onClick={onLogout}>{t('Выйти сейчас')}</button><button className="secondary" autoFocus disabled={starting} onClick={onCancel}>{t('Отмена')}</button></div></div>)}
 </>;
}
/** rows: the PC window's card of rows for one provider (only), with the device access rows passed as children. */
export function ProviderConnections({connection,online=true,only,onStatus,rows,children}:{connection:Connection|null;online?:boolean;only?:Provider;onStatus?:(items:ProviderStatus[])=>void;rows?:boolean;children?:ReactNode}){
 const language=useLanguage();
 const [items,setItems]=useState<Status[]>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0),[pending,setPending]=useState(''),[starting,setStarting]=useState(false),[cancelling,setCancelling]=useState('');
 const previousAuth=useRef(''),statusListener=useRef(onStatus);statusListener.current=onStatus;
 const [confirmLogout,setConfirmLogout]=useState<Provider|null>(null),[switching,setSwitching]=useState<Provider|null>(null);
 async function logout(id:Provider){if(!connection||starting)return;setStarting(true);setError('');try{if(connection.desktop)await desktopCall('provider-logout',{provider:id});else await request(connection,`/provider-connections/${id}/logout`,{});setConfirmLogout(null);setRevision(value=>value+1);}catch{setError(t('Не удалось выйти. Завершите активные задачи и повторите.'));}finally{setStarting(false);}}
 const reason=(item:Status)=>{
  switch(item.login.reason){
   case 'cancelled-or-failed':return t('Окно входа закрылось без завершения авторизации. Повторите вход и завершите его в браузере.');
   case 'sign-in-required':return t('CLI завершил вход, но сервер не видит авторизованный аккаунт. Проверьте аккаунт в CLI и повторите.');
   case 'external-credentials':return t('Локальный выход завершён, но доступ остаётся через другой аккаунт, окружение или GitHub CLI. Эти данные не удалены.');
   case 'logout-failed':return t('Не удалось подтвердить выход. Проверьте провайдера на ПК.');
   default:return t('Не удалось проверить вход. Проверьте сервер провайдера и соединение, затем повторите.');
  }
 };
 useEffect(()=>{const next=items.map(item=>`${item.id}:${item.authenticated}:${item.login.state}`).join('|');if(previousAuth.current&&next!==previousAuth.current)window.dispatchEvent(new Event('pocket-code-providers'));previousAuth.current=next;statusListener.current?.(items);},[items]);
 // While a sign-in window is open the card follows it every 2 s; otherwise every 8 s.
 const signingIn=!!pending||items.some(item=>['waiting','checking'].includes(item.login.state));
 useEffect(()=>{if(!connection||!online){setItems([]);return;}let active=true;const stop=startVisiblePoll(async()=>{try{const value=await request<{providers:Status[]}>(connection,'/provider-connections');if(!Array.isArray(value.providers))throw Error('Invalid provider status');if(active){setItems(value.providers);setError('');if(value.providers.every(item=>item.login.state!=='waiting'&&item.login.state!=='checking'))setPending('');}}catch{if(active)setError(t('Не удалось проверить провайдеры. Обновите или подключите сервер ПК.'));}},signingIn?2000:8000);return()=>{active=false;stop();};},[connection,online,revision,language,signingIn]);
 const methods:Record<string,string>={browser:t('Вход через браузер'),console:'Anthropic Console',sso:'SSO',device:t('Код устройства'),key:t('API-ключ'),token:t('Токен GitHub'),accessToken:t('Токен доступа')};
 async function login(id:Provider,method:string){if(!connection||starting)return;setStarting(true);setPending(id);setError('');try{if(connection.desktop)await desktopCall('provider-login',{provider:id,method});else await request(connection,`/provider-connections/${id}/login/${method}`,{});setRevision(value=>value+1);}catch{setPending('');setError(t('Не удалось начать вход. Завершите активные задачи, проверьте ПК и повторите.'));}finally{setStarting(false);}}
 async function cancelLogin(id:Provider){if(!connection||cancelling)return;setCancelling(id);setError('');try{if(connection.desktop)await desktopCall('provider-login-cancel',{provider:id});else await request(connection,`/provider-connections/${id}/login/cancel`,{});setPending('');setRevision(value=>value+1);}catch{setError(t('Не удалось отменить вход. Закройте окно входа на ПК.'));}finally{setCancelling('');}}
 const refresh=<button className="icon-button" aria-label={t('Проверить провайдеры')} title={t('Проверить провайдеры')} disabled={!online||!connection} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={20}/></button>;
 const hints:Record<Provider,string>={claude:t('API-ключи, credential helpers, Amazon Bedrock, Vertex AI и Microsoft Foundry настраиваются в окружении/конфигурации CLI на ПК.'),codex:t('Вход по коду может требовать разрешения в настройках безопасности ChatGPT. Другие провайдеры настраиваются в конфигурации Codex.'),copilot:t('Используйте fine-grained токен с правом Copilot Requests. Classic PAT не поддерживается. Enterprise host и BYOK описаны в инструкции.'),gemini:t('Откроется Gemini CLI: выберите Sign in with Google и завершите вход в браузере. Подписка Google AI действует через этот аккаунт; API-ключ не нужен.')};
 const serverLabel=(item:Status)=>item.server==='ready'?t('Подключён'):item.server==='on-demand'?t('Запускается с задачей'):t('Недоступен');
 if(rows&&only){
  const item=items.find(entry=>entry.id===only),waiting=!!item&&(pending===item.id||['waiting','checking'].includes(item.login.state)),method=item?.login.method&&item.login.method!=='logout'?methods[item.login.method]||item.login.method:'';
  const methodButtons=(entry:Status)=><div className="provider-login-methods">{entry.methods.map(value=><button className="secondary" key={value} disabled={!entry.installed||entry.busy||starting} onClick={()=>{setSwitching(null);void login(entry.id,value);}}>{methods[value]||value}</button>)}</div>;
  const help=item&&<HelpTip label={t('Способы входа · {0}',names[item.id])}>{t('Откроется окно входа официального CLI на ПК. Ключи и токены вводятся там скрыто, а не в чате.')} {hints[item.id]} <a href={docs[item.id]} target="_blank" rel="noopener noreferrer">{t('Все способы и инструкция')} <ExternalLink size={12}/></a></HelpTip>;
  return <SettingsBlock title={names[only]} action={refresh} className="provider-connections provider-connections-single provider-rows">
   {!online||!connection?<SettingsLine><p role="status">{t('Подключите сервер ПК для проверки провайдеров и входа.')}</p></SettingsLine>:!item&&!error?<SettingsLine><p role="status">{t('Проверяем установку, серверы и вход…')}</p></SettingsLine>:null}
   {error&&<SettingsLine><Notice tone="error">{error}</Notice></SettingsLine>}
   {item&&<>
    <SettingRow title={t('Установка')} note={item.installed?(item.version||t('Версия неизвестна')):undefined}><span className={'settings-value'+(item.installed?' ok':'')}>{item.installed?t('Найдена'):t('Не найдена')}</span></SettingRow>
    <SettingRow title={t('Сервер')}><span className="settings-value">{serverLabel(item)}</span></SettingRow>
    <SettingRow title={t('Аккаунт')} help={help} note={item.busy?t('Идёт работа. Сменить вход можно после завершения задачи.'):undefined}>
     <span className={'settings-value'+(item.authenticated?' ok':'')}>{item.authenticated?<><CheckCircle2 size={16} aria-hidden="true"/>{t('Вход выполнен')}</>:item.authenticated===false?t('Требуется вход'):t('Не проверена')}</span>
     {item.authenticated&&!waiting&&confirmLogout!==item.id&&item.id!=='gemini'&&<><button className="secondary" aria-expanded={switching===item.id} disabled={item.busy||starting} onClick={()=>setSwitching(value=>value===item.id?null:item.id)}>{t('Сменить аккаунт')}</button><button className="secondary danger" disabled={item.busy||starting} onClick={()=>{setSwitching(null);setConfirmLogout(item.id);}}>{t('Выйти из аккаунта')}</button></>}
    </SettingRow>
    {geminiNotice(item)&&<SettingsLine><GeminiState item={item}/></SettingsLine>}
    {item.access==='models-unavailable'&&item.id!=='gemini'&&<SettingsLine><Notice tone="warning">{t('Вход выполнен, но модели недоступны. Проверьте сеть, подписку Copilot и доступ организации.')}</Notice></SettingsLine>}
    {item.authenticated&&confirmLogout===item.id&&<SettingsLine><div className="confirm-inline" role="group" aria-label={t('Выход из аккаунта')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirmLogout(null);}}}><p>{t('Выход из CLI на этом ПК затронет приложения, использующие тот же аккаунт. Чаты и настройки сохранятся.')}</p><div className="confirm-inline-actions"><button className="primary danger" disabled={item.busy||waiting||starting} onClick={()=>void logout(item.id)}>{t('Выйти сейчас')}</button><button className="secondary" autoFocus disabled={starting} onClick={()=>setConfirmLogout(null)}>{t('Отмена')}</button></div></div></SettingsLine>}
    {waiting&&<SettingsLine className="provider-waiting-line"><div className="provider-waiting" role="status"><Loader2 className="provider-spinner" size={20} aria-hidden="true"/><span>{method?t('Ждём вход: {0}. Завершите его в окне на ПК.',method):t('Ждём вход. Завершите его в окне на ПК.')}</span>{item.login.state==='waiting'&&<button className="secondary" disabled={!!cancelling} onClick={()=>void cancelLogin(item.id)}>{t('Отменить вход')}</button>}</div></SettingsLine>}
    {item.login.state==='error'&&!waiting&&<SettingsLine><Notice tone="error">{reason(item)}</Notice></SettingsLine>}
    {!waiting&&item.authenticated===false&&<SettingRow title={t('Способы входа')} note={t('Окно входа CLI откроется на ПК')}>{methodButtons(item)}</SettingRow>}
    {!waiting&&item.authenticated&&switching===item.id&&<SettingRow title={t('Новый вход')} note={t('Заменит текущий аккаунт CLI на этом ПК')}>{methodButtons(item)}</SettingRow>}
    {!waiting&&item.authenticated===null&&<SettingRow title={t('Способы входа')} note={t('Окно входа CLI откроется на ПК')}>{methodButtons(item)}</SettingRow>}
   </>}
   {children}
  </SettingsBlock>;
 }
 return <section className={'provider-connections'+(only?' provider-connections-single':'')}>{only?null:<header><h2>{t('Провайдеры и вход')}</h2>{refresh}</header>}
 {!online||!connection?<p role="status">{t('Подключите сервер ПК для проверки провайдеров и входа.')}</p>:!items.length&&!error?<p role="status">{t('Проверяем установку, серверы и вход…')}</p>:null}
 {error&&<Notice tone="error">{error}</Notice>}
 {items.filter(item=>!only||item.id===only).map(item=>{const waiting=pending===item.id||['waiting','checking'].includes(item.login.state),method=item.login.method&&item.login.method!=='logout'?methods[item.login.method]||item.login.method:'';return <article key={item.id} className="provider-card"><header><h3>{names[item.id]}</h3><span className="muted">{item.version||t('Версия неизвестна')}</span>{only&&refresh}</header><dl>
 <div><dt>{t('Установка')}</dt><dd>{item.installed?t('Найдена'):t('Не найдена')}</dd></div>
 <div><dt><Server size={16}/>{t('Сервер')}</dt><dd>{item.server==='ready'?t('Подключён'):item.server==='on-demand'?t('Запускается с задачей'):t('Недоступен')}</dd></div>
 <div><dt><KeyRound size={16}/>{t('Авторизация')}</dt><dd className={item.authenticated?'provider-ok':''}>{item.authenticated?<><CheckCircle2 size={16}/>{t('Вход выполнен')}</>:item.authenticated===false?t('Требуется вход'):t('Не проверена')}</dd></div></dl>
 {item.busy&&<p className="muted">{t('Идёт работа. Сменить вход можно после завершения задачи.')}</p>}
 {waiting&&<div className="provider-waiting" role="status"><Loader2 className="provider-spinner" size={20} aria-hidden="true"/><span>{method?t('Ждём вход: {0}. Завершите его в окне на ПК.',method):t('Ждём вход. Завершите его в окне на ПК.')}</span>{item.login.state==='waiting'&&<button className="secondary" disabled={!!cancelling} onClick={()=>void cancelLogin(item.id)}>{t('Отменить вход')}</button>}</div>}
 {item.login.state==='error'&&!waiting&&<Notice tone="error">{reason(item)}</Notice>}
 <GeminiState item={item}/>
 <ProviderAccountActions item={item} waiting={waiting} starting={starting} confirm={confirmLogout===item.id} onConfirm={()=>setConfirmLogout(item.id)} onCancel={()=>setConfirmLogout(null)} onLogout={()=>void logout(item.id)}/>
 {!waiting&&<details className="disclosure" open={item.authenticated===false}><summary><ChevronDown className="disclosure-chevron" size={20} aria-hidden="true"/>{item.authenticated?t('Сменить аккаунт'):t('Способы входа')}</summary><p className="muted">{item.authenticated?t('Новый вход заменит текущий аккаунт CLI на этом ПК. '):''}{t('Откроется окно входа официального CLI на ПК. Ключи и токены вводятся там скрыто, а не в чате.')}</p><div className="provider-login-methods">{item.methods.map(method=><button className="secondary" key={method} disabled={!item.installed||item.busy||starting} onClick={()=>void login(item.id,method)}>{methods[method]||method}</button>)}</div>
 <p className="muted">{item.id==='gemini'?hints.gemini:item.id==='claude'?t('API-ключи, credential helpers, Amazon Bedrock, Vertex AI и Microsoft Foundry настраиваются в окружении/конфигурации CLI на ПК.'):item.id==='codex'?t('Вход по коду может требовать разрешения в настройках безопасности ChatGPT. Другие провайдеры настраиваются в конфигурации Codex.'):t('Используйте fine-grained токен с правом Copilot Requests. Classic PAT не поддерживается. Enterprise host и BYOK описаны в инструкции.')}</p>
 <a className="provider-guide-link" href={docs[item.id]} target="_blank" rel="noopener noreferrer">{t('Все способы и инструкция')} <ExternalLink size={14}/></a></details>}</article>;})}</section>;
}
