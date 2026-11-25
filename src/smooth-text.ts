import {useEffect,useRef,useState} from 'react';

/**
 * Text that arrives in chunks, or a whole block at once, is not written into the chat at once: what is waiting is spread
 * over a window of the person's choosing (Appearance → Smooth text), so it always appears word by word. Every received
 * word is in the chat at most that long after the last chunk arrived.
 */
export const TEXT_DELAYS=[0,300,500,1000] as const;
export const DEFAULT_TEXT_DELAY=500;

export type Reveal={shown:number;deadline:number;length:number;at:number};

/** The window in milliseconds from the settings (kept on the document by Appearance); none under reduced motion. */
export function readTextDelay():number{
  if(typeof document==='undefined')return 0;
  if(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
  const raw=document.documentElement.dataset.textDelay;
  if(raw===undefined)return DEFAULT_TEXT_DELAY;
  const value=Number(raw);
  return (TEXT_DELAYS as readonly number[]).includes(value)?value:DEFAULT_TEXT_DELAY;
}

/** Where a reveal may stop at or before `position`: after a whole word and its spaces, never inside a word. */
export function wordStop(text:string,position:number):number{
  if(position>=text.length)return text.length;
  let index=Math.max(0,Math.floor(position));
  while(index>0&&!/\s/.test(text[index-1]))index--;
  return index;
}

/** A reveal that has shown `shown` of `length` characters at time `at` and finishes at `deadline`. */
export const startReveal=(shown:number,length:number,now:number,delay:number):Reveal=>({shown,length,at:now,deadline:now+delay});

/**
 * Moves a reveal to time `now` for a text of `length` characters. The waiting characters are shown evenly up to the
 * deadline; text that arrives meanwhile moves the deadline to `delay` after its arrival.
 */
export function stepReveal(state:Reveal,length:number,now:number,delay:number):Reveal{
  if(delay<=0||length<state.length)return {shown:length,length,at:now,deadline:now};
  let shown=state.shown;
  if(now>=state.deadline)shown=state.length;
  else{const window=Math.max(state.deadline-state.at,1);shown=Math.min(state.length,shown+(state.length-shown)*Math.min(1,(now-state.at)/window));}
  const deadline=length>state.length?now+delay:state.deadline;
  return {shown:now>=deadline?length:shown,length,at:now,deadline};
}

/**
 * The part of `text` to show now. `fromEmpty` starts a text that is mounted already written (a block that arrived whole)
 * from nothing; `live` says the text is still being produced. A text that is not live and never was is shown whole.
 */
export function useSmoothText(text:string,live:boolean,fromEmpty:boolean):{text:string;pending:boolean}{
  const smooth=useRef(live||fromEmpty);
  const wasLive=useRef(live);
  if(live||fromEmpty)smooth.current=true;
  if(live)wasLive.current=true;
  // Once a stream finishes, show its complete final chunk in this render. The
  // timer may still have words queued from the last provider update.
  const finished=!live&&wasLive.current;
  const [index,setIndex]=useState(()=>fromEmpty&&readTextDelay()>0?0:text.length);
  const latest=useRef(text);latest.current=text;
  const previous=useRef(text);
  const state=useRef<Reveal>(null as unknown as Reveal);
  const frame=useRef(0),lastIndex=useRef(index),lastSet=useRef(0);
  state.current??=startReveal(index,text.length,typeof performance==='undefined'?0:performance.now(),readTextDelay());
  useEffect(()=>{
    const delay=readTextDelay(),replaced=!text.startsWith(previous.current);
    previous.current=text;
    if(finished||delay<=0||!smooth.current||replaced){
      cancelAnimationFrame(frame.current);frame.current=0;
      state.current=startReveal(text.length,text.length,performance.now(),0);lastIndex.current=text.length;setIndex(text.length);return;
    }
    if(frame.current)return;
    const tick=(now:number)=>{
      const current=latest.current,next=stepReveal(state.current,current.length,now,readTextDelay());
      state.current=next;
      const stop=next.shown>=current.length?current.length:wordStop(current,next.shown);
      // A render per word is more than the eye follows: at most about 30 a second, and always the last one.
      if(stop!==lastIndex.current&&(stop===current.length||now-lastSet.current>=33)){lastIndex.current=stop;lastSet.current=now;setIndex(stop);}
      frame.current=next.shown<current.length?requestAnimationFrame(tick):0;
    };
    frame.current=requestAnimationFrame(tick);
  },[text,live,finished]);
  // The cleanup also forgets the frame: a remount (React's development check) must be able to start the loop again.
  useEffect(()=>()=>{cancelAnimationFrame(frame.current);frame.current=0;},[]);
  const shown=finished?text.length:Math.min(index,text.length);
  return {text:shown>=text.length?text:text.slice(0,shown),pending:shown<text.length};
}
