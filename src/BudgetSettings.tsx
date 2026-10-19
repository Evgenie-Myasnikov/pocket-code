import {useEffect,useId,useState} from 'react';
import {t,useLanguage} from './i18n';
import {budgetRange,clampBudget,parseBudget} from './preferences';
import './budget-settings.css';

const presets=[1,5,20] as const;
export const budgetLabel=(value:number)=>'$'+(Number.isInteger(value)?String(value):value.toFixed(2));
/** Spend limit per Claude request: typed text stays a draft until Enter or leaving the field, then it is parsed and kept within the host's range. */
export function BudgetSettings({value,onChange}:{value:number;onChange(value:number):void}){
  useLanguage();
  const id=useId(),[draft,setDraft]=useState(String(value)),[note,setNote]=useState(''),[custom,setCustom]=useState(()=>!presets.includes(value as typeof presets[number]));
  useEffect(()=>{setDraft(String(value));},[value]);
  const parsed=parseBudget(draft),invalid=draft.trim()!==''&&(parsed===null||parsed<budgetRange.min||parsed>budgetRange.max);
  function commit(){
    if(parsed===null){setDraft(String(value));setNote(draft.trim()?t('Это не число. Оставлен прежний лимит {0}.',budgetLabel(value)):'');return;}
    const next=clampBudget(parsed,value);setDraft(String(next));
    setNote(next!==parsed?t('Допустимо от $0.10 до $100. Сохранено {0}.',budgetLabel(next)):'');
    if(next!==value)onChange(next);
  }
  return <section className="budget-settings" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'}>{t('Лимит стоимости одного запроса')}</h3>
    <div className="budget-presets" role="group" aria-label={t('Лимит стоимости одного запроса')}>{presets.map(amount=><button type="button" key={amount} className="budget-chip" aria-pressed={!custom&&value===amount} onClick={()=>{setCustom(false);setNote('');if(value!==amount)onChange(amount);}}>{budgetLabel(amount)}</button>)}<button type="button" className="budget-chip" aria-pressed={custom||!presets.includes(value as typeof presets[number])} onClick={()=>setCustom(true)}>{t('Другое')}</button></div>
    {(custom||!presets.includes(value as typeof presets[number]))&&<label className="budget-input">{t('Сумма, $')}<input inputMode="decimal" autoComplete="off" value={draft} aria-invalid={invalid||undefined} aria-describedby={id+'-hint'+(invalid||note?' '+id+'-note':'')} onChange={event=>{setDraft(event.target.value);setNote('');}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'&&draft!==String(value)){event.stopPropagation();setDraft(String(value));setNote('');}}}/></label>}
    <p className="muted" id={id+'-hint'}>{t('От $0.10 до $100 · сейчас {0}. Это оценка Agent SDK: при входе по API-ключу ограничивает расход, при входе по подписке останавливает слишком долгий запрос. Применяется к следующему сообщению.',budgetLabel(value))}</p>
    {(invalid||note)&&<p className={'budget-note'+(invalid?' invalid':'')} id={id+'-note'} role={invalid?'alert':'status'}>{invalid?t('Допустимо от $0.10 до $100. При сохранении значение будет ограничено.'):note}</p>}
  </section>;
}
