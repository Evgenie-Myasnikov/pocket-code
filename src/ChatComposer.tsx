import {useCallback,useLayoutEffect,useRef,type ReactNode} from 'react';
import {ArrowUp,Paperclip,Square,LoaderCircle} from 'lucide-react';
import {AttachmentTray,type DraftAttachment} from './AttachmentTray';
import {t} from './i18n';
import './composer-controls.css';

type Props={
  text:string;label:string;placeholder:string;disabled?:boolean;uploading:boolean;canSend:boolean;
  attachments:DraftAttachment[];controls:ReactNode;usage?:ReactNode;stopLabel:string;
  onText(value:string):void;onRemove(id:string):void;onFiles(files:File[]):void;
  onSend():void;onStop?:()=>void;
};

/** Shared Windows/Android input. Resizing never changes the draft or selection. */
export function ChatComposer({text,label,placeholder,disabled,uploading,canSend,attachments,controls,usage,stopLabel,onText,onRemove,onFiles,onSend,onStop}:Props){
  const input=useRef<HTMLTextAreaElement>(null),files=useRef<HTMLInputElement>(null);
  const fit=useCallback(()=>{const element=input.current;if(element){element.style.height='auto';element.style.height=element.scrollHeight+'px';}},[]);
  useLayoutEffect(fit,[text,fit]);
  useLayoutEffect(()=>{
    const element=input.current;if(!element)return;
    let width=-1,frame=0;
    const observer=new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(next!==width){width=next;cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);}});
    const appearance=new MutationObserver(fit);
    observer.observe(element);appearance.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    return()=>{observer.disconnect();appearance.disconnect();cancelAnimationFrame(frame);};
  },[fit]);
  return <div className="composer prompt-composer">
    {attachments.length>0&&<AttachmentTray attachments={attachments} disabled={!!disabled} onRemove={onRemove}/>}
    <div className="composer-input">
      <textarea ref={input} rows={1} aria-label={label} placeholder={placeholder} value={text} disabled={disabled}
        onChange={event=>onText(event.target.value)}
        onPaste={event=>{const incoming=Array.from(event.clipboardData.files);if(incoming.length){event.preventDefault();if(!uploading&&!disabled)onFiles(incoming);}}}
        onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend)onSend();}}}/>
      {usage}
    </div>
    <div className="composer-tools">
      <input hidden ref={files} type="file" multiple onChange={event=>{const incoming=Array.from(event.target.files||[]);event.target.value='';if(incoming.length)onFiles(incoming);}}/>
      <button type="button" className="icon-button composer-attach" aria-label={t('Прикрепить файлы')} disabled={disabled||uploading} onClick={()=>files.current?.click()}>
        {uploading?<LoaderCircle size={19} className="composer-uploading"/>:<Paperclip size={19}/>}
      </button>
      <div className="composer-models">{controls}</div>
      <div className="composer-actions">
        {onStop&&<button type="button" className="icon-button stop-button" aria-label={stopLabel} onClick={onStop}><Square size={15}/></button>}
        <button type="button" className="send-button" aria-label={t('Отправить сообщение')} title={t('Отправить сообщение')+' · Ctrl/⌘ Enter'} disabled={!canSend} onClick={onSend}><ArrowUp size={20}/></button>
      </div>
    </div>
  </div>;
}
