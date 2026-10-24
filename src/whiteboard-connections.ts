import {portPoint,type PortSide,type WhiteboardItem as Item,type WhiteboardLink as Link} from './whiteboard-model';

type Point={x:number;y:number};
export const portSides:PortSide[]=['n','e','s','w'];
const vector:Record<PortSide,Point>={n:{x:0,y:-1},e:{x:1,y:0},s:{x:0,y:1},w:{x:-1,y:0}};

export function nearbyPort(items:Item[],point:Point,radius:number,exclude?:string){
 let nearest:{item:Item;side:PortSide;point:Point}|undefined,distance=radius;
 for(const item of [...items].reverse()){
  if(item.id===exclude)continue;
  for(const side of portSides){const p=portPoint(item,side),d=Math.hypot(p.x-point.x,p.y-point.y);if(d<=distance){nearest={item,side,point:p};distance=d;}}
 }
 return nearest;
}

export function sideTowards(a:Item,b:Point):PortSide{
 const dx=b.x-(a.x+a.width/2),dy=b.y-(a.y+a.height/2);
 return Math.abs(dx)/a.width>=Math.abs(dy)/a.height?(dx>=0?'e':'w'):(dy>=0?'s':'n');
}

function simplify(points:Point[]){
 const result:Point[]=[];
 for(const p of points){
  if(result.length&&result.at(-1)!.x===p.x&&result.at(-1)!.y===p.y)continue;
  while(result.length>1){const a=result.at(-2)!,b=result.at(-1)!;
   if(a.x===b.x&&b.x===p.x&&(b.y-a.y)*(p.y-b.y)>=0||a.y===b.y&&b.y===p.y&&(b.x-a.x)*(p.x-b.x)>=0)result.pop();else break;
  }
  result.push(p);
 }
 return result;
}

function crosses(a:Point,b:Point,r:Item){
 if(a.x===b.x)return a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height;
 return a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width;
}

/** Orthogonal elbows leave and enter the chosen sides; old links infer midpoint ports. */
export function connectorPoints(from:Item,fromSide:PortSide,to:Point,target?:{item:Item;side:PortSide}):Point[]{
 const start=portPoint(from,fromSide),end=target?portPoint(target.item,target.side):to,lead=24;
 const offset=(p:Point,side:PortSide,other?:Item)=>{
  const gap=other?(side==='e'?other.x-p.x:side==='w'?p.x-other.x-other.width:side==='s'?other.y-p.y:p.y-other.y-other.height):0;
  const distance=gap>0?Math.min(lead,gap/3):lead;
  return {x:p.x+vector[side].x*distance,y:p.y+vector[side].y*distance};
 };
 const a=offset(start,fromSide,target?.item),b=target?offset(end,target.side,from):end;
 const boxes=target?[from,target.item]:[from];
 const xs=[(a.x+b.x)/2,a.x,b.x,...boxes.flatMap(r=>[r.x-lead,r.x+r.width+lead])],ys=[(a.y+b.y)/2,a.y,b.y,...boxes.flatMap(r=>[r.y-lead,r.y+r.height+lead])];
 const candidates:Point[][]=[[a,b],...[...new Set(xs)].map(x=>[a,{x,y:a.y},{x,y:b.y},b]),...[...new Set(ys)].map(y=>[a,{x:a.x,y},{x:b.x,y},b])];
 for(const x of new Set(xs))for(const y of new Set(ys)){
  candidates.push([a,{x,y:a.y},{x,y},{x:b.x,y},b],[a,{x:a.x,y},{x,y},{x,y:b.y},b]);
 }
 let best:Point[]=[start,a,{x:a.x,y:b.y},b,end],score=Infinity;
 for(const candidate of candidates){
  const points=simplify([start,...candidate,end]);let cost=points.length*16,valid=true;
  for(let i=1;i<points.length;i++){
   const p=points[i-1],q=points[i];if(p.x!==q.x&&p.y!==q.y){valid=false;break;}
   cost+=Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
   if(boxes.some(r=>crosses(p,q,r)))cost+=100000;
  }
  if(valid&&cost<score){best=points;score=cost;}
 }
 return simplify(best);
}

export const connectorPath=(points:Point[])=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');

export function connectionEnds(link:Link,from?:Item,to?:Item){
 const fromCenter=from?{x:from.x+from.width/2,y:from.y+from.height/2}:link.fromPoint;
 const toCenter=to?{x:to.x+to.width/2,y:to.y+to.height/2}:link.toPoint;
 if(!fromCenter||!toCenter)return;
 const fromSide=from?link.fromSide||sideTowards(from,toCenter):undefined,toSide=to?link.toSide||sideTowards(to,fromCenter):undefined;
 return {start:from&&fromSide?portPoint(from,fromSide):fromCenter,end:to&&toSide?portPoint(to,toSide):toCenter,fromSide,toSide};
}

export function connectionPoints(link:Link,from?:Item,to?:Item){
 const ends=connectionEnds(link,from,to);if(!ends)return [];
 if(from&&ends.fromSide)return connectorPoints(from,ends.fromSide,ends.end,to&&ends.toSide?{item:to,side:ends.toSide}:undefined);
 if(to&&ends.toSide)return connectorPoints(to,ends.toSide,ends.start).reverse();
 return [ends.start,{x:(ends.start.x+ends.end.x)/2,y:ends.start.y},{x:(ends.start.x+ends.end.x)/2,y:ends.end.y},ends.end];
}
