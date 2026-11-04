import {useEffect,useId,useRef,useState,type ButtonHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {useBackAction} from './navigation';
import {useUiEntrance,useUiPress} from './ui-motion';

/** A normal rail button with a readable label outside the rail's clipping boundary. */
export function RailButton({title,...props}:ButtonHTMLAttributes<HTMLButtonElement>){
 const button=useRef<HTMLButtonElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),id=useId();
 const [point,setPoint]=useState<{left:number;top:number}|null>(null),label=title||props['aria-label'];
 const tooltip=useRef<HTMLSpanElement>(null);
 useUiEntrance(tooltip,'tooltip',!!point);useUiPress(button);
 const clear=()=>{clearTimeout(timer.current);timer.current=undefined;};
 const hide=()=>{clear();setPoint(null);};
 const show=()=>{clear();const rect=button.current?.getBoundingClientRect();if(!rect||!label||props.disabled)return;setPoint({left:Math.max(8,Math.min(rect.right+8,innerWidth-228)),top:Math.max(8,Math.min(rect.top+(rect.height-32)/2,innerHeight-48))});};
 useBackAction(()=>{hide();return true;},105,!!point);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 useEffect(()=>{
  if(!point)return;
  const dismiss=()=>setPoint(null);
  window.addEventListener('resize',dismiss);window.addEventListener('scroll',dismiss,true);window.addEventListener('blur',dismiss);
  return()=>{window.removeEventListener('resize',dismiss);window.removeEventListener('scroll',dismiss,true);window.removeEventListener('blur',dismiss);};
 },[!!point]);
 return <><button {...props} ref={button} data-ui-press aria-describedby={point?id:props['aria-describedby']}
  onPointerEnter={event=>{props.onPointerEnter?.(event);if(event.pointerType==='mouse'){clear();timer.current=setTimeout(show,160);}}}
  onPointerLeave={event=>{props.onPointerLeave?.(event);clear();timer.current=setTimeout(hide,120);}}
  onFocus={event=>{props.onFocus?.(event);if(event.currentTarget.matches(':focus-visible'))show();}}
  onBlur={event=>{props.onBlur?.(event);hide();}}
  onPointerDown={event=>{hide();props.onPointerDown?.(event);}}
  onClick={event=>{hide();props.onClick?.(event);}}/>
  {point&&createPortal(<span ref={tooltip} id={id} role="tooltip" className="rail-tooltip" style={point} onPointerEnter={clear} onPointerLeave={hide}>{label}</span>,document.body)}
 </>;
}
