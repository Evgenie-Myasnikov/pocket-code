import {Plus,X} from 'lucide-react';
import {useLanguage} from './i18n';
import type {BoardNote} from '../server/boards';

type Item=NonNullable<BoardNote['checklist']>[number];
export const checklistProgress=(items?:Item[])=>items?.length?{done:items.filter(item=>item.done).length,total:items.length}:null;
/** Whole days a card has been in its current status, when the host recorded that transition. */
export function statusAge(note:Pick<BoardNote,'status'|'statusHistory'>,now=Date.now()){
 const last=note.statusHistory?.at(-1);if(!last||last.status!==note.status)return null;
 const since=Date.parse(last.at);return Number.isFinite(since)?{since,days:Math.max(0,Math.floor((now-since)/86400000))}:null;
}
const day=(value:number|string,ru:boolean)=>new Date(value).toLocaleDateString(ru?'ru-RU':'en-GB',{day:'numeric',month:'short',year:'numeric'});

/** Acceptance criteria of a card: the same list an agent ticks through MCP. */
export function BoardChecklist({items=[],editable,onChange}:{items?:Item[];editable:boolean;onChange(items:Item[]):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en,progress=checklistProgress(items);
 const update=(index:number,patch:Partial<Item>)=>onChange(items.map((item,i)=>i===index?{...item,...patch}:item));
 return <fieldset className="board-checklist"><legend>{l('Acceptance checklist','Чек-лист приёмки')}{progress&&<span> · {progress.done}/{progress.total}</span>}</legend>
  {!items.length&&!editable&&<p className="muted">{l('No criteria yet.','Критериев пока нет.')}</p>}
  <ul>{items.map((item,index)=><li key={index}><input type="checkbox" aria-label={(item.done?l('Done: ','Выполнено: '):l('Not done: ','Не выполнено: '))+item.text} disabled={!editable} checked={item.done} onChange={event=>update(index,{done:event.target.checked})}/><input type="text" aria-label={l('Criterion ','Критерий ')+(index+1)} disabled={!editable} maxLength={300} value={item.text} placeholder={l('What must be true','Что должно выполняться')} onChange={event=>update(index,{text:event.target.value})}/>{editable&&<button type="button" className="icon-button" aria-label={l('Remove criterion ','Убрать критерий ')+(index+1)} onClick={()=>onChange(items.filter((_,i)=>i!==index))}><X size={16}/></button>}</li>)}</ul>
  {editable&&<button type="button" className="board-checklist-add" disabled={items.length>=50} onClick={()=>onChange([...items,{text:'',done:false}])}><Plus size={16} aria-hidden="true"/>{l('Add criterion','Добавить критерий')}</button>}
 </fieldset>;
}
export function BoardStatusHistory({note,labels}:{note:BoardNote;labels:Record<string,string>}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en,history=note.statusHistory||[];
 if(!history.length)return null;
 const age=statusAge(note);
 return <details className="board-status-history"><summary>{l('Status history','История статусов')}{age&&<span> · {labels[note.status]}: {age.days?l(`${age.days} d`,`${age.days} дн.`):l('today','сегодня')}</span>}</summary>
  <ol>{[...history].reverse().map((entry,index)=><li key={index}><span className={'task-status status-'+entry.status}>{labels[entry.status]}</span><time dateTime={entry.at}>{day(entry.at,ru)}</time></li>)}</ol>
 </details>;
}
