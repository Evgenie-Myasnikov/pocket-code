import {Capacitor} from '@capacitor/core';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ExternalLink,RefreshCw,Unlink,Pencil} from 'lucide-react';
import {useLanguage,t} from './i18n';
import {useBackAction,useModal,supportsEmbeddedBoards} from './navigation';
import {miroLink} from './miro-link';
import './miro-board.css';

export function MiroBoard({url,name,onBack,onDisconnect}:{url:string;name:string;onBack():void;onDisconnect():Promise<void>}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [supported,setSupported]=useState(Capacitor.getPlatform()!=='android');
 useEffect(()=>{void supportsEmbeddedBoards().then(setSupported);},[]);
 // Touch devices open a light read-only view first; the full editor loads on request.
 const [editing,setEditing]=useState(()=>typeof matchMedia!=='function'||!matchMedia('(pointer:coarse)').matches);
 const link=miroLink(url),src=editing?link.embedUrl:`https://miro.com/app/live-embed/${link.boardId}/?embedMode=view_only_without_ui&autoplay=true`,[revision,setRevision]=useState(0),[waiting,setWaiting]=useState(true),[slow,setSlow]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLElement|null>(null);useModal(dialog,confirm,()=>{if(!busy)setConfirm(false);});
 useBackAction(()=>{if(confirm)setConfirm(false);else onBack();return true;},25,true);
 useEffect(()=>{setWaiting(true);setSlow(false);const timer=setTimeout(()=>setSlow(true),12000);return()=>clearTimeout(timer);},[revision,url,editing]);
 return <section className="miro-board" aria-label={l('Miro board','Доска Miro')}>
  <header><button className="icon-button" aria-label={l('Back to boards','К доскам')} onClick={onBack}><ArrowLeft/></button><div><strong>{name}</strong><small>{editing?'Miro':t('Miro · быстрый просмотр')}</small></div><a className="icon-button" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={l('Open in browser','Открыть в браузере')}><ExternalLink/></a>{!editing&&<button className="miro-edit" aria-label={t('Редактировать в Miro')} onClick={()=>setEditing(true)}><Pencil size={16}/><span>{t('Редактировать в Miro')}</span></button>}<button className="icon-button" aria-label={l('Reload Miro','Перезагрузить Miro')} onClick={()=>setRevision(v=>v+1)}><RefreshCw/></button><button className="icon-button" aria-label={l('Disconnect Miro board','Отключить доску Miro')} onClick={()=>setConfirm(true)}><Unlink/></button></header>
  {waiting&&!slow&&<p role="status">{l('Loading Miro…','Загружаем Miro…')}</p>}{waiting&&slow&&<div className="miro-slow" role="status"><span>{t('Miro загружается дольше обычного.')}</span><button onClick={()=>setRevision(v=>v+1)}>{t('Повторить')}</button><a href={link.url} target="_blank" rel="noopener noreferrer">{t('Открыть в браузере')}</a></div>}
  <details className="miro-help" open={slow&&waiting||undefined}><summary>{l('Sign-in and access','Вход и доступ')}</summary><p>{l('Sign in with your Miro account. Access and editing are controlled by Miro. If the embedded sign-in does not work, open the board in your browser. Internet is required. AI access is enabled separately in Miro settings on the PC.','Войдите в свой аккаунт Miro. Доступ и редактирование определяет Miro. Если вход во встроенном окне не работает, откройте доску в браузере. Нужен интернет. Доступ AI включается отдельно в настройках Miro на ПК.')}</p></details>
  {!supported&&<p>{l('Open the board in your browser, or update Android System WebView to use embedded boards.','Откройте доску в браузере или обновите Android System WebView для просмотра внутри приложения.')}</p>}
  {supported&&<iframe key={revision} title={l('Miro live board','Живая доска Miro')} src={src} referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="fullscreen; clipboard-read; clipboard-write" onLoad={()=>setWaiting(false)} onError={()=>{setSlow(true);setWaiting(true);}}/>}
  {confirm&&<div className="modal-backdrop"><section ref={dialog} className="board-dialog" role="dialog" aria-modal="true" aria-label={l('Disconnect Miro board','Отключить доску Miro')}><h2>{l('Disconnect this board?','Отключить эту доску?')}</h2><p>{l('Only the link in Pocket Code is removed. The Miro board is kept.','Удалится только привязка в Pocket Code. Доска в Miro сохранится.')}</p>{error&&<p role="alert">{error}</p>}<footer><button disabled={busy} onClick={()=>setConfirm(false)}>{l('Cancel','Отмена')}</button><button disabled={busy} onClick={async()=>{setBusy(true);try{await onDisconnect();}catch(e){setError((e as Error).message);setBusy(false);}}}>{l('Disconnect','Отключить')}</button></footer></section></div>}
 </section>;
}
