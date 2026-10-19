import {useState} from 'react';
import {t,useLanguage} from './i18n';
import {useStreamSpeed,setStreamSpeed} from './stream-speed';

export function StreamSpeedSettings(){
 useLanguage();const speed=useStreamSpeed(),[error,setError]=useState('');
 const label=t('Скорость появления букв');
 return <div><label>{label}<select aria-label={label} value={speed} onChange={e=>{try{setStreamSpeed(Number(e.target.value));setError('');}catch{setError(t('Не удалось сохранить скорость.'));}}}>
  <option value={20}>{t('Медленно')}</option><option value={40}>{t('Обычно')}</option><option value={80}>{t('Быстро')}</option><option value={0}>{t('Мгновенно')}</option>
 </select></label>{error&&<p className="error-banner" role="alert">{error}</p>}</div>;
}
