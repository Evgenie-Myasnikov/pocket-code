import {useState} from 'react';
import {t,useLanguage} from './i18n';
import {boardGridSteps,useBoardGrid,setBoardGrid} from './board-grid';

export function BoardGridSettings(){
 useLanguage();const step=useBoardGrid(),[error,setError]=useState('');
 const label=t('Шаг сетки доски');
 return <div><label>{label}<select aria-label={label} value={step} onChange={e=>{try{setBoardGrid(Number(e.target.value));setError('');}catch{setError(t('Не удалось сохранить настройку сетки.'));}}}>{boardGridSteps.map(value=><option key={value} value={value}>{value} px</option>)}</select></label>{error&&<p className="error-banner" role="alert">{error}</p>}</div>;
}
