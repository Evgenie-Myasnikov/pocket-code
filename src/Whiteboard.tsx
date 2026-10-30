import type {BoardWriteReceipt} from './board-write-receipt';
import {useAiFollow} from './use-ai-follow';
import {useBoardView,type BoardViewConnection} from './use-board-view';
import type {BoardEditActivity} from '../server/board-live';
import {copySelection,pasteSelection,itemsInRect,selectionRect,type SelectionRect} from './whiteboard-selection';
import type {CanvasCardCopy,CanvasCopies} from './board-canvas';
import {CardActionMenu,type CardAction} from './CardActionMenu';
import {useEffect,useRef,useState,useMemo,type ReactNode,type CSSProperties} from 'react';
import {StickyNote,Type,Frame,Undo2,Redo2,Trash2,Copy,Clipboard,Square,Maximize,MousePointer2,X,Check} from 'lucide-react';
import {useLanguage} from './i18n';
import {emptyWhiteboard,moveItems,removeItems,frameSelection,portPoint,type PortSide,type Whiteboard as Canvas,type WhiteboardItem as Item,type WhiteboardLink as Link} from './whiteboard-model';
import {nearbyPort,connectionEnds,connectionPoints,connectorPath} from './whiteboard-connections';
import {WhiteboardNode,type NodeActions} from './WhiteboardNode';
import {WhiteboardLink} from './WhiteboardLink';
import './whiteboard.css';

export function Whiteboard({value,editable,busy,onSave,onDiscuss,renderCard,cardActions,onVersions,receipt,onDismissReceipt,revealObject,cards=[],onSelection,onInteraction,liveActivity:externalActivity,remoteIds=[],active=true,viewConnection}:{cardActions?(id:string):CardAction[];receipt?:BoardWriteReceipt|null;onDismissReceipt?():void;revealObject?:{id:string;requestId:number};viewConnection?:BoardViewConnection;active?:boolean;onSelection?(ids:string[]):void;onInteraction?(active:boolean):void;liveActivity?:BoardEditActivity|null;remoteIds?:string[];cards?:CanvasCardCopy[];renderCard?(id:string):ReactNode;onVersions?():void;value?:Canvas;editable:boolean;busy:boolean;onSave(value:Canvas,copies?:CanvasCopies):Promise<boolean>;onDiscuss?(ids:string[]):void}){
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const board=value||emptyWhiteboard(),[selected,setSelected]=useState<string[]>([]),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:40,y:40}),[preview,setPreview]=useState<Canvas|null>(null),[connecting,setConnecting]=useState<{id:string;side:PortSide}|null>(null),[wire,setWire]=useState<{link:Link;moving:'from'|'to';target?:string;targetSide?:PortSide}|null>(null),[editing,setEditing]=useState<Item|null>(null),[history,setHistory]=useState<Canvas[]>([]),[future,setFuture]=useState<Canvas[]>([]);
 const [interacting,setInteracting]=useState(false);
 const selectionListener=useRef(onSelection);selectionListener.current=onSelection;
 useEffect(()=>{onInteraction?.(interacting||Boolean(editing));return()=>onInteraction?.(false);},[onInteraction,interacting,Boolean(editing)]);
 const [marquee,setMarquee]=useState<SelectionRect|null>(null),[notice,setNotice]=useState('');
 const clipboard=useRef<{canvas:Canvas;cards:CanvasCardCopy[];count:number}|null>(null),surfaceCancel=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>surfaceCancel.current?.(),[]);
 const [selectedLink,setSelectedLink]=useState<string|null>(null);
 const selectLink=useRef<(id:string)=>void>(null!);
 selectLink.current=id=>{setSelectedLink(id);setSelected([]);setConnecting(null);};
 const [hoverPort,setHoverPort]=useState<{id:string;side:PortSide}|null>(null);
 const viewport=useRef<HTMLDivElement>(null),locked=useRef(false);
 const connectionCancel=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>connectionCancel.current?.(),[]);
 const stamp=useMemo(()=>JSON.stringify(board),[board]),seen=useRef(stamp),expected=useRef<string|null>(null);
 useEffect(()=>{if(!interacting)selectionListener.current?.(frameSelection(board,selected).filter(id=>board.items.some(item=>item.id===id)));},[selected,stamp,interacting]);
 useEffect(()=>{if(seen.current!==stamp){if(expected.current!==stamp){setHistory([]);setFuture([]);}seen.current=stamp;expected.current=null;}},[stamp]);
 const [menu,setMenu]=useState<{x:number;y:number;item?:Item}|null>(null);
 const touches=useRef(new Map<number,{x:number;y:number}>()),pinch=useRef<{distance:number;zoom:number;pan:{x:number;y:number};center:{x:number;y:number}}|null>(null);
 function touchStart(e:React.PointerEvent){if(e.pointerType!=='touch')return;touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.current.size===2){connectionCancel.current?.();surfaceCancel.current?.();const [a,b]=[...touches.current.values()],r=viewport.current!.getBoundingClientRect();pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,pan,center:{x:(a.x+b.x)/2-r.left,y:(a.y+b.y)/2-r.top}};setPreview(null);}}
 function touchMove(e:React.PointerEvent){if(!touches.current.has(e.pointerId))return;touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const start=pinch.current;if(!start||touches.current.size!==2)return;e.stopPropagation();const [a,b]=[...touches.current.values()],r=viewport.current!.getBoundingClientRect(),z=Math.max(.1,Math.min(3,start.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,start.distance)));setZoom(z);setPan({x:(a.x+b.x)/2-r.left-(start.center.x-start.pan.x)*z/start.zoom,y:(a.y+b.y)/2-r.top-(start.center.y-start.pan.y)*z/start.zoom});}
 function touchEnd(e:React.PointerEvent){touches.current.delete(e.pointerId);if(!touches.current.size)pinch.current=null;}
 const shown=preview||board;
 const orderedItems=useMemo(()=>[...shown.items].sort((a,b)=>Number(b.kind==='frame')-Number(a.kind==='frame')),[shown.items]);
 const itemsById=useMemo(()=>new Map(shown.items.map(i=>[i.id,i])),[shown.items]);
 const [commandActivity,setCommandActivity]=useState<BoardEditActivity|null>(null);
 useEffect(()=>{if(!commandActivity)return;const timer=setTimeout(()=>setCommandActivity(null),Math.max(0,commandActivity.expiresAt-Date.now()));return()=>clearTimeout(timer);},[commandActivity]);
 const liveActivity=commandActivity&&(!externalActivity||commandActivity.expiresAt>externalActivity.expiresAt)?commandActivity:externalActivity;
 const aiIds=useMemo(()=>new Set(liveActivity?.ids||[]),[liveActivity]);
 const aiTarget=liveActivity?.targets?.[0]||liveActivity?.ids.map(id=>itemsById.get(id)).find(Boolean);
 const ai=useAiFollow(aiTarget,liveActivity?.id,liveActivity?.expiresAt||0,viewport,{zoom,pan},v=>{setZoom(v.zoom);setPan(v.pan);},!active||interacting||!!editing||!!menu||busy);
 function focusObjects(ids:string[]){
  const items=ids.map(id=>itemsById.get(id)).filter((item):item is Item=>!!item),rect=viewport.current?.getBoundingClientRect();if(!items.length||!rect?.width||!rect.height)return false;
  ai.pause();const x=Math.min(...items.map(i=>i.x)),y=Math.min(...items.map(i=>i.y)),width=Math.max(...items.map(i=>i.x+i.width))-x,height=Math.max(...items.map(i=>i.y+i.height))-y,z=Math.max(.1,Math.min(1,(rect.width-80)/Math.max(1,width),(rect.height-80)/Math.max(1,height)));setZoom(z);setPan({x:rect.width/2-(x+width/2)*z,y:rect.height/2-(y+height/2)*z});return true;
 }
 const revealed=useRef<number|undefined>(undefined);
 useEffect(()=>{if(!revealObject||!active||busy||interacting||editing||revealed.current===revealObject.requestId)return;const frame=requestAnimationFrame(()=>{if(focusObjects([revealObject.id]))revealed.current=revealObject.requestId;});return()=>cancelAnimationFrame(frame);},[revealObject?.requestId,revealObject?.id,active,busy,interacting,!!editing,board]);
 useBoardView(viewConnection,()=>{
  const element=viewport.current,rect=element?.getBoundingClientRect(),world=element?.querySelector('.whiteboard-world'),matrix=world?new DOMMatrixReadOnly(getComputedStyle(world).transform):null;
  const visible=active&&document.visibilityState!=='hidden'&&!!rect&&rect.width>0&&rect.height>0;
  const z=matrix?.a||zoom,px=matrix?.e??pan.x,py=matrix?.f??pan.y;
  const inView=visible?board.items.filter(item=>(item.x+item.width)*z+px>0&&item.x*z+px<rect!.width&&(item.y+item.height)*z+py>0&&item.y*z+py<rect!.height).map(item=>item.id):[];
  return {revision:viewConnection?.revision||'0'.repeat(64),visible,busy:busy||interacting||!!editing||!!menu||locked.current,following:ai.following,zoom:matrix?.a||zoom,pan:{x:matrix?.e??pan.x,y:matrix?.f??pan.y},width:rect?.width||0,height:rect?.height||0,selected:selected.filter(id=>itemsById.has(id)),inView};
 },command=>{
  const action=command.action;
  if(action.type==='follow'){ai.setFollowing(action.enabled);return;}
  ai.pause();
  if(action.type==='fit'){fit();return;}
  const rect=viewport.current!.getBoundingClientRect();
  if(action.type==='camera'){setZoom(action.zoom);setPan({x:rect.width/2-action.x*action.zoom,y:rect.height/2-action.y*action.zoom});return;}
  const items=action.ids.map(id=>itemsById.get(id));if(items.some(item=>!item))throw Error('object_missing');
  if(action.type==='select'){setSelected([...new Set(action.ids)]);setSelectedLink(null);}
  else{const x=Math.min(...items.map(i=>i!.x)),y=Math.min(...items.map(i=>i!.y)),width=Math.max(...items.map(i=>i!.x+i!.width))-x,height=Math.max(...items.map(i=>i!.y+i!.height))-y,z=Math.max(.1,Math.min(1,(rect.width-80)/width,(rect.height-80)/height));setZoom(z);setPan({x:rect.width/2-(x+width/2)*z,y:rect.height/2-(y+height/2)*z});}
  if(items.length)setCommandActivity({id:command.id,ids:action.ids,phase:'reading',action:'inspect',expiresAt:Date.now()+8000,targets:items.map(i=>({id:i!.id,x:i!.x,y:i!.y,width:i!.width,height:i!.height}))});
 });
 const aiLabel=liveActivity?.phase==='failed'?l('AI · failed','AI · ошибка'):liveActivity?.phase==='reading'?l('AI · reading','AI · читает'):liveActivity?.phase==='saved'?l('AI · updated','AI · обновил'):liveActivity?.action==='create'?l('AI · creating','AI · создаёт'):liveActivity?.action==='move'?l('AI · moving','AI · перемещает'):liveActivity?.action==='connect'?l('AI · connecting','AI · связывает'):l('AI · editing','AI · редактирует');
 const nodeActions=useRef<NodeActions>(null!);
 const pendingDraw=useRef<(()=>void)|null>(null),drawFrame=useRef(0);
 function draw(update:()=>void){pendingDraw.current=update;if(!drawFrame.current)drawFrame.current=requestAnimationFrame(()=>{drawFrame.current=0;const update=pendingDraw.current;pendingDraw.current=null;update?.();});}
 function stopDraw(flush=false){if(drawFrame.current)cancelAnimationFrame(drawFrame.current);drawFrame.current=0;const update=pendingDraw.current;pendingDraw.current=null;if(flush)update?.();}
 useEffect(()=>()=>stopDraw(),[]);
 async function change(next:Canvas,mode:'edit'|'undo'|'redo'='edit',copies?:CanvasCopies){
  if(!editable||busy||locked.current)return false;locked.current=true;expected.current=JSON.stringify(next);
  try{if(await onSave(next,copies)){if(mode==='undo'){setHistory(h=>h.slice(0,-1));setFuture(f=>[...f,board]);}else if(mode==='redo'){setFuture(f=>f.slice(0,-1));setHistory(h=>[...h,board]);}else{setHistory(h=>[...h.slice(-49),board]);setFuture([]);}return true;}return false;}finally{locked.current=false;setPreview(null);}
 }
 function add(kind:Item['kind'],point?:{x:number;y:number}){
  const rect=viewport.current?.getBoundingClientRect();
  const item:Item={id:crypto.randomUUID(),kind,text:kind==='frame'?l('Section','Раздел'):kind==='card'?l('Untitled','Без названия'):'',x:Math.max(0,Math.min(100000,((rect?.width||800)/2-pan.x)/zoom)),y:Math.max(0,Math.min(100000,((rect?.height||600)/2-pan.y)/zoom)),width:kind==='frame'?720:kind==='card'?280:240,height:kind==='frame'?480:kind==='card'?280:180,color:'sand'};
  item.x=Math.max(0,item.x-item.width/2);item.y=Math.max(0,item.y-item.height/2);if(board.items.some(i=>Math.abs(i.x-item.x)<24&&Math.abs(i.y-item.y)<24)){item.x+=48;item.y+=48;}
  if(point&&rect){item.x=Math.max(0,Math.min(20000,(point.x-rect.left-pan.x)/zoom));item.y=Math.max(0,Math.min(20000,(point.y-rect.top-pan.y)/zoom));}
  setSelected([item.id]);void change({...board,items:[...board.items,item]}).then(ok=>{if(ok)setEditing(item);});
 }
 function pick(item:Item,extend=false){
  setSelectedLink(null);setSelected(old=>extend?old.includes(item.id)?old.filter(id=>id!==item.id):[...old,item.id]:[item.id]);
 }
 function drag(event:React.PointerEvent<HTMLElement>,item:Item,edge=''){
  event.stopPropagation();if(event.button!==0||busy||locked.current||!editable||editing)return;
  if(event.shiftKey){pick(item,true);return;}
  setInteracting(true);setSelectedLink(null);const ids=frameSelection(board,selected.includes(item.id)?selected:[item.id]);setSelected(ids);
  const el=event.currentTarget;el.setPointerCapture(event.pointerId);const start={x:event.clientX,y:event.clientY};let next=board,moved=false;
  const move=(e:PointerEvent)=>{if(pinch.current)return;const dx=(e.clientX-start.x)/zoom,dy=(e.clientY-start.y)/zoom;moved ||= Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)>3;if(!moved)return;if(edge){const x=edge.includes('w')?Math.max(0,Math.min(item.x+item.width-120,item.x+dx)):item.x,y=edge.includes('n')?Math.max(0,Math.min(item.y+item.height-80,item.y+dy)):item.y;next={...board,items:board.items.map(i=>i.id===item.id?{...i,x,y,width:Math.min(6000,edge.includes('w')?item.x+item.width-x:edge.includes('e')?Math.max(120,item.width+dx):item.width),height:Math.min(6000,edge.includes('n')?item.y+item.height-y:edge.includes('s')?Math.max(80,item.height+dy):item.height)}:i)};}else next=moveItems(board,ids,Math.round(dx/8)*8,Math.round(dy/8)*8);draw(()=>setPreview(next));};
  const end=(e:PointerEvent)=>{setInteracting(false);stopDraw();el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);if(e.type==='pointerup'&&moved&&!pinch.current)void change(next);else setPreview(null);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }

 function connect(from:string,to:string,fromSide?:PortSide,toSide?:PortSide){if(from===to||board.links.length>=1000||board.links.some(l=>l.from===from&&l.to===to))return;void change({...board,links:[...board.links,{id:crypto.randomUUID(),from,to,fromSide,toSide}]});}
 function connectDrag(event:React.PointerEvent<HTMLElement>,item:Item,side:PortSide){
  const start=portPoint(item,side);beginConnection(event,{id:crypto.randomUUID(),from:item.id,fromSide:side,toPoint:start},'to',false);
 }
 function beginConnection(event:React.PointerEvent<HTMLElement>,original:Link,moving:'from'|'to',reconnecting:boolean){
  event.stopPropagation();event.preventDefault();if(event.button!==0||!editable||busy||locked.current||editing)return;
  connectionCancel.current?.();setInteracting(true);viewport.current?.focus({preventScroll:true});setConnecting(null);
  const el=event.currentTarget,pointerId=event.pointerId,rect=viewport.current!.getBoundingClientRect(),start={x:event.clientX,y:event.clientY};let latest=start,held=false,active=false;
  el.setPointerCapture(pointerId);el.classList.add('wb-port-holding');
  const fixed=moving==='from'?original.to:original.from;
  const destination=()=>{const point={x:(latest.x-rect.left-pan.x)/zoom,y:(latest.y-rect.top-pan.y)/zoom};return {point,port:nearbyPort(board.items,point,18/zoom,fixed)};};
  const draft=()=>{const d=destination(),link={...original};
   if(moving==='from'){delete link.from;delete link.fromSide;delete link.fromPoint;if(d.port){link.from=d.port.item.id;link.fromSide=d.port.side;}else link.fromPoint={x:Math.max(0,Math.min(106000,d.point.x)),y:Math.max(0,Math.min(106000,d.point.y))};}
   else{delete link.to;delete link.toSide;delete link.toPoint;if(d.port){link.to=d.port.item.id;link.toSide=d.port.side;}else link.toPoint={x:Math.max(0,Math.min(106000,d.point.x)),y:Math.max(0,Math.min(106000,d.point.y))};}
   return {link,port:d.port};
  };
  const update=()=>{if(!held||Math.hypot(latest.x-start.x,latest.y-start.y)<5&&!active)return;active=true;const d=draft();draw(()=>setWire({link:d.link,moving,target:d.port?.item.id,targetSide:d.port?.side}));};
  const timer=window.setTimeout(()=>{held=true;el.classList.add('wb-port-ready');update();},180);
  const move=(e:PointerEvent)=>{latest={x:e.clientX,y:e.clientY};update();};
  const cleanup=()=>{setInteracting(false);window.clearTimeout(timer);stopDraw();el.classList.remove('wb-port-holding','wb-port-ready');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);connectionCancel.current=null;setWire(null);setHoverPort(null);if(el.hasPointerCapture(pointerId))el.releasePointerCapture(pointerId);};
  const end=(e:PointerEvent)=>{latest={x:e.clientX,y:e.clientY};cleanup();if(e.type!=='pointerup'||!active)return;const d=draft();if(!reconnecting&&!d.port)return;
   if(d.link.from&&d.link.from===d.link.to)return;
   if(board.links.some(l=>l.id!==original.id&&l.from&&l.from===d.link.from&&l.to===d.link.to))return;
   if(reconnecting){setSelectedLink(original.id);void change({...board,links:board.links.map(l=>l.id===original.id?d.link:l)});}else if(board.links.length<1000){setSelectedLink(d.link.id);void change({...board,links:[...board.links,d.link]});}
  };
  connectionCancel.current=cleanup;el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
 }
 async function finish(){if(!editing)return;if(await change({...board,items:board.items.map(i=>i.id===editing.id?{...i,text:editing.text,description:editing.description}:i)}))setEditing(null);}
 function copy(){
  const canvas=copySelection(board,selected);if(!canvas.items.length)return;
  const ids=new Set(canvas.items.map(i=>i.id));clipboard.current={canvas,cards:structuredClone(cards.filter(c=>ids.has(c.id))),count:0};setNotice('');
 }
 async function paste(point?:{x:number;y:number}){
  if(disabled||!clipboard.current)return;const saved=clipboard.current,rect=viewport.current!.getBoundingClientRect();
  const offset=point?{x:(point.x-rect.left-pan.x)/zoom-Math.min(...saved.canvas.items.map(i=>i.x)),y:(point.y-rect.top-pan.y)/zoom-Math.min(...saved.canvas.items.map(i=>i.y))}:{x:32*(saved.count+1),y:32*(saved.count+1)};
  const result=pasteSelection(board,saved.canvas,offset);if(!result){setNotice(l('Canvas object or connection limit reached','Достигнут лимит объектов или связей на холсте'));return;}
  if(await change(result.board,'edit',{cards:saved.cards,ids:result.ids})){saved.count++;setSelected(Object.values(result.ids));setSelectedLink(null);setNotice('');}
 }
 function surfaceStart(e:React.PointerEvent<HTMLDivElement>){
  const blank=e.target===e.currentTarget||e.target instanceof HTMLElement&&e.target.classList.contains('whiteboard-text')&&Boolean(e.target.closest('.wb-frame'));
  const panning=e.button===1||e.pointerType==='touch';if(e.button!==0&&e.button!==1||!panning&&!blank||editing)return;
  e.preventDefault();e.stopPropagation();surfaceCancel.current?.();connectionCancel.current?.();setInteracting(true);setMenu(null);setConnecting(null);setNotice('');
  const el=e.currentTarget,rect=el.getBoundingClientRect(),pointerId=e.pointerId,start={x:e.clientX,y:e.clientY},before=pan,previous=selected;
  const world=(v:{clientX:number;clientY:number})=>({x:(v.clientX-rect.left-before.x)/zoom,y:(v.clientY-rect.top-before.y)/zoom});
  const origin=world(e);let moved=false,area:SelectionRect|null=null;
  if(!panning){setSelected(e.shiftKey?previous:[]);setSelectedLink(null);}
  el.focus({preventScroll:true});el.setPointerCapture(pointerId);
  const move=(v:PointerEvent)=>{if(v.pointerId!==pointerId||pinch.current)return;moved ||= Math.hypot(v.clientX-start.x,v.clientY-start.y)>4;if(!moved)return;
   if(panning)draw(()=>setPan({x:before.x+v.clientX-start.x,y:before.y+v.clientY-start.y}));
   else{area=selectionRect(origin,world(v));const next=area;draw(()=>{setMarquee(next);setSelected([...new Set([...(e.shiftKey?previous:[]),...itemsInRect(board,next)])]);});}
  };
  const cleanup=()=>{setInteracting(false);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',cancel);el.removeEventListener('lostpointercapture',cancel);window.removeEventListener('blur',cancel);surfaceCancel.current=null;if(el.hasPointerCapture(pointerId))el.releasePointerCapture(pointerId);setMarquee(null);};
  const cancel=()=>{stopDraw();cleanup();if(panning)setPan(before);else setSelected(previous);};
  const end=(v:PointerEvent)=>{if(v.pointerId!==pointerId)return;move(v);stopDraw(true);cleanup();};
  surfaceCancel.current=cancel;el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',cancel);el.addEventListener('lostpointercapture',cancel);window.addEventListener('blur',cancel);
 }
 function scale(next:number,px?:number,py?:number){const rect=viewport.current?.getBoundingClientRect();const x=px??(rect?.width||800)/2,y=py??(rect?.height||600)/2;next=Math.max(.1,Math.min(3,next));setPan({x:x-(x-pan.x)*next/zoom,y:y-(y-pan.y)*next/zoom});setZoom(next);}
 function fit(){ai.pause();const rect=viewport.current?.getBoundingClientRect();if(!rect||!board.items.length){setZoom(1);setPan({x:40,y:40});return;}const x=Math.min(...board.items.map(i=>i.x)),y=Math.min(...board.items.map(i=>i.y)),w=Math.max(...board.items.map(i=>i.x+i.width))-x,h=Math.max(...board.items.map(i=>i.y+i.height))-y;const z=Math.max(.1,Math.min(1,(rect.width-80)/w,(rect.height-80)/h));setZoom(z);setPan({x:40-x*z,y:40-y*z});}
 function portHover(e:React.PointerEvent){
  if(e.buttons||e.pointerType==='touch'||wire)return;
  const r=viewport.current!.getBoundingClientRect(),port=nearbyPort(shown.items,{x:(e.clientX-r.left-pan.x)/zoom,y:(e.clientY-r.top-pan.y)/zoom},22/zoom);
  const next=port?{id:port.item.id,side:port.side}:null;draw(()=>setHoverPort(old=>old?.id===next?.id&&old?.side===next?.side?old:next));
 }
 function portKey(item:Item,side:PortSide){
  if(connecting){connect(connecting.id,item.id,connecting.side,side);setConnecting(null);}else setConnecting({id:item.id,side});
 }
 const disabled=!editable||busy||!!editing;
 nodeActions.current={drag,pick,edit:setEditing,finish:()=>{void finish();},menu:(item,x,y)=>{setSelected(old=>old.includes(item.id)?old:[item.id]);setSelectedLink(null);setMenu({x,y,item});},connect:connectDrag,portKey,key:(e,item)=>{
  if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();e.stopPropagation();const rect=e.currentTarget.getBoundingClientRect();setSelected(old=>old.includes(item.id)?old:[item.id]);setMenu({x:rect.left+24,y:rect.top+24,item});return;}
  if(e.key==='Enter'&&!disabled){e.preventDefault();setSelected([item.id]);setEditing({...item});}else if(e.key===' '){e.preventDefault();pick(item,e.shiftKey);}
  const directions:Record<string,[number,number]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};if(directions[e.key]&&!disabled){e.preventDefault();void change(moveItems(board,selected.includes(item.id)?selected:[item.id],...directions[e.key]));}
 }};
 const selectedCard=selected.length===1&&itemsById.get(selected[0])?.kind==='card'?selected[0]:null;
 const selectedActions=selectedCard&&!editing?(cardActions?.(selectedCard)||[]):[];
 const menuItems:CardAction[]=!menu?[]:menu.item?[
  ...(menu.item.kind==='card'?cardActions?.(menu.item.id)||[]:[]),
  {label:l('Copy','Копировать'),Icon:Copy,onSelect:copy},
  ...(clipboard.current?[{label:l('Paste','Вставить'),Icon:Clipboard,disabled:disabled,onSelect:()=>void paste(menu)}]:[]),
  {label:l('Write','Написать'),disabled:disabled,onSelect:()=>setEditing({...menu.item!})},
  ...(onDiscuss?[{label:'Chat',onSelect:()=>onDiscuss([menu.item!.id])}]:[]),
  ...(['sand','mint','blue','rose','violet'] as const).map(color=>({label:l('Color: ','Цвет: ')+color,disabled:disabled,onSelect:()=>void change({...board,items:board.items.map(i=>i.id===menu.item!.id?{...i,color}:i)})})),
  {label:l('Delete','Удалить'),Icon:Trash2,danger:true,disabled:disabled,onSelect:()=>{void change(removeItems(board,selected.includes(menu.item!.id)?selected:[menu.item!.id]));setSelected([]);}}
 ]:[
  ...(selected.length?[{label:l('Copy selection','Копировать выделенное'),Icon:Copy,onSelect:copy},{label:l('Delete selection','Удалить выделенное'),Icon:Trash2,danger:true,disabled:disabled,onSelect:()=>{void change(removeItems(board,selected));setSelected([]);}}]:[]),
  ...(clipboard.current?[{label:l('Paste','Вставить'),Icon:Clipboard,disabled:disabled,onSelect:()=>void paste(menu)}]:[]),
  ...([{kind:'card',Icon:Square,label:l('Card','Карточка')},{kind:'sticky',Icon:StickyNote,label:l('Sticky note','Стикер')},{kind:'text',Icon:Type,label:l('Text','Текст')},{kind:'frame',Icon:Frame,label:l('Frame','Рамка')}] as const).map(({kind,Icon,label})=>({label,Icon,disabled:disabled||board.items.length>=500,onSelect:()=>add(kind,menu)})),
  ...(onVersions?[{label:l('Versions','Версии'),onSelect:onVersions}]:[])
 ];
 const gridStep=24*zoom*Math.pow(2,Math.max(0,Math.ceil(Math.log2(12/(24*zoom)))));
 return <section className="whiteboard" aria-label={l('Free canvas','Свободный холст')}>
  <div className="whiteboard-toolbar" role="toolbar" aria-label={l('Canvas tools','Инструменты холста')}>
   <button aria-label={l('Undo','Отменить')} disabled={disabled||!history.length} onClick={()=>{ai.pause();void change(history.at(-1)!,'undo');}}><Undo2 size={18}/></button>
   <button aria-label={l('Redo','Повторить')} disabled={disabled||!future.length} onClick={()=>{ai.pause();void change(future.at(-1)!,'redo');}}><Redo2 size={18}/></button>
   <button aria-label={l('Fit canvas','Вместить холст')} onClick={fit}><Maximize size={18}/></button>
   <button className="wb-follow" aria-label={ai.following?l('Pause following AI','Приостановить следование за AI'):l('Follow AI','Следовать за AI')} title={ai.following?l('Following AI · navigate to pause','Следуем за AI · движение по холсту приостановит'):l('Follow AI','Следовать за AI')} aria-pressed={ai.following} onClick={ai.toggle}><MousePointer2 size={18}/><span>AI</span></button>
   {selectedActions.length>0&&<div className="wb-selection-actions" role="group" aria-label={l('Selected card actions','Действия выбранной карточки')}>{selectedActions.map(action=><button key={action.label} type="button" title={action.label} aria-label={action.label} disabled={busy||action.disabled} onClick={action.onSelect}>{action.Icon?<action.Icon size={18}/>:action.label}</button>)}</div>}
  </div>
  {active&&receipt&&<div className="wb-write-receipt"><span role="status"><Check size={14} aria-hidden="true"/>{receipt.action==='connect'?l('AI · connections updated','AI · связи обновлены'):l('AI · changes saved','AI · изменения сохранены')} · {l('objects: ','объектов: ')}{receipt.ids.length}</span><button type="button" disabled={!receipt.ids.some(id=>itemsById.has(id))||busy||interacting||!!editing} onClick={()=>focusObjects(receipt.ids)}>{l('Show','Показать')}</button><button type="button" aria-label={l('Dismiss AI result','Скрыть результат AI')} onClick={onDismissReceipt}><X size={14}/></button></div>}
  {notice&&<div className="whiteboard-status" role="status">{notice}</div>}
  {connecting&&<div className="whiteboard-status" role="status">{l('Select a destination side point','Выбери точку на стороне другого элемента')}</div>}
  <div ref={viewport} className="whiteboard-viewport" style={{backgroundSize:`${gridStep}px ${gridStep}px`,backgroundPosition:`${pan.x}px ${pan.y}px`}} tabIndex={0} onPointerDownCapture={e=>{ai.pause();touchStart(e);if(e.button===1)surfaceStart(e);}} onPointerMoveCapture={e=>{touchMove(e);portHover(e);}} onPointerLeave={()=>setHoverPort(null)} onPointerUpCapture={e=>{const copy={pointerId:e.pointerId};setTimeout(()=>touchEnd(copy as React.PointerEvent),0);}} onPointerCancelCapture={touchEnd} onContextMenu={e=>{if(e.target===e.currentTarget){e.preventDefault();setMenu({x:e.clientX,y:e.clientY});}}} onPointerDown={surfaceStart} onWheel={e=>{ai.pause();if(!e.ctrlKey){let target=e.target instanceof Element?e.target.closest<HTMLElement>('*'):null;while(target&&target!==e.currentTarget){const style=getComputedStyle(target);if((/(auto|scroll)/.test(style.overflowY)&&target.scrollHeight>target.clientHeight+1)||(/(auto|scroll)/.test(style.overflowX)&&target.scrollWidth>target.clientWidth+1))return;target=target.parentElement;}}if(e.ctrlKey){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();scale(zoom*Math.exp(-e.deltaY*.003),e.clientX-r.left,e.clientY-r.top);}else setPan({x:pan.x-e.deltaX,y:pan.y-e.deltaY});}} onKeyDownCapture={e=>{if(e.key!=='Tab')ai.pause();}} onKeyDown={e=>{if((e.target as HTMLElement).closest('textarea,input,select,[contenteditable=true]'))return;if((e.ctrlKey||e.metaKey)&&['a','c','v'].includes(e.key.toLowerCase())){e.preventDefault();if(e.key.toLowerCase()==='a'){setSelected(board.items.map(i=>i.id));setSelectedLink(null);}else if(e.key.toLowerCase()==='c')copy();else void paste();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();const list=e.shiftKey?future:history;if(list.length)void change(list.at(-1)!,e.shiftKey?'redo':'undo');}if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=viewport.current!.getBoundingClientRect();setMenu({x:r.left+40,y:r.top+40});}if(e.key==='Escape'){if(surfaceCancel.current){surfaceCancel.current();return;}connectionCancel.current?.();setConnecting(null);setSelected([]);setSelectedLink(null);}if(e.key==='Delete'&&selectedLink){void change({...board,links:board.links.filter(link=>link.id!==selectedLink)});setSelectedLink(null);}if((e.key==='Delete'||e.key==='Backspace')&&selected.length){void change(removeItems(board,selected));setSelected([]);}}}>
   <div className="whiteboard-world" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,'--wb-handle-scale':1/zoom} as CSSProperties}>
    <svg className="whiteboard-links" width="106000" height="106000" aria-label={l('Visual connections','Визуальные связи')}><defs><marker id="canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker></defs>{shown.links.map(link=><WhiteboardLink label={l('Select connection','Выбрать связь')} key={link.id} link={link} from={itemsById.get(link.from||'')} to={itemsById.get(link.to||'')} selected={selectedLink===link.id} hidden={wire?.link.id===link.id} select={selectLink}/>)}{wire&&<path className="wb-wire" d={connectorPath(connectionPoints(wire.link,itemsById.get(wire.link.from||''),itemsById.get(wire.link.to||'')))} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 4"/>}</svg>
    {active&&liveActivity&&aiTarget&&<div className="wb-ai-cursor" data-phase={liveActivity.phase} data-target={aiTarget.id} style={{left:aiTarget.x+aiTarget.width-12,top:aiTarget.y-12}}><svg aria-hidden="true" width="18" height="22" viewBox="0 0 18 22"><path d="M1 1v17l5-5 4 8 3-2-4-7h7Z" fill="currentColor" stroke="var(--bg)"/></svg><span role="status">{aiLabel}</span></div>}
    {marquee&&<div className="wb-marquee" data-testid="canvas-selection" style={{left:marquee.x,top:marquee.y,width:marquee.width,height:marquee.height}}/>}
    {orderedItems.map(item=><WhiteboardNode aiActive={aiIds.has(item.id)} remote={remoteIds.includes(item.id)} key={item.id} item={item} selected={selected.includes(item.id)} disabled={disabled} editing={editing?.id===item.id?editing:null} target={wire?.target===item.id} visiblePort={wire?.target===item.id?wire.targetSide:wire?.moving==='to'&&wire.link.from===item.id?wire.link.fromSide:wire?.moving==='from'&&wire.link.to===item.id?wire.link.toSide:hoverPort?.id===item.id?hoverPort.side:undefined} ru={ru} renderCard={renderCard} actions={nodeActions}/>)}
    {!disabled&&selectedLink&&(()=>{const link=shown.links.find(l=>l.id===selectedLink);if(!link)return null;const ends=connectionEnds(link,itemsById.get(link.from||''),itemsById.get(link.to||''));if(!ends)return null;return (['from','to'] as const).map(end=>{const point=end==='from'?ends.start:ends.end;return <button key={end} className="wb-port wb-link-end" style={{left:point.x,top:point.y,opacity:wire?.link.id===link.id?0:undefined}} aria-label={end==='from'?l('Move connection start','Переместить начало связи'):l('Move connection end','Переместить конец связи')} onPointerDown={e=>beginConnection(e,link,end,true)}/>;});})()}
   </div>
   {!board.items.length&&<div className="whiteboard-empty">{l('Start with a sticky note, a heading or a frame.','Начни со стикера, заголовка или рамки.')}</div>}
  </div>

  {menu&&<CardActionMenu label={menu.item?l('Object actions','Действия элемента'):l('Create element','Создать элемент')} point={menu} items={menuItems} onClose={()=>setMenu(null)}/>}
 </section>;
}
