import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {miroLink} from './miro-link';

export function MiroSettings({connection,roots}:{connection:Connection|null;roots:string[]}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [root,setRoot]=useState(roots[0]||''),[url,setUrl]=useState(''),[linked,setLinked]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[canEdit,setCanEdit]=useState(false);
 useEffect(()=>{if(!roots.includes(root))setRoot(roots[0]||'');},[roots.join('|'),root]);
 useEffect(()=>{let cancelled=false;setUrl('');setLinked('');setCanEdit(false);setError('');if(!connection||!root)return;setLoading(true);void request<{miro?:{url:string};canEdit?:boolean}>(connection,'/project-board?root='+encodeURIComponent(root)).then(r=>{if(!cancelled){setLinked(r.miro?.url||'');setUrl(r.miro?.url||'');setCanEdit(r.canEdit!==false);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[connection,root]);
 async function save(disconnect=false){if(!connection)return;setBusy(true);setError('');try{const next=disconnect?null:miroLink(url).url;await request(connection,'/project-board/miro',{root,url:next});setLinked(next||'');setUrl(next||'');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!connection)return <p>{l('Connect to the PC in Connection settings first.','Сначала подключитесь к ПК в настройках подключения.')}</p>;
 return <form className="miro-settings" onSubmit={e=>{e.preventDefault();void save();}}>
  <p>{l('Connect a Miro board to a project. Open it from Board with the original Miro interface.','Привяжите доску Miro к проекту. Она откроется в разделе «Доска» с интерфейсом Miro.')}</p>
  <label>{l('Project','Проект')}<select aria-label={l('Miro project','Проект Miro')} value={root} disabled={busy} onChange={e=>setRoot(e.target.value)}>{roots.map(r=><option key={r} value={r}>{r.split(/[\\/]/).at(-1)||r}</option>)}</select></label>
  {!roots.length&&<p>{l('No projects available on the connected PC.','На подключённом ПК нет доступных проектов.')}</p>}
  <label>{l('Miro board link','Ссылка на доску Miro')}<input required type="url" maxLength={2048} disabled={busy||loading||!canEdit} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://miro.com/app/board/…"/></label>
  {loading&&<p role="status">{l('Loading…','Загрузка…')}</p>}{linked&&<p role="status">{l('Miro board connected','Доска Miro подключена')}</p>}{error&&<p role="alert">{error}</p>}
  <div className="miro-settings-actions"><button className="primary" disabled={!root||!url||busy||loading||!canEdit}>{l('Connect Miro board','Подключить доску Miro')}</button>{linked&&<button type="button" disabled={busy||loading||!canEdit} onClick={()=>void save(true)}>{l('Disconnect link','Отключить привязку')}</button>}</div>
  <details><summary>{l('Sign-in and storage','Вход и хранение')}</summary><p>{l('Sign in inside Miro or open its browser link. Miro manages access and editing. Pocket Code keeps only the board link on this PC, outside Git; disconnecting does not delete the Miro board. AI access and offline Miro editing are not included.','Войдите в Miro при открытии доски или откройте ссылку в браузере. Miro управляет доступом и редактированием. Pocket Code хранит только привязку на ПК, вне Git; отключение не удаляет доску Miro. Доступ AI и офлайн-редактирование Miro пока не подключены.')}</p></details>
 </form>;
}
