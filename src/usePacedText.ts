import {useEffect,useRef,useState} from 'react';

const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});

/** Pace presentation only; the provider's complete text remains untouched. */
export function usePacedText(text:string,animateInitial:boolean,speed=40){
  const [visible,setVisible]=useState(animateInitial?'':text),current=useRef(visible);
  const pending=useRef({target:text,ends:[] as number[],index:0,last:0,credit:0,frame:0,speed});
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)'),state=pending.current;
    const motion=()=>{if(media.matches){cancelAnimationFrame(state.frame);state.frame=0;state.credit=0;current.current=state.target;setVisible(state.target);}};
    media.addEventListener('change',motion);
    return()=>{cancelAnimationFrame(state.frame);state.frame=0;media.removeEventListener('change',motion);};
  },[]);
  useEffect(()=>{
    const state=pending.current;state.target=text;state.speed=speed;
    const show=(value:string)=>{current.current=value;setVisible(value);};
    const flush=()=>{cancelAnimationFrame(state.frame);state.frame=0;state.credit=0;show(text);};
    if(speed===0||window.matchMedia('(prefers-reduced-motion: reduce)').matches||!text.startsWith(current.current)||text===current.current){flush();}
    else if(text!==current.current){
      const start=current.current.length;
      state.ends=Array.from(graphemes.segment(text.slice(start)),part=>start+part.index+part.segment.length);
      state.index=0;
      if(state.frame)return;
      state.last=performance.now();
      const tick=(now:number)=>{
        // Catch up to large network bursts without letting the display queue grow indefinitely.
        const rate=Math.min(state.speed*2,Math.max(state.speed,(state.ends.length-state.index)/3));
        state.credit+=Math.min(50,now-state.last)*rate/1000;state.last=now;
        const count=Math.floor(state.credit);
        if(count){state.credit-=count;state.index=Math.min(state.ends.length,state.index+count);show(state.target.slice(0,state.ends[state.index-1]));}
        state.frame=state.index<state.ends.length?requestAnimationFrame(tick):0;
      };
      state.frame=requestAnimationFrame(tick);
    }
  },[text,speed]);
  return visible;
}
