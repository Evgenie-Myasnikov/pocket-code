import { t } from "./i18n";import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {useModal} from './navigation';
import {Markdown} from './RichBlocks';
import {ImageViewer} from './ImageViewer';
import { ArrowLeft, Folder, FileText, ChevronRight, X, Image as ImageIcon, Search, WrapText } from 'lucide-react';
import { request, type Connection } from './api';
type Listing = {path: string;parent: string | null;entries: {name: string;directory: boolean;path: string;}[];};
const imageFile=/\.(png|jpe?g|gif|webp)$/i;
/** Read-only preview of one project file: Markdown rendered or raw, wrap, find in file; images open in the shared viewer. Limits stay on the host (2 MB text, no binary). */
export function FilePreview({connection,root,path,onClose}:{connection:Connection;root:string;path:string;onClose():void}){
  const name=path.split(/[\\/]/).pop()||path,markdown=/\.md$/i.test(name),image=imageFile.test(name);
  const [text,setText]=useState<string|null>(null),[picture,setPicture]=useState(''),[error,setError]=useState(''),[raw,setRaw]=useState(!markdown),[wrap,setWrap]=useState(true),[query,setQuery]=useState(''),[match,setMatch]=useState(0);
  const panel=useRef<HTMLElement|null>(null),body=useRef<HTMLDivElement|null>(null);
  useModal(panel,!image||!picture,onClose);
  useEffect(()=>{let valid=true;setText(null);setPicture('');setError('');
    (image?request<{mimeType:string;data?:string}>(connection,`/project-artifact?cwd=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then(value=>{if(valid&&value.data&&/^image\//.test(value.mimeType))setPicture(`data:${value.mimeType};base64,${value.data}`);else if(valid)setError(t('Этот файл нельзя показать'));})
      :request<{text:string}>(connection,'/file?path='+encodeURIComponent(path)).then(value=>{if(valid)setText(value.text);})).catch(e=>{if(valid)setError(t((e as Error).message));});
    return()=>{valid=false;};},[connection,root,path]);
  const parts=useMemo(()=>{if(text===null||!query.trim())return null;const needle=query.toLowerCase(),haystack=text.toLowerCase(),result:ReactNode[]=[];let from=0,index=haystack.indexOf(needle),count=0;while(index>=0&&count<500){result.push(text.slice(from,index),<mark key={count} data-match={count}>{text.slice(index,index+needle.length)}</mark>);from=index+needle.length;index=haystack.indexOf(needle,from);count++;}result.push(text.slice(from));return {result,count};},[text,query]);
  useEffect(()=>{setMatch(0);},[query]);
  useEffect(()=>{if(!parts?.count)return;const marks=body.current?.querySelectorAll('mark');marks?.forEach((mark,index)=>mark.classList.toggle('current',index===match));marks?.[match]?.scrollIntoView({block:'center'});},[match,parts]);
  if(image&&picture)return <ImageViewer src={picture} title={name} onClose={onClose}/>;
  return <div className="modal-backdrop"><section ref={panel} className="file-preview" role="dialog" aria-modal="true" aria-label={name}>
    <header><strong>{name}</strong><button className="icon-button" aria-label={t("Закрыть файл")} onClick={onClose}><X size={20} /></button></header>
    {text!==null&&<div className="file-preview-tools">
      {markdown&&<div className="segmented" role="group" aria-label={t('Вид файла')}><button aria-pressed={!raw} onClick={()=>{setRaw(false);setQuery('');}}>{t('Оформленный')}</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>{t('Исходный')}</button></div>}
      {raw&&<button className="file-preview-toggle" aria-pressed={wrap} onClick={()=>setWrap(value=>!value)}><WrapText size={16}/>{t('Перенос строк')}</button>}
      <label className="file-preview-find"><Search size={16} aria-hidden="true"/><input type="search" aria-label={t('Найти в файле')} placeholder={t('Найти в файле')} value={query} onChange={event=>{setQuery(event.target.value);if(event.target.value)setRaw(true);}} onKeyDown={event=>{if(event.key==='Enter'&&parts?.count){event.preventDefault();setMatch(value=>(value+(event.shiftKey?parts.count-1:1))%parts.count);}}}/>{query.trim()&&<span role="status">{parts?.count?t('{0} из {1}',match+1,parts.count):t('Нет совпадений')}</span>}</label>
    </div>}
    <div className="file-preview-body" ref={body}>
      {error&&<p className="project-docs-error" role="alert">{error}</p>}
      {!error&&text===null&&!picture&&<p className="muted" role="status">{t('Загружаем файл…')}</p>}
      {text!==null&&(raw?<pre className={wrap?'wrap':''}>{parts?parts.result:text}</pre>:<div className="file-markdown"><Markdown text={text}/></div>)}
    </div>
  </section></div>;
}
export function Files({ connection, root, onProject }: {connection: Connection;root: string;onProject?: (path: string) => void;}) {
  const [current, setCurrent] = useState(root),[listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState(''),[error, setError] = useState(''),[loading, setLoading] = useState(false);
  useEffect(()=>{setPreview('');},[connection,root,current]);
  useEffect(() => {setCurrent(root);}, [root]);
  useEffect(() => {let valid = true;setLoading(true);setError('');setListing(null);request<Listing>(connection, '/files?path=' + encodeURIComponent(current)).then((data) => {if (valid) setListing(data);}).catch((e) => {if (valid) setError(e.message);}).finally(() => {if (valid) setLoading(false);});return () => {valid = false;};}, [connection, current]);
  const relative=current.length>root.length&&current.toLowerCase().startsWith(root.toLowerCase())?current.slice(root.length).replace(/^[\\/]+/,''):'';
  return <div className="files-panel">
    <div className="breadcrumb"><button className="icon-button" aria-label={t("На папку выше")} disabled={!listing?.parent||current===root} onClick={() => listing?.parent && setCurrent(listing.parent)}><ArrowLeft size={17} /></button><code>{(root.split(/[\\/]/).filter(Boolean).pop()||root)+(relative?'/'+relative.replace(/\\/g,'/'):'')}</code></div>
    {onProject&&<button className="secondary use-folder" disabled={!listing} onClick={() => onProject(current)}>{t("Новый чат в этой папке ")}<ChevronRight size={16} /></button>}
    {loading && <p className="muted" role="status">{t("Читаем папку на ПК…")}</p>}{error && <div className="project-docs-error" role="alert">{t(error)}</div>}
    {listing?.entries.map((e) => <button className="file-row" key={e.path} onClick={() => e.directory ? setCurrent(e.path) : setPreview(e.path)}>{e.directory ? <Folder size={18} /> : imageFile.test(e.name)?<ImageIcon size={18}/>:<FileText size={18} />}<span>{e.name}</span><ChevronRight size={14} /></button>)}
    {listing?.entries.length === 0 && <p className="muted">{t("В этой папке пока нет файлов.")}</p>}
    {preview && <FilePreview connection={connection} root={root} path={preview} onClose={()=>setPreview('')}/>}
  </div>;
}
