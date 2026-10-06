import {useCallback,useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import './miro-settings.css';

type Status={configured:boolean;authenticated:boolean;enabled:boolean;allowWrite:boolean;signInPending:boolean;canManage:boolean;linked:boolean;redirectUri:string};
export function MiroAISettings({connection,root,linked}:{connection:Connection;root:string;linked:string}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [status,setStatus]=useState<Status>(),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clientId,setClientId]=useState(''),[clientSecret,setClientSecret]=useState(''),[token,setToken]=useState(''),[loginUrl,setLoginUrl]=useState(''),[checked,setChecked]=useState<number>();
 const epoch=useRef(0);
 const reload=useCallback(async()=>{const at=epoch.current;const value=await request<Status>(connection,'/miro/status?root='+encodeURIComponent(root));if(at===epoch.current&&typeof value.configured==='boolean')setStatus(value);},[connection,root]);
 useEffect(()=>{const at=++epoch.current;setStatus(undefined);setLoading(true);setBusy(false);setLoginUrl('');setError('');setClientSecret('');setToken('');setChecked(undefined);void reload().catch(()=>{}).finally(()=>{if(at===epoch.current)setLoading(false);});return()=>{epoch.current++;};},[reload,linked]);
 useEffect(()=>{if(!status?.signInPending)return;const timer=setInterval(()=>void reload().catch(()=>{}),3000);return()=>clearInterval(timer);},[status?.signInPending,reload]);
 useEffect(()=>{if(status?.authenticated)setLoginUrl('');},[status?.authenticated]);
 async function run(action:()=>Promise<unknown>){const at=epoch.current;setBusy(true);setError('');try{await action();if(at===epoch.current)await reload();}catch(e){if(at===epoch.current)setError((e as Error).message);}finally{if(at===epoch.current)setBusy(false);}}
 if(!status)return <p className="miro-api-unavailable">{loading?l('Loading AI access…','Загружаем доступ AI…'):l('AI integration status is unavailable. Update or reconnect the PC host.','Статус интеграции AI недоступен. Обновите или переподключите ПК.')}</p>;
 return <section className="miro-ai-settings" aria-label={l('Miro AI access','Доступ AI к Miro')}>
  <h3>{l('AI access','Доступ AI')}</h3>
  <p>{status.authenticated?l('Miro sign-in is saved on this PC.','Вход Miro сохранён на этом ПК.'):l('A separate Miro app authorization is needed for AI. Signing in inside the board does not enable API access.','Для AI нужна отдельная авторизация приложения Miro. Вход внутри доски не даёт доступ к API.')}</p>
  {!status.canManage?<p>{l('Set up access on the host PC.','Настройте доступ на хост-ПК.')}</p>:<>
   <details className="miro-api-setup">
    <summary>{l('Set up Miro sign-in','Настроить вход Miro')}</summary>
    <p>{l('Create a Miro app with boards:read and boards:write scopes and register this redirect URL:','Создайте приложение Miro с правами boards:read и boards:write и зарегистрируйте адрес возврата:')}</p>
    <code>{status.redirectUri}</code>
    <a href="https://developers.miro.com/docs/getting-started-with-oauth" target="_blank" rel="noopener noreferrer">{l('Miro setup guide','Инструкция Miro')}</a>
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{try{await request(connection,'/miro/config',{clientId,clientSecret});setLoginUrl('');}finally{setClientSecret('');}});}}>
     <label>Client ID<input autoComplete="off" maxLength={200} value={clientId} disabled={busy} onChange={e=>setClientId(e.target.value)}/></label>
     <label>Client secret<input type="password" autoComplete="new-password" maxLength={8192} value={clientSecret} disabled={busy} onChange={e=>setClientSecret(e.target.value)}/></label>
     <button disabled={busy||!clientId||!clientSecret}>{l('Save app configuration','Сохранить настройки приложения')}</button>
    </form>
   </details>
   {status.configured&&<button disabled={busy} onClick={()=>void run(async()=>{const reply=await request<{url:string}>(connection,'/miro/oauth/start',{});const parsed=new URL(reply.url);if(parsed.origin!=='https://miro.com'||parsed.pathname!=='/oauth/authorize')throw Error(l('Invalid sign-in address.','Некорректный адрес входа.'));setLoginUrl(parsed.href);})}>{l('Sign in to Miro','Войти в Miro')}</button>}
   {loginUrl&&<a className="miro-sign-in" href={loginUrl} target="_blank" rel="noopener noreferrer">{l('Continue in the browser on this PC','Продолжить в браузере на этом ПК')}</a>}
   <details className="miro-api-setup"><summary>{l('Use an app access token','Использовать токен приложения')}</summary>
    <p>{l('For a personal Miro developer app. Paste its access token here on the PC. The host checks the linked board and keeps the token encrypted outside Git.','Для личного приложения разработчика Miro. Вставьте токен доступа здесь на ПК. Хост проверит привязанную доску и сохранит токен зашифрованным вне Git.')}</p>
    <form onSubmit={e=>{e.preventDefault();void run(async()=>{try{await request(connection,'/miro/token',{root,token});}finally{setToken('');}});}}><label>{l('Access token','Токен доступа')}<input type="password" autoComplete="new-password" value={token} maxLength={8192} onChange={e=>setToken(e.target.value)} disabled={busy}/></label><button disabled={busy||!token||!linked}>{l('Check and save token','Проверить и сохранить токен')}</button></form>
   </details>
   <fieldset disabled={busy||!status.authenticated||!status.linked}>
    <legend>{l('This project’s board','Доска этого проекта')}</legend>
    <label className="miro-access-toggle"><input type="checkbox" checked={status.enabled} onChange={e=>void run(()=>request(connection,'/miro/access',{root,enabled:e.target.checked,allowWrite:false}))}/>{l('Allow AI to read this board','Разрешить AI читать эту доску')}</label>
    <label className="miro-access-toggle"><input type="checkbox" checked={status.allowWrite} disabled={!status.enabled} onChange={e=>void run(()=>request(connection,'/miro/access',{root,enabled:true,allowWrite:e.target.checked}))}/>{l('Allow AI to update sticky notes, text and cards','Разрешить AI обновлять заметки, текст и карточки')}</label>
   </fieldset>
   {status.enabled&&<button disabled={busy} onClick={()=>void run(async()=>{const result=await request<{items:unknown[]}>(connection,'/miro/items?root='+encodeURIComponent(root));setChecked(result.items.length);})}>{l('Check board access','Проверить доступ к доске')}</button>}
   {checked!==undefined&&<p>{l('Access checked. Items on the first page: ','Доступ проверен. Элементов на первой странице: ')}{checked}</p>}
   {status.authenticated&&<button disabled={busy} onClick={()=>void run(()=>request(connection,'/miro/disconnect',{}))}>{l('Disconnect AI access','Отключить доступ AI')}</button>}
  </>}
  {error&&<p role="alert">{error}</p>}
  <p className="miro-api-hint">{l('AI access is opt-in for each linked board. Disconnecting keeps the original board and its link. Miro must be online. Local sign-out does not revoke the app in Miro.','Доступ AI включается отдельно для каждой привязанной доски. Отключение сохраняет доску и её привязку. Нужен интернет. Локальный выход не отзывает разрешение приложения в Miro.')}</p>
 </section>;
}
