import type {DesktopState} from './desktop-bridge';
import {useId} from 'react';
import {t,useLanguage} from './i18n';
import {Notice,type NoticeTone} from './Notice';
const messages:Record<string,string>={idle:'Готово к проверке',checking:'Проверяем GitHub…',current:'Установлена актуальная версия',downloading:'Скачиваем обновление…',preparing:'Подготавливаем обновление…',ready:'Обновление готово. Ждём завершения активных задач.',restarting:'Перезапускаемся…',complete:'Приложение Windows обновлено',paused:'Обновление приостановлено. Проверьте ещё раз.',error:'Обновление не удалось. Предыдущая версия сохранена.'};
const tones:Record<string,NoticeTone>={current:'success',complete:'success',ready:'info',paused:'warning',error:'error'};
/** Every state names what happens next; when a check is impossible the reason and the fix sit next to the disabled button. */
export function DesktopUpdates({state,action,onConnection}:{state:DesktopState;action:(name:string,args?:Record<string,unknown>)=>unknown;onConnection?:()=>void}){
 useLanguage();const reason=useId();
 const updateState=state.updateState||'idle',busy=['checking','downloading','preparing','ready','restarting'].includes(updateState);
 const message=t(messages[updateState]||messages.idle)+(state.updateVersion?' '+state.updateVersion:'');
 const check=<button className="secondary" disabled={busy||!state.online} aria-describedby={!state.online?reason:undefined} onClick={()=>void action('check-update')}>{updateState==='error'||updateState==='paused'?t('Повторить'):t('Проверить обновления')}</button>;
 return <section className="desktop-updates"><h2>{t('Обновления приложения')}</h2><p>Pocket Code {state.version}</p>
  <label className="desktop-toggle"><input type="checkbox" role="switch" checked={state.autoUpdate!==false} onChange={event=>void action('settings',{autoUpdate:event.target.checked})}/><span>{t('Автоматически обновлять приложение и сервер ПК')}<small>{t('Проверка при подключении и каждые 6 часов. Перед перезапуском дождёмся завершения задач. Аккаунты, чаты и настройки сохранятся.')}</small></span></label>
  {!state.online?<Notice tone="warning" id={reason} title={t('Сервер ПК не в сети')} action={onConnection&&<button className="secondary" onClick={onConnection}>{t('Открыть подключение')}</button>}>{updateState==='error'?t('Последнее обновление не удалось, предыдущая версия сохранена. Запустите сервер ПК, чтобы проверить снова.'):t('Проверка обновлений недоступна, пока сервер ПК не запущен.')}</Notice>
   :tones[updateState]?<Notice tone={tones[updateState]} action={updateState==='error'||updateState==='paused'?check:undefined}>{message}</Notice>:<p role="status">{message}</p>}
  {!(state.online&&(updateState==='error'||updateState==='paused'))&&check}
 </section>;
}
