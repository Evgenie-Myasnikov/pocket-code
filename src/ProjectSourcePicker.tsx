import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,FileText,Folder,FolderOpen} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {projectRelative} from './project-path';
import './project-source-picker.css';

type Entry={name:string;path:string;directory:boolean};
type Listing={path:string;parent:string|null;entries:Entry[]};
type Props={connection:Connection;cwd:string;onPick(file:File):void;markdownOnly?:boolean;disabled?:boolean;label?:string};
const projectPaths=new WeakMap<File,string>();

export function sourceFileLabel(file:File){
  return projectPaths.get(file)||file.webkitRelativePath||file.name;
}

export function sourceFileBinding(file:File){
  const projectPath=projectPaths.get(file);
  return projectPath?{name:projectPath,projectPath}:{name:sourceFileLabel(file)};
}

export function ProjectSourcePicker({connection,cwd,onPick,markdownOnly=false,disabled=false,label}:Props){
  const ru=useLanguage()==='ru',caption=label||(ru?'Файлы проекта':'Project files');
  const [open,setOpen]=useState(false);
  return <div className="project-source-picker">
    <button className="secondary" type="button" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(!open)}><FolderOpen size={16} aria-hidden="true"/>{caption}</button>
    {open&&<SourceBrowser key={cwd} {...{connection,cwd,disabled,markdownOnly}} onPick={file=>{onPick(file);setOpen(false);}}/>}
  </div>;
}

function SourceBrowser({connection,cwd,onPick,markdownOnly,disabled}:Props){
  const ru=useLanguage()==='ru';
  const [directory,setDirectory]=useState(cwd),[base,setBase]=useState('');
  const [listing,setListing]=useState<Listing>(),[search,setSearch]=useState(''),[reload,setReload]=useState(0);
  const [error,setError]=useState(''),[reading,setReading]=useState(false);
  const mounted=useRef(true),readLock=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    setListing(undefined);setError('');setSearch('');
    request<Listing>(connection,'/files?path='+encodeURIComponent(directory)).then(data=>{
      if(!active)return;
      if(!data||!data.path||!Array.isArray(data.entries))throw Error(ru?'Не удалось прочитать папку.':'Could not read this folder.');
      if(directory===cwd)setBase(data.path);
      setListing(data);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
    return()=>{active=false;};
  },[directory,cwd,connection.url,connection.token,connection.desktop,reload,ru]);
  async function select(entry:Entry){
    if(disabled||readLock.current||!base||projectRelative(base,entry.path)===undefined)return;
    if(entry.directory){setDirectory(entry.path);return;}
    readLock.current=true;setReading(true);setError('');
    try{
      const file=await request<{path:string;text:string;name:string}>(connection,'/file?path='+encodeURIComponent(entry.path));
      if(!file?.path||typeof file.text!=='string'||!file.name)throw Error(ru?'Не удалось прочитать путь файла.':'Could not read the file path.');
      const relative=projectRelative(base,file.path);
      if(!relative||relative!==projectRelative(base,entry.path))throw Error(ru?'Расположение файла изменилось. Обновите список.':'The file location changed. Refresh the folder.');
      const selected=new File([file.text],file.name,{type:'text/plain;charset=utf-8'});
      projectPaths.set(selected,relative);
      if(mounted.current)onPick(selected);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}
    finally{readLock.current=false;if(mounted.current)setReading(false);}
  }
  const relative=listing&&base?projectRelative(base,listing.path):undefined;
  const items=listing?.entries.filter(entry=>base&&projectRelative(base,entry.path)!==undefined&&(entry.directory||!markdownOnly||/\.md$/i.test(entry.name))&&entry.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <fieldset className="project-source-browser" disabled={disabled||reading}>
    <legend>{ru?'Выбрать из проекта':'Browse project'}</legend>
    {listing&&<div className="project-source-location">
      {relative&&listing.parent&&projectRelative(base,listing.parent)!==undefined&&<button type="button" className="text-button" aria-label={ru?'На уровень выше':'Parent folder'} onClick={()=>setDirectory(listing.parent!)}><ArrowLeft size={16}/></button>}
      <small>{listing.path}</small>
    </div>}
    {listing&&<input aria-label={ru?'Найти в папке':'Filter folder'} type="search" value={search} onChange={e=>setSearch(e.target.value)}/>}
    {error&&<div role="alert">{error} <button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>{ru?'Обновить':'Refresh'}</button></div>}
    {!listing&&!error&&<small role="status">{ru?'Загрузка…':'Loading…'}</small>}
    {items&&<ul>{items.map(entry=><li key={entry.path}><button type="button" className="text-button" onClick={()=>void select(entry)}>
      {entry.directory?<Folder aria-hidden="true" size={15}/>:<FileText aria-hidden="true" size={15}/>}<span>{entry.name}</span>
    </button></li>)}</ul>}
    {items?.length===0&&<small>{ru?'Подходящих файлов нет.':'No matching files.'}</small>}
  </fieldset>;
}
