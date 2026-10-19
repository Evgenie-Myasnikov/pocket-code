import {useState} from 'react';
import {t,useLanguage} from './i18n';
import {useEdgeFade,setEdgeFade} from './chat-edge-fade';
export function EdgeFadeSettings(){
 useLanguage();const value=useEdgeFade(),[error,setError]=useState(''),label=t('Затухание по краям чата');
 return <div><label>{label}<output>{value===0?t('Выключено'):value+'%'}</output><input type="range" aria-label={label} min="0" max="100" step="5" value={value} onChange={event=>{try{setEdgeFade(Number(event.target.value));setError('');}catch{setError(t('Не удалось сохранить настройку.'));}}}/></label><p className="muted">{t('Прозрачность текста под шапкой и полем ввода. 0 — без затухания.')}</p>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
