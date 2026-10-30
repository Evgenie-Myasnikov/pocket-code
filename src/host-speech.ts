import type {SpeechSynthesisAdapter} from '@assistant-ui/react';
import {request,type Connection} from './api';
import {speechLanguage} from './speech-synthesis';
export class HostSpeechAdapter implements SpeechSynthesisAdapter{
 constructor(private connection:Connection,private voice:number){}
 speak(text:string):SpeechSynthesisAdapter.Utterance{
  const callbacks=new Set<()=>void>();let audio:HTMLAudioElement|undefined,source:string|undefined,settle:(()=>void)|undefined;
  const end=(reason:'finished'|'cancelled'|'error',error?:unknown)=>{if(result.status.type==='ended')return;audio?.pause();settle?.();settle=undefined;if(source)URL.revokeObjectURL(source);result.status={type:'ended',reason,error};callbacks.forEach(fn=>fn());};
  const result:SpeechSynthesisAdapter.Utterance={status:{type:'starting'},cancel:()=>end('cancelled'),subscribe:fn=>{callbacks.add(fn);if(result.status.type==='ended')queueMicrotask(()=>{if(callbacks.has(fn))fn();});return()=>{callbacks.delete(fn);};}};
  const ended=()=>result.status.type==='ended';
  const play=async()=>{
   const chunks=text.match(/[\s\S]{1,1000}(?:\s|$)|[\s\S]{1,1000}/g)||[];
   for(const chunk of chunks){
    if(ended())return;
    const data=await request<{audio:string;mime:string}>(this.connection,'/speech/synthesize',{text:chunk,voice:this.voice,language:speechLanguage(chunk,'ru-RU').startsWith('ru')?'ru':'en'});
    if(ended())return;
    if(data.mime!=='audio/wav'||data.audio.length>25000000)throw Error('Invalid speech audio');
    const bytes=Uint8Array.from(atob(data.audio),c=>c.charCodeAt(0));source=URL.createObjectURL(new Blob([bytes],{type:data.mime}));audio=new Audio(source);
    result.status={type:'running'};callbacks.forEach(fn=>fn());
    await new Promise<void>((resolve,reject)=>{settle=resolve;audio!.onended=()=>{settle=undefined;resolve();};audio!.onerror=()=>reject(Error('Audio playback failed'));void audio!.play().catch(reject);});
    URL.revokeObjectURL(source);source=undefined;
   }
   end('finished');
  };
  void play().catch(error=>end('error',error));return result;
 }
}
