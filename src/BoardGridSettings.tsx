import {useState} from 'react';
import {useLanguage} from './i18n';
import {boardGridSteps,useBoardGrid,setBoardGrid} from './board-grid';

export function BoardGridSettings(){
 const step=useBoardGrid(),ru=useLanguage()==='ru',[error,setError]=useState('');
 const label=ru?'Шаг сетки доски':'Board grid step';
 return <div><label>{label}<select aria-label={label} value={step} onChange={e=>{try{setBoardGrid(Number(e.target.value));setError('');}catch{setError(ru?'Не удалось сохранить настройку сетки.':'Could not save the grid setting.');}}}>{boardGridSteps.map(value=><option key={value} value={value}>{value}</option>)}</select></label>{error&&<p role="alert">{error}</p>}</div>;
}
