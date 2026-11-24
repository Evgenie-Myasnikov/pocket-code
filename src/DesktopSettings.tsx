import {ChatImport} from './ChatImport';
import {CustomProviderAccount,CustomProviderList} from './CustomProviderAccounts';
import {LocalModelSettings} from './LocalModels';
import {SpeechSettingsPanel} from './SpeechSettings';
import {BoardGridSettings} from './BoardGridSettings';
import {settingsPage} from './settings-registry';
import {ClaudeEngineUpdate} from './ClaudeEngineUpdate';
import {ClaudeAccessSettings,claudeAccessLabel} from './ClaudeAccessSettings';
import {CodexAccessSettings,codexAccessLabel} from './CodexAccessSettings';
import {ComposerSettings} from './ComposerSettings';
import {MiroSettings} from './MiroSettings';
import {useEffect,useState,useSyncExternalStore,type ReactNode} from 'react';
import {ArrowLeft,Keyboard} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {AppearanceSettings,appearanceSummary,type useAppearance} from './Appearance';
import {LanguageSelector} from './Language';
import {ProviderConnections} from './ProviderConnections';
import {DesktopUpdates} from './DesktopUpdates';
import {UsageLimits} from './UsageOverview';
import {BudgetSettings} from './BudgetSettings';
import {RunAlertsToggle,SettingsCategoryButton,usageSummary} from './SettingsPanel';
import {DesktopConnectionSettings} from './DesktopConnectionSettings';
import {SettingRow,SettingsBlock} from './SettingsRows';
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

const wideQuery='(min-width:1100px)';
function useWide(){return useSyncExternalStore(listener=>{const media=matchMedia(wideQuery);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);},()=>matchMedia(wideQuery).matches,()=>true);}
/** Device defaults the shared chat reads at send time; changes here reach open chats through updatePreferences. */
function useDevicePreferences(){
  const [codexAccess,setCodexAccess]=useState(()=>preferences('codex').codexAccess),[budget,setBudget]=useState(()=>preferences('claude').budget);
  useEffect(()=>{const sync=(event:Event)=>{const change=(event as CustomEvent<PreferenceChange>).detail;if(change?.provider==='codex'&&change.codexAccess)setCodexAccess(change.codexAccess);if(change?.provider==='claude'&&change.budget!==undefined)setBudget(preferences('claude').budget);};window.addEventListener('pocket-code-preferences',sync);return()=>window.removeEventListener('pocket-code-preferences',sync);},[]);
  return {codexAccess,budget,setCodexAccess:(value:CodexAccess)=>{setCodexAccess(value);updatePreferences({provider:'codex',codexAccess:value});},setBudget:(value:number)=>{setBudget(value);updatePreferences({provider:'claude',budget:value});}};
}
/** List-detail on wide windows (sections stay visible on the left); level-by-level below 1100 px. */
/** connectionPanel is accepted from older callers; the connection page draws its own rows from state. */
export function DesktopSettings({state,connection,appearance,action,initialPage='index',roots=[],onShortcuts}:{onShortcuts?():void;roots?:string[];connectionPanel?:ReactNode;initialPage?:string;state:DesktopState;connection:Connection;appearance:ReturnType<typeof useAppearance>;action(command:string,args?:Record<string,unknown>):Promise<void>}){
  useLanguage();
  const wide=useWide(),[page,setPage]=useState<SettingsCategoryId|'index'>(initialPage==='providers'?'workspace':settingsPage(initialPage) as SettingsCategoryId|'index'),[custom,setCustom]=useState<string|null>(null);
  const live=useLiveSettings(),claudeAccess=useClaudeAccess(),alerts=useRunAlertsPreference(),limitAlerts=useLimitAlertsPreference(),device=useDevicePreferences();
  // Without a chosen section the wide layout opens AI accounts, never the pairing QR, so a shared screen does not show it unasked.
  const current:SettingsCategoryId|'index'=page==='index'&&wide?'workspace':page,category=settingsCategories.find(item=>item.id===current);
  const groups=groupedCategories('desktop');
  const back=()=>{if(custom){setCustom(null);return true;}if(page!=='index'&&!wide){setPage('index');return true;}return false;};
  useBackAction(back,10);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.altKey&&event.key==='ArrowLeft'&&back())event.preventDefault();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);});
  const open=(id:SettingsCategoryId)=>{setCustom(null);setPage(id);};
  const updateBadge=['ready','error','paused'].includes(state.updateState||'');
  const summaries:Partial<Record<SettingsCategoryId,ReactNode>>={
    connection:state.phoneAccess!==undefined?(state.activePhoneAccess?t('Доступ с телефона включён'):t('Доступ с телефона выключен')):state.online?t('Сервер ПК в сети')+(state.internet?' · '+(state.tunnelOnline?t('туннель активен'):t('туннель не подключён')):''):t('Сервер ПК не в сети'),
    updates:state.updateState==='ready'?t('Обновление готово {0}',state.updateVersion||''):state.updateState==='error'?t('Обновление не удалось'):t('Установлена версия {0}',state.version||pkg.version),
    system:[state.startup?t('Запуск с Windows'):t('Без автозапуска'),state.autoReconnect?t('переподключение вкл.'):t('переподключение выкл.')].join(' · '),
    workspace:'Claude · '+claudeAccessLabel(claudeAccess)+' · Codex · '+codexAccessLabel(device.codexAccess),
    usage:usageSummary('claude',live)||usageSummary('codex',live)||t('Оставшийся лимит и время сброса'),
    appearance:appearanceSummary(appearance.appearance),
    notifications:[alerts?t('Вкл.: завершение, ошибки, вопросы'):t('Чаты: выключены'),limitAlerts?t('предупреждения о лимитах'):''].filter(Boolean).join(' · '),
    chat:t('Отправка, подтверждения и время ожидания'),
  };
  const nav=<nav className="settings-index" aria-label={t('Разделы настроек')}>{groups.map(group=><div className="settings-group" role="group" aria-labelledby={'desktop-settings-group-'+group.id} key={group.id}><h3 className="settings-group-title" id={'desktop-settings-group-'+group.id}>{t(group.title)}</h3>{group.items.map(item=><SettingsCategoryButton key={item.id} category={item} platform="desktop" current={wide&&current===item.id} summary={summaries[item.id]||t(categoryHint(item,'desktop'))} badge={item.id==='updates'&&updateBadge} onOpen={()=>open(item.id)}/>)}</div>)}</nav>;
  const title=custom?(custom==='new'?t('Новый провайдер'):t('Свой провайдер')):category?t(categoryTitle(category,'desktop')):t('Настройки');
  const scope=custom?t('Ключ и адрес хранятся на ПК; провайдер доступен с каждого устройства'):category?.storage&&t(category.storage);
  const host=state.online?connection:null;
  return <section className={'desktop-settings settings-categorized settings-list-detail settings-rows-layout'+(page!=='index'?' has-page':'')}><header><h1>{t('Настройки')}</h1></header>{nav}
   <div className="settings-detail">{current!=='index'&&<>
    {custom?<button className="settings-back" onClick={()=>setCustom(null)}><ArrowLeft size={20}/>{t('Все провайдеры')}</button>:<button className="settings-back settings-back-root" onClick={()=>setPage('index')}><ArrowLeft size={20}/>{t('Все настройки')}</button>}
    <h2>{title}</h2>{scope&&<p className="settings-scope">{scope}</p>}
    {current==='connection'&&<DesktopConnectionSettings state={state} action={action}/>}
    {current==='updates'&&<><DesktopUpdates state={state} action={action}/><ClaudeEngineUpdate connection={host} block/></>}
    {current==='workspace'&&(custom?<CustomProviderAccount connection={connection} online={state.online} id={custom} onSaved={setCustom} onRemoved={()=>setCustom(null)}/>:<>
      {(['claude','codex','copilot'] as const).map(id=><ProviderConnections key={id} connection={connection} online={state.online} only={id} rows>
        {id==='claude'&&<><ClaudeAccessSettings row/><BudgetSettings row value={device.budget} onChange={device.setBudget}/></>}
        {id==='codex'&&<CodexAccessSettings row value={device.codexAccess} onChange={device.setCodexAccess}/>}
        {id==='copilot'&&<SettingRow title={t('Доступ агента')} note={t('Разрешения Copilot подтверждаются в чате для каждого инструмента.')}/>}
      </ProviderConnections>)}
      {host&&<SettingsBlock title={t('Лимиты использования')} className="settings-usage"><UsageLimits connection={host} provider="claude"/></SettingsBlock>}
      {state.online&&<SettingsBlock title={t('Свои провайдеры')}><nav className="settings-index" aria-label={t('Свои провайдеры')}><CustomProviderList connection={connection} online={state.online} onOpen={setCustom}/></nav></SettingsBlock>}
      <LocalModelSettings connection={connection} online={state.online}/>
    </>)}
    {current==='chat'&&<><SettingsBlock title={t('Сообщения')}><ComposerSettings desktop rows/>{onShortcuts&&<SettingRow title={t('Сочетания клавиш')} note={t('Список и настройка горячих клавиш')}><button className="secondary settings-shortcuts" aria-label={t('Сочетания клавиш')} onClick={onShortcuts}><Keyboard size={16}/>{t('Изменить')}<kbd>Ctrl+/</kbd></button></SettingRow>}<ChatImport connection={host}/></SettingsBlock><SpeechSettingsPanel connection={host} rows/></>}
    {current==='board'&&<><SettingsBlock title={t('Доска')}><BoardGridSettings row/><SettingRow title="Jira" note={t('Вход в Jira — только в Android-приложении')}/></SettingsBlock><MiroSettings connection={host} roots={roots} rows/></>}
    {current==='notifications'&&<SettingsBlock label={t('Уведомления')}><RunAlertsToggle desktop/><LimitAlertsToggle desktop/></SettingsBlock>}
    {current==='appearance'&&<><SettingsBlock title={t('Язык')}><LanguageSelector row/></SettingsBlock><SettingsBlock title={t('Оформление')} className="settings-appearance"><AppearanceSettings {...appearance} connection={connection}/></SettingsBlock></>}
   </>}</div></section>;
}
