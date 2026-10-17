import {createContext,useContext,useEffect,useLayoutEffect,useState,type RefObject} from 'react';

/** Code font metrics, measured once per font change for the whole Review panel. */
export type CodeMetrics={unit:number;line:number;font:string};
export type ScrollBus={subscribe(listener:()=>void):()=>void;schedule():void};

/** One scroll and resize listener for every diff table; listeners run together in one animation frame. */
export function createScrollBus(viewport:RefObject<HTMLElement|null>):ScrollBus&{attach():()=>void}{
  const listeners=new Set<()=>void>();let frame=0;
  const run=()=>{frame=0;for(const listener of [...listeners])listener();};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(run);};
  return {
    subscribe(listener){listeners.add(listener);schedule();return()=>{listeners.delete(listener);};},
    schedule,
    attach(){
      const element=viewport.current;if(!element)return()=>{};
      element.addEventListener('scroll',schedule,{passive:true});
      const resize=new ResizeObserver(schedule);resize.observe(element);
      const list=element.querySelector('.review-file-list');if(list)resize.observe(list);
      return()=>{element.removeEventListener('scroll',schedule);resize.disconnect();cancelAnimationFrame(frame);frame=0;};
    },
  };
}

const fallback:CodeMetrics={unit:8.4,line:24.4,font:''};
export const ReviewContext=createContext<{metrics:CodeMetrics;bus:ScrollBus|null}>({metrics:fallback,bus:null});
export const useReviewContext=()=>useContext(ReviewContext);

/** Measures the probe that carries the diff font: the character width and row height every table uses. */
export function useCodeMetrics(probe:RefObject<HTMLElement|null>,fontSize:number|null):CodeMetrics{
  const [metrics,setMetrics]=useState<CodeMetrics>(fallback);
  const measure=()=>{
    const element=probe.current;if(!element)return;
    const style=getComputedStyle(element),size=Number.parseFloat(style.fontSize)||14;
    const width=element.getBoundingClientRect().width/100;
    const next={unit:width||size*.6,line:Math.round((size*1.6+2)*100)/100,font:`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`};
    setMetrics(old=>Math.abs(old.unit-next.unit)<.001&&old.line===next.line&&old.font===next.font?old:next);
  };
  useLayoutEffect(measure,[fontSize]);
  useEffect(()=>{
    // Appearance changes the chat text size through root styles; web fonts can finish loading later.
    const observer=new MutationObserver(measure);observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','class','lang','data-theme']});
    const fonts=(document as Document&{fonts?:FontFaceSet}).fonts;fonts?.addEventListener?.('loadingdone',measure);
    return()=>{observer.disconnect();fonts?.removeEventListener?.('loadingdone',measure);};
  },[]);
  return metrics;
}
