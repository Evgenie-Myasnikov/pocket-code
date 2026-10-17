import {useLayoutEffect,useRef,type ReactNode} from 'react';
import './chat-overlay.css';

/** Keep the transcript's scroll padding in sync with its floating controls. */
export function ChatOverlay({edge,enabled=true,children}:{edge:'top'|'bottom';enabled?:boolean;children:ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=ref.current,workspace=element?.closest<HTMLElement>('.workspace');
    if(!enabled||!element||!workspace)return;
    const property=`--chat-overlay-${edge}`;
    const measure=()=>workspace.style.setProperty(property,`${element.offsetHeight}px`);
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    // The top band shows a hairline only once the transcript scrolls beneath it.
    const scrolled=(target:EventTarget|null)=>{if(edge==='top'&&target instanceof HTMLElement&&target.classList.contains('conversation'))element.dataset.scrolled=String(target.scrollTop>4);};
    const onScroll=(event:Event)=>scrolled(event.target);scrolled(workspace.querySelector('.conversation'));workspace.addEventListener('scroll',onScroll,true);
    return()=>{observer.disconnect();workspace.removeEventListener('scroll',onScroll,true);workspace.style.removeProperty(property);};
  },[edge,enabled]);
  return enabled?<div ref={ref} className={`chat-overlay chat-overlay-${edge}`}>{children}</div>:<>{children}</>;
}
