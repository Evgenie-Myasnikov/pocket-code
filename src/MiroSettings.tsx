import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {miroLink} from './miro-link';
import {MiroAISettings} from './MiroAISettings';
import {Notice} from './Notice';
import './miro-settings.css';

const boardName=(url:string)=>{try{return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)||url);}catch{return url;}};
/** Three honest states: no link (one primary action), connected (change or disconnect with confirmation), and AI access below. */
export function MiroSettings({connection,roots}:{connection:Connection|null;roots:string[]}){
 useLanguage();
 const [root,setRoot]=useState(roots[0]||''),[url,setUrl]=useState(''),[linked,setLinked]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[canEdit,setCanEdit]=useState(false),[editing,setEditing]=useState(false),[confirm,setConfirm]=useState(false);
 useEffect(()=>{if(!roots.includes(root))setRoot(roots[0]||'');},[roots.join('|'),root]);
 useEffect(()=>{let cancelled=false;setUrl('');setLinked('');setCanEdit(false);setError('');setEditing(false);setConfirm(false);if(!connection||!root)return;setLoading(true);void request<{miro?:{url:string};canEdit?:boolean}>(connection,'/project-board?root='+encodeURIComponent(root)).then(r=>{if(!cancelled){setLinked(r.miro?.url||'');setUrl(r.miro?.url||'');setCanEdit(r.canEdit!==false);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[connection,root]);
 async function save(disconnect=false){if(!connection)return;setBusy(true);setError('');try{const next=disconnect?null:miroLink(url).url;await request(connection,'/project-board/miro',{root,url:next});setLinked(next||'');setUrl(next||'');setEditing(false);setConfirm(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!connection)return <Notice tone="info">{t('Сначала подключитесь к ПК в настройках подключения.')}</Notice>;
 const showField=!linked||editing;
 return <div className="miro-settings"><form onSubmit={e=>{e.preventDefault();void save();}}>
  <p className="muted">{t('Привяжите доску Miro к проекту. Она откроется в разделе «Доска» с интерфейсом Miro.')}</p>
  <label>{t('Проект')}<select aria-label={t('Проект Miro')} value={root} disabled={busy} onChange={e=>setRoot(e.target.value)}>{roots.map(r=><option key={r} value={r}>{r.split(/[\\/]/).at(-1)||r}</option>)}</select></label>
  {!roots.length&&<p>{t('На подключённом ПК нет доступных проектов.')}</p>}
  {loading&&<p role="status">{t('Загрузка…')}</p>}
  {linked&&!loading&&<div className="miro-linked"><p className="miro-linked-status" role="status"><span className="connect-dot online" aria-hidden="true"/>{t('Доска Miro подключена')}: <strong>{boardName(linked)}</strong></p>{!editing&&!confirm&&<div className="miro-settings-actions"><button type="button" className="secondary" disabled={busy||!canEdit} onClick={()=>setEditing(true)}>{t('Изменить ссылку')}</button><button type="button" className="secondary danger" disabled={busy||!canEdit} onClick={()=>setConfirm(true)}>{t('Отключить')}</button></div>}
   {confirm&&<div className="confirm-inline" role="group" aria-label={t('Отключить доску Miro')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirm(false);}}}><p>{t('Привязка к проекту будет удалена с ПК. Сама доска в Miro останется.')}</p><div className="confirm-inline-actions"><button type="button" className="primary danger" disabled={busy} onClick={()=>void save(true)}>{t('Отключить привязку')}</button><button type="button" className="secondary" autoFocus onClick={()=>setConfirm(false)}>{t('Отмена')}</button></div></div>}</div>}
  {showField&&<><label>{t('Ссылка на доску Miro')}<input required type="url" maxLength={2048} disabled={busy||loading||!canEdit} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://miro.com/app/board/…"/></label>
  <div className="miro-settings-actions"><button className="primary" disabled={!root||!url||busy||loading||!canEdit}>{linked?t('Сохранить ссылку'):t('Подключить доску Miro')}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setUrl(linked);}}>{t('Отмена')}</button>}</div></>}
  {error&&<Notice tone="error">{error}</Notice>}
  <details className="disclosure"><summary><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true"/>{t('Вход и хранение')}</summary><p className="muted">{t('Войдите в Miro при открытии доски или откройте ссылку в браузере. Miro управляет доступом и редактированием. Pocket Code хранит привязку на ПК, вне Git; отключение не удаляет доску Miro. Доступ AI настраивается отдельно ниже. Офлайн-редактирование Miro недоступно.')}</p></details>
 </form><MiroAISettings key={root} connection={connection} root={root} linked={linked}/></div>;
}
