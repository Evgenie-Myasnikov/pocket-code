import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dependencyPath} from '../src/board-links.js';
test('long dependency lines use gutters rather than crossing intermediate cards',()=>{
 const from={x:360,y:92},to={x:1380,y:732},obstacles=[{x:700,y:92},{x:1040,y:92}];
 const tokens=dependencyPath(from,to).split(' ');let x=0,y=0;
 for(let i=0;i<tokens.length;){const command=tokens[i++];if(command==='M'){x=+tokens[i++];y=+tokens[i++];continue;}const nx=command==='H'?+tokens[i++]:x,ny=command==='V'?+tokens[i++]:y;
  for(const o of obstacles){const crosses=ny===y?y>o.y&&y<o.y+260&&Math.max(x,nx)>o.x&&Math.min(x,nx)<o.x+280:x>o.x&&x<o.x+280&&Math.max(y,ny)>o.y&&Math.min(y,ny)<o.y+260;assert.equal(crosses,false);}
  x=nx;y=ny;
 }
 assert.equal(x,to.x);assert.equal(y,to.y+42);
});
