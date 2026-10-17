import {useEffect,useState} from 'react';
import {FileText,Image as ImageIcon,X,LoaderCircle,RotateCw,TriangleAlert,TextCursorInput,ChevronRight} from 'lucide-react';
import {t} from './i18n';
import {plural} from './plural';
import './attachment-tray.css';
/** status is absent once the PC has the file; a pasted long text can be put back into the message. */
export type DraftAttachment={id:string;name:string;size:number;file?:File;status?:'uploading'|'failed';error?:string;pastedText?:boolean};
export const attachmentReady=(a:DraftAttachment)=>!a.status;
function AttachmentCard({attachment:a,disabled,onRemove,onRetry,onInsertText}:{attachment:DraftAttachment;disabled:boolean;onRemove:()=>void;onRetry?:()=>void;onInsertText?:()=>void}){
  const [preview,setPreview]=useState(''),[failed,setFailed]=useState(false);
  const isImage=!!a.file&&(/^(image\/(png|jpeg|gif|webp|avif|bmp))$/i.test(a.file.type)||(!a.file.type&&/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(a.name)));
  useEffect(()=>{
    setFailed(false);if(!isImage||!a.file){setPreview('');return;}
    const url=URL.createObjectURL(a.file);setPreview(url);return()=>URL.revokeObjectURL(url);
  },[a.file,isImage]);
  const image=!!preview&&!failed&&!a.status,extension=a.name.includes('.')?a.name.split('.').pop()!.slice(0,12).toUpperCase():'FILE';
  const size=a.size<1024?a.size+' B':a.size<1024*1024?(a.size/1024).toFixed(1)+' KB':(a.size/1024/1024).toFixed(1)+' MB';
  const state=a.status==='uploading'?t('Загружается…'):a.status==='failed'?t('Не загружен'):`${extension} · ${size}`;
  return <div className={'draft-attachment'+(image?' draft-attachment-image':'')} data-status={a.status} title={a.error?`${a.name}: ${t(a.error)}`:a.name}>
    {image?<img src={preview} alt={a.name} onError={()=>setFailed(true)}/>:<><span className="draft-attachment-icon" aria-hidden="true">{a.status==='uploading'?<LoaderCircle size={25} className="composer-uploading"/>:a.status==='failed'?<TriangleAlert size={25}/>:isImage?<ImageIcon size={25}/>:<FileText size={25}/>}</span><span className="draft-attachment-info"><strong>{a.pastedText?t('Вставленный текст'):a.name}</strong><small role={a.status==='failed'?'alert':undefined}>{state}</small>
      {a.status==='failed'&&onRetry&&<button type="button" className="text-button attachment-action" disabled={disabled} onClick={onRetry}><RotateCw size={14} aria-hidden="true"/>{t('Повторить')}</button>}
      {!a.status&&a.pastedText&&onInsertText&&<button type="button" className="text-button attachment-action" disabled={disabled} onClick={onInsertText}><TextCursorInput size={14} aria-hidden="true"/>{t('Вставить текстом')}</button>}
    </span></>}
    <button type="button" className="attachment-remove" disabled={disabled} aria-label={t('Убрать {0}',a.name)} onClick={onRemove}><X size={24} aria-hidden="true"/></button>
  </div>;
}
/** On a short screen (keyboard open) the tray folds into a "N files ›" chip so Send stays visible. */
export function AttachmentTray({attachments,disabled=false,compact=false,onRemove,onRetry,onInsertText}:{attachments:DraftAttachment[];disabled?:boolean;compact?:boolean;onRemove:(id:string)=>void;onRetry?:(id:string)=>void;onInsertText?:(id:string)=>void}){
  const [expanded,setExpanded]=useState(false);
  const count=plural(attachments.length,['{0} файл','{0} файла','{0} файлов']),uploading=attachments.filter(a=>a.status==='uploading').length,failed=attachments.filter(a=>a.status==='failed').length;
  if(compact&&!expanded)return <button type="button" className="attachment-summary" aria-expanded="false" onClick={()=>setExpanded(true)}>{count}{uploading>0&&<> · {t('загрузка')}</>}{failed>0&&<> · {t('ошибка')}</>}<ChevronRight size={16} aria-hidden="true"/></button>;
  return <div className="attachment-tray-wrap">
    {(attachments.length>2||compact)&&<p className="attachment-count">{count}{compact&&<button type="button" className="text-button" onClick={()=>setExpanded(false)}>{t('Свернуть')}</button>}</p>}
    <div className="attachment-tray">{attachments.map(a=><AttachmentCard key={a.id} attachment={a} disabled={disabled} onRemove={()=>onRemove(a.id)} onRetry={onRetry?()=>onRetry(a.id):undefined} onInsertText={onInsertText?()=>onInsertText(a.id):undefined}/>)}</div>
  </div>;
}
