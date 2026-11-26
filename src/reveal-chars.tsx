import {useRef,type ReactNode} from 'react';

/**
 * The newest characters of a text that writes itself (a reasoning, a file being written) are drawn one by one, each
 * coming into its place while it fades in (`.rc` in chat-motion.css). A character animates once, when it first appears:
 * - characters already on the screen when the block mounts (a remount, a reopened reasoning) are plain at once;
 * - a character keeps its animation only for a short while after it appeared, then it is marked done (`rc-done`),
 *   so a word that is rebuilt around it never starts its animation again;
 * - the animated part always starts at the beginning of a word, so a word is never split between plain and animated text.
 */
export const REVEAL_TAIL=360;
/** How long after it appeared a character may still be animating: its delay (at most 240 ms) plus its entrance. */
const YOUNG_MS=900;

export type RevealTail={tailStart:number;delay(index:number):number;young(index:number):boolean};

export function useRevealTail(length:number,animated:boolean,tail=REVEAL_TAIL):RevealTail{
  const born=useRef(new Map<number,{at:number;delay:number}>()),seen=useRef(length);
  const now=typeof performance==='undefined'?Date.now():performance.now();
  if(animated&&length>seen.current){
    for(let index=seen.current;index<length;index++)born.current.set(index,{at:now,delay:Math.min((index-seen.current)*10,240)});
  }
  seen.current=Math.max(animated?seen.current:length,length);
  for(const [index,entry] of born.current)if(now-entry.at>YOUNG_MS*2||index>=length)born.current.delete(index);
  let first=length;
  if(animated)for(const [index,entry] of born.current)if(now-entry.at<YOUNG_MS&&index<first)first=index;
  return {
    tailStart:Math.max(first,length-tail),
    delay:index=>born.current.get(index)?.delay??0,
    young:index=>{const entry=born.current.get(index);return !!entry&&now-entry.at<YOUNG_MS;},
  };
}

/** `part` starts at `start` in the whole text; from `tailStart` on its characters are drawn one by one, words kept whole. */
export function revealCharacters(part:string,start:number,tailStart:number,delay:(index:number)=>number,young:(index:number)=>boolean=()=>true):ReactNode[]{
  let settled=Math.max(0,Math.min(part.length,tailStart-start));
  // Back to the start of the word, so the same word never changes between plain and animated text.
  while(settled>0&&settled<part.length&&!/\s/.test(part[settled-1]))settled--;
  const nodes:ReactNode[]=[part.slice(0,settled)];
  let word:ReactNode[]=[],first=-1;
  const close=()=>{if(word.length){nodes.push(<span className="rc-word" key={'w'+first}>{word}</span>);word=[];}};
  for(let index=settled;index<part.length;index++){
    const character=part[index],absolute=start+index;
    if(/\s/.test(character)){close();nodes.push(character);continue;}
    if(!word.length)first=absolute;
    const fresh=young(absolute);
    word.push(<span className={fresh?'rc':'rc rc-done'} key={absolute} style={fresh?{animationDelay:delay(absolute)+'ms'}:undefined}>{character}</span>);
  }
  close();return nodes;
}
