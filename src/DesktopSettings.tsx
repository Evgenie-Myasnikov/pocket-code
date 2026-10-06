import {MiroSettings} from './MiroSettings';
import {useState,type ReactNode} from 'react';
import {ArrowLeft,ChevronRight,Monitor,Palette,KeyRound,Download,Info,ChartNoAxesCombined,Smartphone} from 'lucide-react';
import {useLanguage} from './i18n';
import {AppearanceSettings,type useAppearance} from './Appearance';
import {LanguageSelector} from './Language';
import {ProviderConnections} from './ProviderConnections';
import {DesktopUpdates} from './DesktopUpdates';
import {CodexUsage} from './CodexUsage';
import type {DesktopState} from './desktop-bridge';
import type {Connection} from './api';
import pkg from '../package.json';
import './settings.css';
import {setRunAlerts,useRunAlertsPreference} from './chat-notifications';

export function DesktopSettings({state,connection,appearance,action,connectionPanel,initialPage='index',roots=[]}:{roots?:string[];connectionPanel:ReactNode;initialPage?:string;state:DesktopState;connection:Connection;appearance:ReturnType<typeof useAppearance>;action(command:string,args?:Record<string,unknown>):Promise<void>}){
  const runAlerts=useRunAlertsPreference();
  const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en,[page,setPage]=useState(initialPage),[provider,setProvider]=useState<'claude'|'codex'|'copilot'|null>(null);
  const categories=[{id:'miro',title:'Miro',hint:l('Connect project boards','Подключение досок проектов'),Icon:Monitor},{id:'connection',title:l('Connection','Подключение'),hint:l('Pair a phone, QR and connected devices','QR, подключение телефона и устройства'),Icon:Smartphone},{id:'system',title:l('Windows application','Приложение Windows'),hint:l('Startup, tray and reconnection','Автозапуск, трей и переподключение'),Icon:Monitor},{id:'appearance',title:l('Appearance and language','Оформление и язык'),hint:l('Theme, colors and sizes','Тема, цвета и размеры'),Icon:Palette},{id:'providers',title:l('AI accounts','Аккаунты AI'),hint:l('Sign-in, status and sign-out','Вход, состояние и выход'),Icon:KeyRound},{id:'usage',title:l('Usage limits','Лимиты использования'),hint:l('Remaining allowance and reset time','Остаток лимита и время сброса'),Icon:ChartNoAxesCombined},{id:'updates',title:l('Updates','Обновления'),hint:l('Windows, PC host and Android','Windows, хост ПК и Android'),Icon:Download},{id:'about',title:l('About','О приложении'),hint:'Pocket Code',Icon:Info}];
  const category=categories.find(c=>c.id===page);
  const back=()=>{if(provider)setProvider(null);else setPage('index');};
  return <section className="desktop-settings settings-categorized"><header><h1>{l('Settings','Настройки')}</h1></header>{page==='index'?<nav className="settings-index" aria-label={l('Settings categories','Разделы настроек')}>{categories.map(({id,title,hint,Icon})=><button key={id} className="settings-category" aria-label={title} onClick={()=>setPage(id)}><Icon size={21}/><span><strong>{title}</strong><small>{hint}</small></span><ChevronRight size={18}/></button>)}</nav>:<><button className="settings-back" onClick={back}><ArrowLeft size={18}/>{provider?category?.title:l('All settings','Все настройки')}</button><h2>{provider?provider==='claude'?'Claude':provider==='codex'?'Codex':'GitHub Copilot':category?.title}</h2>
    {page==='connection'&&connectionPanel}{page==='miro'&&<MiroSettings connection={state.online?connection:null} roots={roots}/>}
    {page==='system'&&<><label className="desktop-toggle"><input type="checkbox" checked={state.startup} onChange={e=>void action('settings',{startup:e.target.checked})}/>{l('Start with Windows','Запускать с Windows')}</label><label className="desktop-toggle"><input type="checkbox" checked={state.autoReconnect} onChange={e=>void action('settings',{autoReconnect:e.target.checked})}/>{l('Restore the last active connection','Восстанавливать последнее подключение')}</label><p className="muted">{l('Closing the window keeps Pocket Code in the tray. Use the tray menu → Exit to quit.','Закрытие окна оставляет Pocket Code в трее. Для выхода используйте меню трея → Выход.')}</p></>}
    {page==='appearance'&&<><LanguageSelector/><AppearanceSettings {...appearance}/></>}
    {page==='system'&&<label className="desktop-toggle"><input type="checkbox" checked={runAlerts} onChange={e=>setRunAlerts(e.target.checked)}/>{l('Notify when an agent finishes, fails or needs an answer','Уведомлять о завершении, ошибке и вопросе агента')}</label>}
    {(page==='providers'||page==='usage')&&(provider?page==='providers'?<ProviderConnections connection={connection} online={state.online} only={provider}/>:<CodexUsage connection={state.online?connection:null} provider={provider}/>:<nav className="settings-index" aria-label={l('AI providers','Провайдеры AI')}>{(['claude','codex','copilot'] as const).map(id=><button className="settings-category" key={id} onClick={()=>setProvider(id)}><span><strong>{id==='claude'?'Claude':id==='codex'?'Codex':'GitHub Copilot'}</strong></span><ChevronRight size={18}/></button>)}</nav>)}
    {page==='updates'&&<DesktopUpdates state={state} action={action}/>}
    {page==='about'&&<><h3>Pocket Code</h3><p>{pkg.version}</p><p>{l('Personal AI chats and shared project boards, hosted on your PC.','Личные AI-чаты и общие проектные доски на вашем ПК.')}</p></>}
  </>}</section>;
}
