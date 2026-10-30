import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupThinkingMessages} from '../src/activity-groups';
import type {ChatMessage} from '../server/types';
test('text and images stay above one Thinking group containing only internal work',()=>{
 const messages:ChatMessage[]=[{id:'u',role:'user',blocks:[{type:'text',text:'Build'}]},{id:'a',role:'assistant',blocks:[{type:'text',text:'Checking'},{type:'thinking',thinking:'Reasoning'},{type:'tool_use',id:'call',name:'Bash'}]},{id:'r',role:'user',blocks:[{type:'tool_result',tool_use_id:'call',content:'output'}]},{id:'b',role:'assistant',blocks:[{type:'image',source:{data:'x'}},{type:'text',text:'Done'}]}];
 const runs=groupThinkingMessages(messages);assert.equal(runs.filter(r=>r.items).length,1);assert.equal(runs.at(-1)?.items?.length,3);assert.deepEqual(runs.filter(r=>r.message?.role==='assistant').flatMap(r=>r.message!.blocks.map(b=>b.type)),['text','image','text']);assert.ok(runs.at(-1)?.items?.every(item=>!['text','image'].includes(item.block.type)));
});

test('progress prose stays visible while a tool is running',()=>{
 const message:ChatMessage={id:'work',role:'assistant',blocks:[{type:'text',text:'Checking'},{type:'tool_use',id:'c',name:'Bash'}]};const runs=groupThinkingMessages([message],undefined,new Set([message]));assert.equal(runs.length,2);assert.equal(runs[0].message?.blocks[0].text,'Checking');assert.equal(runs[1].items?.length,1);
});

 test('separate saved assistant messages retain their identity and all prose',()=>{const messages:ChatMessage[]=Array.from({length:100},(_,index)=>({id:String(index),role:'assistant',blocks:[{type:'text',text:`Reply ${index}`}]}));const runs=groupThinkingMessages(messages);assert.equal(runs.length,100);assert.ok(runs.every((run,index)=>run.message===messages[index]));});
