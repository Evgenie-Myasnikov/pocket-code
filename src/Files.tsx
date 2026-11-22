import { t } from "./i18n";import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {useBackAction,useModal} from './navigation';
import './file-preview.css';
import {Markdown} from './RichBlocks';
import {ImageViewer} from './ImageViewer';
import { ArrowLeft, Folder, FileText, ChevronRight, X, Image as ImageIcon, Search, WrapText } from 'lucide-react';
import { request, type Connection } from './api';
type Listing = {path: string;parent: string | null;entries: {name: string;directory: boolean;path: string;}[];};
const imageFile=/\.(png|jpe?g|gif|webp)$/i;
/** Read-only preview of one project file: Markdown rendered or raw, wrap, find in file; images open in the shared viewer. Limits stay on the host (2 MB text, no binary). */
export function FilePreview({connection,root,path,onClose,scoped=false}:{connection:Connection;root:string;path:string;onClose():void;scoped?:boolean}){
  const name=path.split(/[\\/]/).pop()||path,markdown=/\.md$/i.test(name),image=imageFile.test(name);
  const [text,setText]=useState<string|null>(null),[picture,setPicture]=useState(''),[error,setError]=useState(''),[raw,setRaw]=useState(!markdown),[wrap,setWrap]=useState(true),[query,setQuery]=useState(''),[match,setMatch]=useState(0);
  const panel=useRef<HTMLElement|null>(null),body=useRef<HTMLDivElement|null>(null);
  const [finding,setFinding]=useState(false);
  const searchInput=useRef<HTMLInputElement>(null),searchButton=useRef<HTMLButtonElement>(null);
  function closeSearch(){setFinding(false);setQuery('');searchButton.current?.focus();}
  useModal(panel,!image||!picture,onClose);
  useBackAction(()=>{closeSearch();return true;},110,finding);
  useEffect(()=>{if(finding)searchInput.current?.focus();},[finding]);
  useEffect(()=>{let valid=true;setText(null);setPicture('');setError('');
    (image?request<{mimeType:string;data?:string}>(connection,`/project-artifact?cwd=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then(value=>{if(valid&&value.data&&/^image\//.test(value.mimeType))setPicture(`data:${value.mimeType};base64,${value.data}`);else if(valid)setError(t('Этот файл нельзя показать'));})
      :request<{text:string}>(connection,'/file?path='+encodeURIComponent(path)+(scoped?'&cwd='+encodeURIComponent(root):'')).then(value=>{if(valid)setText(value.text);})).catch(e=>{if(valid)setError(t((e as Error).message));});
    return()=>{valid=false;};},[connection,root,path,scoped]);
  const parts=useMemo(()=>{if(text===null||!query.trim())return null;const needle=query.toLowerCase(),haystack=text.toLowerCase(),result:ReactNode[]=[];let from=0,index=haystack.indexOf(needle),count=0;while(index>=0&&count<500){result.push(text.slice(from,index),<mark key={count} data-match={count}>{text.slice(index,index+needle.length)}</mark>);from=index+needle.length;index=haystack.indexOf(needle,from);count++;}result.push(text.slice(from));return {result,count};},[text,query]);
  useEffect(()=>{setMatch(0);},[query]);
  useEffect(()=>{if(!parts?.count)return;const marks=body.current?.querySelectorAll('mark');marks?.forEach((mark,index)=>mark.classList.toggle('current',index===match));marks?.[match]?.scrollIntoView({block:'center'});},[match,parts]);
  if(image&&picture)return <ImageViewer src={picture} title={name} onClose={onClose}/>;
  return <div className="modal-backdrop file-reader-backdrop"><section ref={panel} className="file-preview file-reader" role="dialog" aria-modal="true" aria-label={name}
    onKeyDown={event=>{if(text!==null&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'){event.preventDefault();setFinding(true);searchInput.current?.select();}}}>
    <header className="file-reader-header"><FileText size={17} aria-hidden="true"/><strong title={path}>{name}</strong>
      {text!==null&&<>
        {raw&&<button className="file-reader-action" aria-label={t('Перенос строк')} title={t('Перенос строк')} aria-pressed={wrap} onClick={()=>setWrap(value=>!value)}><WrapText size={17}/></button>}
        <button ref={searchButton} className="file-reader-action" aria-label={t('Найти в файле')} title={t('Найти в файле')} aria-expanded={finding} onClick={()=>finding?closeSearch():setFinding(true)}><Search size={17}/></button>
      </>}
      <button className="file-reader-action" title={t('Закрыть файл')} aria-label={t('Закрыть файл')} onClick={onClose}><X size={18}/></button>
    </header>
    {text!==null&&(markdown||finding)&&<div className="file-reader-toolbar">
      {markdown&&<div className="segmented" role="group" aria-label={t('Вид файла')}><button aria-pressed={!raw} onClick={()=>{setRaw(false);setQuery('');}}>{t('Оформленный')}</button><button aria-pressed={raw} onClick={()=>setRaw(true)}>{t('Исходный')}</button></div>}
      {finding&&<label className="file-reader-search"><Search size={15} aria-hidden="true"/><input ref={searchInput} type="search" aria-label={t('Найти в файле')} placeholder={t('Найти в файле')} value={query} onChange={event=>{setQuery(event.target.value);if(event.target.value)setRaw(true);}} onKeyDown={event=>{if(event.key==='Enter'&&parts?.count){event.preventDefault();setMatch(value=>(value+(event.shiftKey?parts.count-1:1))%parts.count);}}}/>{query.trim()&&<span role="status">{parts?.count?t('{0} из {1}',match+1,parts.count):t('Нет совпадений')}</span>}</label>}
    </div>}
    <div className="file-preview-body" ref={body}>
      {error&&<p className="project-docs-error" role="alert">{error}</p>}
      {!error&&text===null&&!picture&&<p className="muted" role="status">{t('Загружаем файл…')}</p>}
      {text!==null&&(raw?<pre className={wrap?'wrap':''}>{parts?parts.result:text}</pre>:<div className="file-markdown"><Markdown text={text}/></div>)}
    </div>
  </section></div>;
}
export function Files({ connection, root, onProject, initialDirectory=root, scoped=false }: {connection: Connection;root: string;onProject?: (path: string) => void;initialDirectory?:string;scoped?:boolean}) {
  const [current, setCurrent] = useState(initialDirectory),[listing, setListing] = useState<Listing | null>(null);
  const [preview, setPreview] = useState(''),[error, setError] = useState(''),[loading, setLoading] = useState(false);
  useEffect(()=>{setPreview('');},[connection,root,current]);
  useEffect(() => {setCurrent(initialDirectory);}, [root,initialDirectory]);
  useEffect(() => {let valid = true;setLoading(true);setError('');setListing(null);request<Listing>(connection, '/files?path=' + encodeURIComponent(current)+(scoped?'&cwd='+encodeURIComponent(root):'')).then((data) => {if (valid) setListing(data);}).catch((e) => {if (valid) setError(e.message);}).finally(() => {if (valid) setLoading(false);});return () => {valid = false;};}, [connection,current,root,scoped]);
  const relative=current.length>root.length&&current.toLowerCase().startsWith(root.toLowerCase())?current.slice(root.length).replace(/^[\\/]+/,''):'';
  return <div className="files-panel">
    <div className="breadcrumb"><button className="icon-button" aria-label={t("На папку выше")} disabled={!listing?.parent||current===root} onClick={() => listing?.parent && setCurrent(listing.parent)}><ArrowLeft size={16} /></button><code>{(root.split(/[\\/]/).filter(Boolean).pop()||root)+(relative?'/'+relative.replace(/\\/g,'/'):'')}</code></div>
    {onProject&&<button className="secondary use-folder" disabled={!listing} onClick={() => onProject(current)}>{t("Новый чат в этой папке ")}<ChevronRight size={16} /></button>}
    {loading && <p className="muted" role="status">{t("Читаем папку на ПК…")}</p>}{error && <div className="project-docs-error" role="alert">{t(error)}</div>}
    {listing?.entries.map((e) => <button className="file-row" key={e.path} onClick={() => e.directory ? setCurrent(e.path) : setPreview(e.path)}>{e.directory ? <Folder size={20} /> : imageFile.test(e.name)?<ImageIcon size={20}/>:<FileText size={20} />}<span>{e.name}</span><ChevronRight size={14} /></button>)}
    {listing?.entries.length === 0 && <p className="muted">{t("В этой папке пока нет файлов.")}</p>}
    {preview && <FilePreview connection={connection} root={root} path={preview} scoped={scoped} onClose={()=>setPreview('')}/>}
  </div>;
}
