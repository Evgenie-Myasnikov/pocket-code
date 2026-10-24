import {CardActionMenu,type CardAction} from './CardActionMenu';
import {useEffect,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {StickyNote,Type,Frame,Undo2,Redo2,Trash2,Square,Maximize,Plus,Minus,MousePointer2} from 'lucide-react';
import {useLanguage} from './i18n';
import {emptyWhiteboard,moveItems,removeItems,frameSelection,portPoint,type PortSide,type Whiteboard as Canvas,type WhiteboardItem as Item} from './whiteboard-model';
import {nearbyPort,portSides,sideTowards,connectorPoints,connectorPath} from './whiteboard-connections';
import './whiteboard.css';

export function Whiteboard({value,editable,busy,onSave,onDiscuss,renderCard,onVersions}:{renderCard?(id:string):ReactNode;onVersions?():void;value?:Canvas;editable:boolean;busy:boolean;onSave(value:Canvas):Promise<boolean>;onDiscuss?(ids:string[]):void}){
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const board=value||emptyWhiteboard(),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:40,y:40}),[preview,setPreview]=useState<Canvas|null>(null),[connecting,setConnecting]=useState<{id:string;side:PortSide}|null>(null),[wire,setWire]=useState<{from:string;side:PortSide;x:number;y:number;target?:string;toSide?:PortSide}|null>(null),[editing,setEditing]=useState<Item|null>(null),[history,setHistory]=useState<Canvas[]>([]),[future,setFuture]=useState<Canvas[]>([]);
 const [hoverPort,setHoverPort]=useState<{id:string;side:PortSide}|null>(null);
 const viewport=useRef<HTMLDivElement>(null),locked=useRef(false);
 const connectionCancel=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>connectionCancel.current?.(),[]);
 const stamp=JSON.stringify(board),seen=useRef(stamp),expected=useRef<string|null>(null);
 useEffect(()=>{if(seen.current!==stamp){if(expected.current!==stamp){setHistory([]);setFuture([]);}seen.current=stamp;expected.current=null;}},[stamp]);
 const [menu,setMenu]=useState<{x:number;y:number;item?:Item}|null>(null);
 const touches=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<{distance:number;zoom:number;pan:{x:number;y:number};center:{x:number;y:number}}|null>(null);
 function touchStart(e:React.PointerEvent){if(e.pointerType!=='touch')return;touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.current.size===2){connectionCancel.current?.();const [a,b]=[...touches.current.values()],r=viewport.current!.getBoundingClientRect();pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,pan,center:{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top}};setPreview(null);}}
 function touchMove(e:React.PointerEvent){if(!touches.current.has(e.pointerId))return;touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const start=pinch.current;if(!start||touches.current.size!==2)return;e.stopPropagation();const [a,b]=[...touches.current.values()],r=viewport.current!.getBoundingClientRect(),z=Math.max(.1,Math.min(3,start.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,start.distance)));setZoom(z);setPan({x:(a.x+b.x)/2-r.left-(start.center.x-start.pan.x)*z/start.zoom,y:(a.y+b.y)/2-r.top-(start.center.y-start.pan.y)*z/start.zoom});}
 function touchEnd(e:React.PointerEvent){touches.current.delete(e.pointerId);if(!touches.current.size)pinch.current=null;}
 const shown=preview||board;
 async function change(next:Canvas,mode:'edit'|'undo'|'redo'='edit'){
  if(!editable||busy||locked.current)return false;locked.current=true;expected.current=JSON.stringify(next);
  try{if(await onSave(next)){if(mode==='undo'){setHistory(h=>h.slice(0,-1));setFuture(f=>[...f,board]);}else if(mode==='redo'){setFuture(f=>f.slice(0,-1));setHistory(h=>[...h,board]);}else{setHistory(h=>[...h.slice(-49),board]);setFuture([]);}return true;}return false;}finally{locked.current=false;setPreview(null);}
 }
 function add(kind:Item['kind'],point?:{x:number;y:number}){
  const rect=viewport.current?.getBoundingClientRect();
  const item:Item={id:crypto.randomUUID(),kind,text:kind==='frame'?l('Section','Раздел'):kind==='card'?l('Untitled','Без названия'):'',x:Math.max(0,Math.min(100000,((rect?.width||800)/2-pan.x)/zoom)),y:Math.max(0,Math.min(100000,((rect?.height||600)/2-pan.y)/zoom)),width:kind==='frame'?720:kind==='card'?280:240,height:kind==='frame'?480:kind==='card'?280:180,color:'sand'};
  item.x=Math.max(0,item.x-item.width/2);item.y=Math.max(0,item.y-item.height/2);if(board.items.some(i=>Math.abs(i.x-item.x)<24&&Math.abs(i.y-item.y)<24)){item.x+=48;item.y+=48;}
  if(point&&rect){item.x=Math.max(0,Math.min(20000,(point.x-rect.left-pan.x)/zoom));item.y=Math.max(0,Math.min(20000,(point.y-rect.top-pan.y)/zoom));}
  setSelected([item.id]);void change({...board,items:[...board.items,item]}).then(ok=>{if(ok)setEditing(item);});
 }
 function pick(item:Item,extend=false){
  setSelected(old=>extend?old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id]:[item.id]);
 }
 function drag(event:React.PointerEvent<HTMLElement>,item:Item,edge=''){
  event.stopPropagation();if(event.button!==0||busy||locked.current||!editable||editing)return;
  if(event.shiftKey){pick(item,true);return;}
  const ids=frameSelection(board,selected.includes(item.id)?selected:[item.id]);setSelected(ids);
  const el=event.currentTarget;el.setPointerCapture(event.pointerId);const start={x:event.clientX,y:event.clientY};let next=board,moved=false;
  const move=(e:PointerEvent)=>{if(pinch.current)return;const dx=(e.clientX-start.x)/zoom,dy=(e.clientY-start.y)/zoom;moved ||= Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)>3;if(!moved)return;if(edge){const x=edge.includes('w')?Math.max(0,Math.min(item.x+item.width-120,item.x+dx)):item.x,y=edge.includes('n')?Math.max(0,Math.min(item.y+item.height-80,item.y+dy)):item.y;next={...board,items:board.items.map(i=>i.id===item.id?{...i,x,y,width:Math.min(6000,edge.includes('w')?item.x+item.width-x:edge.includes('e')?Math.max(120,item.width+dx):item.width),height:Math.min(6000,edge.includes('n')?item.y+item.height-y:edge.includes('s')?Math.max(80,item.height+dy):item.height)}:i)};}else next=moveItems(board,ids,Math.round(dx/8)*8,Math.round(dy/8)*8);setPreview(next);};
  const end=(e:PointerEvent)=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);if(e.type==='pointerup'&&moved&&!pinch.current)void change(next);else setPreview(null);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }

 function connect(from:string,to:string,fromSide?:PortSide,toSide?:PortSide){if(from===to||board.links.length>=1000||board.links.some(l=>l.from===from&&l.to===to))return;void change({...board,links:[...board.links,{id:crypto.randomUUID(),from,to,fromSide,toSide}]});}
 function connectDrag(event:React.PointerEvent<HTMLElement>,item:Item,side:PortSide){
  event.stopPropagation();event.preventDefault();if(event.button!==0||!editable||busy||locked.current||editing)return;
  viewport.current?.focus({preventScroll:true});setConnecting(null);const el=event.currentTarget,rect=viewport.current!.getBoundingClientRect();el.setPointerCapture(event.pointerId);
  const destination=(e:PointerEvent)=>{
   const point={x:(e.clientX-rect.left-pan.x)/zoom,y:(e.clientY-rect.top-pan.y)/zoom};
   return {point,port:nearbyPort(board.items,point,18/zoom,item.id)};
  };
  const move=(e:PointerEvent)=>{const d=destination(e),point=d.port?.point||d.point;setWire({from:item.id,side,x:point.x,y:point.y,target:d.port?.item.id,toSide:d.port?.side});};
  const cleanup=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);connectionCancel.current=null;setWire(null);setHoverPort(null);if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);};
  const end=(e:PointerEvent)=>{cleanup();if(e.type!=='pointerup')return;const d=destination(e);if(d.port)connect(item.id,d.port.item.id,side,d.port.side);};
  connectionCancel.current=cleanup;
  const start=portPoint(item,side);setWire({from:item.id,side,...start});
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 async function finish(){if(!editing)return;if(await change({...board,items:board.items.map(i=>i.id===editing.id?{...i,text:editing.text,description:editing.description}:i)}))setEditing(null);}
 function panStart(e:React.PointerEvent<HTMLDivElement>){
  if(e.button!==0||e.target!==e.currentTarget)return;setSelected([]);setConnecting(null);setMenu(null);
  const el=e.currentTarget;el.setPointerCapture(e.pointerId);const start={x:e.clientX,y:e.clientY},before=pan;let moved=false;
  const move=(v:PointerEvent)=>{if(pinch.current)return;moved ||= Math.abs(v.clientX-start.x)+Math.abs(v.clientY-start.y)>4;if(moved)setPan({x:before.x+v.clientX-start.x,y:before.y+v.clientY-start.y});};
  const end=(v:PointerEvent)=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);if(el.hasPointerCapture(v.pointerId))el.releasePointerCapture(v.pointerId);};el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 function scale(next:number,px?:number,py?:number){const rect=viewport.current?.getBoundingClientRect();const x=px??(rect?.width||800)/2,y=py??(rect?.height||600)/2;next=Math.max(.1,Math.min(3,next));setPan({x:x-(x-pan.x)*next/zoom,y:y-(y-pan.y)*next/zoom});setZoom(next);}
 function fit(){const rect=viewport.current?.getBoundingClientRect();if(!rect||!board.items.length){setZoom(1);setPan({x:40,y:40});return;}const x=Math.min(...board.items.map(i=>i.x)),y=Math.min(...board.items.map(i=>i.y)),w=Math.max(...board.items.map(i=>i.x+i.width))-x,h=Math.max(...board.items.map(i=>i.y+i.height))-y;const z=Math.max(.1,Math.min(1,(rect.width-80)/w,(rect.height-80)/h));setZoom(z);setPan({x:40-x*z,y:40-y*z});}
 function portHover(e:React.PointerEvent){
  if(e.buttons||e.pointerType==='touch'||wire)return;
  const r=viewport.current!.getBoundingClientRect(),port=nearbyPort(shown.items,{x:(e.clientX-r.left-pan.x)/zoom,y:(e.clientY-r.top-pan.y)/zoom},22/zoom);
  setHoverPort(old=>old?.id===port?.item.id&&old?.side===port?.side?old:port?{id:port.item.id,side:port.side}:null);
 }
 function portKey(item:Item,side:PortSide){
  if(connecting){connect(connecting.id,item.id,connecting.side,side);setConnecting(null);}else setConnecting({id:item.id,side});
 }
 const disabled=!editable||busy||!!editing;
 const menuItems:CardAction[]=!menu?[]:menu.item?[
  {label:l('Write','Написать'),disabled:disabled,onSelect:()=>setEditing({...menu.item!})},
  ...(onDiscuss?[{label:'Chat',onSelect:()=>onDiscuss([menu.item!.id])}]:[]),
  ...(['sand','mint','blue','rose','violet'] as const).map(color=>({label:l('Color: ','Цвет: ')+color,disabled:disabled,onSelect:()=>void change({...board,items:board.items.map(i=>i.id===menu.item!.id?{...i,color}:i)})})),
  {label:l('Delete','Удалить'),Icon:Trash2,danger:true,disabled:disabled,onSelect:()=>{void change(removeItems(board,[menu.item!.id]));setSelected([]);}}
 ]:[
  ...([{kind:'card',Icon:Square,label:l('Card','Карточка')},{kind:'sticky',Icon:StickyNote,label:l('Sticky note','Стикер')},{kind:'text',Icon:Type,label:l('Text','Текст')},{kind:'frame',Icon:Frame,label:l('Frame','Рамка')}] as const).map(({kind,Icon,label})=>({label,Icon,disabled:disabled||board.items.length>=500,onSelect:()=>add(kind,menu)})),
  ...(onVersions?[{label:l('Versions','Версии'),onSelect:onVersions}]:[])
 ];
 return <section className="whiteboard" aria-label={l('Free canvas','Свободный холст')}>
  <div className="whiteboard-toolbar" role="toolbar" aria-label={l('Canvas tools','Инструменты холста')}>
   <button aria-label={l('Undo','Отменить')} disabled={disabled||!history.length} onClick={()=>void change(history.at(-1)!,'undo')}><Undo2 size={18}/></button>
   <button aria-label={l('Redo','Повторить')} disabled={disabled||!future.length} onClick={()=>void change(future.at(-1)!,'redo')}><Redo2 size={18}/></button>
   <button aria-label={l('Fit canvas','Вместить холст')} onClick={fit}><Maximize size={18}/></button>
  </div>
  {connecting&&<div className="whiteboard-status" role="status">{l('Select a destination side point','Выбери точку на стороне другого элемента')}</div>}
  <div ref={viewport} className="whiteboard-viewport" tabIndex={0} onPointerDownCapture={touchStart} onPointerMoveCapture={e=>{touchMove(e);portHover(e);}} onPointerLeave={()=>setHoverPort(null)} onPointerUpCapture={e=>{const copy={pointerId:e.pointerId};setTimeout(()=>touchEnd(copy as React.PointerEvent),0);}} onPointerCancelCapture={touchEnd} onContextMenu={e=>{if(e.target===e.currentTarget){e.preventDefault();setMenu({x:e.clientX,y:e.clientY});}}} onPointerDown={panStart} onWheel={e=>{if(e.ctrlKey){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();scale(zoom*Math.exp(-e.deltaY*.003),e.clientX-r.left,e.clientY-r.top);}else setPan({x:pan.x-e.deltaX,y:pan.y-e.deltaY});}} onKeyDown={e=>{if((e.target as HTMLElement).closest('textarea,input,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const list=e.shiftKey?future:history;if(list.length)void change(list.at(-1)!,e.shiftKey?'redo':'undo');}if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=viewport.current!.getBoundingClientRect();setMenu({x:r.left+40,y:r.top+40});}if(e.key==='Escape'){connectionCancel.current?.();setConnecting(null);setSelected([]);}if(e.key==='Delete'&&selected.length){void change(removeItems(board,selected));setSelected([]);}}}>
   <div className="whiteboard-world" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,'--wb-handle-scale':1/zoom} as CSSProperties}>
    <svg className="whiteboard-links" width="106000" height="106000" aria-label={l('Visual connections','Визуальные связи')}><defs><marker id="canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker></defs>{shown.links.map(link=>{
     const a=shown.items.find(i=>i.id===link.from),b=shown.items.find(i=>i.id===link.to);if(!a||!b)return null;
     const fromSide=link.fromSide||sideTowards(a,{x:b.x+b.width/2,y:b.y+b.height/2}),toSide=link.toSide||sideTowards(b,{x:a.x+a.width/2,y:a.y+a.height/2});
     return <path className="wb-link" key={link.id} d={connectorPath(connectorPoints(a,fromSide,portPoint(b,toSide),{item:b,side:toSide}))} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" markerEnd="url(#canvas-arrow)"/>;
    })}{wire&&(()=>{const a=shown.items.find(i=>i.id===wire.from),b=shown.items.find(i=>i.id===wire.target);if(!a)return null;return <path className="wb-wire" d={connectorPath(connectorPoints(a,wire.side,wire,b&&wire.toSide?{item:b,side:wire.toSide}:undefined))} fill="none" stroke="currentColor" strokeDasharray="6 4"/>;})()}</svg>
    {[...shown.items].sort((a,b)=>Number(b.kind==='frame')-Number(a.kind==='frame')).map(item=><article key={item.id} onContextMenu={e=>{e.preventDefault();e.stopPropagation();setSelected([item.id]);setMenu({x:e.clientX,y:e.clientY,item});}} data-canvas-id={item.id} data-note-id={item.kind==='card'?item.id:undefined} className={`whiteboard-item wb-${item.kind} wb-${item.color}${selected.includes(item.id)?' wb-selected':''}${wire?.target===item.id?' wb-connect-target':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height}}>
     {editing?.id===item.id?<div className="wb-editor" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))void finish();}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')setEditing(null);else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void finish();}}}>
      <textarea autoFocus aria-label={l('Text','Текст')} maxLength={item.kind==='card'?160:4000} value={editing.text} onChange={e=>setEditing({...editing,text:e.target.value})}/>
      {item.kind==='card'&&<textarea aria-label={l('Description','Описание')} maxLength={20000} value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/>}
     </div>:<div className="whiteboard-text" role="button" tabIndex={0} aria-label={item.text||item.kind} onPointerDown={e=>drag(e,item)} onClick={e=>{if(e.detail===0)pick(item,e.shiftKey);}} onDoubleClick={()=>{if(!disabled)setEditing({...item});}} onKeyDown={e=>{if(e.key==='Enter'&&!disabled){e.preventDefault();setSelected([item.id]);setEditing({...item});}else if(e.key===' '){e.preventDefault();pick(item,e.shiftKey);}const directions:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(directions[e.key]&&!disabled){e.preventDefault();void change(moveItems(board,selected.includes(item.id)?selected:[item.id],...directions[e.key]));}}}><span>{item.text||l('Double-click to write','Двойной клик — текст')}</span>{item.kind==='card'&&<p>{item.description}</p>}</div>}
     {item.kind==='card'&&<div className="wb-card-meta">{renderCard?.(item.id)}</div>}
     {selected.includes(item.id)&&!disabled&&['n','e','s','w','ne','se','sw','nw'].map(edge=><span key={edge} className={'wb-resize wb-resize-'+edge} data-resize={edge} onPointerDown={e=>drag(e,item,edge)}/>)}
     {!disabled&&portSides.map(side=>{const visible=hoverPort?.id===item.id&&hoverPort.side===side||wire?.target===item.id&&wire.toSide===side||wire?.from===item.id&&wire.side===side;return <button key={side} className={'wb-port wb-port-'+side+(visible?' wb-port-visible':'')} tabIndex={selected.includes(item.id)?0:-1} aria-label={l('Connect ','Связать ')+side} onPointerDown={e=>connectDrag(e,item,side)} onClick={e=>{if(e.detail===0)portKey(item,side);}}/>;})}
    </article>)}
   </div>
   {!board.items.length&&<div className="whiteboard-empty">{l('Start with a sticky note, a heading or a frame.','Начни со стикера, заголовка или рамки.')}</div>}
  </div>

  {menu&&<CardActionMenu label={menu.item?l('Object actions','Действия элемента'):l('Create element','Создать элемент')} point={menu} items={menuItems} onClose={()=>setMenu(null)}/>}
 </section>;
}
