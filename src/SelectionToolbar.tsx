import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Quote} from 'lucide-react';
import {useAssistantChat} from './AssistantChat';
import {useLanguage} from './i18n';
import './selection-toolbar.css';

const NEWLINE=String.fromCharCode(10);

/**
 * Words selected in the transcript offer Copy and Quote, as in Strata: the toolbar stands over the selection once the
 * pointer is let go, Copy puts the words on the clipboard, Quote adds them to the message field as a quotation.
 */
export function SelectionToolbar(){
  const bridge=useAssistantChat(),ru=useLanguage()==='ru';
  const [spot,setSpot]=useState<{x:number;y:number;above:boolean}|null>(null),[copied,setCopied]=useState(false);
  const words=useRef(''),dragging=useRef(false),timer=useRef(0);
  useEffect(()=>{
    const inTranscript=(node:Node|null)=>!!node&&!!document.querySelector('.chat-canvas .conversation-inner')?.contains(node);
    const read=()=>{
      if(dragging.current)return;
      const selection=document.getSelection();
      if(!selection||selection.isCollapsed||!selection.rangeCount||!inTranscript(selection.getRangeAt(0).commonAncestorContainer)){setSpot(null);return;}
      const value=selection.toString().trim();
      if(!value){setSpot(null);return;}
      words.current=value;
      const box=selection.getRangeAt(0).getBoundingClientRect();
      setSpot({x:Math.min(Math.max(box.left+box.width/2,110),window.innerWidth-110),y:box.top>72?box.top-8:box.bottom+8,above:box.top>72});
    };
    const down=(event:PointerEvent)=>{
      if((event.target as HTMLElement|null)?.closest('.selection-toolbar'))return;
      dragging.current=true;setSpot(null);
    };
    const up=()=>{if(!dragging.current)return;dragging.current=false;window.setTimeout(read,0);};
    document.addEventListener('selectionchange',read);document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);
    window.addEventListener('scroll',read,true);window.addEventListener('resize',read);
    return()=>{document.removeEventListener('selectionchange',read);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);window.removeEventListener('scroll',read,true);window.removeEventListener('resize',read);window.clearTimeout(timer.current);};
  },[]);
  if(!spot)return null;
  const copy=async()=>{
    try{await navigator.clipboard.writeText(words.current);}
    catch{document.execCommand('copy');}
    setCopied(true);window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>setCopied(false),1400);
  };
  const quote=()=>{
    bridge?.onDraft(words.current.split(NEWLINE).map(line=>'> '+line).join(NEWLINE)+NEWLINE+NEWLINE);
    document.getSelection()?.removeAllRanges();setSpot(null);
    requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus());
  };
  // The buttons never take the selection away from the text.
  const keep={onMouseDown:(event:React.MouseEvent)=>event.preventDefault()};
  return createPortal(<div className="selection-toolbar" data-above={spot.above||undefined} style={{left:spot.x,top:spot.y}} role="toolbar" aria-label={ru?'Выделенный текст':'Selected text'}>
    <button type="button" {...keep} onClick={()=>void copy()}>{copied?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}<span>{copied?(ru?'Скопировано':'Copied'):(ru?'Копировать':'Copy')}</span></button>
    {bridge&&<button type="button" {...keep} onClick={quote}><Quote size={14} aria-hidden="true"/><span>{ru?'Цитировать':'Quote'}</span></button>}
  </div>,document.body);
}
