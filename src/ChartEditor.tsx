import {useRef,useState} from 'react';
import {Plus,X} from 'lucide-react';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {whiteboardChart,type WhiteboardChart as Chart,type WhiteboardItem as Item} from './whiteboard-model';
import {parseTable} from './whiteboard-chart-layout';

export const emptyChart=(ru:boolean):Chart=>({type:'bar',categories:['P50','P95','P99'],series:[{name:ru?'До':'Before',values:[0,0,0]},{name:ru?'После':'After',values:[0,0,0]}],unit:ru?'мс':'ms',lowerIsBetter:true});
const cell=(value:number|null)=>value===null?'':String(value);
const number=(text:string)=>{const value=text.trim().replace(/\s/g,'').replace(',','.');if(!value)return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:NaN;};

/** The table view of a chart: every stored number is visible and editable here. */
export function ChartEditor({item,onClose,onSave}:{item:Item;onClose():void;onSave(item:Item):Promise<boolean>}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en,dialog=useRef<HTMLFormElement|null>(null),source=item.chart||emptyChart(ru);
 const [title,setTitle]=useState(item.text),[unit,setUnit]=useState(source.unit||''),[stacked,setStacked]=useState(!!source.stacked),[better,setBetter]=useState(source.lowerIsBetter===undefined?'':source.lowerIsBetter?'lower':'higher');
 const [reference,setReference]=useState(source.reference?String(source.reference.value):''),[referenceLabel,setReferenceLabel]=useState(source.reference?.label||'');
 const [series,setSeries]=useState(source.series.map(entry=>entry.name)),[categories,setCategories]=useState(source.categories),[values,setValues]=useState(source.categories.map((_,c)=>source.series.map(entry=>cell(entry.values[c]))));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useModal(dialog,true,()=>{if(!busy)onClose();});
 const setValue=(c:number,s:number,value:string)=>setValues(old=>old.map((row,i)=>i===c?row.map((entry,j)=>j===s?value:entry):row));
 function paste(event:React.ClipboardEvent){const table=parseTable(event.clipboardData.getData('text/plain'));if(!table)return;event.preventDefault();setSeries(table.series.slice(0,8));setCategories(table.categories.slice(0,40));setValues(table.values.slice(0,40).map(row=>row.slice(0,8)));setError('');}
 async function submit(){
  const numbers=values.map(row=>row.map(number));
  if(numbers.some(row=>row.some(value=>Number.isNaN(value)))){setError(l('Every value must be a number or empty.','Каждое значение должно быть числом или пустым.'));return;}
  const referenceValue=number(reference);if(Number.isNaN(referenceValue)){setError(l('The reference line must be a number.','Опорная линия должна быть числом.'));return;}
  const chart=whiteboardChart.safeParse({type:'bar',categories,series:series.map((name,s)=>({name,values:numbers.map(row=>row[s] as number|null)})),...(unit.trim()?{unit:unit.trim()}:{}),...(stacked?{stacked:true}:{}),...(better?{lowerIsBetter:better==='lower'}:{}),...(referenceValue===null?{}:{reference:{value:referenceValue,...(referenceLabel.trim()?{label:referenceLabel.trim()}:{})}})});
  if(!chart.success){const issue=chart.error.issues[0];setError(l('Check the chart data: ','Проверьте данные графика: ')+(issue.path.includes('name')||issue.path.includes('categories')?l('every series and category needs a name of up to 80 characters.','у каждого ряда и категории должно быть название до 80 символов.'):issue.message));return;}
  if(!title.trim()){setError(l('Give the chart a title.','Укажите название графика.'));return;}
  setBusy(true);setError('');if(!await onSave({...item,text:title.trim().slice(0,200),chart:chart.data}))setBusy(false);
 }
 return <div className="modal-backdrop"><form ref={dialog} className="board-dialog chart-editor" role="dialog" aria-modal="true" aria-label={l('Chart data','Данные графика')} onSubmit={event=>{event.preventDefault();void submit();}} onKeyDown={event=>event.stopPropagation()}>
  <h2>{l('Chart data','Данные графика')}</h2>
  <div className="chart-editor-row"><label style={{flex:'1 1 220px'}}>{l('Title','Название')}<input autoFocus maxLength={200} value={title} onChange={event=>setTitle(event.target.value)}/></label><label style={{width:110}}>{l('Unit','Единица')}<input maxLength={24} value={unit} placeholder={l('ms','мс')} onChange={event=>setUnit(event.target.value)}/></label></div>
  <div className="chart-editor-grid" onPaste={paste}><table><thead><tr><th scope="col">{l('Category','Категория')}</th>{series.map((name,s)=><th key={s} scope="col"><input aria-label={l('Series name ','Название ряда ')+(s+1)} maxLength={80} value={name} onChange={event=>setSeries(old=>old.map((entry,i)=>i===s?event.target.value:entry))}/></th>)}<th/></tr></thead>
   <tbody>{categories.map((category,c)=><tr key={c}><th scope="row"><input aria-label={l('Category name ','Название категории ')+(c+1)} maxLength={80} value={category} onChange={event=>setCategories(old=>old.map((entry,i)=>i===c?event.target.value:entry))}/></th>{series.map((name,s)=><td key={s}><input inputMode="decimal" aria-label={`${name} · ${category}`} value={values[c]?.[s]??''} onChange={event=>setValue(c,s,event.target.value)}/></td>)}<td><button type="button" className="chart-editor-remove" disabled={categories.length<2} aria-label={l('Remove category ','Убрать категорию ')+category} onClick={()=>{setCategories(old=>old.filter((_,i)=>i!==c));setValues(old=>old.filter((_,i)=>i!==c));}}><X size={14}/></button></td></tr>)}
    <tr><th/>{series.map((name,s)=><td key={s}><button type="button" className="chart-editor-remove" disabled={series.length<2} aria-label={l('Remove series ','Убрать ряд ')+name} onClick={()=>{setSeries(old=>old.filter((_,i)=>i!==s));setValues(old=>old.map(row=>row.filter((_,i)=>i!==s)));}}><X size={14}/></button></td>)}<td/></tr></tbody></table></div>
  <div className="chart-editor-actions"><button type="button" disabled={categories.length>=40} onClick={()=>{setCategories(old=>[...old,l('Category ','Категория ')+(old.length+1)]);setValues(old=>[...old,series.map(()=>'')]);}}><Plus size={14}/> {l('Category','Категория')}</button><button type="button" disabled={series.length>=8} onClick={()=>{setSeries(old=>[...old,l('Series ','Ряд ')+(old.length+1)]);setValues(old=>old.map(row=>[...row,'']));}}><Plus size={14}/> {l('Series','Ряд')}</button><small style={{alignSelf:'center',color:'var(--muted)'}}>{l('Paste a table copied from a spreadsheet to replace the data. Up to 8 series.','Вставьте таблицу, скопированную из электронной таблицы, чтобы заменить данные. До 8 рядов.')}</small></div>
  <div className="chart-editor-row"><label className="chart-editor-check"><input type="checkbox" checked={stacked} onChange={event=>setStacked(event.target.checked)}/>{l('Stack the series','Складывать ряды в один столбец')}</label><label>{l('Change between two series','Изменение между двумя рядами')}<select value={better} onChange={event=>setBetter(event.target.value)}><option value="">{l('Not judged','Без оценки')}</option><option value="lower">{l('Lower is better','Меньше — лучше')}</option><option value="higher">{l('Higher is better','Больше — лучше')}</option></select></label><label style={{width:120}}>{l('Reference line','Опорная линия')}<input inputMode="decimal" value={reference} placeholder="16.7" onChange={event=>setReference(event.target.value)}/></label><label style={{flex:'1 1 120px'}}>{l('Its label','Её подпись')}<input maxLength={60} value={referenceLabel} placeholder="60 fps" onChange={event=>setReferenceLabel(event.target.value)}/></label></div>
  {error&&<p role="alert">{error}</p>}
  <footer><button type="button" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button><button className="primary" disabled={busy}>{l('Save','Сохранить')}</button></footer>
 </form></div>;
}
