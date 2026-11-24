import {useEffect,useRef,useState} from 'react';
import {request} from './api';
import {createPortal} from 'react-dom';
import {ChevronDown,FileText,Folder,FolderOpen,GitCompareArrows,X} from 'lucide-react';
import type {Connection} from './api';
import {Files,FilePreview} from './Files';
import {t,useLanguage} from './i18n';
import {desktopCall} from './desktop-bridge';
import {useModal} from './navigation';
import {projectChild} from './project-path';
import {useSidePreview} from './ChatSidePanel';
import type {TurnChanges} from './turn-changes';
import './turn-result.css';

function containingFolder(files:string[]){
 if(!files.length)return '';
 const parts=files[0].split('/').slice(0,-1);
 for(const file of files.slice(1)){
   const next=file.split('/').slice(0,-1);
   let i=0;while(i<parts.length&&parts[i]===next[i])i++;
   parts.length=i;
 }
 return parts.join('/');
}

const pictures=/\.(png|jpe?g|gif|webp)$/i;
const sizeText=(bytes:number)=>bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(bytes<10240?1:0)+' KB':(bytes/1024/1024).toFixed(1)+' MB';
/** A small picture instead of the PNG label; it is read only while the list is open. */
function Thumbnail({connection,root,path}:{connection:Connection;root:string;path:string}){
 const [src,setSrc]=useState('');
 useEffect(()=>{let live=true;request<{mimeType:string;data?:string}>(connection,`/project-artifact?cwd=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`).then(value=>{if(live&&value?.data&&/^image\//.test(value.mimeType))setSrc(`data:${value.mimeType};base64,${value.data}`);}).catch(()=>{});return()=>{live=false;};},[connection,root,path]);
 return src?<img className="turn-result-thumb" src={src} alt="" loading="lazy"/>:<span className="turn-result-type">IMG</span>;
}
/** A file row as in the Strata file list: its type (a thumbnail for a picture), its name, the folder it is in and its size. */
function fileLabel(file:string,size:number|null|undefined,thumb?:React.ReactNode){
 const slash=file.lastIndexOf('/'),name=file.slice(slash+1),dir=slash>0?file.slice(0,slash):'',dot=name.lastIndexOf('.');
 return <>{thumb||<span className="turn-result-type">{dot>0?name.slice(dot+1).slice(0,6).toUpperCase():'FILE'}</span>}<span className="turn-result-name">{name}</span><span className="turn-result-dir">{dir}</span>{typeof size==='number'&&<span className="turn-result-size">{sizeText(size)}</span>}</>;
}
export function TurnResult({changes,root,connection,onReview}:{changes:TurnChanges;root:string;connection:Connection;onReview?:(changes:TurnChanges)=>void}){
 const ru=useLanguage()==='ru',deleted=new Set(changes.deleted);
 const outputs=changes.files.filter(file=>!deleted.has(file)),folder=containingFolder(outputs);
 const name=root.replace(/[\\/]+$/,'').split(/[\\/]/).pop()||root;
 const [expanded,setExpanded]=useState(false),[location,setLocation]=useState<{path:string;directory:boolean}|null>(null);
 const [opening,setOpening]=useState(false),[folderError,setFolderError]=useState('');
 const dialog=useRef<HTMLElement|null>(null),sidePreview=useSidePreview(),[sizes,setSizes]=useState<Record<string,number|null>>({});
 useEffect(()=>{if(!expanded)return;let live=true;request<{sizes?:Record<string,number|null>}>(connection,'/file-sizes',{cwd:root,paths:changes.files.slice(0,500)}).then(value=>{if(live&&value?.sizes)setSizes(value.sizes);}).catch(()=>{});return()=>{live=false;};},[expanded,connection,root,changes.files.join('|')]);
 useModal(dialog,Boolean(location?.directory),()=>setLocation(null));
 const result=folder?projectChild(root,folder):root;
 const folderAction=connection.desktop?(ru?'В Проводнике':'Open in Explorer'):(ru?'В файлах ПК':'Browse PC files');
 async function openFolder(path:string){
   if(!connection.desktop){setLocation({path,directory:true});return;}
   setOpening(true);setFolderError('');
   try{await desktopCall('open-project-folder',{cwd:root,path});}
   catch(error){
     const summary=ru?'Не удалось открыть папку в Проводнике.':'Could not open the folder in Explorer.';
     setFolderError(error instanceof Error?summary+' '+t(error.message):summary);
   }finally{setOpening(false);}
 }
 // As in Strata: a quiet label, the folder name in bold, and a short Open; the full action is the button's name.
 const folderRow=(label:string,title:string,path:string,main:boolean)=><div className="turn-result-location">
   {main?<FolderOpen size={18}/>:<Folder size={16}/>}<span title={path}>{label} <strong>{title}</strong></span>
   <button type="button" aria-label={folderAction+' · '+path} title={folderAction} disabled={opening} onClick={()=>void openFolder(path)}>{ru?'Открыть':'Open'}</button>
 </div>;
 return <section className="turn-result" aria-label={ru?'Результат работы':'Turn result'}>
   {outputs.length>0&&folderRow(ru?'Результат в':'Delivered to',folder||name,result,true)}
   {(folder||!outputs.length)&&folderRow(ru?'Рабочая папка':'Working folder',name,root,!outputs.length)}
   {folderError&&<p className="error-banner" role="alert">{folderError}</p>}
   <div className="turn-result-tools">
     <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(open=>!open)}><ChevronDown size={14} className="turn-result-chevron"/>{ru?'Файлов: '+changes.files.length:'Files: '+changes.files.length}</button>
     {!changes.countsUnknown&&(changes.added>0||changes.removed>0)&&<span className="turn-result-counts" title={ru?'Строки в операциях правки':'Lines in recorded edits'}><b>+{changes.added}</b> <b>−{changes.removed}</b></span>}
     {onReview&&<button type="button" className="turn-result-review" onClick={()=>onReview(changes)}><GitCompareArrows size={14}/>{ru?'Посмотреть diff':'View diff'}</button>}
   </div>
   {expanded&&<ul>{changes.files.map(file=><li key={file}>{deleted.has(file)?<span className="turn-result-deleted"><FileText size={14}/><span>{file}</span><small>{ru?'Удалён':'Deleted'}</small></span>:<button type="button" aria-label={file} onClick={()=>{const path=projectChild(root,file);if(sidePreview)sidePreview(root,path,changes.byFile?.[file]);else setLocation({path,directory:false});}}>{fileLabel(file,sizes[file],pictures.test(file)?<Thumbnail connection={connection} root={root} path={projectChild(root,file)}/>:undefined)}{(()=>{const own=changes.byFile?.[file];return own&&(own.added>0||own.removed>0)?<span className="turn-result-file-counts" aria-label={ru?`добавлено ${own.added}, удалено ${own.removed}`:`${own.added} added, ${own.removed} removed`}><b>+{own.added}</b> <b>−{own.removed}</b></span>:null;})()}</button>}</li>)}</ul>}
   {location&&createPortal(location.directory?<div className="modal-backdrop"><section ref={dialog} className="file-preview turn-result-browser" role="dialog" aria-modal="true" aria-label={ru?'Папка проекта':'Project folder'}>
     <header><strong>{ru?'Папка проекта':'Project folder'}</strong><button type="button" className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={()=>setLocation(null)}><X size={18}/></button></header>
     <Files connection={connection} root={root} initialDirectory={location.path} scoped/>
   </section></div>:<FilePreview connection={connection} root={root} path={location.path} scoped onClose={()=>setLocation(null)}/>,document.body)}
 </section>;
}
