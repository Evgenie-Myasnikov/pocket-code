import {useEffect,useRef,useState} from 'react';
import {RefreshCw,ExternalLink,CheckCircle2,AlertCircle,Server,KeyRound} from 'lucide-react';
import {request,type Connection} from './api';
import {desktopCall} from './desktop-bridge';
import {useLanguage} from './i18n';
import {startVisiblePoll} from './visible-poll';
import './provider-connections.css';
import type {DesktopState} from './desktop-bridge';
export function HostStatus({state}:{state:DesktopState}){const ru=useLanguage()==='ru';return <dl className="host-status"><div><dt>{ru?'Сервер ПК':'PC host'}</dt><dd>{state.online?(state.hostBusy?(ru?'В работе':'Working'):(ru?'В сети':'Online')):(ru?'Не в сети':'Offline')}</dd></div><div><dt>{ru?'Интернет-туннель':'Internet tunnel'}</dt><dd>{state.tunnelOnline?(ru?'Подключён':'Connected'):(ru?'Не подключён':'Not connected')}</dd></div></dl>;}

type Provider='claude'|'codex'|'copilot';
type Status={id:Provider;installed:boolean;version:string;server:string;authenticated:boolean|null;access?:string;busy:boolean;login:{state:string;reason?:string;method?:string};methods:string[]};
const names={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const docs={claude:'https://code.claude.com/docs/en/authentication',codex:'https://developers.openai.com/codex/auth/',copilot:'https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli'};
function ProviderAccountActions({item,waiting,starting,confirm,onConfirm,onCancel,onLogout}:{item:Status;waiting:boolean;starting:boolean;confirm:boolean;onConfirm:()=>void;onCancel:()=>void;onLogout:()=>void}){
 const ru=useLanguage()==='ru';return <>
 {item.access==='models-unavailable'&&<p role="status">{ru?'Вход выполнен, но модели недоступны. Проверьте сеть, подписку Copilot и доступ организации.':'Signed in, but models are unavailable. Check network, Copilot subscription and organization access.'}</p>}
 {item.authenticated&&(!confirm?<button className="secondary" disabled={item.busy||waiting||starting} onClick={onConfirm}>{ru?'Выйти из аккаунта':'Sign out'}</button>:<div role="group" aria-label={ru?'Выход из аккаунта':'Sign out'}><p>{ru?'Выход из CLI на этом ПК затронет приложения, использующие тот же аккаунт. Чаты и настройки сохранятся.':'Signs out the CLI on this PC, including apps using the same account. Chats and settings are preserved.'}</p><button className="secondary" disabled={item.busy||waiting||starting} onClick={onLogout}>{ru?'Выйти':'Sign out now'}</button><button className="secondary" disabled={starting} onClick={onCancel}>{ru?'Отмена':'Cancel'}</button></div>)}
 </>;
}
export function ProviderConnections({connection,online=true,only}:{connection:Connection|null;online?:boolean;only?:Provider}){
 const language=useLanguage(),l=(en:string,ru:string)=>language==='ru'?ru:en;
 const [items,setItems]=useState<Status[]>([]),[error,setError]=useState(''),[revision,setRevision]=useState(0),[pending,setPending]=useState(''),[starting,setStarting]=useState(false);
 const previousAuth=useRef('');
 const [confirmLogout,setConfirmLogout]=useState<Provider|null>(null);
 async function logout(id:Provider){if(!connection||starting)return;setStarting(true);setError('');try{if(connection.desktop)await desktopCall('provider-logout',{provider:id});else await request(connection,`/provider-connections/${id}/logout`,{});setConfirmLogout(null);setRevision(value=>value+1);}catch{setError(l('Could not sign out. Finish active tasks and retry.','Не удалось выйти. Завершите активные задачи и повторите.'));}finally{setStarting(false);}}
 const reason=(item:Status)=>{
  switch(item.login.reason){
   case 'cancelled-or-failed':return l('The sign-in window closed without completing sign-in. Retry and finish browser authorization.','Окно входа закрылось без завершения авторизации. Повторите вход и завершите его в браузере.');
   case 'sign-in-required':return l('The CLI finished, but its server still reports no signed-in account. Check the account in the CLI and retry.','CLI завершил вход, но сервер не видит авторизованный аккаунт. Проверьте аккаунт в CLI и повторите.');
   case 'external-credentials':return l('Local sign-out finished, but another account or environment/GitHub CLI credentials still provide access. Those credentials were not removed.','Локальный выход завершён, но доступ остаётся через другой аккаунт, окружение или GitHub CLI. Эти данные не удалены.');
   case 'logout-failed':return l('Sign-out could not be verified. Check the provider on the PC.','Не удалось подтвердить выход. Проверьте провайдера на ПК.');
   default:return l('Could not verify sign-in. Check the provider server and connection, then retry.','Не удалось проверить вход. Проверьте сервер провайдера и соединение, затем повторите.');
  }
 };
 useEffect(()=>{const next=items.map(item=>`${item.id}:${item.authenticated}:${item.login.state}`).join('|');if(previousAuth.current&&next!==previousAuth.current)window.dispatchEvent(new Event('pocket-code-providers'));previousAuth.current=next;},[items]);
 useEffect(()=>{if(!connection||!online){setItems([]);return;}let active=true;const stop=startVisiblePoll(async()=>{try{const value=await request<{providers:Status[]}>(connection,'/provider-connections');if(!Array.isArray(value.providers))throw Error('Invalid provider status');if(active){setItems(value.providers);setError('');if(value.providers.every(item=>item.login.state!=='waiting'&&item.login.state!=='checking'))setPending('');}}catch{if(active)setError(l('Cannot check providers. Update or reconnect the PC host.','Не удалось проверить провайдеры. Обновите или подключите сервер ПК.'));}},8000);return()=>{active=false;stop();};},[connection,online,revision,language]);
 const methods:Record<string,string>={browser:l('Browser sign-in','Вход через браузер'),console:'Anthropic Console',sso:'SSO',device:l('Device code','Код устройства'),key:l('API key','API-ключ'),token:l('GitHub token','Токен GitHub'),accessToken:l('Access token','Токен доступа')};
 async function login(id:Provider,method:string){if(!connection||starting)return;setStarting(true);setPending(id);setError('');try{if(connection.desktop)await desktopCall('provider-login',{provider:id,method});else await request(connection,`/provider-connections/${id}/login/${method}`,{});setRevision(value=>value+1);}catch{setPending('');setError(l('Sign-in could not start. Finish active tasks, check the PC and retry.','Не удалось начать вход. Завершите активные задачи, проверьте ПК и повторите.'));}finally{setStarting(false);}}
 return <section className="provider-connections"><header><h2>{l('Providers & sign-in','Провайдеры и вход')}</h2><button className="icon-button" aria-label={l('Check providers','Проверить провайдеры')} disabled={!online||!connection} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={18}/></button></header>
 {!online||!connection?<p role="status">{l('Connect the PC host to check providers and sign in.','Подключите сервер ПК для проверки провайдеров и входа.')}</p>:!items.length&&!error?<p role="status">{l('Checking installation, servers and sign-in…','Проверяем установку, серверы и вход…')}</p>:null}
 {error&&<p className="error" role="alert">{error}</p>}
 {items.filter(item=>!only||item.id===only).map(item=>{const waiting=pending===item.id||['waiting','checking'].includes(item.login.state);return <article key={item.id} className="provider-card"><header><h3>{names[item.id]}</h3><span className="muted">{item.version||l('Version unknown','Версия неизвестна')}</span></header><dl>
 <div><dt>{l('Installation','Установка')}</dt><dd>{item.installed?l('Detected','Найдена'):l('Not found','Не найдена')}</dd></div>
 <div><dt><Server size={15}/>{l('Server','Сервер')}</dt><dd>{item.server==='ready'?l('Connected','Подключён'):item.server==='on-demand'?l('Starts with a task','Запускается с задачей'):l('Unavailable','Недоступен')}</dd></div>
 <div><dt><KeyRound size={15}/>{l('Sign-in','Авторизация')}</dt><dd className={item.authenticated?'provider-ok':''}>{item.authenticated?<><CheckCircle2 size={15}/>{l('Signed in','Вход выполнен')}</>:item.authenticated===false?l('Sign-in required','Требуется вход'):l('Not verified','Не проверена')}</dd></div></dl>
 {item.busy&&<p className="muted">{l('Working. Sign-in changes are available after the task finishes.','Идёт работа. Сменить вход можно после завершения задачи.')}</p>}
 {waiting&&<p role="status">{l('Complete sign-in in the window on your PC, or close it to cancel. Status will refresh automatically.','Завершите вход в окне на ПК или закройте его для отмены. Статус обновится автоматически.')}</p>}
 {item.login.state==='error'&&!waiting&&<p className="error"><AlertCircle size={16}/>{reason(item)}</p>}
 <ProviderAccountActions item={item} waiting={waiting} starting={starting} confirm={confirmLogout===item.id} onConfirm={()=>setConfirmLogout(item.id)} onCancel={()=>setConfirmLogout(null)} onLogout={()=>void logout(item.id)}/>
 <details open={item.authenticated===false}><summary>{l('Manual sign-in methods','Способы ручного входа')}</summary><p className="muted">{l('Opens an official CLI sign-in window on the PC. Keys and tokens are entered there with hidden input, never in a chat.','Откроется окно входа официального CLI на ПК. Ключи и токены вводятся там скрыто, а не в чате.')}</p><div className="provider-login-methods">{item.methods.map(method=><button className="secondary" key={method} disabled={!item.installed||item.busy||waiting||starting} onClick={()=>void login(item.id,method)}>{methods[method]||method}</button>)}</div>
 <p className="muted">{item.id==='claude'?l('API keys, credential helpers, Amazon Bedrock, Vertex AI and Microsoft Foundry use the CLI environment/configuration on this PC.','API-ключи, credential helpers, Amazon Bedrock, Vertex AI и Microsoft Foundry настраиваются в окружении/конфигурации CLI на ПК.'):item.id==='codex'?l('Device login may need permission in ChatGPT security settings. Custom providers use the local Codex configuration.','Вход по коду может требовать разрешения в настройках безопасности ChatGPT. Другие провайдеры настраиваются в конфигурации Codex.'):l('Use a fine-grained token with Copilot Requests permission. Classic PATs are unsupported. Enterprise host and BYOK configuration are described in the guide.','Используйте fine-grained токен с правом Copilot Requests. Classic PAT не поддерживается. Enterprise host и BYOK описаны в инструкции.')}</p>
 <a href={docs[item.id]} target="_blank" rel="noopener noreferrer">{l('All methods & setup guide','Все способы и инструкция')} <ExternalLink size={14}/></a></details></article>;})}</section>;
}
