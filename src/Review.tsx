import {useEffect,useState,useRef} from 'react';
import {useModal} from './navigation';
import {request,type Connection} from './api';
import {t} from './i18n';
import type {ReviewFile} from '../server/review';
import './review.css';
export type DiffRow={left?:string;right?:string;old?:number;next?:number;kind:'context'|'change'|'hunk'};
export function diffRows(patch:string):DiffRow[]{
  const rows:DiffRow[]=[];let old=0,next=0,removed:{text:string;line:number}[]=[],added:{text:string;line:number}[]=[];
  const flush=()=>{for(let i=0;i<Math.max(removed.length,added.length);i++)rows.push({kind:'change',left:removed[i]?.text,old:removed[i]?.line,right:added[i]?.text,next:added[i]?.line});removed=[];added=[];};
  for(const line of patch.split('\n')){
    if(line.startsWith('@@')){flush();const match=line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);if(match){old=Number(match[1]);next=Number(match[2]);rows.push({kind:'hunk',left:line});}continue;}
    if(!old&&!next)continue;
    if(line.startsWith('-'))removed.push({text:line.slice(1),line:old++});
    else if(line.startsWith('+'))added.push({text:line.slice(1),line:next++});
    else if(line.startsWith(' ')){flush();rows.push({kind:'context',left:line.slice(1),right:line.slice(1),old:old++,next:next++});}
  }flush();return rows;
}
type Data={files:ReviewFile[];current:string;base:string;branches:string[];patch:string;binary:boolean};
export function Review({connection,cwd,onClose}:{connection:Connection;cwd:string;onClose:()=>void}){
  const panel=useRef<HTMLElement|null>(null);useModal(panel,true,onClose);
  const [mode,setMode]=useState('working'),[base,setBase]=useState(''),[file,setFile]=useState(''),[data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [layout,setLayout]=useState(()=>{try{return localStorage.getItem('pocket-code-diff-layout')||'split';}catch{return 'split';}});
  useEffect(()=>{let active=true;setBusy(true);setError('');const query=new URLSearchParams({cwd,mode,...(base?{base}:{}),...(file?{file}:{})});request<Data>(connection,'/review?'+query).then(value=>{if(active){setData(value);if(!file&&value.files.length)setFile(value.files[0].path);}}).catch(e=>{if(active){setError(e.message);setData(null);}}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[connection,cwd,mode,base,file,refresh]);
  const rows=diffRows(data?.patch||'');
  return <aside ref={panel} className="review-panel" role="dialog" aria-label="Review" aria-modal="true"><header><h2>Review</h2><button className="secondary" onClick={onClose}>{t('Вернуться в чат')}</button></header><div className="review-controls"><select aria-label={t('Сравнение')} value={mode} onChange={e=>{setMode(e.target.value);setFile('');setData(null);}}><option value="working">{t('Все изменения')}</option><option value="staged">Staged</option><option value="branch">Branch</option></select><select aria-label={t('Вид сравнения')} value={layout} onChange={e=>{setLayout(e.target.value);try{localStorage.setItem('pocket-code-diff-layout',e.target.value);}catch{}}}><option value="split">{t('Две колонки')}</option><option value="unified">{t('Одна колонка')}</option></select><button className="secondary" disabled={busy} onClick={()=>{setFile('');setRefresh(n=>n+1);}}>{t('Обновить')}</button></div>
    {mode==='branch'&&data&&<label className="review-base">{data.current} → <select aria-label={t('Базовая ветка')} value={base||data.base} onChange={e=>{setBase(e.target.value);setFile('');}}>{['HEAD',...data.branches].map(branch=><option key={branch}>{branch}</option>)}</select></label>}
    <p className="muted review-note">{t('Изменения Git в папке проекта, включая правки вне этого чата.')}</p>
    {error&&<p className="error" role="alert">{t(error)}</p>}{busy&&<p role="status">{t('Загружаем изменения…')}</p>}
    <div className="review-body"><nav aria-label={t('Изменённые файлы')}>{data?.files.map(item=><button className={file===item.path?'selected':''} key={item.path} onClick={()=>setFile(item.path)}><span>{item.path}</span><small><b>+{item.added}</b> <em>−{item.removed}</em>{item.untracked?' · new':''}</small></button>)}</nav><section className="diff-content">{data?.files.length===0&&!busy&&<p>{t('Нет изменений')}</p>}{data?.binary?<p>{t('Двоичный или слишком большой файл')}</p>:<table className={'diff-table '+layout}><tbody>{rows.map((row,i)=>row.kind==='hunk'?<tr key={i} className="hunk"><td colSpan={layout==='split'?4:3}>{row.left}</td></tr>:layout==='split'?<tr key={i}><td className={row.kind==='change'&&row.left!==undefined?'removed':''}>{row.old}</td><td className={row.kind==='change'&&row.left!==undefined?'removed':''}><pre>{row.left}</pre></td><td className={row.kind==='change'&&row.right!==undefined?'added':''}>{row.next}</td><td className={row.kind==='change'&&row.right!==undefined?'added':''}><pre>{row.right}</pre></td></tr>:row.kind==='context'?<tr key={i}><td>{row.old}</td><td>{row.next}</td><td><pre> {row.left}</pre></td></tr>:<ReviewChange key={i} row={row}/>)}</tbody></table>}</section></div>
  </aside>;
}
function ReviewChange({row}:{row:DiffRow}){return <>{row.left!==undefined&&<tr className="removed"><td>{row.old}</td><td/><td><pre>-{row.left}</pre></td></tr>}{row.right!==undefined&&<tr className="added"><td/><td>{row.next}</td><td><pre>+{row.right}</pre></td></tr>}</>;}
