import {test} from 'node:test';import assert from 'node:assert/strict';import {boardColumnWidth,boardPlacement} from '../src/board-placement';
test('notes stay inside their destination branch, including outside-canvas drops',()=>{
 const versions=['','release/1','release/2'];for(const x of [-100,0,200,339,340,630,679,680,900,2500]){const result=boardPlacement(x,30,versions);assert.equal(result.branch,versions[result.column]);assert.ok(result.x>=result.column*340+12);assert.ok(result.x+280<=(result.column+1)*340-12);assert.equal(result.y,64);assert.equal(result.x%8,0);assert.equal(result.y%8,0);}
 assert.equal(boardPlacement(350,120,versions).branch,'release/1');
});
test('placement snaps to the nearest eight-pixel cell within branch bounds',()=>{
 assert.deepEqual(boardPlacement(25,101,['']),{column:0,x:24,y:104,branch:''});
 assert.deepEqual(boardPlacement(375,119,['','next']),{column:1,x:376,y:120,branch:'next'});
 assert.equal(boardPlacement(25,25000,['']).y,19496);
});
test('all selectable grid steps fit cards inside every version column',()=>{
 const versions=['','one','two','three'];
 for(const step of [8,12,16,24,32,64])for(let x=-100;x<1800;x+=13){
  const result=boardPlacement(x,111,versions,280,step),width=boardColumnWidth(step);
  assert.equal(result.x%step,0);assert.equal(result.y%step,0);
  assert.ok(result.x>=result.column*width+12);assert.ok(result.x+280<=(result.column+1)*width-12);
  assert.equal(result.branch,versions[result.column]);
 }
});
