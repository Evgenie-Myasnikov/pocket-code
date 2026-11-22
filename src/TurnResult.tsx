import {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ChevronDown,FileText,Folder,FolderOpen,GitCompareArrows,X} from 'lucide-react';
import type {Connection} from './api';
import {Files,FilePreview} from './Files';
import {t,useLanguage} from './i18n';
import {desktopCall} from './desktop-bridge';
import {useModal} from './navigation';
import {projectChild} from './project-path';
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

export function TurnResult({changes,root,connection,onReview}:{changes:TurnChanges;root:string;connection:Connection;onReview?:(changes:TurnChanges)=>void}){
 const ru=useLanguage()==='ru',deleted=new Set(changes.deleted);
 const outputs=changes.files.filter(file=>!deleted.has(file)),folder=containingFolder(outputs);
 const name=root.replace(/[\\/]+$/,'').split(/[\\/]/).pop()||root;
 const [expanded,setExpanded]=useState(false),[location,setLocation]=useState<{path:string;directory:boolean}|null>(null);
 const [opening,setOpening]=useState(false),[folderError,setFolderError]=useState('');
 const dialog=useRef<HTMLElement|null>(null);
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
 const folderRow=(title:string,path:string,main:boolean)=><div className="turn-result-location">
   {main?<FolderOpen size={18}/>:<Folder size={15}/>}<span title={path}>{title}</span>
   <button type="button" aria-label={folderAction+' · '+path} disabled={opening} onClick={()=>void openFolder(path)}>{folderAction}<ArrowUpRight size={13}/></button>
 </div>;
 return <section className="turn-result" aria-label={ru?'Результат работы':'Turn result'}>
   {outputs.length>0&&folderRow(ru?'Результат в '+(folder||name):'Result in '+(folder||name),result,true)}
   {(folder||!outputs.length)&&folderRow(ru?'Рабочая папка · '+name:'Working folder · '+name,root,!outputs.length)}
   {folderError&&<p className="error-banner" role="alert">{folderError}</p>}
   <div className="turn-result-tools">
     <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(open=>!open)}><ChevronDown size={14} className="turn-result-chevron"/>{ru?'Файлов: '+changes.files.length:'Files: '+changes.files.length}</button>
     {!changes.countsUnknown&&(changes.added>0||changes.removed>0)&&<span className="turn-result-counts" title={ru?'Строки в операциях правки':'Lines in recorded edits'}><b>+{changes.added}</b> <b>−{changes.removed}</b></span>}
     {onReview&&<button type="button" className="turn-result-review" onClick={()=>onReview(changes)}><GitCompareArrows size={14}/>{ru?'Посмотреть diff':'View diff'}</button>}
   </div>
   {expanded&&<ul>{changes.files.map(file=><li key={file}>{deleted.has(file)?<span className="turn-result-deleted"><FileText size={14}/><span>{file}</span><small>{ru?'Удалён':'Deleted'}</small></span>:<button type="button" onClick={()=>setLocation({path:projectChild(root,file),directory:false})}><FileText size={14}/><span>{file}</span><ArrowUpRight size={13}/></button>}</li>)}</ul>}
   {location&&createPortal(location.directory?<div className="modal-backdrop"><section ref={dialog} className="file-preview turn-result-browser" role="dialog" aria-modal="true" aria-label={ru?'Папка проекта':'Project folder'}>
     <header><strong>{ru?'Папка проекта':'Project folder'}</strong><button type="button" className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={()=>setLocation(null)}><X size={18}/></button></header>
     <Files connection={connection} root={root} initialDirectory={location.path} scoped/>
   </section></div>:<FilePreview connection={connection} root={root} path={location.path} scoped onClose={()=>setLocation(null)}/>,document.body)}
 </section>;
}
