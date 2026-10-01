import {useEffect,useState} from 'react';
import {FileText,Image as ImageIcon,X} from 'lucide-react';
import {t} from './i18n';
import './attachment-tray.css';
export type DraftAttachment={id:string;name:string;size:number;file?:File};
function AttachmentCard({attachment:a,disabled,onRemove}:{attachment:DraftAttachment;disabled:boolean;onRemove:()=>void}){
  const [preview,setPreview]=useState(''),[failed,setFailed]=useState(false);
  const isImage=!!a.file&&(/^(image\/(png|jpeg|gif|webp|avif|bmp))$/i.test(a.file.type)||(!a.file.type&&/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(a.name)));
  useEffect(()=>{
    setFailed(false);if(!isImage||!a.file){setPreview('');return;}
    const url=URL.createObjectURL(a.file);setPreview(url);return()=>URL.revokeObjectURL(url);
  },[a.file,isImage]);
  const image=!!preview&&!failed,extension=a.name.includes('.')?a.name.split('.').pop()!.slice(0,12).toUpperCase():'FILE';
  const size=a.size<1024?a.size+' B':a.size<1024*1024?(a.size/1024).toFixed(1)+' KB':(a.size/1024/1024).toFixed(1)+' MB';
  return <div className={'draft-attachment'+(image?' draft-attachment-image':'')} title={a.name}>
    {image?<img src={preview} alt={a.name} onError={()=>setFailed(true)}/>:<><span className="draft-attachment-icon" aria-hidden="true">{isImage?<ImageIcon size={25}/>:<FileText size={25}/>}</span><span className="draft-attachment-info"><strong>{a.name}</strong><small>{extension} · {size}</small></span></>}
    <button type="button" className="attachment-remove" disabled={disabled} aria-label={t('Убрать {0}',a.name)} onClick={onRemove}><X size={24} aria-hidden="true"/></button>
  </div>;
}
export function AttachmentTray({attachments,disabled=false,onRemove}:{attachments:DraftAttachment[];disabled?:boolean;onRemove:(id:string)=>void}){
  return <div className="attachment-tray">{attachments.map(a=><AttachmentCard key={a.id} attachment={a} disabled={disabled} onRemove={()=>onRemove(a.id)}/>)}</div>;
}
