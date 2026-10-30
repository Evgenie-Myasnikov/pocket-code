import {ClaudeAccessSettings,claudeAccessLabel} from './ClaudeAccessSettings';
import {CodexAccessSettings,codexAccessLabel} from './CodexAccessSettings';
import {ComposerSettings} from './ComposerSettings';
import {MiroSettings} from './MiroSettings';
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {ArrowLeft,ChevronRight,Keyboard} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {AppearanceSettings,appearanceSummary,type useAppearance} from './Appearance';
import {LanguageSelector} from './Language';
import {ProviderConnections} from './ProviderConnections';
import {DesktopUpdates} from './DesktopUpdates';
import {UsageLimits} from './UsageOverview';
import {BudgetSettings,budgetLabel} from './BudgetSettings';
import {RunAlertsToggle,SettingsCategoryButton,usageSummary} from './SettingsPanel';
import {useClaudeAccess} from './claude-access';
import {useLiveSettings} from './live-settings';
import {LimitAlertsToggle,useLimitAlertsPreference} from './LimitAlert';
import {useRunAlertsPreference} from './chat-notifications';
import {preferences,updatePreferences,type CodexAccess,type PreferenceChange} from './preferences';
import {useBackAction} from './navigation';
import {categoryHint,categoryTitle,groupedCategories,settingsCategories,type SettingsCategoryId} from './settings-registry';
import type {DesktopState} from './desktop-bridge';
import type {Connection} from './api';
import pkg from '../package.json';
import './settings.css';

type Provider='claude'|'codex'|'copilot';
const providerNames:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const wideQuery='(min-width:1100px)';
function useWide(){return useSyncExternalStore(listener=>{const media=matchMedia(wideQuery);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);},()=>matchMedia(wideQuery).matches,()=>true);}
/** Device defaults the shared chat reads at send time; changes here reach open chats through updatePreferences. */
function useDevicePreferences(){
  const [codexAccess,setCodexAccess]=useState(()=>preferences('codex').codexAccess),[budget,setBudget]=useState(()=>preferences('claude').budget);
  useEffect(()=>{const sync=(event:Event)=>{const change=(event as CustomEvent<PreferenceChange>).detail;if(change?.provider==='codex'&&change.codexAccess)setCodexAccess(change.codexAccess);if(change?.provider==='claude'&&change.budget!==undefined)setBudget(preferences('claude').budget);};window.addEventListener('pocket-code-preferences',sync);return()=>window.removeEventListener('pocket-code-preferences',sync);},[]);
  return {codexAccess,budget,setCodexAccess:(value:CodexAccess)=>{setCodexAccess(value);updatePreferences({provider:'codex',codexAccess:value});},setBudget:(value:number)=>{setBudget(value);updatePreferences({provider:'claude',budget:value});}};
}
/** List-detail on wide windows (sections stay visible on the left); level-by-level below 1100 px. */
export function DesktopSettings({state,connection,appearance,action,connectionPanel,initialPage='index',roots=[],onConnection,onShortcuts}:{onShortcuts?():void;roots?:string[];connectionPanel:ReactNode;initialPage?:string;state:DesktopState;connection:Connection;appearance:ReturnType<typeof useAppearance>;action(command:string,args?:Record<string,unknown>):Promise<void>;onConnection?:()=>void}){
  useLanguage();
  const wide=useWide(),[page,setPage]=useState<SettingsCategoryId|'index'>(initialPage==='providers'?'workspace':initialPage as SettingsCategoryId|'index'),[provider,setProvider]=useState<Provider|null>(null);
  const live=useLiveSettings(),claudeAccess=useClaudeAccess(),alerts=useRunAlertsPreference(),limitAlerts=useLimitAlertsPreference(),device=useDevicePreferences();
  // Without a chosen section the wide layout opens AI accounts, never the pairing QR, so a shared screen does not show it unasked.
  const current:SettingsCategoryId|'index'=page==='index'&&wide?'workspace':page,category=settingsCategories.find(item=>item.id===current);
  const groups=groupedCategories('desktop');
  const back=()=>{if(provider){setProvider(null);return true;}if(page!=='index'&&!wide){setPage('index');return true;}return false;};
  useBackAction(back,10);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.altKey&&event.key==='ArrowLeft'&&back())event.preventDefault();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);});
  const open=(id:SettingsCategoryId)=>{setProvider(null);setPage(id);};
  const updateBadge=['ready','error','paused'].includes(state.updateState||'');
  const summaries:Partial<Record<SettingsCategoryId,ReactNode>>={
    connection:state.online?t('Сервер ПК в сети')+(state.internet?' · '+(state.tunnelOnline?t('туннель активен'):t('туннель не подключён')):''):t('Сервер ПК не в сети'),
    updates:state.updateState==='ready'?t('Обновление готово {0}',state.updateVersion||''):state.updateState==='error'?t('Обновление не удалось'):t('Установлена версия {0}',state.version||pkg.version),
    system:[state.startup?t('Запуск с Windows'):t('Без автозапуска'),state.autoReconnect?t('переподключение вкл.'):t('переподключение выкл.')].join(' · '),
    workspace:'Claude · '+claudeAccessLabel(claudeAccess)+' · Codex · '+codexAccessLabel(device.codexAccess),
    usage:usageSummary('claude',live)||usageSummary('codex',live)||t('Оставшийся лимит и время сброса'),
    appearance:appearanceSummary(appearance.appearance),
    notifications:[alerts?t('Вкл.: завершение, ошибки, вопросы'):t('Чаты: выключены'),limitAlerts?t('предупреждения о лимитах'):''].filter(Boolean).join(' · '),
    about:t('Версия {0}',pkg.version),
  };
  const providerSummary=(id:Provider)=>id==='claude'?claudeAccessLabel(claudeAccess)+' · '+t('до {0} за запрос',budgetLabel(device.budget)):id==='codex'?codexAccessLabel(device.codexAccess):t('Разрешения подтверждаются в чате');
  const nav=<nav className="settings-index" aria-label={t('Разделы настроек')}>{groups.map(group=><div className="settings-group" role="group" aria-labelledby={'desktop-settings-group-'+group.id} key={group.id}><h3 className="settings-group-title" id={'desktop-settings-group-'+group.id}>{t(group.title)}</h3>{group.items.map(item=><SettingsCategoryButton key={item.id} category={item} platform="desktop" current={wide&&current===item.id} summary={summaries[item.id]||t(categoryHint(item,'desktop'))} badge={item.id==='updates'&&updateBadge} onOpen={()=>open(item.id)}/>)}</div>)}</nav>;
  const title=provider?providerNames[provider]:category?t(categoryTitle(category,'desktop')):t('Настройки');
  const scope=provider?t('Вход — на ПК; режим доступа и лимит стоимости — на этом устройстве'):category?.storage&&t(category.storage);
  return <section className={'desktop-settings settings-categorized settings-list-detail'+(page!=='index'?' has-page':'')}><header><h1>{t('Настройки')}</h1></header>{nav}
   <div className="settings-detail">{current!=='index'&&<>
    {provider?<button className="settings-back" onClick={()=>setProvider(null)}><ArrowLeft size={20}/>{t('Все провайдеры')}</button>:<button className="settings-back settings-back-root" onClick={()=>setPage('index')}><ArrowLeft size={20}/>{t('Все настройки')}</button>}
    <h2>{title}</h2>{scope&&<p className="settings-scope">{scope}</p>}
    {current==='connection'&&connectionPanel}{current==='miro'&&<MiroSettings connection={state.online?connection:null} roots={roots}/>}
    {current==='system'&&<><label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.startup} onChange={e=>void action('settings',{startup:e.target.checked})}/><span>{t('Запускать с Windows')}</span></label><label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.autoReconnect} onChange={e=>void action('settings',{autoReconnect:e.target.checked})}/><span>{t('Восстанавливать последнее подключение')}</span></label><p className="muted">{t('Закрытие окна оставляет Pocket Code в трее. Для выхода используйте меню трея → Выход.')}</p><ComposerSettings desktop/>{onShortcuts&&<button className="secondary settings-shortcuts" aria-label={t('Сочетания клавиш')} onClick={onShortcuts}><Keyboard size={16}/>{t('Сочетания клавиш')}<kbd>Ctrl+/</kbd></button>}</>}
    {current==='notifications'&&<><RunAlertsToggle desktop/><LimitAlertsToggle desktop/></>}
    {current==='appearance'&&<><LanguageSelector/><AppearanceSettings {...appearance} connection={connection}/></>}
    {current==='workspace'&&(provider?<><ProviderConnections connection={connection} online={state.online} only={provider}/>{provider==='claude'&&<><ClaudeAccessSettings/><BudgetSettings value={device.budget} onChange={device.setBudget}/></>}{provider==='codex'&&<CodexAccessSettings value={device.codexAccess} onChange={device.setCodexAccess}/>}{provider==='copilot'&&<p className="muted settings-note">{t('Разрешения Copilot подтверждаются в чате для каждого инструмента.')}</p>}</>:<nav className="settings-index" aria-label={t('Провайдеры AI')}>{(['claude','codex','copilot'] as const).map(id=><button className="settings-category" key={id} aria-labelledby={'desktop-provider-'+id} aria-describedby={'desktop-provider-'+id+'-summary'} onClick={()=>setProvider(id)}><span><strong id={'desktop-provider-'+id}>{providerNames[id]}</strong><small id={'desktop-provider-'+id+'-summary'}>{providerSummary(id)}</small></span><ChevronRight size={20} aria-hidden="true"/></button>)}</nav>)}
    {current==='usage'&&<UsageLimits connection={state.online?connection:null} provider="claude"/>}
    {current==='updates'&&<DesktopUpdates state={state} action={action} onConnection={onConnection||(()=>open('connection'))}/>}
    {current==='about'&&<><h3>Pocket Code</h3><p>{pkg.version}</p><p>{t('Личные AI-чаты и общие проектные доски на вашем ПК.')}</p></>}
   </>}</div></section>;
}
