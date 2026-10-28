import {useEffect,useRef,useState} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';
import {Mic,Square} from 'lucide-react';
import {useLanguage} from './i18n';
import {desktopCall} from './desktop-bridge';

const NativeVoice=registerPlugin<{recognize(options:{language:string}):Promise<{text:string;cancelled?:boolean}>}>('VoiceInput');
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:any)=>void)|null;onerror:((e:any)=>void)|null;onend:(()=>void)|null;start():void;stop():void;abort():void};
export function VoiceInput({disabled,onText,focus}:{disabled?:boolean;onText(text:string):void;focus():void}){
 const ru=useLanguage()==='ru',[active,setActive]=useState(false),[error,setError]=useState(''),[hint,setHint]=useState('');
 const recognition=useRef<Recognition|null>(null),generation=useRef(0),append=useRef(onText);append.current=onText;
 useEffect(()=>()=>{generation.current++;recognition.current?.abort();recognition.current=null;},[]);
 const start=async()=>{
  if(active){recognition.current?.stop();return;}
  setError('');setHint('');focus();const token=++generation.current;
  try{
   if(Capacitor.isNativePlatform()){setActive(true);const result=await NativeVoice.recognize({language:ru?'ru-RU':'en-US'});if(token===generation.current&&result.text)append.current(result.text);if(token===generation.current)setActive(false);return;}
   if((window as any).chrome?.webview){await desktopCall('dictation');setHint(ru?'Диктовка Windows открыта. Текст появится в поле ввода.':'Windows dictation opened. Text will appear in the message field.');return;}
   const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
   if(!Constructor)throw Error(ru?'Голосовой ввод недоступен в этом браузере.':'Voice input is unavailable in this browser.');
   const speech:Recognition=new Constructor();recognition.current=speech;speech.lang=ru?'ru-RU':'en-US';speech.continuous=false;speech.interimResults=false;
   speech.onresult=e=>{if(token!==generation.current)return;let text='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)text+=e.results[i][0].transcript+' ';if(text.trim())append.current(text.trim());};
   speech.onerror=e=>{if(token!==generation.current)return;setError(e.error==='not-allowed'?(ru?'Разрешите доступ к микрофону.':'Allow microphone access.'):(ru?'Не удалось распознать речь. Попробуйте ещё раз.':'Speech recognition failed. Please try again.'));};
   speech.onend=()=>{if(token===generation.current){setActive(false);recognition.current=null;}};speech.start();setActive(true);
  }catch(e){if(token===generation.current){setActive(false);setError((e as Error).message);}}
 };
 return <><button type="button" className="icon-button composer-voice" disabled={disabled||active&&Capacitor.isNativePlatform()} aria-label={active?(ru?'Остановить диктовку':'Stop dictation'):(ru?'Голосовой ввод':'Voice input')} aria-pressed={active} title={ru?'Голосовой ввод':'Voice input'} onPointerDown={e=>e.preventDefault()} onClick={()=>void start()}>{active?<Square size={15}/>:<Mic size={18}/>}</button>{(error||hint)&&<span className="voice-input-notice" role={error?'alert':'status'} onClick={()=>{setError('');setHint('');}}>{error||hint}</span>}</>;
}
