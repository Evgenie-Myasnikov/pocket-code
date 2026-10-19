import {ClaudeAccessSettings,claudeAccessLabel} from './ClaudeAccessSettings';
import {ComposerSettings} from './ComposerSettings';
import {MiroSettings} from './MiroSettings';
import {ProviderConnections} from './ProviderConnections';
import {ArrowLeft,ChevronRight,Terminal} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {LanguageSelector} from './Language';
import {AppearanceSettings,appearanceSummary,useAppearance} from './Appearance';
import {CodexAccessSettings,codexAccessLabel} from './CodexAccessSettings';
import {UsageLimits} from './UsageOverview';
import {useState} from 'react';
import {setRunAlerts,useRunAlertsPreference} from './chat-notifications';
import {EngineUpdates} from './EngineUpdates';
import {JiraSettings} from './Jira';
import {jiraEnabled} from './features';
import {BudgetSettings,budgetLabel} from './BudgetSettings';
import {useClaudeAccess} from './claude-access';
import {useLiveSettings} from './live-settings';
import {LimitAlertsToggle,useLimitAlertsPreference} from './LimitAlert';
import {narrowestWindow,percentLabel} from './usage-format';
import {resetLabel,windowLabel} from './CodexUsage';
import {categoryHint,categoryIcon,categoryTitle,groupedCategories,settingsCategories,type SettingsCategory,type SettingsPlatform} from './settings-registry';
import type {Connection} from './api';
import type {WorkspaceProvider,CodexAccess} from './preferences';
import pkg from '../package.json';
import {useEffect,useRef,type ReactNode} from 'react';
import {useBackAction} from './navigation';
import './settings.css';

export type SettingsPage='index'|'appearance'|'workspace'|'usage'|'jira'|'miro'|'updates'|'connection'|'notifications'|'about';
type Subpage='index'|'account'|'access'|'composer'|'project';
const providerNames:Record<WorkspaceProvider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const storage=(id:string)=>settingsCategories.find(item=>item.id===id)?.storage;
/** Index row: the title is the button's name, the live value its description (D14: nothing hidden behind aria-label). */
export function SettingsCategoryButton({category,platform,summary,badge,current,onOpen}:{category:SettingsCategory;platform:SettingsPlatform;summary:ReactNode;badge?:boolean;current?:boolean;onOpen():void}){
  const Icon=categoryIcon(category,platform),id=`settings-${platform}-${category.id}`;
  return <button className={'settings-category'+(current?' current':'')} data-settings-category={category.id} aria-current={current?'page':undefined} aria-labelledby={id+'-title'} aria-describedby={id+'-summary'} onClick={onOpen}><Icon size={20} aria-hidden="true"/><span><strong id={id+'-title'}>{t(categoryTitle(category,platform))}{badge&&<span className="settings-badge" aria-hidden="true"/>}</strong><small id={id+'-summary'}>{summary}</small></span><ChevronRight size={20} aria-hidden="true"/></button>;
}
export function usageSummary(provider:WorkspaceProvider,live:ReturnType<typeof useLiveSettings>){
  const narrowest=narrowestWindow(live.usage(provider));
  return narrowest?t('{0} · {1}: осталось {2}%',providerNames[provider],windowLabel(narrowest.window,provider),percentLabel(narrowest.remaining))+(narrowest.window.resetsAt!==null?' · '+resetLabel(narrowest.window.resetsAt):''):null;
}
type Props={connectionPanel?:ReactNode;workspaceSelector?:ReactNode;page:SettingsPage;onPage(page:SettingsPage):void;subpageRequest?:'access'|null;provider:WorkspaceProvider;connection:Connection|null;computerName:string;networkError:string;roots:string[];cwd:string;onProject(root:string):void;appearance:ReturnType<typeof useAppearance>;codexAccess:CodexAccess;onCodexAccess(value:CodexAccess):void;budget:number;onBudget(value:number):void;online?:boolean};
export function SettingsPanel({connectionPanel,workspaceSelector,page,onPage,subpageRequest,provider,connection,computerName,roots,cwd,onProject,appearance,codexAccess,onCodexAccess,budget,onBudget,online}:Props){
  useLanguage();
  const [subpage,setSubpage]=useState<Subpage>(subpageRequest||'index');
  useEffect(()=>setSubpage(subpageRequest||'index'),[page,subpageRequest]);
  useEffect(()=>{if(subpage==='access'&&provider==='copilot')setSubpage('index');},[provider,subpage]);
  // Android Back and Esc leave an AI account page for the AI accounts list first, the same level the on-screen Back names.
  useBackAction(()=>{setSubpage('index');return true;},10,page==='workspace'&&subpage!=='index');
  const previousSub=useRef(subpage);
  useEffect(()=>{const prior=previousSub.current;previousSub.current=subpage;if(subpage==='index'&&prior!=='index')content.current?.querySelector<HTMLButtonElement>(`[data-settings-subpage="${prior}"]`)?.focus({preventScroll:true});},[subpage]);
  const live=useLiveSettings(),claudeAccess=useClaudeAccess(),alerts=useRunAlertsPreference(),limitAlerts=useLimitAlertsPreference();
  const groups=groupedCategories('phone',jiraEnabled()?[]:['jira']),category=settingsCategories.find(item=>item.id===page);
  const content=useRef<HTMLDivElement|null>(null),previous=useRef(page),indexScroll=useRef(0);
  useEffect(()=>{
    if(previous.current===page)return;const prior=previous.current;previous.current=page;
    if(content.current){content.current.scrollTop=page==='index'?indexScroll.current:0;const target=page==='index'?content.current.querySelector<HTMLButtonElement>(`[data-settings-category="${prior}"]`):content.current.querySelector<HTMLButtonElement>('.settings-back');target?.focus({preventScroll:true});}
  },[page]);
  const accessSummary=provider==='copilot'?t('Разрешения подтверждаются в чате'):provider==='codex'?codexAccessLabel(codexAccess):claudeAccessLabel(claudeAccess)+' · '+t('до {0} за запрос',budgetLabel(budget));
  const summaries:Record<string,ReactNode>={
    connection:connection&&!connection.workspaceOnly?<><span className={'connect-dot '+(online?'online':'offline')} aria-hidden="true"/>{computerName} · {online?t('Подключено'):t('Нет связи')}</>:t('Не подключено · отсканируйте QR'),
    updates:live.update?t('Доступно {0}',live.update):t('Установлена версия {0}',pkg.version),
    workspace:providerNames[provider]+' · '+accessSummary,
    usage:usageSummary(provider,live)||t('Оставшийся лимит и время сброса'),
    appearance:appearanceSummary(appearance.appearance),
    notifications:[alerts?t('Вкл.: завершение, ошибки, вопросы'):t('Чаты: выключены'),limitAlerts?t('предупреждения о лимитах'):''].filter(Boolean).join(' · '),
    about:t('Версия {0}',pkg.version),
  };
  const subpages:{id:Exclude<Subpage,'index'>;title:string;summary:string}[]=[
    {id:'account',title:'Аккаунт AI',summary:providerNames[provider]},
    ...(provider==='copilot'?[]:[{id:'access' as const,title:'Доступ агента',summary:accessSummary}]),
    {id:'composer',title:'Сообщения и подтверждения',summary:t('Отправка, подтверждения и время ожидания')},
    {id:'project',title:'Папка для новых чатов',summary:cwd.split(/[\\/]/).filter(Boolean).at(-1)||cwd||t('Не выбрана')},
  ];
  const subTitle=subpage==='account'?t('Аккаунт {0}',providerNames[provider]):subpage==='access'?t('Доступ агента · {0}',providerNames[provider]):subpage==='composer'?t('Сообщения и подтверждения'):subpage==='project'?t('Папка для новых чатов'):'';
  const inSubpage=page==='workspace'&&subpage!=='index',scope=page==='workspace'&&subpage!=='account'?t('Хранится на этом устройстве'):category?.storage&&t(category.storage);
  return <section className="settings-panel settings-categorized" data-settings-page={page}><div className="settings-content" ref={content} key={`${provider}:${page}`}>
    {page==='index'?<nav className="settings-index" aria-label={t('Разделы настроек')}>{groups.map(group=><div className="settings-group" role="group" aria-labelledby={'settings-group-'+group.id} key={group.id}><h3 className="settings-group-title" id={'settings-group-'+group.id}>{t(group.title)}</h3>{group.items.map(item=><SettingsCategoryButton key={item.id} category={item} platform="phone" summary={summaries[item.id]||t(categoryHint(item,'phone'))} badge={item.id==='updates'&&!!live.update} onOpen={()=>{indexScroll.current=content.current?.scrollTop||0;onPage(item.id as SettingsPage);}}/>)}</div>)}</nav>:<>
      {inSubpage?<button className="settings-back" onClick={()=>setSubpage('index')}><ArrowLeft size={20}/>{t('Аккаунты AI')}</button>:<button className="settings-back" onClick={()=>onPage('index')}><ArrowLeft size={20}/>{t('Все настройки')}</button>}
      <h2 className="settings-page-title">{inSubpage?subTitle:t(category?.title||'Настройки')}</h2>
      {scope&&<p className="settings-scope">{scope}</p>}
      {page==='appearance'&&<><LanguageSelector/><AppearanceSettings {...appearance}/></>}
      {page==='workspace'&&<>{subpage==='index'&&<>{workspaceSelector}<nav className="settings-index settings-subindex" aria-label={t('Разделы аккаунта AI')}>{subpages.map(item=><button className="settings-category" key={item.id} data-settings-subpage={item.id} aria-labelledby={'settings-sub-'+item.id} aria-describedby={'settings-sub-'+item.id+'-summary'} onClick={()=>setSubpage(item.id)}><span><strong id={'settings-sub-'+item.id}>{t(item.title)}</strong><small id={'settings-sub-'+item.id+'-summary'}>{item.summary}</small></span><ChevronRight size={20} aria-hidden="true"/></button>)}</nav>{provider==='copilot'&&<p className="muted settings-note">{t('Разрешения Copilot подтверждаются в чате для каждого инструмента.')}</p>}</>}
        {subpage==='account'&&<><ProviderConnections connection={connection} only={provider}/>{provider==='copilot'&&<p className="muted settings-note">{t('Разрешения Copilot подтверждаются в чате для каждого инструмента.')}</p>}</>}
        {subpage==='composer'&&<ComposerSettings desktop={false}/>}
        {subpage==='project'&&<label>{t('Папка для новых чатов')}<select value={roots.includes(cwd)?cwd:''} onChange={event=>onProject(event.target.value)}>{!roots.includes(cwd)&&<option value="">{cwd}</option>}{roots.map(root=><option key={root}>{root}</option>)}</select></label>}
        {subpage==='access'&&(provider==='codex'?<CodexAccessSettings value={codexAccess} onChange={onCodexAccess}/>:provider==='claude'?<><ClaudeAccessSettings/><BudgetSettings value={budget} onChange={onBudget}/></>:null)}</>}
      {page==='usage'&&<UsageLimits connection={connection} provider={provider}/>}
      {page==='miro'&&<MiroSettings connection={connection} roots={roots}/>}
      {page==='jira'&&jiraEnabled()&&<JiraSettings key={provider} connection={connection} provider={provider}/>}
      {page==='updates'&&<><div id="settings-updates"/><EngineUpdates connection={connection} provider={provider}/></>}
      {page==='notifications'&&<><RunAlertsToggle/><LimitAlertsToggle/></>}{page==='connection'&&connectionPanel}
      {page==='about'&&<div className="settings-about"><span className="logo"><Terminal size={24}/></span><h3>Pocket Code</h3><span className="version">BETA</span><p>{t('Версия {0}',pkg.version)}</p><p className="muted">{t('Claude Code и Codex с вашего ПК — на телефоне.')}</p></div>}
    </>}</div>
  </section>;
}
export function RunAlertsToggle({desktop=false}:{desktop?:boolean}){
  useLanguage();const enabled=useRunAlertsPreference();
  return <div className="settings-run-alerts"><label className={desktop?'desktop-toggle':'checkbox-label'}><input type="checkbox" role={desktop?'switch':undefined} checked={enabled} onChange={event=>setRunAlerts(event.target.checked)}/><span>{desktop?t('Уведомлять, когда агент завершил работу, упал или ждёт ответа'):t('Уведомлять, когда чат на ПК завершён, упал или ждёт ответа')}</span></label><p className="muted">{desktop?t('Уведомления Windows приходят, даже когда окно Pocket Code свёрнуто в трей.'):t('Включая чаты, запущенные на ПК и не открытые на телефоне. Пока ПК подключён, Android показывает тихое уведомление о слежении.')}</p></div>;
}
