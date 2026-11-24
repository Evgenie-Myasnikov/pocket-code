import {ProjectFolderPicker} from './ProjectFolderPicker';
import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {miroLink} from './miro-link';
import {MiroAISettings} from './MiroAISettings';
import {Notice} from './Notice';
import './miro-settings.css';
import {HelpTip,SettingRow,SettingsBlock,SettingsLine} from './SettingsRows';

const boardName=(url:string)=>{try{return decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)||url);}catch{return url;}};
/** Three honest states: no link (one primary action), connected (change or disconnect with confirmation), and AI access below. */
/** rows: a "Miro" card and an "AI access" card of rows for the PC window. */
export function MiroSettings({connection,roots,rows=false}:{connection:Connection|null;roots:string[];rows?:boolean}){
 useLanguage();
 const [root,setRoot]=useState(roots[0]||''),[url,setUrl]=useState(''),[linked,setLinked]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[canEdit,setCanEdit]=useState(false),[editing,setEditing]=useState(false),[confirm,setConfirm]=useState(false);
 useEffect(()=>{if(!roots.includes(root))setRoot(roots[0]||'');},[roots.join('|'),root]);
 useEffect(()=>{let cancelled=false;setUrl('');setLinked('');setCanEdit(false);setError('');setEditing(false);setConfirm(false);if(!connection||!root)return;setLoading(true);void request<{miro?:{url:string};canEdit?:boolean}>(connection,'/project-board?root='+encodeURIComponent(root)).then(r=>{if(!cancelled){setLinked(r.miro?.url||'');setUrl(r.miro?.url||'');setCanEdit(r.canEdit!==false);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[connection,root]);
 async function save(disconnect=false){if(!connection)return;setBusy(true);setError('');try{const next=disconnect?null:miroLink(url).url;await request(connection,'/project-board/miro',{root,url:next});setLinked(next||'');setUrl(next||'');setEditing(false);setConfirm(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!connection)return rows?<SettingsBlock title="Miro"><SettingsLine><p>{t('Сначала подключитесь к ПК в настройках подключения.')}</p></SettingsLine></SettingsBlock>:<Notice tone="info">{t('Сначала подключитесь к ПК в настройках подключения.')}</Notice>;
 const showField=!linked||editing;
 if(rows)return <><SettingsBlock title="Miro" className="miro-settings-rows" action={<HelpTip label={t('Вход и хранение')}>{t('Войдите в Miro при открытии доски или откройте ссылку в браузере. Miro управляет доступом и редактированием. Pocket Code хранит привязку на ПК, вне Git; отключение не удаляет доску Miro. Доступ AI настраивается отдельно ниже. Офлайн-редактирование Miro недоступно.')}</HelpTip>}><form onSubmit={e=>{e.preventDefault();void save();}}>
  <SettingRow title={t('Проект')} note={roots.length?t('Доска Miro открывается в разделе «Доска»'):t('На подключённом ПК нет доступных проектов.')}><ProjectFolderPicker paths={roots} value={root} label={t('Проект Miro')} disabled={busy||!roots.length} onChange={setRoot}/></SettingRow>
  {loading&&<SettingsLine><p role="status">{t('Загрузка…')}</p></SettingsLine>}
  {linked&&!loading&&<SettingRow title={<span className="miro-linked-status" role="status"><span className="connect-dot online" aria-hidden="true"/>{t('Доска Miro подключена')}</span>} note={boardName(linked)}>{!editing&&!confirm&&<><button type="button" className="secondary" disabled={busy||!canEdit} onClick={()=>setEditing(true)}>{t('Изменить ссылку')}</button><button type="button" className="secondary danger" disabled={busy||!canEdit} onClick={()=>setConfirm(true)}>{t('Отключить')}</button></>}</SettingRow>}
  {confirm&&<SettingsLine><div className="confirm-inline" role="group" aria-label={t('Отключить доску Miro')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirm(false);}}}><p>{t('Привязка к проекту будет удалена с ПК. Сама доска в Miro останется.')}</p><div className="confirm-inline-actions"><button type="button" className="primary danger" disabled={busy} onClick={()=>void save(true)}>{t('Отключить привязку')}</button><button type="button" className="secondary" autoFocus onClick={()=>setConfirm(false)}>{t('Отмена')}</button></div></div></SettingsLine>}
  {showField&&<SettingRow title={t('Ссылка на доску Miro')} htmlFor="miro-board-link" className="miro-link-row"><input id="miro-board-link" required type="url" maxLength={2048} disabled={busy||loading||!canEdit} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://miro.com/app/board/…"/><button className="primary" disabled={!root||!url||busy||loading||!canEdit}>{linked?t('Сохранить ссылку'):t('Подключить доску Miro')}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setUrl(linked);}}>{t('Отмена')}</button>}</SettingRow>}
  {error&&<SettingsLine><Notice tone="error">{error}</Notice></SettingsLine>}
 </form></SettingsBlock><MiroAISettings key={root} connection={connection} root={root} linked={linked} rows/></>;
 return <div className="miro-settings"><form onSubmit={e=>{e.preventDefault();void save();}}>
  <p className="muted">{t('Привяжите доску Miro к проекту. Она откроется в разделе «Доска» с интерфейсом Miro.')}</p>
  <div className="project-folder-field"><span>{t('Проект')}</span><ProjectFolderPicker paths={roots} value={root} label={t('Проект Miro')} disabled={busy||!roots.length} onChange={setRoot}/></div>
  {!roots.length&&<p>{t('На подключённом ПК нет доступных проектов.')}</p>}
  {loading&&<p role="status">{t('Загрузка…')}</p>}
  {linked&&!loading&&<div className="miro-linked"><p className="miro-linked-status" role="status"><span className="connect-dot online" aria-hidden="true"/>{t('Доска Miro подключена')}: <strong>{boardName(linked)}</strong></p>{!editing&&!confirm&&<div className="miro-settings-actions"><button type="button" className="secondary" disabled={busy||!canEdit} onClick={()=>setEditing(true)}>{t('Изменить ссылку')}</button><button type="button" className="secondary danger" disabled={busy||!canEdit} onClick={()=>setConfirm(true)}>{t('Отключить')}</button></div>}
   {confirm&&<div className="confirm-inline" role="group" aria-label={t('Отключить доску Miro')} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirm(false);}}}><p>{t('Привязка к проекту будет удалена с ПК. Сама доска в Miro останется.')}</p><div className="confirm-inline-actions"><button type="button" className="primary danger" disabled={busy} onClick={()=>void save(true)}>{t('Отключить привязку')}</button><button type="button" className="secondary" autoFocus onClick={()=>setConfirm(false)}>{t('Отмена')}</button></div></div>}</div>}
  {showField&&<><label>{t('Ссылка на доску Miro')}<input required type="url" maxLength={2048} disabled={busy||loading||!canEdit} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://miro.com/app/board/…"/></label>
  <div className="miro-settings-actions"><button className="primary" disabled={!root||!url||busy||loading||!canEdit}>{linked?t('Сохранить ссылку'):t('Подключить доску Miro')}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setUrl(linked);}}>{t('Отмена')}</button>}</div></>}
  {error&&<Notice tone="error">{error}</Notice>}
  <details className="disclosure"><summary><ChevronDown className="disclosure-chevron" size={20} aria-hidden="true"/>{t('Вход и хранение')}</summary><p className="muted">{t('Войдите в Miro при открытии доски или откройте ссылку в браузере. Miro управляет доступом и редактированием. Pocket Code хранит привязку на ПК, вне Git; отключение не удаляет доску Miro. Доступ AI настраивается отдельно ниже. Офлайн-редактирование Miro недоступно.')}</p></details>
 </form><MiroAISettings key={root} connection={connection} root={root} linked={linked}/></div>;
}
