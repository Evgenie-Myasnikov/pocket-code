import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupActivityMessages,groupActivityBlocks,visibleMessageBlocks} from '../src/activity-groups';
import type {ChatMessage} from '../server/types';

test('reasoning, routine work and failures retain their chronology between prose and images',()=>{
 const message:ChatMessage={id:'work',role:'assistant',blocks:[
  {type:'text',text:'Checking'},{type:'thinking',thinking:'First'},{type:'thinking',thinking:'Second'},
  {type:'tool_use',id:'a',name:'Read'},{type:'tool_use',id:'b',name:'Read'},
  {type:'tool_use',id:'c',name:'Bash'},{type:'tool_result',tool_use_id:'c',is_error:true,content:'Fixture error'},
  {type:'image',source:{data:'x'}},{type:'text',text:'Finished'}
 ]};
 for(const mode of ['brief','detailed'] as const){
  assert.equal(groupActivityMessages([message],undefined,null,mode)[0].message,message);
  const runs=groupActivityBlocks(visibleMessageBlocks(message),mode);
  assert.deepEqual(runs.map(run=>run.items.map(item=>item.block.type)),[['text'],['thinking','thinking'],['tool_use','tool_use'],['tool_use'],['image'],['text']]);
  assert.equal(runs[3].items[0].result?.is_error,true);
 }
});

test('separate saved assistant messages retain their anchors and all prose',()=>{
 const messages:ChatMessage[]=Array.from({length:100},(_,i)=>({id:String(i),role:'assistant',blocks:[{type:'text',text:`Reply ${i}`}]}));
 assert.ok(groupActivityMessages(messages).every((run,index)=>run.message===messages[index]));
});
