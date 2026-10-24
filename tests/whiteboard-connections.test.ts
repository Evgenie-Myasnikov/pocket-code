import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearbyPort,portSides,connectorPoints,sideTowards} from '../src/whiteboard-connections';
import {portPoint,type WhiteboardItem as Item} from '../src/whiteboard-model';

const a:Item={id:'11111111-1111-4111-8111-111111111111',kind:'sticky',text:'One',x:200,y:200,width:240,height:160,color:'sand'};
test('only side midpoint neighborhoods are connection targets at every zoom',()=>{
 for(const zoom of [.1,.5,1,3]){
  const radius=18/zoom,p=portPoint(a,'e');
  assert.equal(nearbyPort([a],{x:p.x+17/zoom,y:p.y},radius)?.side,'e');
  assert.equal(nearbyPort([a],{x:p.x+19/zoom,y:p.y},radius),undefined);
  assert.equal(nearbyPort([a],p,radius,a.id),undefined);
 }
 assert.equal(nearbyPort([a],{x:a.x+20,y:a.y+20},18),undefined);
 assert.equal(nearbyPort([a],{x:a.x+a.width/2,y:a.y+a.height/2},18),undefined);
});

test('orthogonal routes respect every source/destination side without crossing endpoint interiors',()=>{
 for(const position of [{x:800,y:500},{x:450,y:200},{x:600,y:0},{x:0,y:500}]){
  const b={...a,id:'22222222-2222-4222-8222-222222222222',...position};
  for(const from of portSides)for(const to of portSides){
   const points=connectorPoints(a,from,portPoint(b,to),{item:b,side:to});
   assert.deepEqual(points[0],portPoint(a,from));assert.deepEqual(points.at(-1),portPoint(b,to));
   for(let i=1;i<points.length;i++){
    const p=points[i-1],q=points[i];assert.ok(p.x===q.x||p.y===q.y);
    for(const r of [a,b]){
     const crosses=p.x===q.x?p.x>r.x&&p.x<r.x+r.width&&Math.max(p.y,q.y)>r.y&&Math.min(p.y,q.y)<r.y+r.height:p.y>r.y&&p.y<r.y+r.height&&Math.max(p.x,q.x)>r.x&&Math.min(p.x,q.x)<r.x+r.width;
     assert.equal(crosses,false,`${JSON.stringify(position)} ${from}->${to}`);
    }
   }
  }
 }
});

test('legacy automatic sides and pointer previews produce orthogonal paths',()=>{
 assert.equal(sideTowards(a,{x:1000,y:280}),'e');
 const points=connectorPoints(a,'n',{x:120,y:100});
 assert.deepEqual(points[0],portPoint(a,'n'));assert.deepEqual(points.at(-1),{x:120,y:100});
 assert.ok(points.every((p,i)=>!i||p.x===points[i-1].x||p.y===points[i-1].y));
});
