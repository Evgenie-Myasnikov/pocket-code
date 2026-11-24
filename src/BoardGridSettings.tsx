import {useId,useState} from 'react';
import {SettingRow} from './SettingsRows';
import {t,useLanguage} from './i18n';
import {boardGridSteps,useBoardGrid,setBoardGrid} from './board-grid';

/** row: one settings row for the board card of the PC window. */
export function BoardGridSettings({row=false}:{row?:boolean}={}){
 useLanguage();const step=useBoardGrid(),[error,setError]=useState(''),id=useId();
 const label=t('Шаг сетки доски');
 const change=(value:string)=>{try{setBoardGrid(Number(value));setError('');}catch{setError(t('Не удалось сохранить настройку сетки.'));}};
 if(row)return <SettingRow title={label} htmlFor={id} note={error?<span role="alert">{error}</span>:t('Новые карточки встают по этой сетке')}><select id={id} value={step} onChange={e=>change(e.target.value)}>{boardGridSteps.map(value=><option key={value} value={value}>{value} px</option>)}</select></SettingRow>;
 return <div><label>{label}<select aria-label={label} value={step} onChange={e=>{try{setBoardGrid(Number(e.target.value));setError('');}catch{setError(t('Не удалось сохранить настройку сетки.'));}}}>{boardGridSteps.map(value=><option key={value} value={value}>{value} px</option>)}</select></label>{error&&<p className="error-banner" role="alert">{error}</p>}</div>;
}
