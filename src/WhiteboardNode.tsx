import {memo,useMemo,type MutableRefObject,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent} from 'react';
import {portSides} from './whiteboard-connections';
import type {PortSide,WhiteboardItem as Item} from './whiteboard-model';

export type NodeActions={
 drag(e:ReactPointerEvent<HTMLElement>,item:Item,edge?:string):void;
 pick(item:Item,extend?:boolean):void;
 edit(item:Item|null):void;
 finish():void;
 menu(item:Item,x:number,y:number):void;
 key(e:KeyboardEvent,item:Item):void;
 connect(e:ReactPointerEvent<HTMLElement>,item:Item,side:PortSide):void;
 portKey(item:Item,side:PortSide):void;
};
type Props={aiActive?:boolean;remote?:boolean;item:Item;selected:boolean;disabled:boolean;editing:Item|null;visiblePort?:PortSide;target:boolean;ru:boolean;renderCard?(id:string):ReactNode;actions:MutableRefObject<NodeActions>};

export const WhiteboardNode=memo(function WhiteboardNode({aiActive,remote,item,selected,disabled,editing,visiblePort,target,ru,renderCard,actions}:Props){
 const label=(en:string,ruText:string)=>ru?ruText:en;
 const metadata=useMemo(()=>item.kind==='card'?renderCard?.(item.id):null,[renderCard,item.id,item.kind]);
 return <article onContextMenu={e=>{e.preventDefault();e.stopPropagation();actions.current.menu(item,e.clientX,e.clientY);}} data-canvas-id={item.id} data-note-id={item.kind==='card'?item.id:undefined} className={`whiteboard-item wb-${item.kind} wb-${item.color}${remote?' wb-remote-updated':''}${aiActive?' wb-ai-active':''}${selected?' wb-selected':''}${target?' wb-connect-target':''}`} style={{left:item.x,top:item.y,width:item.width,height:item.height}}>
  {editing?<div className="wb-editor" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))actions.current.finish();}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')actions.current.edit(null);else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();actions.current.finish();}}}>
   <textarea autoFocus aria-label={label('Text','Текст')} maxLength={item.kind==='card'?160:4000} value={editing.text} onChange={e=>actions.current.edit({...editing,text:e.target.value})}/>
   {item.kind==='card'&&<textarea aria-label={label('Description','Описание')} maxLength={20000} value={editing.description||''} onChange={e=>actions.current.edit({...editing,description:e.target.value})}/>}
  </div>:<div className="whiteboard-text" role="button" tabIndex={0} aria-label={item.text||item.kind} onPointerDown={e=>{if(item.kind==='frame'&&e.target===e.currentTarget)return;actions.current.drag(e,item);}} onClick={e=>{if(e.detail===0)actions.current.pick(item,e.shiftKey);}} onDoubleClick={()=>{if(!disabled)actions.current.edit({...item});}} onKeyDown={e=>actions.current.key(e,item)}><span>{item.text||label('Double-click to write','Двойной клик — текст')}</span>{item.kind==='card'&&<p>{item.description}</p>}</div>}
  {item.kind==='card'&&<div className="wb-card-meta">{metadata}</div>}
  {selected&&!disabled&&['n','e','s','w','ne','se','sw','nw'].map(edge=><span key={edge} className={'wb-resize wb-resize-'+edge} data-resize={edge} onPointerDown={e=>actions.current.drag(e,item,edge)}/>)}
  {!disabled&&portSides.map(side=><button key={side} className={'wb-port wb-port-'+side+(visiblePort===side?' wb-port-visible':'')} tabIndex={selected?0:-1} aria-label={label('Connect ','Связать ')+side} onPointerDown={e=>actions.current.connect(e,item,side)} onClick={e=>{if(e.detail===0)actions.current.portKey(item,side);}}/>)}
 </article>;
});
