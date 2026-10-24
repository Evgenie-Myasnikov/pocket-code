import {useRef,useState} from 'react';
import {StickyNote,Type,Frame,Undo2,Redo2,Trash2,ArrowUpRight,Maximize,Plus,Minus,MousePointer2} from 'lucide-react';
import {useLanguage} from './i18n';
import {emptyWhiteboard,moveItems,removeItems,frameSelection,edgePoint,type Whiteboard as Canvas,type WhiteboardItem as Item} from './whiteboard-model';
import './whiteboard.css';

export function Whiteboard({value,editable,busy,onSave,onDiscuss}:{value?:Canvas;editable:boolean;busy:boolean;onSave(value:Canvas):Promise<boolean>;onDiscuss?(ids:string[]):void}){
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const board=value||emptyWhiteboard(),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:40,y:40}),[preview,setPreview]=useState<Canvas|null>(null),[connecting,setConnecting]=useState(false),[editing,setEditing]=useState<Item|null>(null),[history,setHistory]=useState<Canvas[]>([]),[future,setFuture]=useState<Canvas[]>([]);
 const viewport=useRef<HTMLDivElement>(null),locked=useRef(false);
 const shown=preview||board;
 async function change(next:Canvas,mode:'edit'|'undo'|'redo'='edit'){
  if(!editable||busy||locked.current)return false;locked.current=true;
  try{if(await onSave(next)){if(mode==='undo'){setHistory(h=>h.slice(0,-1));setFuture(f=>[...f,board]);}else if(mode==='redo'){setFuture(f=>f.slice(0,-1));setHistory(h=>[...h,board]);}else{setHistory(h=>[...h.slice(-49),board]);setFuture([]);}return true;}return false;}finally{locked.current=false;setPreview(null);}
 }
 function add(kind:Item['kind']){
  const rect=viewport.current?.getBoundingClientRect();
  const item:Item={id:crypto.randomUUID(),kind,text:kind==='frame'?l('Section','Раздел'):'',x:Math.max(0,Math.min(100000,((rect?.width||800)/2-pan.x)/zoom)),y:Math.max(0,Math.min(100000,((rect?.height||600)/2-pan.y)/zoom)),width:kind==='frame'?720:240,height:kind==='frame'?480:180,color:'sand'};
  const last=board.items.at(-1);if(last)item.x=Math.min(100000,last.x+last.width+80);else item.x=Math.max(0,item.x-item.width/2);
  setSelected([item.id]);void change({...board,items:[...board.items,item]});
 }
 function pick(item:Item,extend=false){
  if(connecting&&selected.length===1&&selected[0]!==item.id){void change({...board,links:[...board.links,{id:crypto.randomUUID(),from:selected[0],to:item.id}]});setConnecting(false);return;}
  setSelected(old=>extend?old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id]:[item.id]);
 }
 function drag(event:React.PointerEvent<HTMLElement>,item:Item,resize=false){
  event.stopPropagation();if(event.button!==0||busy||locked.current||!editable)return;
  if(connecting){pick(item);return;}if(event.shiftKey){pick(item,true);return;}
  const ids=frameSelection(board,selected.includes(item.id)?selected:[item.id]);setSelected(ids);
  const el=event.currentTarget;el.setPointerCapture(event.pointerId);const start={x:event.clientX,y:event.clientY};let next=board,moved=false;
  const move=(e:PointerEvent)=>{const dx=(e.clientX-start.x)/zoom,dy=(e.clientY-start.y)/zoom;moved=Math.abs(dx)+Math.abs(dy)>3;if(!moved)return;next=resize?{...board,items:board.items.map(i=>i.id===item.id?{...i,width:Math.max(120,Math.min(6000,item.width+dx)),height:Math.max(80,Math.min(6000,item.height+dy))}:i)}:moveItems(board,ids,Math.round(dx/8)*8,Math.round(dy/8)*8);setPreview(next);};
  const end=(e:PointerEvent)=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);if(e.type==='pointerup'&&moved)void change(next);else setPreview(null);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 function panStart(e:React.PointerEvent<HTMLDivElement>){
  if(e.button!==0||e.target!==e.currentTarget)return;setSelected([]);setConnecting(false);
  const el=e.currentTarget;el.setPointerCapture(e.pointerId);const start={x:e.clientX,y:e.clientY},before=pan;
  const move=(v:PointerEvent)=>setPan({x:before.x+v.clientX-start.x,y:before.y+v.clientY-start.y});
  const end=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);};el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 function scale(next:number,px?:number,py?:number){const rect=viewport.current?.getBoundingClientRect();const x=px??(rect?.width||800)/2,y=py??(rect?.height||600)/2;next=Math.max(.1,Math.min(3,next));setPan({x:x-(x-pan.x)*next/zoom,y:y-(y-pan.y)*next/zoom});setZoom(next);}
 function fit(){const rect=viewport.current?.getBoundingClientRect();if(!rect||!board.items.length){setZoom(1);setPan({x:40,y:40});return;}const x=Math.min(...board.items.map(i=>i.x)),y=Math.min(...board.items.map(i=>i.y)),w=Math.max(...board.items.map(i=>i.x+i.width))-x,h=Math.max(...board.items.map(i=>i.y+i.height))-y;const z=Math.max(.1,Math.min(1,(rect.width-80)/w,(rect.height-80)/h));setZoom(z);setPan({x:40-x*z,y:40-y*z});}
 const disabled=!editable||busy;
 return <section className="whiteboard" aria-label={l('Free canvas','Свободный холст')}>
  <div className="whiteboard-toolbar" role="toolbar" aria-label={l('Canvas tools','Инструменты холста')}>
   <button aria-label={l('Select','Выделение')} aria-pressed={!connecting} onClick={()=>setConnecting(false)}><MousePointer2 size={18}/></button>
   {([{kind:'sticky',Icon:StickyNote,label:l('Sticky note','Стикер')},{kind:'text',Icon:Type,label:l('Text','Текст')},{kind:'frame',Icon:Frame,label:l('Frame','Рамка')}] as const).map(({kind,Icon,label})=><button key={kind} aria-label={label} disabled={disabled||board.items.length>=500} onClick={()=>add(kind)}><Icon size={18}/><span>{label}</span></button>)}
   <button aria-label={l('Connect','Связать')} disabled={disabled||selected.length!==1} aria-pressed={connecting} onClick={()=>setConnecting(!connecting)}><ArrowUpRight size={18}/><span>{l('Connect','Связать')}</span></button>
   <button disabled={!selected.length||!onDiscuss} onClick={()=>onDiscuss?.(selected)}>{l('Discuss selection','Обсудить выделенное')}</button>
   <button aria-label={l('Undo','Отменить')} disabled={disabled||!history.length} onClick={()=>void change(history.at(-1)!,'undo')}><Undo2 size={18}/></button>
   <button aria-label={l('Redo','Повторить')} disabled={disabled||!future.length} onClick={()=>void change(future.at(-1)!,'redo')}><Redo2 size={18}/></button>
   <button aria-label={l('Delete selection','Удалить выделенное')} disabled={disabled||!selected.length} onClick={()=>{void change(removeItems(board,selected));setSelected([]);}}><Trash2 size={18}/></button>
   <button aria-label={l('Zoom out','Отдалить')} onClick={()=>scale(zoom/1.2)}><Minus size={18}/></button><output>{Math.round(zoom*100)}%</output><button aria-label={l('Zoom in','Приблизить')} onClick={()=>scale(zoom*1.2)}><Plus size={18}/></button><button aria-label={l('Fit canvas','Вместить холст')} onClick={fit}><Maximize size={18}/></button>
  </div>
  {connecting&&<div className="whiteboard-status" role="status">{l('Select the destination object','Выбери объект назначения')}</div>}
  <div ref={viewport} className="whiteboard-viewport" tabIndex={0} onPointerDown={panStart} onWheel={e=>{if(e.ctrlKey){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();scale(zoom*Math.exp(-e.deltaY*.003),e.clientX-r.left,e.clientY-r.top);}else setPan({x:pan.x-e.deltaX,y:pan.y-e.deltaY});}} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const list=e.shiftKey?future:history;if(list.length)void change(list.at(-1)!,e.shiftKey?'redo':'undo');}if(e.key==='Escape'){setConnecting(false);setSelected([]);}if(e.key==='Delete'&&selected.length){void change(removeItems(board,selected));setSelected([]);}}}>
   <div className="whiteboard-world" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>
    <svg className="whiteboard-links" width="106000" height="106000" aria-label={l('Visual connections','Визуальные связи')}><defs><marker id="canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker></defs>{shown.links.map(link=>{const a=shown.items.find(i=>i.id===link.from),b=shown.items.find(i=>i.id===link.to);if(!a||!b)return null;const start=edgePoint(a,b),end=edgePoint(b,a);return <line key={link.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="currentColor" strokeWidth="2" markerEnd="url(#canvas-arrow)"/>;})}</svg>
    {[...shown.items].sort((a,b)=>Number(b.kind==='frame')-Number(a.kind==='frame')).map(item=><article key={item.id} className={`whiteboard-item wb-${item.kind} wb-${item.color}${selected.includes(item.id)?' wb-selected':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height}}>
     <button className="whiteboard-handle" aria-label={l('Move ','Переместить ')+(item.text||item.kind)} onPointerDown={e=>drag(e,item)} onClick={e=>{if(e.detail===0)pick(item,e.shiftKey);}} onKeyDown={e=>{const directions:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(directions[e.key]&&editable){e.preventDefault();void change(moveItems(board,selected.includes(item.id)?selected:[item.id],...directions[e.key]));}}}>⠿</button>
     <button className="whiteboard-text" onClick={e=>pick(item,e.shiftKey)} onDoubleClick={()=>{if(editable)setEditing({...item});}}>{item.text||l('Double-click to write','Двойной клик — текст')}</button>
     {selected.includes(item.id)&&<div className="whiteboard-item-actions"><button disabled={disabled} onClick={()=>setEditing({...item})}>{l('Edit','Изменить')}</button><button disabled={disabled} aria-label={l('Resize','Изменить размер')} onPointerDown={e=>drag(e,item,true)}>↘</button></div>}
    </article>)}
   </div>
   {!board.items.length&&<div className="whiteboard-empty">{l('Start with a sticky note, a heading or a frame.','Начни со стикера, заголовка или рамки.')}</div>}
  </div>
  {editing&&<div className="modal-backdrop"><form className="board-dialog" role="dialog" aria-modal="true" aria-label={l('Edit object','Изменить объект')} onSubmit={async e=>{e.preventDefault();if(await change({...board,items:board.items.map(i=>i.id===editing.id?editing:i)}))setEditing(null);}}><h2>{l('Object','Объект')}</h2><label>{l('Text','Текст')}<textarea autoFocus maxLength={4000} value={editing.text} onChange={e=>setEditing({...editing,text:e.target.value})}/></label><label>{l('Color','Цвет')}<select value={editing.color} onChange={e=>setEditing({...editing,color:e.target.value as Item['color']})}>{['sand','mint','blue','rose','violet'].map(c=><option key={c}>{c}</option>)}</select></label><div className="board-dialog-row">{(['width','height'] as const).map(axis=><label key={axis}>{axis==='width'?l('Width','Ширина'):l('Height','Высота')}<input type="number" min={axis==='width'?120:80} max={6000} value={editing[axis]} onChange={e=>setEditing({...editing,[axis]:Number(e.target.value)})}/></label>)}</div><footer><button type="button" onClick={()=>setEditing(null)}>{l('Cancel','Отмена')}</button><button disabled={disabled}>{l('Save','Сохранить')}</button></footer></form></div>}
 </section>;
}
