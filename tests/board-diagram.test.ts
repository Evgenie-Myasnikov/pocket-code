import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// @ts-expect-error -- plain ESM helper without type declarations
import {parseFlowchart,layoutFlowchart,DIAGRAM_LIMITS} from '../scripts/board-diagram.mjs';
import {whiteboardSchema} from '../src/whiteboard-model';

test('Mermaid flowchart subset parses shapes, chained and labelled edges, and ignores styling',()=>{
 const graph=parseFlowchart('graph TB\n %% synthetic\n A["Start here"] --> B{Check} -->|ok| C((Done))\n B -- retry --> A\n C --- D[[Archive]]\n D -.-> E>Note]\n subgraph s\n end\n style A fill:#fff\n F;G==>H');
 assert.equal(graph.direction,'TD');
 assert.deepEqual(graph.nodes.map((n:{label:string})=>n.label),['Start here','Check','Done','Archive','Note','F','G','H']);
 assert.deepEqual(graph.links.map((l:{from:string;to:string;style:string;label?:string})=>[l.from,l.to,l.style,l.label||'']),[['A','B','arrow',''],['B','C','arrow','ok'],['B','A','arrow','retry'],['C','D','line',''],['D','E','dashed',''],['G','H','arrow','']]);
});
test('unsupported diagrams and syntax fail with an actionable message',()=>{
 assert.throws(()=>parseFlowchart('sequenceDiagram\n A->>B: hi'),/Only Mermaid "flowchart"/);
 assert.throws(()=>parseFlowchart('flowchart LR\n A ~~ B'),/Line 2: unsupported syntax/);
 assert.throws(()=>parseFlowchart('flowchart LR\n A[unclosed'),/missing "\]"/);
 assert.throws(()=>parseFlowchart('flowchart LR\n'+Array.from({length:DIAGRAM_LIMITS.nodes+1},(_,i)=>'N'+i).join('\n')),/limited to/);
});
test('layered layout keeps cycles readable and fits every node inside the frame',()=>{
 for(const direction of ['TD','BT','LR','RL']){
  const graph=parseFlowchart(`flowchart ${direction}\n A --> B\n A --> C\n B --> D\n C --> D\n D -.-> A`);
  const layout=layoutFlowchart(graph,{x:500,y:300});
  const at=(id:string)=>layout.positions.get(id);
  const horizontal=direction==='LR'||direction==='RL',axis=horizontal?'x':'y',sign=direction==='BT'||direction==='RL'?-1:1;
  assert.ok(sign*(at('B')[axis]-at('A')[axis])>0&&sign*(at('D')[axis]-at('B')[axis])>0,direction);
  assert.equal(at('B')[axis],at('C')[axis]);
  for(const p of layout.positions.values())assert.ok(p.x>=500&&p.y>=300&&p.x+240<=500+layout.frame.width&&p.y+140<=300+layout.frame.height,direction);
 }
});
test('canvas connections accept an optional label and style, and reject unknown styles',()=>{
 const a=randomUUID(),b=randomUUID(),item=(id:string)=>({id,kind:'sticky',text:'Synthetic',x:0,y:0,width:240,height:140,color:'sand'});
 const canvas=(link:object)=>({version:1,items:[item(a),item(b)],links:[{id:randomUUID(),from:a,to:b,...link}]});
 assert.ok(whiteboardSchema.safeParse(canvas({label:'then',style:'dashed'})).success);
 assert.ok(whiteboardSchema.safeParse(canvas({})).success);
 assert.ok(!whiteboardSchema.safeParse(canvas({style:'zigzag'})).success);
 assert.ok(!whiteboardSchema.safeParse(canvas({label:''})).success);
});
