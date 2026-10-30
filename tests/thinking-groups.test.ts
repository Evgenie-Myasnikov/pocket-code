import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupThinkingMessages} from '../src/activity-groups';
import type {ChatMessage} from '../server/types';
test('one thinking group preserves intermediate text, tools and reasoning while images and final answer remain outside',()=>{
 const messages:ChatMessage[]=[{id:'u',role:'user',blocks:[{type:'text',text:'Build'}]},{id:'a',role:'assistant',blocks:[{type:'text',text:'Checking'},{type:'thinking',thinking:'Reasoning'},{type:'tool_use',id:'call',name:'Bash'}]},{id:'r',role:'user',blocks:[{type:'tool_result',tool_use_id:'call',content:'output'}]},{id:'b',role:'assistant',blocks:[{type:'image',source:{data:'x'}},{type:'text',text:'Done'}]}];
 const runs=groupThinkingMessages(messages);assert.equal(runs.filter(r=>r.items).length,1);assert.equal(runs[1].items?.length,4);assert.deepEqual(runs.filter(r=>r.message?.role==='assistant').flatMap(r=>r.message!.blocks.map(b=>b.type)),['image','text']);assert.equal(runs.at(-1)?.message?.blocks[0].text,'Done');
});

test('commentary followed by a running tool stays inside Thinking',()=>{
 const message:ChatMessage={id:'work',role:'assistant',blocks:[{type:'text',text:'Checking'},{type:'tool_use',id:'c',name:'Bash'}]};const runs=groupThinkingMessages([message],undefined,new Set([message]));assert.equal(runs.length,1);assert.equal(runs[0].items?.length,2);assert.equal(runs[0].message,undefined);
});
