import {test} from 'node:test';import assert from 'node:assert/strict';import {boardPlacement} from '../src/board-placement';
test('notes stay inside their destination branch, including outside-canvas drops',()=>{
 const versions=['','release/1','release/2'];for(const x of [-100,0,200,339,340,630,679,680,900,2500]){const result=boardPlacement(x,30,versions);assert.equal(result.branch,versions[result.column]);assert.ok(result.x>=result.column*340+12);assert.ok(result.x+280<=(result.column+1)*340-12);assert.equal(result.y,60);}
 assert.equal(boardPlacement(350,120,versions).branch,'release/1');
});
