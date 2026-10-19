import {useCallback,useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {ChevronDown} from 'lucide-react';
import {Notice} from './Notice';
import './miro-settings.css';

type Status={configured:boolean;authenticated:boolean;enabled:boolean;allowWrite:boolean;signInPending:boolean;canManage:boolean;linked:boolean;redirectUri:string};
export function MiroAISettings({connection,root,linked}:{connection:Connection;root:string;linked:string}){
 useLanguage();
 const [confirm,setConfirm]=useState(false);
 const [status,setStatus]=useState<Status>(),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),[token,setToken]=useState(''),[loginUrl,setLoginUrl]=useState(''),[checked,setChecked]=useState<number>();
 const epoch=useRef(0);
 const reload=useCallback(async()=>{const at=epoch.current;const value=await request<Status>(connection,'/miro/status?root='+encodeURIComponent(root));if(at===epoch.current&&typeof value.configured==='boolean')setStatus(value);},[connection,root]);
 useEffect(()=>{const at=++epoch.current;setStatus(undefined);setLoading(true);setBusy(false);setLoginUrl('');setError('');setClientSecret('');setToken('');setChecked(undefined);void reload().catch(()=>{}).finally(()=>{if(at===epoch.current)setLoading(false);});return()=>{epoch.current++;};},[reload,linked]);
 useEffect(()=>{if(!status?.signInPending)return;const timer=setInterval(()=>void reload().catch(()=>{}),3000);return()=>clearInterval(timer);},[status?.signInPending,reload]);
 useEffect(()=>{if(status?.authenticated)setLoginUrl('');},[status?.authenticated]);
 async function run(action:()=>Promise<unknown>){const at=epoch.current;setBusy(true);setError('');try{await action();if(at===epoch.current)await reload();}catch(e){if(at===epoch.current)setError((e as Error).message);}finally{if(at===epoch.current)setBusy(false);}}
 if(!status)return <p className="miro-api-unavailable">{loading?t('Загружаем доступ AI…'):t('Статус интеграции AI недоступен. Обновите или переподключите ПК.')}</p>;
 return <section className="miro-ai-settings" aria-label={t('Доступ AI к Miro')}>
  <h3>{t('Доступ AI')}</h3>
  <p>{status.authenticated?t('Вход Miro сохранён на этом ПК.'):t('Для AI нужна отдельная авторизация приложения Miro. Вход внутри доски не даёт доступ к API.')}</p>
  {!status.canManage?<p>{t('Настройте доступ на хост-ПК.')}</p>:<>
   <details className="miro-api-setup disclosure">
    <summary><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true"/>{t('Настроить вход Miro')}</summary>
    <p>{t('Создайте приложение Miro с правами boards:read и boards:write и зарегистрируйте адрес возврата:')}</p>
    <code>{status.redirectUri}</code>
    <a href="https://developers.miro.com/docs/getting-started-with-oauth" target="_blank" rel="noopener noreferrer">{t('Инструкция Miro')}</a>
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{try{await request(connection,'/miro/config',{clientId,clientSecret});setLoginUrl('');}finally{setClientSecret('');}});}}>
     <label>Client ID<input autoComplete="off" maxLength={200} value={clientId} disabled={busy} onChange={e=>setClientId(e.target.value)}/></label>
     <label>Client secret<input type="password" autoComplete="new-password" maxLength={8192} value={clientSecret} disabled={busy} onChange={e=>setClientSecret(e.target.value)}/></label>
     <button className="secondary" disabled={busy||!clientId||!clientSecret}>{t('Сохранить настройки приложения')}</button>
    </form>
   </details>
   {status.configured&&<button className={status.authenticated?'secondary':'primary'} disabled={busy} onClick={()=>void run(async()=>{const reply=await request<{url:string}>(connection,'/miro/oauth/start',{});const parsed=new URL(reply.url);if(parsed.origin!=='https://miro.com'||parsed.pathname!=='/oauth/authorize')throw Error(t('Некорректный адрес входа.'));setLoginUrl(parsed.href);})}>{status.authenticated?t('Войти в Miro заново'):t('Войти в Miro')}</button>}
   {loginUrl&&<a className="miro-sign-in" href={loginUrl} target="_blank" rel="noopener noreferrer">{t('Продолжить в браузере на этом ПК')}</a>}
   <details className="miro-api-setup disclosure"><summary><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true"/>{t('Использовать токен приложения')}</summary>
    <p>{t('Для личного приложения разработчика Miro. Вставьте токен доступа здесь на ПК. Хост проверит привязанную доску и сохранит токен зашифрованным вне Git.')}</p>
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{try{await request(connection,'/miro/token',{root,token});}finally{setToken('');}});}}><label>{t('Токен доступа')}<input type="password" autoComplete="new-password" value={token} maxLength={8192} onChange={e=>setToken(e.target.value)} disabled={busy}/></label><button className="secondary" disabled={busy||!token||!linked}>{t('Проверить и сохранить токен')}</button></form>
   </details>
   <fieldset disabled={busy||!status.authenticated||!status.linked}>
    <legend>{t('Доска этого проекта')}</legend>
    <label className="miro-access-toggle"><input type="checkbox" checked={status.enabled} onChange={e=>void run(()=>request(connection,'/miro/access',{root,enabled:e.target.checked,allowWrite:false}))}/>{t('Разрешить AI читать эту доску')}</label>
    <label className="miro-access-toggle"><input type="checkbox" checked={status.allowWrite} disabled={!status.enabled} onChange={e=>void run(()=>request(connection,'/miro/access',{root,enabled:true,allowWrite:e.target.checked}))}/>{t('Разрешить AI обновлять заметки, текст и карточки')}</label>
   </fieldset>
   {status.enabled&&<button className="secondary" disabled={busy} onClick={()=>void run(async()=>{const result=await request<{items:unknown[]}>(connection,'/miro/items?root='+encodeURIComponent(root));setChecked(result.items.length);})}>{t('Проверить доступ к доске')}</button>}
   {checked!==undefined&&<p>{t('Доступ проверен. Элементов на первой странице: ')}{checked}</p>}
   {status.authenticated&&!confirm&&<button className="secondary danger" disabled={busy} onClick={()=>setConfirm(true)}>{t('Отключить доступ AI')}</button>}
   {status.authenticated&&confirm&&<div className="confirm-inline" role="group" aria-label={t('Отключить доступ AI')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirm(false);}}}><p>{t('AI перестанет читать и менять доски Miro с этого ПК. Доска и её привязка сохранятся.')}</p><div className="confirm-inline-actions"><button className="primary danger" disabled={busy} onClick={()=>void run(async()=>{await request(connection,'/miro/disconnect',{});setConfirm(false);})}>{t('Отключить сейчас')}</button><button className="secondary" autoFocus onClick={()=>setConfirm(false)}>{t('Отмена')}</button></div></div>}
  </>}
  {error&&<Notice tone="error">{error}</Notice>}
  <p className="miro-api-hint">{t('Доступ AI включается отдельно для каждой привязанной доски. Отключение сохраняет доску и её привязку. Нужен интернет. Локальный выход не отзывает разрешение приложения в Miro.')}</p>
 </section>;
}
