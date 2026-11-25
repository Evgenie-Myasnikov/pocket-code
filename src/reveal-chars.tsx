import {useRef,type ReactNode} from 'react';

/**
 * The newest characters of a text that writes itself (a reasoning, a file being written) are drawn one by one, each
 * coming down a little from above into its place while it fades in (`.rc` in chat-motion.css). Older text is plain.
 */
export const REVEAL_TAIL=360;

/**
 * Where the animated tail starts for a text of `length` once `shown` characters were shown here before. A character is
 * written once: the window never reaches back behind `shown`, so a tail rebuilt around characters already on the screen
 * (a paragraph split, a shifted line window, a remount of the block) keeps them plain instead of replaying their
 * animation. A block mounted mid-stream still animates its newest `tail` characters once.
 */
export function revealWindow(shown:number,length:number,tail=REVEAL_TAIL){
  return {tailStart:Math.max(shown,Math.max(0,length-tail)),shown:Math.max(shown,length)};
}

/** Where the animated tail starts, and the small delay each newly shown character keeps so that a batch follows in order. */
export function useRevealTail(length:number,animated:boolean,tail=REVEAL_TAIL){
  const delays=useRef(new Map<number,number>()),seen=useRef(length),shown=useRef<number|undefined>(undefined);
  const range=revealWindow(shown.current??(animated?Math.max(0,length-tail):length),length,tail);
  const tailStart=animated?range.tailStart:length;
  shown.current=range.shown;
  if(animated){
    for(let index=seen.current;index<length;index++)delays.current.set(index,Math.min((index-seen.current)*10,240));
    seen.current=Math.max(seen.current,length);
    if(delays.current.size>tail*2)for(const key of delays.current.keys())if(key<tailStart)delays.current.delete(key);
  }else seen.current=length;
  return {tailStart,delay:(index:number)=>delays.current.get(index)??0};
}

/** `part` starts at `start` in the whole text; its characters from `tailStart` on are animated, words kept whole. */
export function revealCharacters(part:string,start:number,tailStart:number,delay:(index:number)=>number):ReactNode[]{
  const settled=Math.max(0,Math.min(part.length,tailStart-start)),nodes:ReactNode[]=[part.slice(0,settled)];
  let word:ReactNode[]=[],first=-1;
  const close=()=>{if(word.length){nodes.push(word.length<=30?<span className="rc-word" key={'w'+first}>{word}</span>:word);word=[];}};
  for(let index=settled;index<part.length;index++){
    const character=part[index],absolute=start+index;
    if(/\s/.test(character)){close();nodes.push(character);continue;}
    if(!word.length)first=absolute;
    word.push(<span className="rc" key={absolute} style={{animationDelay:delay(absolute)+'ms'}}>{character}</span>);
  }
  close();return nodes;
}
