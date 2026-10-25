import {useEffect,useRef,useState,type RefObject} from 'react';
import type {BoardActivityTarget} from '../server/board-live';

type View={zoom:number;pan:{x:number;y:number}};
export function useAiFollow(target:BoardActivityTarget|undefined,eventId:string|undefined,expiresAt:number,viewport:RefObject<HTMLDivElement|null>,view:View,apply:(view:View)=>void,suspended:boolean){
 const [following,setFollowing]=useState(true),[visible,setVisible]=useState(document.visibilityState!=='hidden');
 const latest=useRef({view,apply});latest.current={view,apply};
 const frame=useRef(0);
 const cancel=()=>{cancelAnimationFrame(frame.current);frame.current=0;};
 const pause=()=>{cancel();setFollowing(false);};
 useEffect(()=>{const update=()=>{if(document.visibilityState==='hidden')cancel();setVisible(document.visibilityState!=='hidden');};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{
  cancel();const element=viewport.current;
  if(!following||!visible||suspended||!target||!eventId||expiresAt<=Date.now()||!element)return;
  const focus=()=>{
   cancel();const rect=element.getBoundingClientRect();if(rect.width<1||rect.height<1||expiresAt<=Date.now())return;
   const zoom=Math.max(.1,Math.min(1,(rect.width-96)/Math.max(1,target.width),(rect.height-96)/Math.max(1,target.height)));
   const next={zoom,pan:{x:rect.width/2-(target.x+target.width/2)*zoom,y:rect.height/2-(target.y+target.height/2)*zoom}};
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){latest.current.apply(next);return;}
   const start=latest.current.view,time=performance.now();
   const tick=(now:number)=>{const t=Math.min(1,(now-time)/360),ease=1-(1-t)**3;latest.current.apply({zoom:start.zoom+(next.zoom-start.zoom)*ease,pan:{x:start.pan.x+(next.pan.x-start.pan.x)*ease,y:start.pan.y+(next.pan.y-start.pan.y)*ease}});frame.current=t<1?requestAnimationFrame(tick):0;};
   frame.current=requestAnimationFrame(tick);
  };
  focus();const observer=new ResizeObserver(focus);observer.observe(element);
  return()=>{cancel();observer.disconnect();};
 },[eventId,target?.x,target?.y,target?.width,target?.height,following,visible,suspended,expiresAt]);
 return {following,pause,toggle:()=>{if(following)pause();else setFollowing(true);}};
}
