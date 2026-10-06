import {ClaudeAccessSettings} from './ClaudeAccessSettings';
import {MiroSettings} from './MiroSettings';
import {ProviderConnections} from './ProviderConnections';
import {CopilotConnection} from './CopilotConnection';
import {ArrowLeft,ChevronRight,Palette,SlidersHorizontal,ChartNoAxesCombined,Link2,Download,Laptop,Info,LogOut,Terminal} from 'lucide-react';
import {t} from './i18n';
import {LanguageSelector} from './Language';
import {AppearanceSettings,useAppearance} from './Appearance';
import {CodexAccessSettings} from './CodexAccessSettings';
import {CodexUsage} from './CodexUsage';
import {Capacitor} from '@capacitor/core';
import {useState} from 'react';
import {runAlertsEnabled,setRunAlerts} from './chat-notifications';
import {EngineUpdates} from './EngineUpdates';
import {JiraSettings} from './Jira';
import type {Connection} from './api';
import type {WorkspaceProvider,CodexAccess} from './preferences';
import pkg from '../package.json';
import {useEffect,useRef,type ReactNode} from 'react';
import './settings.css';

export type SettingsPage='index'|'appearance'|'workspace'|'usage'|'jira'|'miro'|'updates'|'connection'|'notifications'|'about';
const categories=[
  {id:'miro',title:'Miro',hint:'Подключение досок проектов',Icon:Link2},
  {id:'appearance',title:'Оформление и язык',hint:'Тема, цвета и размер текста',Icon:Palette},
  {id:'workspace',title:'Аккаунты AI',hint:'Аккаунт, доступ и параметры чата',Icon:SlidersHorizontal},
  {id:'usage',title:'Лимиты использования',hint:'Оставшийся лимит и время сброса',Icon:ChartNoAxesCombined},
  {id:'jira',title:'Jira',hint:'Подключение к сервису задач',Icon:Link2},
  {id:'updates',title:'Обновления',hint:'Версия приложения и установка обновлений',Icon:Download},
  {id:'connection',title:'Подключение к ПК',hint:'QR и подключённый компьютер',Icon:Laptop},
  {id:'notifications',title:'Уведомления',hint:'Завершение, ошибки и вопросы агента',Icon:Laptop},
  {id:'about',title:'О приложении',hint:'Pocket Code',Icon:Info},
] as const;
type Props={connectionPanel?:ReactNode;workspaceSelector?:ReactNode;page:SettingsPage;onPage(page:SettingsPage):void;provider:WorkspaceProvider;connection:Connection|null;computerName:string;networkError:string;roots:string[];cwd:string;onProject(root:string):void;appearance:ReturnType<typeof useAppearance>;codexAccess:CodexAccess;onCodexAccess(value:CodexAccess):void;budget:number;onBudget(value:number):void;onDisconnect():void};
export function SettingsPanel({connectionPanel,workspaceSelector,page,onPage,provider,connection,computerName,networkError,roots,cwd,onProject,appearance,codexAccess,onCodexAccess,budget,onBudget,onDisconnect}:Props){
  const [subpage,setSubpage]=useState<'index'|'account'|'access'|'project'>('index');
  useEffect(()=>setSubpage('index'),[page]);
  const category=categories.find(item=>item.id===page);
  const content=useRef<HTMLDivElement|null>(null),previous=useRef(page),indexScroll=useRef(0);
  useEffect(()=>{
    if(previous.current===page)return;const prior=previous.current;previous.current=page;
    if(content.current){content.current.scrollTop=page==='index'?indexScroll.current:0;const target=page==='index'?content.current.querySelector<HTMLButtonElement>(`[data-settings-category="${prior}"]`):content.current.querySelector<HTMLButtonElement>('.settings-back');target?.focus({preventScroll:true});}
  },[page]);
  return <section className="settings-panel settings-categorized" data-settings-page={page}><div className="settings-content" ref={content} key={`${provider}:${page}`}>
    {page==='index'?<nav className="settings-index" aria-label={t('Разделы настроек')}>{categories.map(({id,title,hint,Icon})=><button className="settings-category" key={id} data-settings-category={id} onClick={()=>{indexScroll.current=content.current?.scrollTop||0;onPage(id);}} aria-label={t(title)}><Icon size={21}/><span><strong>{t(title)}</strong><small>{t(hint)}</small></span><ChevronRight size={18}/></button>)}</nav>:<>
      <button className="settings-back" onClick={()=>onPage('index')}><ArrowLeft size={18}/>{t('Все настройки')}</button>
      <h2 className="settings-page-title">{t(category?.title||'Настройки')}</h2>
      {page==='appearance'&&<><LanguageSelector/><AppearanceSettings {...appearance}/></>}
      {page==='workspace'&&<>{workspaceSelector}{subpage==='index'?<nav className="settings-index">{(['account','access','project'] as const).map(id=><button className="settings-category" key={id} onClick={()=>setSubpage(id)}><span><strong>{t(id==='account'?'Аккаунт AI':id==='access'?'Доступ агента':'Папка для новых чатов')}</strong></span><ChevronRight size={18}/></button>)}</nav>:<button className="settings-back" onClick={()=>setSubpage('index')}><ArrowLeft size={18}/>{t('Назад')}</button>}{subpage==='account'&&<ProviderConnections connection={connection} only={provider}/>}<p className="muted">{t('Настройки рабочего пространства {0}',provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude')}</p>{subpage==='project'&&<label>{t('Папка для новых чатов')}<select value={roots.includes(cwd)?cwd:''} onChange={event=>onProject(event.target.value)}>{!roots.includes(cwd)&&<option value="">{cwd}</option>}{roots.map(root=><option key={root}>{root}</option>)}</select></label>}{subpage==='access'&&(provider==='copilot'?<></>:provider==='codex'?<CodexAccessSettings value={codexAccess} onChange={onCodexAccess}/>:<><ClaudeAccessSettings/><label>{t('Лимит стоимости одного запроса, $')}<input type="number" min="0.1" max="100" step="0.1" value={budget} onChange={event=>onBudget(Number(event.target.value))}/></label><p className="muted">{t('Оценка Agent SDK. Фактическая оплата зависит от способа входа в Claude. Лимит применяется к следующему сообщению.')}</p></>)}</>}
      {page==='usage'&&<>{workspaceSelector}<CodexUsage connection={connection} provider={provider}/></>}
      {page==='miro'&&<MiroSettings connection={connection} roots={roots}/>}
      {page==='jira'&&<JiraSettings key={provider} connection={connection} provider={provider}/>}
      {page==='updates'&&<><div id="settings-updates"/>{provider!=='copilot'&&<EngineUpdates connection={connection} provider={provider}/>}</>}
      {page==='notifications'&&<RunAlertsToggle/>}{page==='connection'&&connectionPanel}
      {page==='about'&&<div className="settings-about"><span className="logo"><Terminal size={24}/></span><h3>Pocket Code</h3><span className="version">BETA</span><p>{t('Версия {0}',pkg.version)}</p><p className="muted">{t('Claude Code и Codex с вашего ПК — на телефоне.')}</p></div>}
    </>}{page==='index'&&<footer className="settings-exit"><button className="settings-category settings-disconnect" onClick={onDisconnect}><LogOut size={21}/><span><strong>{t('Отключить и забыть')}</strong></span></button></footer>}</div>
  </section>;
}
function RunAlertsToggle(){
  const [enabled,setEnabled]=useState(runAlertsEnabled);
  return <div className="settings-run-alerts"><label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);setRunAlerts(event.target.checked);}}/>{t('Уведомлять о завершении любых чатов на ПК')}</label><p className="muted">{t('Включая чаты, запущенные на ПК и не открытые на телефоне. Пока ПК подключён, Android показывает тихое уведомление о слежении.')}</p></div>;
}
