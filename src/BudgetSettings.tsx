import {useEffect,useId,useState} from 'react';
import {t,useLanguage} from './i18n';
import {budgetRange,clampBudget,parseBudget} from './preferences';
import './budget-settings.css';
import {HelpTip,SettingRow} from './SettingsRows';

const presets=[1,5,20] as const;
export const budgetLabel=(value:number)=>'$'+(Number.isInteger(value)?String(value):value.toFixed(2));
/** Spend limit per Claude request: typed text stays a draft until Enter or leaving the field, then it is parsed and kept within the host's range. */
/** row: a select of the preset limits (and a field for another amount) in one settings row of the PC window. */
export function BudgetSettings({value,onChange,row=false}:{value:number;onChange(value:number):void;row?:boolean}){
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
  const isPreset=!custom&&presets.includes(value as typeof presets[number]);
  const field=<input className="budget-row-input" inputMode="decimal" autoComplete="off" aria-label={t('Сумма, $')} value={draft} aria-invalid={invalid||undefined} aria-describedby={id+'-hint'+(invalid||note?' '+id+'-note':'')} onChange={event=>{setDraft(event.target.value);setNote('');}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'&&draft!==String(value)){event.stopPropagation();setDraft(String(value));setNote('');}}}/>;
  if(row)return <SettingRow className="budget-settings budget-row" title={t('Лимит стоимости одного хода')} htmlFor={id+'-select'} noteId={id+'-hint'} note={(invalid||note)?<span id={id+'-note'} className={'budget-note'+(invalid?' invalid':'')} role={invalid?'alert':'status'}>{invalid?t('Допустимо от $0.10 до $100. При сохранении значение будет ограничено.'):note}</span>:t('От $0.10 до $100, к следующему сообщению')} help={<HelpTip label={t('О лимите стоимости')}>{t('От $0.10 до $100 · сейчас {0}. Это оценка Agent SDK: при входе по API-ключу ограничивает расход, при входе по подписке останавливает слишком долгий ход. Лимит общий для сообщения и уточнений, которые Claude примет до конца хода. Применяется к следующему сообщению.',budgetLabel(value))}</HelpTip>}>
    {!isPreset&&field}
    <select id={id+'-select'} value={isPreset?String(value):'custom'} onChange={event=>{const next=event.target.value;if(next==='custom'){setCustom(true);return;}setCustom(false);setNote('');const amount=Number(next);if(value!==amount)onChange(amount);}}>{presets.map(amount=><option key={amount} value={amount}>{budgetLabel(amount)}</option>)}<option value="custom">{t('Другое')}</option></select>
  </SettingRow>;
  return <section className="budget-settings" aria-labelledby={id+'-title'}>
    <h3 id={id+'-title'}>{t('Лимит стоимости одного хода')}</h3>
    <div className="budget-presets" role="group" aria-label={t('Лимит стоимости одного хода')}>{presets.map(amount=><button type="button" key={amount} className="budget-chip" aria-pressed={!custom&&value===amount} onClick={()=>{setCustom(false);setNote('');if(value!==amount)onChange(amount);}}>{budgetLabel(amount)}</button>)}<button type="button" className="budget-chip" aria-pressed={custom||!presets.includes(value as typeof presets[number])} onClick={()=>setCustom(true)}>{t('Другое')}</button></div>
    {(custom||!presets.includes(value as typeof presets[number]))&&<label className="budget-input">{t('Сумма, $')}<input inputMode="decimal" autoComplete="off" value={draft} aria-invalid={invalid||undefined} aria-describedby={id+'-hint'+(invalid||note?' '+id+'-note':'')} onChange={event=>{setDraft(event.target.value);setNote('');}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit();}else if(event.key==='Escape'&&draft!==String(value)){event.stopPropagation();setDraft(String(value));setNote('');}}}/></label>}
    <p className="muted" id={id+'-hint'}>{t('От $0.10 до $100 · сейчас {0}. Это оценка Agent SDK: при входе по API-ключу ограничивает расход, при входе по подписке останавливает слишком долгий ход. Лимит общий для сообщения и уточнений, которые Claude примет до конца хода. Применяется к следующему сообщению.',budgetLabel(value))}</p>
    {(invalid||note)&&<p className={'budget-note'+(invalid?' invalid':'')} id={id+'-note'} role={invalid?'alert':'status'}>{invalid?t('Допустимо от $0.10 до $100. При сохранении значение будет ограничено.'):note}</p>}
  </section>;
}
