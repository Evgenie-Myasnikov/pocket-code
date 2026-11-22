import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {ChatMessage,WritePreview} from '../server/types';
import {withLiveWrites} from '../src/live-write-messages';
import {canonicalCalls} from '../src/turn-changes';

const progress:WritePreview={tool:'Write',id:'w1',path:'sample.ts',content:'export const total = 2;',totalBytes:23,totalLines:1};
test('a live write is transient, uses host counts and keeps one row per reported file',()=>{
  const messages:ChatMessage[]=[{id:'start',role:'assistant',blocks:[{type:'text',text:'Updating the sample.'}]}];
  const display=withLiveWrites(messages,[progress]);
  assert.equal(display[0],messages[0]);
  assert.equal(display[1].blocks[0].name,'Write');
  assert.deepEqual(display[1].blocks[0].input,{file_path:'sample.ts',content:progress.content,status:'running',preview_bytes:23,preview_lines:1,preview_truncated:undefined});
  assert.equal(messages.length,1);
  assert.equal(withLiveWrites(messages,[]),messages);
  const pending:ChatMessage={id:'edit',role:'assistant',blocks:[{type:'tool_use',name:'File changes',id:'w1'}]};
  const files=[progress,{...progress,path:'second.ts'}].map(item=>({...item,tool:'Patch' as const}));
  const edits=withLiveWrites([pending],files);
  assert.equal(edits.length,1);
  assert.equal(edits[0].id,pending.id);
  assert.deepEqual(edits[0].blocks.map(block=>(block.input as {file_path:string}).file_path),['sample.ts','second.ts']);
  const done:ChatMessage[]=[pending,{id:'result',role:'user',blocks:[{type:'tool_result',tool_use_id:'w1',content:'Saved'}]}];
  assert.equal(withLiveWrites(done,[progress]),done);
});

test('previews update the newest snapshot and ignore results belonging to an older turn',()=>{
 const ask=(id:string):ChatMessage=>({id,role:'user',blocks:[{type:'text',text:id}]});
 const result:ChatMessage={id:'old-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'w1',content:'Saved.'}]};
 const start:ChatMessage={id:'start',role:'assistant',blocks:[{type:'tool_use',id:'w1',name:'Write'}]};
 const snapshot:ChatMessage={id:'snapshot',role:'assistant',blocks:[...start.blocks,...start.blocks]};
 const rows=canonicalCalls(withLiveWrites([ask('older'),result,ask('current'),start,snapshot],[progress]));
 assert.equal(rows[3].blocks.length,1);
 assert.equal((rows[3].blocks[0].input as {content:string}).content,progress.content);
 assert.equal(rows[4].blocks.length,0);
});
