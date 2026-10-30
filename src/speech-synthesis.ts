import type {SpeechSynthesisAdapter} from '@assistant-ui/react';
export function speechLanguage(text:string,fallback:string){return /[\u0410-\u044f\u0401\u0451]/.test(text)?'ru-RU':/[a-z]/i.test(text)?'en-US':fallback;}
export class LocalSpeechSynthesisAdapter implements SpeechSynthesisAdapter{
 constructor(private language:string){}
 speak(text:string):SpeechSynthesisAdapter.Utterance{
  const synth=window.speechSynthesis,utterance=new SpeechSynthesisUtterance(text),listeners=new Set<()=>void>();
  utterance.lang=speechLanguage(text,this.language);let timer:ReturnType<typeof setTimeout>|undefined,started=false;
  const clear=()=>{clearTimeout(timer);synth.removeEventListener('voiceschanged',start);};
  const end=(reason:'finished'|'cancelled'|'error',error?:unknown)=>{if(result.status.type==='ended')return;clear();result.status={type:'ended',reason,error};listeners.forEach(fn=>fn());};
  const result:SpeechSynthesisAdapter.Utterance={status:{type:'starting'},cancel:()=>{if(result.status.type==='ended')return;end('cancelled');if(started)synth.cancel();},subscribe:fn=>{listeners.add(fn);if(result.status.type==='ended')queueMicrotask(()=>{if(listeners.has(fn))fn();});return()=>{listeners.delete(fn);};}};
  const start=()=>{
   if(started||result.status.type==='ended')return;started=true;clear();
   const language=utterance.lang.toLowerCase(),voices=synth.getVoices();
   utterance.voice=voices.find(v=>v.lang.toLowerCase()===language&&v.localService)||voices.find(v=>v.lang.toLowerCase()===language)||voices.find(v=>v.lang.toLowerCase().split('-')[0]===language.split('-')[0])||null;
   result.status={type:'running'};listeners.forEach(fn=>fn());
   try{synth.speak(utterance);}catch(error){end('error',error);}
  };
  utterance.addEventListener('end',()=>end('finished'));utterance.addEventListener('error',event=>end('error',event.error));
  if(synth.getVoices().length)start();else{synth.addEventListener('voiceschanged',start);timer=setTimeout(start,1200);}
  return result;
 }
}
