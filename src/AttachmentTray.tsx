import {useEffect,useId,useRef,useState,type MouseEvent} from 'react';
import {FileText,Image as ImageIcon,X,LoaderCircle,RotateCw,TriangleAlert,TextCursorInput,ChevronRight} from 'lucide-react';
import {t} from './i18n';
import {plural} from './plural';
import './attachment-tray.css';
/** status is absent once the PC has the file; a pasted long text can be put back into the message. */
export type DraftAttachment={id:string;name:string;size:number;file?:File;status?:'uploading'|'failed';error?:string;pastedText?:boolean};
export const attachmentReady=(a:DraftAttachment)=>!a.status;
type CardAction=(event:MouseEvent<HTMLButtonElement>)=>void;
function AttachmentCard({attachment:a,disabled,onRemove,onRetry,onInsertText}:{attachment:DraftAttachment;disabled:boolean;onRemove:CardAction;onRetry?:CardAction;onInsertText?:CardAction}){
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
    {image?<img src={preview} alt={a.name} onError={()=>setFailed(true)}/>:<><span className="draft-attachment-icon" aria-hidden="true">{a.status==='uploading'?<LoaderCircle size={24} className="composer-uploading"/>:a.status==='failed'?<TriangleAlert size={24}/>:isImage?<ImageIcon size={24}/>:<FileText size={24}/>}</span><span className="draft-attachment-info"><strong>{a.pastedText?t('Вставленный текст'):a.name}</strong><small role={a.status==='failed'?'alert':undefined}>{state}</small>
      {a.status==='failed'&&onRetry&&<button type="button" className="text-button attachment-action" disabled={disabled} onClick={onRetry}><RotateCw size={14} aria-hidden="true"/>{t('Повторить')}</button>}
      {!a.status&&a.pastedText&&onInsertText&&<button type="button" className="text-button attachment-action" disabled={disabled} onClick={onInsertText}><TextCursorInput size={14} aria-hidden="true"/>{t('Вставить текстом')}</button>}
    </span></>}
    <button type="button" className="attachment-remove" disabled={disabled} aria-label={t('Убрать {0}',a.name)} onClick={onRemove}><X size={24} aria-hidden="true"/></button>
  </div>;
}
/** On a short screen (keyboard open) the tray folds into a "N files ›" chip so Send stays visible. */
export function AttachmentTray({attachments,disabled=false,compact=false,onRemove,onRetry,onInsertText,focusDraft}:{attachments:DraftAttachment[];disabled?:boolean;compact?:boolean;onRemove:(id:string)=>void;onRetry?:(id:string)=>void;onInsertText?:(id:string)=>void;focusDraft:()=>void}){
  const [expanded,setExpanded]=useState(false);
  const count=plural(attachments.length,['{0} файл','{0} файла','{0} файлов']);
  const uploading=attachments.some(a=>a.status==='uploading');
  const failed=attachments.filter(a=>a.status==='failed');
  const errors=failed.filter(a=>a.error);
  const trayId=useId();
  const tray=useRef<HTMLDivElement>(null);
  const visible=!compact||expanded;
  function draftAction(action:((id:string)=>void)|undefined,id:string):CardAction|undefined{
    if(!action)return;
    return event=>{
      // Retry and Insert as text both remove the activated button.
      if(event.detail===0)focusDraft();
      action(id);
    };
  }
  function remove(event:MouseEvent<HTMLButtonElement>,id:string){
    // Keyboard and assistive activation leave focus on a control that is about to disappear.
    if(event.detail===0&&tray.current){
      const buttons=Array.from(tray.current.querySelectorAll<HTMLButtonElement>('.attachment-remove'));
      const index=buttons.indexOf(event.currentTarget);
      const neighbor=buttons[index+1]||buttons[index-1];
      if(neighbor)neighbor.focus();
      else focusDraft();
    }
    onRemove(id);
  }
  return <div className="attachment-tray-wrap">
    {compact?<button type="button" className="attachment-summary" aria-expanded={expanded}
      aria-controls={trayId} onClick={()=>setExpanded(value=>!value)}>
      <ChevronRight size={16} aria-hidden="true"/>{count}
      {uploading&&<> · {t('загрузка')}</>}{failed.length>0&&<> · {t('ошибка')}</>}
    </button>:attachments.length>2&&<p className="attachment-count">{count}</p>}
    <div id={trayId} hidden={!visible}>
      {visible&&<div ref={tray} className="attachment-tray">
        {attachments.map(a=><AttachmentCard key={a.id} attachment={a} disabled={disabled}
          onRemove={event=>remove(event,a.id)}
          onRetry={draftAction(onRetry,a.id)}
          onInsertText={draftAction(onInsertText,a.id)}/>)}
      </div>}
      <div aria-live="polite">
        {visible&&errors.length>0&&<ul className="attachment-errors">
          {errors.map(a=><li key={a.id}><strong>{a.name}</strong> — {t(a.error!)}</li>)}
        </ul>}
      </div>
    </div>
  </div>;
}
