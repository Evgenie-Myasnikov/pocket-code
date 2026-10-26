import type {BoardSelection} from './board-selection-context';
import {BoardSelectionPreview} from './BoardSelectionPreview';
import {boardImageMime} from './board-image-drag';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {ArrowUp,Paperclip,Square,LoaderCircle,ListPlus,CornerDownRight,Clock,RefreshCw} from 'lucide-react';
import {AttachmentTray,type DraftAttachment} from './AttachmentTray';
import {t} from './i18n';
import './composer-controls.css';

/** A paste this long becomes a text attachment that can be put back into the message. */
export const LONG_PASTE=10000;
type Props={
  boardSelection?:BoardSelection|null;onRevealBoardSelection?(id:string):void;
  text:string;label:string;placeholder:string;disabled?:boolean;uploading:boolean;canSend:boolean;
  attachments:DraftAttachment[];controls:ReactNode;usage?:ReactNode;stopLabel:string;
  /** A send is in flight: Send waits, the field keeps focus and the keyboard stays open. */
  busy?:boolean;stopping?:boolean;
  /** While a turn runs Send says what it does: queue or steer; without the PC it waits to send. */
  mode?:'send'|'queue'|'steer'|'later';
  /** Why Send is unavailable right now (no PC connection); the draft stays editable. */
  blockedReason?:string;
  /** Stop turns into "Retry connection" while the run status is unknown. */
  stopRetry?:boolean;
  enterSends?:boolean;keyHint?:boolean;
  onText(value:string):void;onRemove(id:string):void;onFiles(files:File[],options?:{pastedText?:boolean}):void;
  onBoardImage?(data:DataTransfer):void;
  onRetry?(id:string):void;onInsertText?(id:string):void;onRecall?():string|undefined;
  onSend():void;onStop?:()=>void;
};
function useShortScreen(){
  const query='(max-height: 540px)',[short,setShort]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);
  useEffect(()=>{if(typeof matchMedia!=='function')return;const list=matchMedia(query),change=()=>setShort(list.matches);change();list.addEventListener('change',change);return()=>list.removeEventListener('change',change);},[]);
  return short;
}

/** Shared Windows/Android input. Resizing never changes the draft or selection. */
export function ChatComposer({boardSelection,onRevealBoardSelection,text,label,placeholder,disabled,uploading,canSend,attachments,controls,usage,stopLabel,busy=false,stopping=false,mode='send',blockedReason,stopRetry=false,enterSends=false,keyHint=false,onText,onRemove,onFiles,onBoardImage,onRetry,onInsertText,onRecall,onSend,onStop}:Props){
  const input=useRef<HTMLTextAreaElement>(null),files=useRef<HTMLInputElement>(null),hadFocus=useRef(false),focusAtPress=useRef(false);
  const [wave,setWave]=useState<{id:number;x:number;y:number}|null>(null),waveSequence=useRef(0),wavePointer=useRef(0);
  const ripple=()=>{if(disabled||matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)').matches)return;const rect=input.current?.closest('.prompt-composer')?.getBoundingClientRect();if(rect?.width&&rect.height)setWave({id:++waveSequence.current,x:1+16/rect.width,y:1+16/rect.height});};
  useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)'),clear=()=>setWave(null);query.addEventListener('change',clear);return()=>query.removeEventListener('change',clear);},[]);
  const [focused,setFocused]=useState(false),[dragging,setDragging]=useState(false),short=useShortScreen();
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
  // The field is never disabled while sending, so Android keeps the keyboard; focus returns if anything took it.
  useEffect(()=>{if(!busy&&hadFocus.current){hadFocus.current=false;if(document.activeElement!==input.current&&!document.querySelector('[aria-modal="true"]'))input.current?.focus({preventScroll:true});}},[busy]);
  const send=()=>{if(!canSend)return;hadFocus.current=focusAtPress.current||document.activeElement===input.current;focusAtPress.current=false;onSend();};
  // Pressing a button would move focus off the field and close the phone keyboard; keep it in the field.
  const keepFocus=(event:React.PointerEvent)=>{focusAtPress.current=document.activeElement===input.current;if(focusAtPress.current)event.preventDefault();};
  const empty=!text.trim()&&!attachments.length,stopOnly=Boolean(onStop)&&empty;
  const sendLabel=mode==='later'?t('Отправить, когда ПК будет на связи'):mode==='queue'?t('В очередь'):mode==='steer'?t('Направить'):t('Отправить сообщение');
  const shortcut=enterSends?'Enter':'Ctrl+Enter';
  const hasFiles=(event:React.DragEvent)=>Array.from(event.dataTransfer?.types||[]).includes('Files')||!!onBoardImage&&Array.from(event.dataTransfer?.types||[]).includes(boardImageMime);
  return <div className={'composer prompt-composer'+(dragging?' composer-drop':'')} data-pulsing={!!onStop&&!stopRetry&&!stopping||undefined} data-stopping={stopping||undefined} data-running={onStop?true:undefined}
    onDragEnter={event=>{if(!disabled&&hasFiles(event)){event.preventDefault();setDragging(true);}}}
    onDragOver={event=>{if(!disabled&&hasFiles(event)){event.preventDefault();event.dataTransfer.dropEffect='copy';}}}
    onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDragging(false);}}
    onDrop={event=>{if(!hasFiles(event))return;event.preventDefault();event.stopPropagation();setDragging(false);if(disabled)return;if(event.dataTransfer.types.includes(boardImageMime)&&onBoardImage){onBoardImage(event.dataTransfer);return;}const incoming=Array.from(event.dataTransfer.files);if(incoming.length)onFiles(incoming);}}>
    {wave&&<span key={wave.id} className="composer-border-wave" aria-hidden="true" style={{'--composer-wave-x':wave.x,'--composer-wave-y':wave.y} as CSSProperties} onAnimationEnd={()=>setWave(null)}/>}
    {dragging&&<div className="composer-drop-zone" aria-hidden="true">{t('Отпустите, чтобы прикрепить')}</div>}
    {boardSelection&&<BoardSelectionPreview selection={boardSelection} onReveal={onRevealBoardSelection}/>}
    {attachments.length>0&&<AttachmentTray attachments={attachments} disabled={!!disabled} compact={short} onRemove={onRemove} onRetry={onRetry} onInsertText={onInsertText}/>}
    <div className="composer-input">
      <textarea ref={input} rows={1} aria-label={label} placeholder={placeholder} value={text} disabled={disabled} aria-keyshortcuts={enterSends?'Enter':'Control+Enter'}
        onPointerDown={()=>{wavePointer.current=Date.now();ripple();}} onFocus={()=>{setFocused(true);if(Date.now()-wavePointer.current>200)ripple();}} onBlur={()=>setFocused(false)}
        onChange={event=>onText(event.target.value)}
        onPaste={event=>{
          const incoming=Array.from(event.clipboardData.files);
          // Files pasted during an upload wait their turn instead of being dropped.
          if(incoming.length){event.preventDefault();if(!disabled)onFiles(incoming);return;}
          const pasted=event.clipboardData.getData('text/plain');
          if(pasted.length>LONG_PASTE&&!disabled){event.preventDefault();onFiles([new File([pasted],'pasted-text.txt',{type:'text/plain'})],{pastedText:true});}
        }}
        onKeyDown={event=>{
          if(event.nativeEvent.isComposing)return;
          if(event.key==='Enter'&&(event.ctrlKey||event.metaKey||enterSends&&!event.shiftKey&&!event.altKey)){event.preventDefault();send();return;}
          // Up in an empty field brings back the last message to edit, like a terminal.
          if(event.key==='ArrowUp'&&!text&&onRecall){const previous=onRecall();if(previous){event.preventDefault();onText(previous);}}
        }}/>
      {usage}
    </div>
    {blockedReason&&<p className="composer-hint composer-blocked" role="status">{blockedReason}</p>}
    <div className="composer-tools">
      <input hidden ref={files} type="file" multiple onChange={event=>{const incoming=Array.from(event.target.files||[]);event.target.value='';if(incoming.length)onFiles(incoming);}}/>
      <button type="button" className="icon-button composer-attach" aria-label={t('Прикрепить файлы')} disabled={disabled} onClick={()=>files.current?.click()}>
        {uploading?<LoaderCircle size={20} className="composer-uploading"/>:<Paperclip size={20}/>}
      </button>
      <div className="composer-models">{controls}</div>
      <div className="composer-actions">
        {onStop&&<button type="button" className={'icon-button stop-button'+(stopOnly?' stop-primary':'')} aria-label={stopping?t('Останавливаю…'):stopLabel} title={stopping?t('Останавливаю…'):stopLabel+(keyHint?' (Esc)':'')} aria-busy={stopping||undefined} disabled={stopping} onPointerDown={keepFocus} onClick={onStop}>{stopping?<LoaderCircle size={16} className="composer-uploading"/>:stopRetry?<RefreshCw size={16}/>:<Square size={stopOnly?16:13}/>}</button>}
        {!stopOnly&&<button type="button" className="send-button" data-mode={mode} aria-label={sendLabel} title={`${sendLabel} · ${shortcut}`} aria-keyshortcuts={enterSends?'Enter':'Control+Enter'} aria-busy={busy||undefined} disabled={!canSend} aria-description={blockedReason}
          onPointerDown={keepFocus} onClick={send}>
          {busy?<LoaderCircle size={20} className="composer-uploading"/>:mode==='later'?<Clock size={20}/>:mode==='queue'?<ListPlus size={20}/>:mode==='steer'?<CornerDownRight size={20}/>:<ArrowUp size={20}/>}
        </button>}
      </div>
    </div>
  </div>;
}
