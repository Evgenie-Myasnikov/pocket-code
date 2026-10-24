import {z} from 'zod';

const point=z.number().finite().min(0).max(100000);
const side=z.enum(['n','e','s','w']);
export type PortSide=z.infer<typeof side>;
export const whiteboardItem=z.object({id:z.string().uuid(),kind:z.enum(['sticky','text','frame','card']),text:z.string().max(4000),description:z.string().max(20000).optional(),x:point,y:point,width:z.number().min(120).max(6000),height:z.number().min(80).max(6000),color:z.enum(['sand','mint','blue','rose','violet']).default('sand')}).strict();
const loosePoint=z.object({x:z.number().finite().min(0).max(106000),y:z.number().finite().min(0).max(106000)}).strict();
export const whiteboardLink=z.object({id:z.string().uuid(),from:z.string().uuid().optional(),to:z.string().uuid().optional(),fromPoint:loosePoint.optional(),toPoint:loosePoint.optional(),fromSide:side.optional(),toSide:side.optional()}).strict().superRefine((link,ctx)=>{
 if(Boolean(link.from)===Boolean(link.fromPoint)||Boolean(link.to)===Boolean(link.toPoint)||!link.from&&link.fromSide||!link.to&&link.toSide)ctx.addIssue({code:'custom',message:'Each endpoint needs exactly one object or free point'});
});
export const whiteboardSchema=z.object({version:z.literal(1),items:z.array(whiteboardItem).max(500),links:z.array(whiteboardLink).max(1000)}).strict().superRefine((value,ctx)=>{
 const ids=new Set(value.items.map(i=>i.id)),links=new Set<string>();
 if(ids.size!==value.items.length)ctx.addIssue({code:'custom',message:'Duplicate canvas item'});
 for(const link of value.links){if(link.from&&!ids.has(link.from)||link.to&&!ids.has(link.to)||link.from&&link.from===link.to||links.has(link.id))ctx.addIssue({code:'custom',message:'Invalid canvas connection'});links.add(link.id);}
});
export type WhiteboardLink=z.infer<typeof whiteboardLink>;
export type Whiteboard=z.infer<typeof whiteboardSchema>;
export type WhiteboardItem=z.infer<typeof whiteboardItem>;
export const emptyWhiteboard=():Whiteboard=>({version:1,items:[],links:[]});
export function frameSelection(board:Whiteboard,ids:string[]){const frames=board.items.filter(i=>ids.includes(i.id)&&i.kind==='frame');return [...new Set([...ids,...board.items.filter(i=>frames.some(f=>i.x>=f.x&&i.y>=f.y&&i.x+i.width<=f.x+f.width&&i.y+i.height<=f.y+f.height)).map(i=>i.id)])];}
export function edgePoint(a:WhiteboardItem,b:WhiteboardItem){const x=a.x+a.width/2,y=a.y+a.height/2,dx=b.x+b.width/2-x,dy=b.y+b.height/2-y;const t=1/Math.max(Math.abs(dx)/(a.width/2),Math.abs(dy)/(a.height/2),1);return {x:x+dx*t,y:y+dy*t};}
export function portPoint(item:WhiteboardItem,side:PortSide){return {x:item.x+(side==='w'?0:side==='e'?item.width:item.width/2),y:item.y+(side==='n'?0:side==='s'?item.height:item.height/2)};}
export function removeItems(board:Whiteboard,ids:string[]):Whiteboard{return {...board,items:board.items.filter(i=>!ids.includes(i.id)),links:board.links.filter(l=>(!l.from||!ids.includes(l.from))&&(!l.to||!ids.includes(l.to)))};}
export function moveItems(board:Whiteboard,ids:string[],dx:number,dy:number):Whiteboard{
 const moving=board.items.filter(i=>ids.includes(i.id));if(!moving.length)return board;
 dx=Math.max(-Math.min(...moving.map(i=>i.x)),Math.min(dx,Math.min(...moving.map(i=>(i.kind==='card'?20000:100000)-i.x))));
 dy=Math.max(-Math.min(...moving.map(i=>i.y)),Math.min(dy,Math.min(...moving.map(i=>(i.kind==='card'?20000:100000)-i.y))));
 return {...board,items:board.items.map(i=>ids.includes(i.id)?{...i,x:i.x+dx,y:i.y+dy}:i)};
}
