import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupActivityMessages,groupActivityBlocks,visibleMessageBlocks} from '../src/activity-groups';
import {uniqueMessages,turnTranscript} from '../src/turn-transcript';
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

test('a reattached job shares one reasoning disclosure with the saved part of its turn',()=>{
 const ask=(id:string):ChatMessage=>({id,role:'user',blocks:[{type:'text',text:id}]});
 const thought=(id:string,text:string):ChatMessage=>({id,role:'assistant',blocks:[{type:'thinking',thinking:text}]});
 const previous=ask('previous'),current=ask('current'),first=thought('first','Inspect.'),old=thought('next','Ver');
 const next=thought('next','Verify.'),write:ChatMessage={id:'file',role:'assistant',blocks:[{type:'tool_use',name:'Write',id:'file',input:{file_path:'example.ts',status:'running'}}]};
 const history=[previous,thought('saved','Earlier.'),current,first,old],live=[next,write];
 const joined=uniqueMessages([...history,...live]);
 assert.deepEqual(joined,[...history.slice(0,-1),next,write]);
 const {runs,reasoningKeys}=turnTranscript(joined,undefined,new Set(live),'brief',new Set());
 assert.deepEqual(runs.filter(run=>run.reasoning).map(run=>run.reasoning),[
  {key:'turn-reasoning:previous',paragraphs:['Earlier.'],live:false},
  {key:'turn-reasoning:current',paragraphs:['Inspect.','Verify.'],live:true},
 ]);
 const saved=[ask('provider-id'),first,next,write];
 const finished=turnTranscript(saved,undefined,null,'brief',new Set(),reasoningKeys);
 assert.equal(finished.runs.find(run=>run.reasoning)?.key,'turn-reasoning:current');
 const corrected=[saved[0],first,ask('queued'),next,write];
 const resumed=turnTranscript(corrected,undefined,new Set(corrected),'brief',new Set(),finished.reasoningKeys).runs.filter(run=>run.reasoning);
 assert.deepEqual(resumed.map(run=>run.reasoning?.live),[false,true]);
 assert.equal(new Set(resumed.map(run=>run.key)).size,2);
});
