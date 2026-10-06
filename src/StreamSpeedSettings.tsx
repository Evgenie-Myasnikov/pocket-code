import {useState} from 'react';
import {useLanguage} from './i18n';
import {useStreamSpeed,setStreamSpeed} from './stream-speed';

export function StreamSpeedSettings(){
 const speed=useStreamSpeed(),ru=useLanguage()==='ru',[error,setError]=useState('');
 const label=ru?'Скорость появления букв':'Letter reveal speed';
 return <div><label>{label}<select aria-label={label} value={speed} onChange={e=>{try{setStreamSpeed(Number(e.target.value));setError('');}catch{setError(ru?'Не удалось сохранить скорость.':'Could not save the speed.');}}}>
  <option value={20}>{ru?'Медленно':'Slow'}</option><option value={40}>{ru?'Обычно':'Normal'}</option><option value={80}>{ru?'Быстро':'Fast'}</option><option value={0}>{ru?'Мгновенно':'Instant'}</option>
 </select></label>{error&&<p role="alert">{error}</p>}</div>;
}
