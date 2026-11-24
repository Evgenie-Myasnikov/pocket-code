import assert from 'node:assert/strict';
import test from 'node:test';
import {nearestCards} from '../src/board-nearest-cards';

test('a chat started at a point takes the nearest cards, measured to the card edge, limited and ordered',()=>{
  const card=(id:string,x:number,y:number)=>({id,x,y,width:280,height:280});
  const cards=[card('far',5000,5000),card('right',700,100),card('under',100,500),card('here',100,100)];
  assert.deepEqual(nearestCards(cards,{x:420,y:150}),['here','right','under']);
  assert.deepEqual(nearestCards(cards,{x:420,y:150},2),['here','right']);
  assert.deepEqual(nearestCards(cards,{x:9000,y:9000}),[]);
  assert.deepEqual(nearestCards(cards,{x:200,y:200},1),['here'],'a point inside a card is at distance zero');
});
