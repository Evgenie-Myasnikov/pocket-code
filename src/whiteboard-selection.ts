import {frameSelection,type Whiteboard} from './whiteboard-model';

export type SelectionRect={x:number;y:number;width:number;height:number};
export function selectionRect(a:{x:number;y:number},b:{x:number;y:number}):SelectionRect{return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)};}
export function itemsInRect(board:Whiteboard,rect:SelectionRect){
 return board.items.filter(item=>item.kind==='frame'
  ?item.x>=rect.x&&item.y>=rect.y&&item.x+item.width<=rect.x+rect.width&&item.y+item.height<=rect.y+rect.height
  :item.x<rect.x+rect.width&&item.x+item.width>rect.x&&item.y<rect.y+rect.height&&item.y+item.height>rect.y).map(item=>item.id);
}
export function copySelection(board:Whiteboard,ids:string[]):Whiteboard{
 const selected=new Set(frameSelection(board,ids));
 return structuredClone({version:1,items:board.items.filter(item=>selected.has(item.id)),links:board.links.filter(link=>Boolean(link.from||link.to)&&(!link.from||selected.has(link.from))&&(!link.to||selected.has(link.to)))});
}
export function pasteSelection(board:Whiteboard,clipboard:Whiteboard,offset={x:32,y:32}):{board:Whiteboard;ids:Record<string,string>}|null{
 if(!clipboard.items.length||board.items.length+clipboard.items.length>500||board.links.length+clipboard.links.length>1000)return null;
 const ids=Object.fromEntries(clipboard.items.map(item=>[item.id,crypto.randomUUID()]));
 const dx=Math.max(-Math.min(...clipboard.items.map(i=>i.x)),Math.min(offset.x,...clipboard.items.map(i=>(i.kind==='card'?20000:100000)-i.x)));
 const dy=Math.max(-Math.min(...clipboard.items.map(i=>i.y)),Math.min(offset.y,...clipboard.items.map(i=>(i.kind==='card'?20000:100000)-i.y)));
 const items=clipboard.items.map(item=>({...item,id:ids[item.id],x:item.x+dx,y:item.y+dy}));
 const links=clipboard.links.map(link=>({...link,id:crypto.randomUUID(),...(link.from?{from:ids[link.from]}:{}),...(link.to?{to:ids[link.to]}:{}),...(link.fromPoint?{fromPoint:{x:Math.max(0,Math.min(106000,link.fromPoint.x+dx)),y:Math.max(0,Math.min(106000,link.fromPoint.y+dy))}}:{}),...(link.toPoint?{toPoint:{x:Math.max(0,Math.min(106000,link.toPoint.x+dx)),y:Math.max(0,Math.min(106000,link.toPoint.y+dy))}}:{})}));
 return {board:{...board,items:[...board.items,...items],links:[...board.links,...links]},ids};
}
