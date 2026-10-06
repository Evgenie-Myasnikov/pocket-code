import {useEffect,useMemo,useRef,useState} from 'react';
import {revealCharacterLimit,revealLifetime,type RevealRange,type RevealOptions} from './streaming-reveal';

export function useStreamingReveal(text:string,streaming:boolean,animateInitial=false):RevealOptions|undefined{
  const [reduced,setReduced]=useState(()=>typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [revision,setRevision]=useState(0),previous=useRef({text:animateInitial?'':text,ranges:[] as RevealRange[]});
  useEffect(()=>{
    if(!streaming)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);
    change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
  },[streaming]);
  const reveal=useMemo(()=>{
    const now=performance.now(),prior=previous.current;
    const enabled=streaming&&!reduced&&text.startsWith(prior.text);
    const ranges=enabled?prior.ranges.filter(range=>now-range.at<revealLifetime&&range.end>text.length-revealCharacterLimit).map(range=>({...range,start:Math.max(range.start,text.length-revealCharacterLimit)})):[];
    if(enabled&&text.length>prior.text.length)ranges.push({start:Math.max(prior.text.length,text.length-revealCharacterLimit),end:text.length,at:now});
    previous.current={text,ranges};
    return ranges.length?{ranges,now}:undefined;
  },[text,streaming,reduced,revision]);
  useEffect(()=>{
    if(!reveal)return;
    const timer=setTimeout(()=>setRevision(value=>value+1),Math.max(0,reveal.ranges.at(-1)!.at+revealLifetime-performance.now())+16);
    return()=>clearTimeout(timer);
  },[reveal]);
  return reveal;
}
