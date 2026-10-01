import {useEffect,useLayoutEffect,useState,useRef} from 'react';
import {ArrowLeft,Eye,EyeOff,SlidersHorizontal,RefreshCw,GitBranch,X} from 'lucide-react';
import {useModal} from './navigation';
import {request,type Connection} from './api';
import {t,getLanguage} from './i18n';
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
type Data={files:ReviewFile[];current:string;base:string;branches:string[];patch:string;binary:boolean;repositoryRoot?:string;projectPath?:string;scope?:string};
export function Review({connection,cwd,onClose,initialMode='working'}:{connection:Connection;cwd:string;onClose:()=>void;initialMode?:'working'|'branch'}){
  const panel=useRef<HTMLElement|null>(null),diff=useRef<HTMLElement|null>(null),eye=useRef<HTMLButtonElement|null>(null),restore=useRef<HTMLButtonElement|null>(null),optionsButton=useRef<HTMLButtonElement|null>(null);
  const [reading,setReading]=useState(false),[options,setOptions]=useState(false);
  const optionsPanel=useRef<HTMLDivElement|null>(null);
  const [fontSize,setFontSize]=useState<number|null>(()=>{try{const value=Number(localStorage.getItem('pocket-code-diff-font-size'));return value>=10&&value<=24?value:null;}catch{return null;}});
  useModal(optionsPanel,options&&!reading,()=>setOptions(false));
  const scrollPosition=useRef<{top:number;left:number;focus:boolean}|null>(null);
  function toggleReading(value:boolean){scrollPosition.current={top:diff.current?.scrollTop||0,left:diff.current?.scrollLeft||0,focus:true};setReading(value);}
  useLayoutEffect(()=>{const position=scrollPosition.current;if(!position)return;if(diff.current){diff.current.scrollTop=position.top;diff.current.scrollLeft=position.left;}if(position.focus)(reading?restore:eye).current?.focus({preventScroll:true});scrollPosition.current=null;},[reading]);
  useModal(panel,true,()=>{if(reading)toggleReading(false);else if(options){setOptions(false);optionsButton.current?.focus({preventScroll:true});}else onClose();});
  const [mode,setMode]=useState<string>(initialMode),[base,setBase]=useState(''),[file,setFile]=useState(''),[data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [layout,setLayout]=useState(()=>{const fallback=window.innerWidth<600?'unified':'split';try{const saved=localStorage.getItem('pocket-code-diff-layout');return saved==='split'||saved==='unified'?saved:fallback;}catch{return fallback;}});
  const [updated,setUpdated]=useState(0);
  useEffect(()=>{
    let active=true,inFlight=false;
    const load=async(background=false)=>{
      if(inFlight||!active)return;inFlight=true;
      if(!background){setBusy(true);setError('');setData(previous=>previous?{...previous,patch:'',binary:false}:null);}
      const query=new URLSearchParams({cwd,mode,...(base?{base}:{}),...(file?{file}:{})});
      try{
        let value:Data;
        try{value=await request<Data>(connection,'/review?'+query);}
        catch(error){if(!file||(error as {status?:number}).status!==404)throw error;query.delete('file');value=await request<Data>(connection,'/review?'+query);}
        if(!active)return;
        setData(value);setError('');setUpdated(Date.now());
        if(!value.files.some(item=>item.path===file))setFile(value.files[0]?.path||'');
      }catch(error){if(active)setError((error as Error).message);}
      finally{inFlight=false;if(active)setBusy(false);}
    };
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load(true);},5000);
    const resume=()=>{if(document.visibilityState==='visible')void load(true);};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[connection,cwd,mode,base,file,refresh]);
  useEffect(()=>{if(diff.current){diff.current.scrollTop=0;diff.current.scrollLeft=0;}},[file,mode,base]);
  const rows=diffRows(data?.patch||'');
  const repository=data?.repositoryRoot||cwd,repoName=repository.split(/[\\/]/).filter(Boolean).at(-1)||repository;
  const selectedFile=data?.files.find(item=>item.path===file);
  return <aside ref={panel} className={'review-panel'+(reading?' review-reading':'')} role="dialog" aria-label="Review" aria-modal="true">
    <header className="review-header" hidden={reading}>
      <button className="icon-button" aria-label={t('Вернуться в чат')} title={t('Вернуться в чат')} onClick={onClose}><ArrowLeft size={20}/></button>
      <div className="review-heading"><h2>Review</h2><span className="review-context" title={repository}><span>{repoName}</span>{data?.current&&<><GitBranch size={12}/><span>{data.current}</span></>}</span></div>
      <button ref={eye} className="icon-button" aria-label={t('Режим чтения')} title={t('Режим чтения')} aria-pressed={reading} onClick={()=>toggleReading(true)}><Eye size={20}/></button>
      <button ref={optionsButton} className="icon-button" aria-label={t('Параметры ревью')} title={t('Параметры ревью')} aria-expanded={options} aria-controls="review-options" onClick={()=>setOptions(value=>!value)}><SlidersHorizontal size={20}/></button>
    </header>
    <div className="review-options-backdrop" hidden={!options||reading} onClick={()=>setOptions(false)}><div ref={optionsPanel} id="review-options" className="review-options" role="dialog" aria-modal="true" aria-label={t('Параметры ревью')} onClick={event=>event.stopPropagation()}>
      <div className="review-options-heading"><strong>{t('Параметры ревью')}</strong><button className="icon-button" aria-label={getLanguage()==='ru'?'Закрыть параметры':'Close review options'} onClick={()=>setOptions(false)}><X size={20}/></button></div>
      <div className="review-controls"><label>{t('Сравнение')}<select aria-label={t('Сравнение')} value={mode} onChange={e=>{setMode(e.target.value);setFile('');setData(null);}}><option value="working">{t('Все изменения')}</option><option value="staged">{t('Подготовленные изменения')}</option><option value="branch">{t('Изменения ветки')}</option></select></label><label>{t('Вид сравнения')}<select aria-label={t('Вид сравнения')} value={layout} onChange={e=>{setLayout(e.target.value);try{localStorage.setItem('pocket-code-diff-layout',e.target.value);}catch{}}}><option value="split">{t('Две колонки')}</option><option value="unified">{t('Одна колонка')}</option></select></label></div>
      {mode==='branch'&&data&&<label className="review-base">{t('Базовая ветка')}<select aria-label={t('Базовая ветка')} value={base||data.base} onChange={e=>{setBase(e.target.value);setFile('');}}>{[...new Set(['HEAD',...data.branches])].map(branch=><option key={branch}>{branch}</option>)}</select></label>}
      <label className="review-font-size">{getLanguage()==='ru'?'Размер кода':'Code size'}<select aria-label={getLanguage()==='ru'?'Размер кода':'Code size'} value={fontSize??''} onChange={event=>{const value=event.target.value?Number(event.target.value):null;setFontSize(value);try{if(value===null)localStorage.removeItem('pocket-code-diff-font-size');else localStorage.setItem('pocket-code-diff-font-size',String(value));}catch{}}}><option value="">{getLanguage()==='ru'?'Как в чате, не меньше 14 px':'Match chat, minimum 14 px'}</option>{[10,12,14,16,18,20,22,24].map(size=><option key={size} value={size}>{size} px</option>)}</select></label>
      <p className="review-scope">{data?.projectPath||cwd}</p><p className="muted review-note">{t('Изменения Git в папке проекта, включая правки вне этого чата.')}</p>
      <button className="review-refresh" disabled={busy} onClick={()=>{setFile('');setRefresh(n=>n+1);}}><RefreshCw size={16}/>{t('Обновить')}</button>
    </div></div>
    <div className="review-filebar" hidden={reading}>
      <select aria-label={t('Изменённые файлы')} title={file} value={file} disabled={!data?.files.length} onChange={e=>setFile(e.target.value)}>{!data?.files.length&&<option value="">{t('Изменённые файлы')}</option>}{data?.files.map(item=><option key={item.path} value={item.path}>{item.path}</option>)}</select>
      {selectedFile&&<small className="review-stats"><b>+{selectedFile.added}</b> <em>−{selectedFile.removed}</em></small>}
    </div>
    <div className="review-summary" hidden={reading}><span>{t(mode==='branch'?'Изменения ветки':mode==='staged'?'Подготовленные изменения':'Все изменения')} {'\u00b7'} {data?.files.length??0} {getLanguage()==='ru'?'файл.':'files'}</span><button className="icon-button" disabled={busy} aria-label={t('Обновить')} title={updated?new Date(updated).toLocaleTimeString():''} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/></button></div>
    {reading&&<button ref={restore} className="icon-button review-restore" aria-label={t('Показать управление ревью')} title={t('Показать управление ревью')} onClick={()=>toggleReading(false)}><EyeOff size={20}/></button>}
    {error&&<p className="error" role="alert">{t(error)}</p>}{busy&&<p role="status">{t('Загружаем изменения…')}</p>}
    <div className="review-body"><section ref={diff} className="diff-content" aria-label={file||t('Изменённые файлы')} tabIndex={0}>{data?.files.length===0&&!busy&&<p>{t('Нет изменений')}</p>}{data?.binary?<p>{t('Двоичный или слишком большой файл')}</p>:<table className={'diff-table '+layout} style={{fontSize:fontSize?`${fontSize}px`:'max(14px, var(--chat-font-size,14px))'}}><tbody>{rows.map((row,i)=>row.kind==='hunk'?<tr key={i} className="hunk"><td colSpan={layout==='split'?4:3}>{row.left}</td></tr>:layout==='split'?<tr key={i}><td className={row.kind==='change'&&row.left!==undefined?'removed':''}>{row.old}</td><td className={row.kind==='change'&&row.left!==undefined?'removed':''}><pre>{row.left}</pre></td><td className={row.kind==='change'&&row.right!==undefined?'added':''}>{row.next}</td><td className={row.kind==='change'&&row.right!==undefined?'added':''}><pre>{row.right}</pre></td></tr>:row.kind==='context'?<tr key={i}><td>{row.old}</td><td>{row.next}</td><td><pre> {row.left}</pre></td></tr>:<ReviewChange key={i} row={row}/>)}</tbody></table>}</section></div>
  </aside>;
}
function ReviewChange({row}:{row:DiffRow}){return <>{row.left!==undefined&&<tr className="removed"><td>{row.old}</td><td/><td><pre>-{row.left}</pre></td></tr>}{row.right!==undefined&&<tr className="added"><td/><td>{row.next}</td><td><pre>+{row.right}</pre></td></tr>}</>;}
