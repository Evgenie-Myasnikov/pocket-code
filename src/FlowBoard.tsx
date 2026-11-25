import {createContext,memo,useCallback,useContext,useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {ReactFlow,ReactFlowProvider,Background,BackgroundVariant,Handle,Position,NodeResizer,ViewportPortal,ConnectionMode,SelectionMode,applyNodeChanges,useReactFlow,useInternalNode,
  type Node,type Edge,type NodeProps,type EdgeProps,type NodeChange,type Connection as FlowConnection} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import {createPortal} from 'react-dom';
import {StickyNote,Type,Frame,Undo2,Redo2,Trash2,Copy,Clipboard,Square,Maximize,MousePointer2,X,Check,Search,ChevronUp,ChevronDown,ChartColumn,Plus,MessageSquare} from 'lucide-react';
import type {BoardWriteReceipt} from './board-write-receipt';
import {useBoardView,type BoardViewConnection} from './use-board-view';
import type {Connection} from './api';
import type {BoardEditActivity} from '../server/board-live';
import {copySelection,pasteSelection} from './whiteboard-selection';
import type {CanvasCardCopy,CanvasCopies} from './board-canvas';
import {CardActionMenu,type CardAction} from './CardActionMenu';
import {useLanguage} from './i18n';
import {emptyWhiteboard,removeItems,frameSelection,type PortSide,type Whiteboard as Canvas,type WhiteboardItem as Item,type WhiteboardLink as Link} from './whiteboard-model';
import {connectionEnds,connectionPoints,connectorPath,portSides} from './whiteboard-connections';
import {ChartEditor,emptyChart} from './ChartEditor';
import {WhiteboardChart} from './WhiteboardChart';
import {ImproveTaskText} from './ImproveTaskText';
import {CardPromptDialog} from './CardPromptDialog';
import type {NodeMark} from './WhiteboardNode';
import './whiteboard.css';
import './flow-board.css';

type Props={taskTextConnection?:Connection;taskTextRoot?:string;marks?:Map<string,NodeMark>;cardActions?(id:string):CardAction[];receipt?:BoardWriteReceipt|null;onDismissReceipt?():void;
  revealObject?:{id:string;requestId:number};viewConnection?:BoardViewConnection;active?:boolean;onSelection?(ids:string[]):void;onInteraction?(active:boolean):void;
  liveActivity?:BoardEditActivity|null;remoteIds?:string[];cards?:CanvasCardCopy[];renderCard?(id:string):ReactNode;onVersions?():void;value?:Canvas;editable:boolean;busy:boolean;
  onSave(value:Canvas,copies?:CanvasCopies):Promise<boolean>;
  /** Starts a chat at a point of the board (canvas coordinates); ids are objects the person pointed at. */
  onChatAt?(point:{x:number;y:number},ids?:string[]):void;
  /** Drawn inside the canvas, above the objects: chats pinned to points. */
  overlay?:ReactNode;
  /** Where the canvas tools go when the board header shows them in its own row; null while that row is not mounted. */
  toolbarHost?:HTMLElement|null};
type NodeData={item:Item;flags:string;mark?:NodeMark};
type BoardNode=Node<NodeData,'board'>;
type Draft={text:string;description?:string};
/** What every object on the canvas needs from the board; it changes rarely, so typing in one editor does not render the others. */
type Shared={ru:boolean;disabled:boolean;single:boolean;editingId:string|null;renderCard?(id:string):ReactNode;taskText?:{connection:Connection;cwd:string};
  edit(id:string|null):void;finish(id:string,draft:Draft):void;resize(id:string,box:{x:number;y:number;width:number;height:number}):void;interact(active:boolean):void};
const BoardContext=createContext<Shared>(null!);
const DESCRIPTION_LIMIT=20000;
const sidePosition:Record<PortSide,Position>={n:Position.Top,e:Position.Right,s:Position.Bottom,w:Position.Left};
const clamp=(value:number,max:number)=>Math.max(0,Math.min(max,Math.round(value)));
const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;

function NodeEditor({item}:{item:Item}){
  const shared=useContext(BoardContext),{ru}=shared,[draft,setDraft]=useState<Draft>({text:item.text,description:item.description});
  const latest=useRef(draft);latest.current=draft;
  const count=draft.description?.length||0,ai=item.kind==='card'&&shared.taskText?{...shared.taskText,compact:true}:undefined;
  return <div className="wb-editor nodrag nowheel nopan" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)&&!document.querySelector('[data-improve-task-dialog]'))shared.finish(item.id,latest.current);}}
    onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')shared.edit(null);else if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();shared.finish(item.id,latest.current);}}}>
    <div className="wb-title-field"><textarea autoFocus aria-label={ru?'Текст':'Text'} maxLength={item.kind==='card'?160:4000} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/>
      {ai&&<ImproveTaskText {...ai} field="title" value={draft.text} context={draft.description} maxLength={160} onApply={text=>setDraft(old=>({...old,text}))}/>}</div>
    {item.kind==='card'&&<div className="wb-description-field"><textarea aria-label={ru?'Описание':'Description'} maxLength={DESCRIPTION_LIMIT} value={draft.description||''} onChange={e=>setDraft({...draft,description:e.target.value})}/>
      {ai&&<ImproveTaskText {...ai} field="description" value={draft.description||''} context={draft.text} maxLength={DESCRIPTION_LIMIT} onApply={description=>setDraft(old=>({...old,description}))}/>}</div>}
    {item.kind==='card'&&count>=DESCRIPTION_LIMIT*.8&&<small className="wb-editor-count" data-near={count>=DESCRIPTION_LIMIT*.9} role="status">{count.toLocaleString(ru?'ru-RU':'en-US')} / {DESCRIPTION_LIMIT.toLocaleString(ru?'ru-RU':'en-US')}</small>}
  </div>;
}

const BoardObject=memo(function BoardObject({id,data,selected}:NodeProps<BoardNode>){
  const shared=useContext(BoardContext),{item,flags,mark}=data,{ru}=shared;
  const metadata=useMemo(()=>item.kind==='card'?shared.renderCard?.(id):null,[shared.renderCard,id,item.kind]);
  const editing=shared.editingId===id&&item.kind!=='chart';
  return <article data-canvas-id={id} data-note-id={item.kind==='card'?id:undefined} className={`whiteboard-item wb-${item.kind} wb-${item.color}${flags}${selected?' wb-selected':''}${mark?' wb-issue-'+mark.level:''}`}>
    {selected&&shared.single&&!shared.disabled&&<NodeResizer minWidth={120} minHeight={80} maxWidth={6000} maxHeight={6000} handleClassName="wb-resize-handle" lineClassName="wb-resize-line"
      onResizeStart={()=>shared.interact(true)} onResizeEnd={(_,box)=>{shared.interact(false);shared.resize(id,box);}}/>}
    {mark&&<span className="wb-issue-badge" role="img" aria-label={mark.title} title={mark.title}>!</span>}
    {editing?<NodeEditor item={item}/>
    :item.kind==='chart'?<div className="whiteboard-text wb-chart-body" role="button" tabIndex={0} aria-label={item.text||(ru?'График':'Chart')}><span>{item.text}</span>{item.chart&&<WhiteboardChart chart={item.chart} ru={ru}/>}</div>
    :<div className={'whiteboard-text'+(item.kind==='frame'?' wb-frame-label':'')} role="button" tabIndex={0} aria-label={item.text||item.kind}><span>{item.text||(ru?'Двойной клик — текст':'Double-click to write')}</span>{item.kind==='card'&&item.description&&<p>{item.description}</p>}</div>}
    {item.kind==='card'&&!editing&&<div className="wb-card-meta">{metadata}</div>}
    {item.kind!=='frame'&&portSides.map(side=><Handle key={side} id={side} type="source" position={sidePosition[side]} isConnectable={!shared.disabled} className="wb-handle" aria-label={(ru?'Связать ':'Connect ')+side}/>)}
  </article>;
});

type EdgeData={link:Link;label:string};
type BoardEdge=Edge<EdgeData,'board'>;
function rect(node:ReturnType<typeof useInternalNode>,id:string):Item|undefined{
  if(!node)return;
  return {id,kind:'sticky',text:'',color:'sand',x:node.internals.positionAbsolute.x,y:node.internals.positionAbsolute.y,width:node.measured.width??node.width??240,height:node.measured.height??node.height??180};
}
/** The connector keeps the board's own orthogonal routing; React Flow supplies the live geometry while objects move. */
function BoardConnection({source,target,data,selected}:EdgeProps<BoardEdge>){
  const from=rect(useInternalNode(source),source),to=rect(useInternalNode(target),target),link=data!.link;
  const points=connectionPoints(link,from,to),path=connectorPath(points);
  if(!path)return null;
  const i=Math.max(0,Math.floor((points.length-1)/2)),a=points[i],b=points[i+1]||a;
  return <g className={selected?'wb-connection wb-connection-selected':'wb-connection'}>
    <path className="wb-link" d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" strokeDasharray={link.style==='dashed'?'6 5':undefined} markerEnd={link.style==='line'?undefined:'url(#canvas-arrow)'}/>
    {link.label&&<text className="wb-link-label" x={(a.x+b.x)/2} y={(a.y+b.y)/2} textAnchor="middle" dominantBaseline="middle">{link.label}</text>}
    <path className="wb-link-hit react-flow__edge-interaction" d={path} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" aria-label={data!.label}/>
  </g>;
}
const nodeTypes={board:BoardObject},edgeTypes={board:BoardConnection};

function Board({value,editable,busy,onSave,onChatAt,overlay,toolbarHost,renderCard,cardActions,onVersions,receipt,onDismissReceipt,revealObject,cards=[],onSelection,onInteraction,liveActivity:externalActivity,remoteIds=[],active=true,viewConnection,marks,taskTextConnection,taskTextRoot}:Props){
  const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
  const flow=useReactFlow<BoardNode,BoardEdge>(),surface=useRef<HTMLDivElement>(null);
  const board=value||emptyWhiteboard(),boardRef=useRef(board);boardRef.current=board;
  const [selected,setSelected]=useState<string[]>([]),[selectedLink,setSelectedLink]=useState<string|null>(null);
  const [editingId,setEditingId]=useState<string|null>(null),[chartItem,setChartItem]=useState<Item|null>(null);
  const [history,setHistory]=useState<Canvas[]>([]),[future,setFuture]=useState<Canvas[]>([]);
  const [interacting,setInteracting]=useState(false),[notice,setNotice]=useState('');
  const [menu,setMenu]=useState<{x:number;y:number;item?:Item}|null>(null),[cardPrompt,setCardPrompt]=useState<{x:number;y:number}|null|undefined>(undefined);
  const locked=useRef(false),clipboard=useRef<{canvas:Canvas;cards:CanvasCardCopy[];count:number}|null>(null);
  const itemsById=useMemo(()=>new Map(board.items.map(item=>[item.id,item])),[board.items]);
  const disabled=!editable||busy||!!editingId;
  const editingAny=!!editingId||!!chartItem;
  useEffect(()=>{onInteraction?.(interacting||editingAny);return()=>onInteraction?.(false);},[onInteraction,interacting,editingAny]);
  const selectionListener=useRef(onSelection);selectionListener.current=onSelection;
  const stamp=useMemo(()=>JSON.stringify(board),[board]),seen=useRef(stamp),expected=useRef<string|null>(null);
  useEffect(()=>{if(!interacting)selectionListener.current?.(frameSelection(board,selected).filter(id=>itemsById.has(id)));},[selected,stamp,interacting]);
  // A board that changed from outside starts a new undo history; our own saves keep it.
  useEffect(()=>{if(seen.current!==stamp){if(expected.current!==stamp){setHistory([]);setFuture([]);}seen.current=stamp;expected.current=null;}},[stamp]);

  // AI activity: the objects being changed, a label next to them and the camera that follows.
  const [commandActivity,setCommandActivity]=useState<BoardEditActivity|null>(null);
  useEffect(()=>{if(!commandActivity)return;const timer=setTimeout(()=>setCommandActivity(null),Math.max(0,commandActivity.expiresAt-Date.now()));return()=>clearTimeout(timer);},[commandActivity]);
  const liveActivity=commandActivity&&(!externalActivity||commandActivity.expiresAt>externalActivity.expiresAt)?commandActivity:externalActivity;
  const aiTarget=liveActivity?.targets?.[0]||liveActivity?.ids.map(id=>itemsById.get(id)).find(Boolean);
  const [following,setFollowing]=useState(true);
  function focusRect(items:{x:number;y:number;width:number;height:number}[],duration=360){
    const box=surface.current?.getBoundingClientRect();if(!items.length||!box?.width||!box.height)return false;
    const x=Math.min(...items.map(i=>i.x)),y=Math.min(...items.map(i=>i.y)),width=Math.max(...items.map(i=>i.x+i.width))-x,height=Math.max(...items.map(i=>i.y+i.height))-y;
    const zoom=Math.max(.1,Math.min(1,(box.width-96)/Math.max(1,width),(box.height-96)/Math.max(1,height)));
    void flow.setCenter(x+width/2,y+height/2,{zoom,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration});return true;
  }
  const focusObjects=(ids:string[])=>focusRect(ids.map(id=>itemsById.get(id)).filter((item):item is Item=>!!item));
  const suspended=!active||interacting||editingAny||!!menu||busy;
  useEffect(()=>{if(following&&!suspended&&aiTarget&&liveActivity&&liveActivity.expiresAt>Date.now())focusRect([aiTarget]);},
    [liveActivity?.id,aiTarget?.x,aiTarget?.y,aiTarget?.width,aiTarget?.height,following,suspended]);
  const revealed=useRef<number|undefined>(undefined);
  useEffect(()=>{if(!revealObject||!active||busy||interacting||editingAny||revealed.current===revealObject.requestId)return;
    const frame=requestAnimationFrame(()=>{if(focusObjects([revealObject.id]))revealed.current=revealObject.requestId;});return()=>cancelAnimationFrame(frame);},
    [revealObject?.requestId,revealObject?.id,active,busy,interacting,editingAny,board]);
  useBoardView(viewConnection,()=>{
    const box=surface.current?.getBoundingClientRect(),view=flow.getViewport();
    const visible=active&&document.visibilityState!=='hidden'&&!!box&&box.width>0&&box.height>0;
    const inView=visible?board.items.filter(item=>(item.x+item.width)*view.zoom+view.x>0&&item.x*view.zoom+view.x<box!.width&&(item.y+item.height)*view.zoom+view.y>0&&item.y*view.zoom+view.y<box!.height).map(item=>item.id):[];
    return {revision:viewConnection?.revision||'0'.repeat(64),visible,busy:busy||interacting||editingAny||!!menu||locked.current,following,zoom:view.zoom,pan:{x:view.x,y:view.y},width:box?.width||0,height:box?.height||0,selected:selected.filter(id=>itemsById.has(id)),inView};
  },command=>{
    const action=command.action;
    if(action.type==='follow'){setFollowing(action.enabled);return;}
    setFollowing(false);
    if(action.type==='fit'){fit();return;}
    if(action.type==='camera'){void flow.setCenter(action.x,action.y,{zoom:action.zoom});return;}
    const items=action.ids.map(id=>itemsById.get(id));if(items.some(item=>!item))throw Error('object_missing');
    if(action.type==='select')select([...new Set(action.ids)]);else focusRect(items as Item[],0);
    if(items.length)setCommandActivity({id:command.id,ids:action.ids,phase:'reading',action:'inspect',expiresAt:Date.now()+8000,targets:items.map(i=>({id:i!.id,x:i!.x,y:i!.y,width:i!.width,height:i!.height}))});
  });
  const aiLabel=liveActivity?.phase==='failed'?l('AI · failed','AI · ошибка'):liveActivity?.phase==='reading'?l('AI · reading','AI · читает'):liveActivity?.phase==='saved'?l('AI · updated','AI · обновил'):liveActivity?.action==='create'?l('AI · creating','AI · создаёт'):liveActivity?.action==='move'?l('AI · moving','AI · перемещает'):liveActivity?.action==='connect'?l('AI · connecting','AI · связывает'):l('AI · editing','AI · редактирует');

  // Find on the board.
  const [finder,setFinder]=useState<{query:string;status:string;index:number}|null>(null),finderInput=useRef<HTMLInputElement>(null);
  const statuses=useMemo(()=>new Map(cards.map(card=>[card.id,card.status])),[cards]);
  const found=useMemo(()=>{if(!finder||!finder.query.trim()&&!finder.status)return [] as string[];const query=finder.query.trim().toLocaleLowerCase();
    return board.items.filter(item=>(!finder.status||statuses.get(item.id)===finder.status)&&(!query||(item.text+'\n'+(item.description||'')+(item.chart?'\n'+[item.chart.unit||'',...item.chart.categories,...item.chart.series.map(series=>series.name)].join('\n'):'')).toLocaleLowerCase().includes(query))).sort((a,b)=>a.y-b.y||a.x-b.x).map(item=>item.id);},[finder?.query,finder?.status,board.items,statuses]);
  function findStep(direction:1|-1){if(!finder||!found.length)return;const index=(finder.index+direction+found.length)%found.length;setFinder({...finder,index});focusObjects([found[index]]);}
  function openFinder(){setFinder(old=>old||{query:'',status:'',index:-1});requestAnimationFrame(()=>finderInput.current?.focus());}

  // Canvas objects as React Flow nodes. Unchanged objects keep their data object, so only changed ones render.
  const cache=useRef(new Map<string,{signature:string;data:NodeData}>());
  const [nodes,setNodes]=useState<BoardNode[]>([]);
  const aiIds=liveActivity?.ids||[];
  const flagKey=JSON.stringify([aiIds,remoteIds,found]);
  useEffect(()=>{
    const ai=new Set(aiIds),remote=new Set(remoteIds),matches=new Set(found),next=new Map<string,{signature:string;data:NodeData}>();
    setNodes(old=>{
      const previous=new Map(old.map(node=>[node.id,node]));
      return board.items.map(item=>{
        const flags=(remote.has(item.id)?' wb-remote-updated':'')+(ai.has(item.id)?' wb-ai-active':'')+(matches.has(item.id)?' wb-found':''),mark=marks?.get(item.id);
        const signature=JSON.stringify([item,flags,mark]),kept=cache.current.get(item.id);
        const entry=kept?.signature===signature?kept:{signature,data:{item,flags,mark}};next.set(item.id,entry);
        const frame=item.kind==='frame';
        return {id:item.id,type:'board' as const,position:{x:item.x,y:item.y},width:item.width,height:item.height,data:entry.data,selected:previous.get(item.id)?.selected||false,
          zIndex:frame?-1:0,...(frame?{dragHandle:'.wb-frame-label',className:'wb-frame-node'}:{}),...(item.kind==='card'?{extent:[[0,0],[20000+item.width,20000+item.height]] as [[number,number],[number,number]]}:{})};
      });
    });
    cache.current=next;
  },[board.items,marks,flagKey]);
  const edges=useMemo<BoardEdge[]>(()=>board.links.filter(link=>link.from&&link.to&&itemsById.has(link.from)&&itemsById.has(link.to)).map(link=>{
    const ends=connectionEnds(link,itemsById.get(link.from!),itemsById.get(link.to!));
    return {id:link.id,type:'board' as const,source:link.from!,target:link.to!,sourceHandle:ends?.fromSide,targetHandle:ends?.toSide,selected:selectedLink===link.id,reconnectable:true,data:{link,label:ru?'Выбрать связь':'Select connection'}};
  }),[board.links,itemsById,selectedLink,ru]);
  const looseLinks=useMemo(()=>board.links.filter(link=>!link.from||!link.to),[board.links]);

  async function change(next:Canvas,mode:'edit'|'undo'|'redo'='edit',copies?:CanvasCopies){
    if(!editable||busy||locked.current)return false;locked.current=true;expected.current=JSON.stringify(next);const before=boardRef.current;
    try{if(await onSave(next,copies)){if(mode==='undo'){setHistory(h=>h.slice(0,-1));setFuture(f=>[...f,before]);}else if(mode==='redo'){setFuture(f=>f.slice(0,-1));setHistory(h=>[...h,before]);}else{setHistory(h=>[...h.slice(-49),before]);setFuture([]);}return true;}
      // A refused save puts the objects back where the board has them.
      setNodes(old=>old.map(node=>{const item=boardRef.current.items.find(i=>i.id===node.id);return item?{...node,position:{x:item.x,y:item.y},width:item.width,height:item.height}:node;}));return false;
    }finally{locked.current=false;}
  }
  function select(ids:string[]){const set=new Set(ids);setSelectedLink(null);setSelected(ids);setNodes(old=>old.map(node=>node.selected===set.has(node.id)?node:{...node,selected:set.has(node.id)}));}
  function place(point?:{x:number;y:number}){
    const box=surface.current?.getBoundingClientRect(),at=flow.screenToFlowPosition(point||{x:(box?.left||0)+(box?.width||800)/2,y:(box?.top||0)+(box?.height||600)/2});
    return {x:clamp(at.x,20000),y:clamp(at.y,20000)};
  }
  async function add(kind:Item['kind'],point?:{x:number;y:number},preset?:Draft){
    const at=place(point),width=kind==='frame'?720:kind==='chart'?560:kind==='card'?280:240,height=kind==='frame'?480:kind==='chart'?360:kind==='card'?280:180;
    const item:Item={id:crypto.randomUUID(),kind,text:preset?.text??(kind==='frame'?l('Section','Раздел'):kind==='card'?l('Untitled','Без названия'):kind==='chart'?l('Chart','График'):''),
      ...(preset?.description?{description:preset.description}:{}),x:point?at.x:Math.max(0,at.x-width/2),y:point?at.y:Math.max(0,at.y-height/2),width,height,color:'sand',...(kind==='chart'?{chart:emptyChart(ru)}:{})};
    while(board.items.some(i=>Math.abs(i.x-item.x)<24&&Math.abs(i.y-item.y)<24)){item.x+=48;item.y+=48;}
    const ok=await change({...board,items:[...board.items,item]});
    if(ok){select([item.id]);if(!preset){if(kind==='chart')setChartItem(item);else setEditingId(item.id);}}
    return ok;
  }
  function addCard(point?:{x:number;y:number}){if(taskTextConnection&&taskTextRoot)setCardPrompt(point||null);else void add('card',point);}
  function remove(ids:string[]){void change(removeItems(board,ids));select([]);}
  function copy(){const canvas=copySelection(board,selected);if(!canvas.items.length)return;const ids=new Set(canvas.items.map(i=>i.id));clipboard.current={canvas,cards:structuredClone(cards.filter(c=>ids.has(c.id))),count:0};setNotice('');}
  async function paste(point?:{x:number;y:number}){
    if(disabled||!clipboard.current)return;const saved=clipboard.current;
    const at=point?flow.screenToFlowPosition(point):null;
    const offset=at?{x:at.x-Math.min(...saved.canvas.items.map(i=>i.x)),y:at.y-Math.min(...saved.canvas.items.map(i=>i.y))}:{x:32*(saved.count+1),y:32*(saved.count+1)};
    const result=pasteSelection(board,saved.canvas,offset);if(!result){setNotice(l('Canvas object or connection limit reached','Достигнут лимит объектов или связей на холсте'));return;}
    if(await change(result.board,'edit',{cards:saved.cards,ids:result.ids})){saved.count++;select(Object.values(result.ids));setNotice('');}
  }
  function fit(){setFollowing(false);if(board.items.length)void flow.fitView({padding:.08,maxZoom:1,duration:200});else void flow.setViewport({x:40,y:40,zoom:1});}

  // Moving: a frame carries the objects inside it; the result is saved when the pointer is released.
  const carried=useRef<{frame:string;origin:{x:number;y:number};items:Map<string,{x:number;y:number}>}|null>(null);
  function dragStart(_:unknown,node:BoardNode){
    setInteracting(true);setFollowing(false);carried.current=null;
    if(node.data.item.kind!=='frame')return;
    const inside=frameSelection(board,[node.id]).filter(id=>id!==node.id);
    carried.current={frame:node.id,origin:{...node.position},items:new Map(inside.map(id=>{const item=itemsById.get(id)!;return [id,{x:item.x,y:item.y}];}))};
  }
  function dragMove(_:unknown,node:BoardNode){
    const carry=carried.current;if(!carry||carry.frame!==node.id||!carry.items.size)return;
    const dx=node.position.x-carry.origin.x,dy=node.position.y-carry.origin.y;
    setNodes(old=>old.map(n=>{const start=carry.items.get(n.id);return start&&!n.dragging?{...n,position:{x:Math.max(0,start.x+dx),y:Math.max(0,start.y+dy)}}:n;}));
  }
  function dragStop(){
    setInteracting(false);carried.current=null;
    const positions=new Map(flow.getNodes().map(node=>[node.id,node.position]));let moved=false;
    const items=board.items.map(item=>{const p=positions.get(item.id);if(!p)return item;const max=item.kind==='card'?20000:100000,x=clamp(p.x,max),y=clamp(p.y,max);if(x===item.x&&y===item.y)return item;moved=true;return {...item,x,y};});
    if(moved)void change({...board,items});
  }
  const nodesChange=useCallback((changes:NodeChange<BoardNode>[])=>{
    setNodes(old=>applyNodeChanges(changes,old));
    if(changes.some(change=>change.type==='select'))setNodes(now=>{const ids=now.filter(node=>node.selected).map(node=>node.id);setSelected(old=>old.length===ids.length&&old.every((id,i)=>id===ids[i])?old:ids);if(ids.length)setSelectedLink(null);return now;});
  },[]);
  function connect(connection:FlowConnection){
    const {source:from,target:to}=connection;if(!from||!to||from===to||board.links.length>=1000||board.links.some(link=>link.from===from&&link.to===to))return;
    const link:Link={id:crypto.randomUUID(),from,to,fromSide:(connection.sourceHandle||undefined) as PortSide|undefined,toSide:(connection.targetHandle||undefined) as PortSide|undefined};
    setSelectedLink(link.id);void change({...board,links:[...board.links,link]});
  }
  function reconnect(edge:BoardEdge,connection:FlowConnection){
    const {source:from,target:to}=connection;if(!from||!to||from===to||board.links.some(link=>link.id!==edge.id&&link.from===from&&link.to===to))return;
    void change({...board,links:board.links.map(link=>link.id===edge.id?{...link,from,to,fromSide:(connection.sourceHandle||undefined) as PortSide|undefined,toSide:(connection.targetHandle||undefined) as PortSide|undefined}:link)});
  }

  const shared=useMemo<Shared>(()=>({ru,disabled:!editable||busy,single:selected.length===1,editingId,renderCard,taskText:taskTextConnection&&taskTextRoot?{connection:taskTextConnection,cwd:taskTextRoot}:undefined,
    edit:setEditingId,interact:setInteracting,
    finish:(id,draft)=>{const now=boardRef.current,item=now.items.find(i=>i.id===id);if(!item||item.text===draft.text&&(item.description||'')===(draft.description||'')){setEditingId(null);return;}
      void change({...now,items:now.items.map(i=>i.id===id?{...i,text:draft.text,...(i.kind==='card'?{description:draft.description}:{})}:i)}).then(ok=>{if(ok)setEditingId(null);});},
    resize:(id,box)=>{const now=boardRef.current;void change({...now,items:now.items.map(i=>i.id===id?{...i,x:clamp(box.x,100000),y:clamp(box.y,100000),width:Math.max(120,Math.min(6000,Math.round(box.width))),height:Math.max(80,Math.min(6000,Math.round(box.height)))}:i)});},
  }),[ru,editable,busy,selected.length===1,editingId,renderCard,taskTextConnection,taskTextRoot]);

  const selectedCard=selected.length===1&&itemsById.get(selected[0])?.kind==='card'?selected[0]:null;
  const selectedActions=selectedCard&&!editingId?(cardActions?.(selectedCard)||[]):[];
  const menuItems:CardAction[]=!menu?[]:menu.item?[
    ...(menu.item.kind==='card'?cardActions?.(menu.item.id)||[]:[]),
    {label:l('Copy','Копировать'),Icon:Copy,onSelect:copy},
    ...(clipboard.current?[{label:l('Paste','Вставить'),Icon:Clipboard,disabled,onSelect:()=>void paste(menu)}]:[]),
    {label:menu.item.kind==='chart'?l('Edit data','Изменить данные'):l('Write','Написать'),disabled,onSelect:()=>menu.item!.kind==='chart'?setChartItem(menu.item!):setEditingId(menu.item!.id)},
    ...(onChatAt?[{label:l('Chat about this','Чат об этом'),Icon:MessageSquare,onSelect:()=>onChatAt({x:menu.item!.x+menu.item!.width+24,y:menu.item!.y},[menu.item!.id])}]:[]),
    ...(['sand','mint','blue','rose','violet'] as const).map(color=>({label:l('Color: ','Цвет: ')+color,disabled,onSelect:()=>void change({...board,items:board.items.map(i=>i.id===menu.item!.id?{...i,color}:i)})})),
    {label:l('Delete','Удалить'),Icon:Trash2,danger:true,disabled,onSelect:()=>remove(selected.includes(menu.item!.id)?selected:[menu.item!.id])}
  ]:[
    ...(selected.length?[{label:l('Copy selection','Копировать выделенное'),Icon:Copy,onSelect:copy},{label:l('Delete selection','Удалить выделенное'),Icon:Trash2,danger:true,disabled,onSelect:()=>remove(selected)}]:[]),
    ...(clipboard.current?[{label:l('Paste','Вставить'),Icon:Clipboard,disabled,onSelect:()=>void paste(menu)}]:[]),
    {label:l('Card','Карточка'),Icon:Square,disabled:disabled||board.items.length>=500,onSelect:()=>addCard(menu)},
    ...([{kind:'sticky',Icon:StickyNote,label:l('Sticky note','Стикер')},{kind:'text',Icon:Type,label:l('Text','Текст')},{kind:'frame',Icon:Frame,label:l('Frame','Рамка')},{kind:'chart',Icon:ChartColumn,label:l('Chart','График')}] as const).map(({kind,Icon,label})=>({label,Icon,disabled:disabled||board.items.length>=500,onSelect:()=>void add(kind,menu)})),
    ...(onChatAt?[{label:l('Chat here','Чат здесь'),Icon:MessageSquare,onSelect:()=>onChatAt(flow.screenToFlowPosition(menu))}]:[]),
    ...(onVersions?[{label:l('Versions','Версии'),onSelect:onVersions}]:[])
  ];
  function keyDown(e:React.KeyboardEvent){
    if((e.target as HTMLElement).closest('textarea,input,select,[contenteditable=true]'))return;
    const key=e.key.toLowerCase(),command=e.ctrlKey||e.metaKey;
    // A key pressed on a focused object acts on that object.
    const focusedId=(e.target as HTMLElement).closest<HTMLElement>('[data-canvas-id]')?.dataset.canvasId,focused=focusedId?itemsById.get(focusedId):undefined;
    if(focused&&e.key===' '){e.preventDefault();select(e.shiftKey?(selected.includes(focused.id)?selected.filter(id=>id!==focused.id):[...selected,focused.id]):[focused.id]);return;}
    if(command&&key==='f'){e.preventDefault();openFinder();return;}
    if(command&&key==='a'){e.preventDefault();select(board.items.map(i=>i.id));return;}
    if(command&&key==='c'){e.preventDefault();copy();return;}
    if(command&&key==='v'){e.preventDefault();void paste();return;}
    if(command&&key==='z'){e.preventDefault();const list=e.shiftKey?future:history;if(list.length)void change(list.at(-1)!,e.shiftKey?'redo':'undo');return;}
    if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const item=focused||(selected.length===1?itemsById.get(selected[0]):undefined),box=(item&&surface.current!.querySelector(`[data-canvas-id="${item.id}"]`)||surface.current!).getBoundingClientRect();if(item&&!selected.includes(item.id))select([item.id]);setMenu({x:box.left+24,y:box.top+24,item});return;}
    if(e.key==='Escape'){select([]);return;}
    if(e.key==='Enter'&&(focused||selected.length===1)&&!disabled){e.preventDefault();const item=focused||itemsById.get(selected[0]);if(item?.kind==='chart')setChartItem(item);else if(item)setEditingId(item.id);return;}
    if(disabled)return;
    if(e.key==='Delete'&&selectedLink){void change({...board,links:board.links.filter(link=>link.id!==selectedLink)});setSelectedLink(null);}
    else if((e.key==='Delete'||e.key==='Backspace')&&selected.length)remove(selected);
  }
  const touch=useMemo(coarse,[]);
  return <section className="whiteboard flow-board" aria-label={l('Free canvas','Свободный холст')}>
    {(()=>{const bar=<div className="whiteboard-toolbar" role="toolbar" aria-label={l('Canvas tools','Инструменты холста')}>
      <button aria-label={l('New card','Новая карточка')} title={l('New card','Новая карточка')} disabled={disabled||board.items.length>=500} onClick={()=>addCard()}><Plus size={18}/></button>
      <button aria-label={l('Undo','Отменить')} disabled={disabled||!history.length} onClick={()=>{setFollowing(false);void change(history.at(-1)!,'undo');}}><Undo2 size={18}/></button>
      <button aria-label={l('Redo','Повторить')} disabled={disabled||!future.length} onClick={()=>{setFollowing(false);void change(future.at(-1)!,'redo');}}><Redo2 size={18}/></button>
      <button aria-label={l('Fit canvas','Вместить холст')} onClick={fit}><Maximize size={18}/></button>
      <button aria-label={l('Find on board','Найти на доске')} title={l('Find on board (Ctrl+F)','Найти на доске (Ctrl+F)')} aria-pressed={!!finder} onClick={()=>finder?setFinder(null):openFinder()}><Search size={18}/></button>
      <button className="wb-follow" aria-label={following?l('Pause following AI','Приостановить следование за AI'):l('Follow AI','Следовать за AI')} title={following?l('Following AI · navigate to pause','Следуем за AI · движение по холсту приостановит'):l('Follow AI','Следовать за AI')} aria-pressed={following} onClick={()=>setFollowing(!following)}><MousePointer2 size={18}/><span>AI</span></button>
      {selectedActions.length>0&&<div className="wb-selection-actions" role="group" aria-label={l('Selected card actions','Действия выбранной карточки')}>{selectedActions.map(action=><button key={action.label} type="button" title={action.label} aria-label={action.label} disabled={busy||action.disabled} onClick={action.onSelect}>{action.Icon?<action.Icon size={18}/>:action.label}</button>)}</div>}
    </div>;return toolbarHost?createPortal(bar,toolbarHost):toolbarHost===undefined?bar:null;})()}
    {finder&&<div className="wb-finder" role="search" aria-label={l('Find on board','Найти на доске')} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')setFinder(null);else if(e.key==='Enter'){e.preventDefault();findStep(e.shiftKey?-1:1);}}}>
      <Search size={16} aria-hidden="true"/><input ref={finderInput} type="search" aria-label={l('Text to find','Текст для поиска')} placeholder={l('Find on board','Найти на доске')} value={finder.query} onChange={e=>setFinder({...finder,query:e.target.value,index:-1})}/>
      <select aria-label={l('Card status','Статус карточки')} value={finder.status} onChange={e=>setFinder({...finder,status:e.target.value,index:-1})}><option value="">{l('Any status','Любой статус')}</option><option value="idea">{l('Idea','Идея')}</option><option value="questions">{l('Questions','Уточнение')}</option><option value="ready">{l('Ready','Готово к работе')}</option><option value="working">{l('Working','В работе')}</option><option value="review">{l('Review','Проверка')}</option><option value="done">{l('Done','Готово')}</option></select>
      <output aria-live="polite">{found.length?(finder.index<0?found.length:`${finder.index+1} / ${found.length}`):finder.query.trim()||finder.status?l('Nothing found','Ничего не найдено'):''}</output>
      <button type="button" aria-label={l('Previous match','Предыдущее совпадение')} disabled={!found.length} onClick={()=>findStep(-1)}><ChevronUp size={16}/></button><button type="button" aria-label={l('Next match','Следующее совпадение')} disabled={!found.length} onClick={()=>findStep(1)}><ChevronDown size={16}/></button><button type="button" aria-label={l('Close search','Закрыть поиск')} onClick={()=>setFinder(null)}><X size={16}/></button>
    </div>}
    {active&&receipt&&<div className="wb-write-receipt"><span role="status"><Check size={14} aria-hidden="true"/>{receipt.action==='connect'?l('AI · connections updated','AI · связи обновлены'):l('AI · changes saved','AI · изменения сохранены')} · {l('objects: ','объектов: ')}{receipt.ids.length}</span><button type="button" disabled={!receipt.ids.some(id=>itemsById.has(id))||busy||interacting||editingAny} onClick={()=>{setFollowing(false);focusObjects(receipt.ids);}}>{l('Show','Показать')}</button><button type="button" aria-label={l('Dismiss AI result','Скрыть результат AI')} onClick={onDismissReceipt}><X size={14}/></button></div>}
    {notice&&<div className="whiteboard-status" role="status">{notice}</div>}
    <div ref={surface} className="whiteboard-viewport flow-board-surface" tabIndex={0} onKeyDown={keyDown} onPointerDownCapture={()=>setFollowing(false)} onKeyDownCapture={e=>{if(e.key!=='Tab')setFollowing(false);}}>
      <BoardContext.Provider value={shared}>
        <ReactFlow<BoardNode,BoardEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={nodesChange}
          minZoom={.1} maxZoom={3} defaultViewport={{x:40,y:40,zoom:1}} snapToGrid snapGrid={[8,8]} nodeExtent={[[0,0],[106000,106000]]} onlyRenderVisibleElements={board.items.length>120}
          panOnScroll panOnScrollSpeed={1} zoomOnDoubleClick={false} panOnDrag={touch?true:[1]} selectionOnDrag={!touch} selectionMode={SelectionMode.Partial} multiSelectionKeyCode="Shift" deleteKeyCode={null} selectionKeyCode={null}
          nodesDraggable={!disabled} nodesConnectable={!disabled} edgesReconnectable={!disabled} elementsSelectable connectionMode={ConnectionMode.Loose} connectionRadius={22} elevateNodesOnSelect={false}
          onNodeDragStart={dragStart} onNodeDrag={dragMove} onNodeDragStop={dragStop} onConnect={connect} onReconnect={reconnect}
          onConnectStart={()=>setInteracting(true)} onConnectEnd={()=>setInteracting(false)} onMoveStart={event=>{if(event)setFollowing(false);}}
          onNodeDoubleClick={(_,node)=>{if(disabled)return;if(node.data.item.kind==='chart')setChartItem(node.data.item);else setEditingId(node.id);}}
          onEdgeClick={(_,edge)=>{select([]);setSelectedLink(edge.id);}} onPaneClick={()=>{setSelectedLink(null);setMenu(null);}}
          onNodeContextMenu={(event,node)=>{event.preventDefault();if(!selected.includes(node.id))select([node.id]);setMenu({x:event.clientX,y:event.clientY,item:node.data.item});}}
          onPaneContextMenu={event=>{event.preventDefault();setMenu({x:event.clientX,y:event.clientY});}}>
          <Background variant={BackgroundVariant.Dots} gap={24} size={1}/>
          <svg className="flow-board-defs" width="0" height="0" aria-hidden="true"><defs><marker id="canvas-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5" fill="context-stroke"/></marker></defs></svg>
          <ViewportPortal>
            {looseLinks.length>0&&<svg className="whiteboard-links" width="1" height="1" aria-label={l('Visual connections','Визуальные связи')}>{looseLinks.map(link=>{
              const path=connectorPath(connectionPoints(link,itemsById.get(link.from||''),itemsById.get(link.to||'')));
              return path?<g key={link.id} className={selectedLink===link.id?'wb-connection wb-connection-selected':'wb-connection'}>
                <path className="wb-link" d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray={link.style==='dashed'?'6 5':undefined} markerEnd={link.style==='line'?undefined:'url(#canvas-arrow)'}/>
                <path className="wb-link-hit" d={path} fill="none" stroke="transparent" strokeWidth="14" vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={l('Select connection','Выбрать связь')} onPointerDown={e=>{e.stopPropagation();select([]);setSelectedLink(link.id);}}/>
              </g>:null;})}</svg>}
            {active&&liveActivity&&aiTarget&&<div className="wb-ai-cursor" data-phase={liveActivity.phase} data-target={aiTarget.id} style={{left:aiTarget.x+aiTarget.width-12,top:aiTarget.y-12} as CSSProperties}>
              <svg key={aiTarget.id} aria-hidden="true" width="22" height="26" viewBox="0 0 22 26"><path d="M3 2.5c0-.9 1-1.4 1.7-.8l14 11.2c.8.6.4 1.9-.6 1.9h-6.2l3.7 7.4c.3.6 0 1.3-.6 1.6l-1.6.8c-.6.3-1.3 0-1.6-.6l-3.7-7.5-3.6 4c-.7.7-1.8.2-1.8-.7Z" fill="currentColor" stroke="var(--bg)" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              <span className="wb-dynamic-island" role="status" key={liveActivity.id}><i aria-hidden="true"/>{aiLabel}</span>
            </div>}
          </ViewportPortal>
          {overlay}
        </ReactFlow>
      </BoardContext.Provider>
      {!board.items.length&&<div className="whiteboard-empty">{l('Start with a card, a sticky note or a frame.','Начни с карточки, стикера или рамки.')}</div>}
    </div>
    {chartItem&&<ChartEditor item={chartItem} onClose={()=>setChartItem(null)} onSave={async next=>{const ok=await change({...board,items:board.items.map(i=>i.id===next.id?next:i)});if(ok)setChartItem(null);return ok;}}/>}
    {cardPrompt!==undefined&&taskTextConnection&&taskTextRoot&&<CardPromptDialog connection={taskTextConnection} cwd={taskTextRoot} onClose={()=>setCardPrompt(undefined)}
      onCreate={async card=>{const ok=await add('card',cardPrompt||undefined,card);if(ok)setCardPrompt(undefined);return ok;}}/>}
    {menu&&<CardActionMenu label={menu.item?l('Object actions','Действия элемента'):l('Create element','Создать элемент')} point={menu} items={menuItems} onClose={()=>setMenu(null)}/>}
  </section>;
}

/** The project board canvas on React Flow: the same data and callbacks as the earlier hand-written canvas. */
export function FlowBoard(props:Props){return <ReactFlowProvider><Board {...props}/></ReactFlowProvider>;}
