import {chatScrollMotion} from './chat-scroll-motion';
import {useLayoutEffect,type RefObject} from 'react';

const scrollGeometry=new WeakMap<HTMLElement,{height:number;content:number}>();
export function transcriptFollowing(element:HTMLElement,previousTop:number,wasFollowing:boolean){
  const previous=scrollGeometry.get(element),height=element.clientHeight,content=element.scrollHeight;
  scrollGeometry.set(element,{height,content});
  // A shrinking draft can clamp scrollTop just before the keyboard resizes the
  // viewport. That backward movement is layout, not a request to read history.
  const resized=previous&&(previous.height!==height||previous.content!==content);
  return content-element.scrollTop-height<80||wasFollowing&&(element.scrollTop>=previousTop-1||!!resized);
}

/** Follow rendered height, including paced letters, images and disclosure changes. */
export function useTranscriptFollow(scroll:RefObject<HTMLDivElement|null>,following:{current:boolean},enabled:boolean,context:string){
  useLayoutEffect(()=>{
    const element=scroll.current,content=element?.querySelector('.conversation-inner');
    if(!enabled||!element||!content)return;
    const motion=chatScrollMotion(element,following),follow=()=>motion.follow();
    let touchY:number|undefined;
    const wheel=(event:WheelEvent)=>{if(event.deltaY<0){following.current=false;motion.cancel();}};
    const start=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY;};
    const move=(event:TouchEvent)=>{const y=event.touches[0]?.clientY;if(y!==undefined&&touchY!==undefined&&y>touchY+2){following.current=false;motion.cancel();}touchY=y;};
    const key=(event:KeyboardEvent)=>{if(['ArrowUp','PageUp','Home'].includes(event.key)||event.key===' '&&event.shiftKey){following.current=false;motion.cancel();}};
    const pointer=(event:PointerEvent)=>{if(event.pointerType==='mouse'&&event.clientX>=element.getBoundingClientRect().right-16){following.current=false;motion.cancel();}};
    // Floating controls change scroll padding without changing text content size.
    const observer=new ResizeObserver(follow);observer.observe(content,{box:'border-box'});observer.observe(element);
    element.addEventListener('wheel',wheel,{passive:true});element.addEventListener('touchstart',start,{passive:true});element.addEventListener('touchmove',move,{passive:true});
    element.addEventListener('keydown',key);element.addEventListener('pointerdown',pointer);motion.follow(true);
    return()=>{motion.destroy();element.removeEventListener('keydown',key);element.removeEventListener('pointerdown',pointer);observer.disconnect();element.removeEventListener('wheel',wheel);element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);};
  },[scroll,following,enabled,context]);
}
