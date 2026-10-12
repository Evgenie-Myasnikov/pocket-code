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
    return()=>{observer.disconnect();workspace.style.removeProperty(property);};
  },[edge,enabled]);
  return enabled?<div ref={ref} className={`chat-overlay chat-overlay-${edge}`}>{children}</div>:<>{children}</>;
}
