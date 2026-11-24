import type {DesktopState} from './desktop-bridge';
import {useId} from 'react';
import {t,useLanguage} from './i18n';
import {Notice,type NoticeTone} from './Notice';
import {useActivity} from './useActivity';
import {providerName} from './ActivityList';
import type {Connection} from './api';
import './updates.css';
import pkg from '../package.json';
import {SettingRow,SettingsBlock,SettingsLine,SwitchRow} from './SettingsRows';
const host:Connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
const megabytes=(bytes:number)=>(bytes/1048576).toLocaleString(undefined,{maximumFractionDigits:1});
/** Download progress as a determinate bar with "23.4 / 46 MB"; without a known size only the state is shown. */
export function UpdateProgress({received,total}:{received:number;total:number}){if(!total)return null;const percent=Math.min(100,Math.round(received/total*100));return <div className="update-progress"><progress max={100} value={percent} aria-label={t('Загрузка обновления')}/><span>{t('{0} / {1} МБ · {2}%',megabytes(received),megabytes(total),percent)}</span></div>;}
const messages:Record<string,string>={idle:'Готово к проверке',checking:'Проверяем GitHub…',current:'Установлена актуальная версия',downloading:'Скачиваем обновление…',preparing:'Подготавливаем обновление…',ready:'Обновление готово. Перезапуск — когда завершатся активные задачи.',restarting:'Перезапускаемся…',complete:'Приложение Windows обновлено',paused:'Обновление приостановлено. Проверьте ещё раз.',error:'Обновление не удалось. Предыдущая версия сохранена.'};
const tones:Record<string,NoticeTone>={current:'success',complete:'success',ready:'info',paused:'warning',error:'error'};
/** Every state names what happens next; when a check is impossible the reason and the fix sit next to the disabled button. */
export function DesktopUpdates({state,action}:{state:DesktopState;action:(name:string,args?:Record<string,unknown>)=>unknown}){
 useLanguage();const reason=useId();
 const updateState=state.updateState||'idle',busy=['checking','downloading','preparing','ready','restarting'].includes(updateState);
 const message=t(messages[updateState]||messages.idle);
 // While a ready update waits, the running tasks that hold the restart are listed by name.
 const activity=useActivity(updateState==='ready'&&state.online?host:null),blocking=activity.items.filter(item=>item.status==='running'||item.status==='needs_input');
 const version=state.updateVersion&&['downloading','preparing','ready','restarting'].includes(updateState)?<span className="update-version-chip">{updateState==='ready'?t('{0} готово',state.updateVersion):state.updateVersion}</span>:null;
 const details=<>{version}<span>{message}</span>{updateState==='downloading'&&<UpdateProgress received={state.updateReceived||0} total={state.updateSize||0}/>}{updateState==='ready'&&blocking.length>0&&<div className="update-blocking"><p>{t('Ждём задачи: {0}',blocking.length)}</p><ul>{blocking.map(item=><li key={item.provider+item.id}>{item.title||t('Новый разговор')} · {providerName(item.provider)}</li>)}</ul></div>}</>;
 const check=<button className="secondary" disabled={busy||!state.online} aria-describedby={!state.online?reason:undefined} onClick={()=>void action('check-update')}>{updateState==='error'||updateState==='paused'?t('Повторить'):t('Проверить обновления')}</button>;
 const statusLine=!state.online?<Notice tone="warning" id={reason} title={t('Сервер ПК не в сети')} action={<button className="secondary" disabled={state.busy||state.statusCode==='preparing'||state.statusCode==='starting'} onClick={()=>void action('restart-host')}>{t('Запустить локальный сервер')}</button>}>{updateState==='error'?t('Последнее обновление не удалось, предыдущая версия сохранена. Запустите сервер ПК, чтобы проверить снова.'):t('Проверка обновлений недоступна, пока сервер ПК не запущен.')}</Notice>
   :tones[updateState]?<Notice tone={tones[updateState]} action={updateState==='error'||updateState==='paused'?check:undefined}><div className="update-status">{details}</div></Notice>:null;
 return <SettingsBlock title="Pocket Code" className="desktop-updates">
  <SettingRow title={t('Версия {0}',state.version||pkg.version)} note={!tones[updateState]&&state.online?<span className="update-status" role="status">{details}</span>:t('Windows-приложение и сервер ПК')}>{!(state.online&&(updateState==='error'||updateState==='paused'))&&check}</SettingRow>
  {statusLine&&<SettingsLine>{statusLine}</SettingsLine>}
  <SwitchRow title={t('Автоматически обновлять приложение и сервер ПК')} note={t('Каждые 6 часов; перезапуск после завершения задач')} checked={state.autoUpdate!==false} onChange={value=>void action('settings',{autoUpdate:value})}/>
 </SettingsBlock>;
}
