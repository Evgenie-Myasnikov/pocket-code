import {useEffect,useRef} from 'react';
type Props={className:string;label:string;hint:string;axis:'x'|'y';current():number;limits():{min:number;max:number};onChange(value:number):void;onCommit(value:number):void;onReset():void};
export function PanelResizeHandle({className,label,hint,axis,current,limits,onChange,onCommit,onReset}:Props){
 const cancel=useRef<(()=>void)|null>(null);useEffect(()=>()=>cancel.current?.(),[]);
 const bound=(value:number)=>{const {min,max}=limits();return Math.round(Math.max(min,Math.min(max,value)));},range=limits();
 return <div className={className} role="separator" aria-label={label} aria-orientation={axis==='x'?'vertical':'horizontal'} aria-valuenow={Math.round(current())} aria-valuemin={Math.round(range.min)} aria-valuemax={Math.round(range.max)} tabIndex={0} title={hint}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();cancel.current?.();const handle=event.currentTarget,id=event.pointerId,start=axis==='x'?event.clientX:event.clientY,origin=current();let next=origin,ended=false;handle.setPointerCapture(id);document.body.classList.add('desktop-resizing');document.body.dataset.resizeAxis=axis;
   const move=(e:PointerEvent)=>{next=bound(origin+(axis==='x'?e.clientX:e.clientY)-start);onChange(next);};
   const finish=(commit:boolean)=>{if(ended)return;ended=true;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);handle.removeEventListener('pointercancel',abort);handle.removeEventListener('lostpointercapture',abort);document.removeEventListener('keydown',key,true);document.body.classList.remove('desktop-resizing');delete document.body.dataset.resizeAxis;cancel.current=null;if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);if(commit)onCommit(next);else onChange(origin);};
   const up=()=>finish(true),abort=()=>finish(false),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();abort();}};
   cancel.current=abort;handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);handle.addEventListener('pointercancel',abort);handle.addEventListener('lostpointercapture',abort);document.addEventListener('keydown',key,true);
  }} onDoubleClick={onReset} onKeyDown={event=>{const step=event.shiftKey?64:16,negative=axis==='x'?'ArrowLeft':'ArrowUp',positive=axis==='x'?'ArrowRight':'ArrowDown';if(event.key===negative||event.key===positive){event.preventDefault();onCommit(bound(current()+(event.key===positive?step:-step)));}else if(event.key==='Home'){event.preventDefault();onReset();}}}/>;
}
