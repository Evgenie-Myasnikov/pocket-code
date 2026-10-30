import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {saveSpeechSettings,useSpeechSettings,speechSettings} from './speech-settings-store';
import {HostSpeechAdapter} from './host-speech';
import {LocalSpeechSynthesisAdapter} from './speech-synthesis';
import type {SpeechSynthesisAdapter} from '@assistant-ui/react';
export function SpeechSettingsPanel({connection}:{connection?:Connection|null}){
 const language=useLanguage(),ru=language==='ru',v=useSpeechSettings(),label=(a:string,b:string)=>ru?a:b;
 const [state,setState]=useState<{ready:boolean;installing:boolean;error?:string}|null>(null),[error,setError]=useState(''),[playing,setPlaying]=useState(false);
 const active=useRef<SpeechSynthesisAdapter.Utterance|null>(null),selectAfterInstall=useRef(false);
 useEffect(()=>{let alive=true,timer:ReturnType<typeof setTimeout>;const poll=async()=>{if(!connection)return;try{const value=await request<any>(connection,'/speech/status');if(!alive)return;setState(value);if(value.ready&&selectAfterInstall.current){selectAfterInstall.current=false;saveSpeechSettings({...speechSettings(),engine:'supertonic'});}if(value.installing)timer=setTimeout(poll,2000);}catch{if(alive)setError(label('Обновите подключённый хост для локальных голосов.','Update the connected host to enable local voices.'));}};void poll();return()=>{alive=false;clearTimeout(timer);};},[connection?.url,connection?.token,connection?.desktop,state?.installing]);
 useEffect(()=>()=>{active.current?.cancel();},[]);
 const stop=()=>{active.current?.cancel();active.current=null;setPlaying(false);};
 const preview=()=>{stop();setError('');if(v.engine==='supertonic'&&(!connection||!state?.ready)){setError(label('Сначала установите голоса на подключённом ПК.','Install the voices on the connected PC first.'));return;}
 const adapter=v.engine==='supertonic'?new HostSpeechAdapter(connection!,v.voice):new LocalSpeechSynthesisAdapter(ru?'ru-RU':'en-US');
 try{const utterance=adapter.speak(label('Здравствуйте! Это выбранный голос для чтения ответов. Можно продолжать работу.','Hello! This is the selected voice for reading replies.'));active.current=utterance;setPlaying(true);utterance.subscribe(()=>{if(active.current!==utterance)return;if(utterance.status.type==='ended'){setPlaying(false);if(utterance.status.reason==='error')setError(label('Не удалось воспроизвести голос. Проверьте подключение и звуковой выход.','Could not play the voice. Check the connection and audio output.'));}});}catch{setPlaying(false);setError(label('Озвучивание недоступно на этом устройстве.','Speech is unavailable on this device.'));}};
 return <fieldset className="speech-settings"><legend>{label('Озвучивание','Read aloud')}</legend>
 <label>{label('Движок','Engine')}<select aria-label={label('Движок озвучивания','Speech engine')} value={v.engine} onChange={e=>{stop();saveSpeechSettings({...v,engine:e.target.value as 'system'|'supertonic'});}}><option value="system">{label('Системный голос','System voice')}</option><option value="supertonic">Supertonic 3 · {label('локально на ПК','local on PC')}</option></select></label>
 <label>{label('Голос Supertonic 3','Supertonic 3 voice')}<select aria-label={label('Голос Supertonic 3','Supertonic 3 voice')} value={v.voice} onChange={e=>{stop();saveSpeechSettings({...v,voice:Number(e.target.value)});}}>{Array.from({length:10},(_,id)=><option key={id} value={id}>{label('Голос','Voice')} {id+1} · ID {id}</option>)}</select></label>
 <p className="muted">{label('Бесплатная локальная озвучка. Модель скачивается на ПК один раз (около 129 МБ); телефон получает готовый звук. Для чтения нужен подключённый ПК.','Free local speech. Download the model to your PC once (about 129 MB); the phone receives audio. Reading requires a connected PC.')}</p>
 {!state?.ready&&<button type="button" className="secondary" disabled={!connection||state?.installing} onClick={async()=>{setError('');selectAfterInstall.current=true;try{setState(await request<any>(connection!,'/speech/install',{}));}catch{selectAfterInstall.current=false;setError(label('Не удалось начать установку голосов.','Could not start voice installation.'));}}}>{state?.installing?label('Установка голосов…','Installing voices…'):label('Скачать голоса Supertonic 3','Download Supertonic 3 voices')}</button>}
 {state?.ready&&<p role="status">{label('Локальные голоса установлены','Local voices installed')}</p>}
 <button type="button" className="secondary" onClick={playing?stop:preview}>{playing?label('Остановить','Stop'):label('Прослушать','Preview voice')}</button>
 <a href="https://huggingface.co/Supertone/supertonic-3/blob/main/LICENSE" target="_blank" rel="noreferrer">Supertonic 3 · OpenRAIL-M</a>
 {(error||state?.error)&&<p role="alert">{error||state?.error}</p>}
 </fieldset>;
}
