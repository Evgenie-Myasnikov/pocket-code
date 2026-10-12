import {useState} from 'react';
import {useLanguage} from './i18n';
import {useEdgeFade,setEdgeFade} from './chat-edge-fade';
export function EdgeFadeSettings(){
 const value=useEdgeFade(),ru=useLanguage()==='ru',[error,setError]=useState(''),label=ru?'Затухание по краям чата':'Chat edge fade';
 return <div><label>{label}<output>{value===0?(ru?'Выключено':'Off'):`${value}%`}</output><input type="range" aria-label={label} min="0" max="100" step="5" value={value} onChange={event=>{try{setEdgeFade(Number(event.target.value));setError('');}catch{setError(ru?'Не удалось сохранить настройку.':'Could not save the setting.');}}}/></label><p className="muted">{ru?'Прозрачность текста под шапкой и полем ввода. 0 — без затухания.':'Fades the text beneath the header and input. Set to 0 to disable.'}</p>{error&&<p role="alert">{error}</p>}</div>;
}
