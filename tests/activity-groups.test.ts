import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupActivityBlocks,groupActivityMessages,visibleMessageBlocks,summarizeActivity} from '../src/activity-groups';
import type {Block,ChatMessage} from '../server/types';
const call=(id:string,name='Bash'):Block=>({type:'tool_use',id,name,input:{command:id,status:'completed'}});
const msg=(id:string,blocks:Block[],role:ChatMessage['role']='assistant'):ChatMessage=>({id,role,blocks});
test('consecutive matching labels merge across messages, with separate results retained',()=>{
 const a=call('a'),b=call('b','Command'),ra:Block={type:'tool_result',tool_use_id:'a',content:'first output'},rb:Block={type:'tool_result',tool_use_id:'b',content:'second output'};
 const results=new Map([['a',ra],['b',rb]]);
 const runs=groupActivityMessages([msg('one',[a]),msg('result-a',[ra],'user'),msg('two',[b]),msg('result-b',[rb],'user')],results);
 assert.equal(runs.length,1);assert.deepEqual(runs[0].items?.map(i=>[i.block,i.result]),[[a,ra],[b,rb]]);
});
test('text, user input, unknown data and errors break groups; errors stay visible',()=>{
 const barriers=[msg('text',[{type:'text',text:'Response'}]),msg('user',[{type:'text',text:'Next request'}],'user'),msg('unknown',[{type:'codexItem',content:{future:true}}]),msg('failed',[{...call('error'),input:{status:'failed'}}])];
 for(const barrier of barriers){const runs=groupActivityMessages([msg('a',[call('a')]),barrier,msg('b',[call('b')])]);assert.equal(runs.length,3);assert.equal(runs[1].message,barrier);}
});
test('a running call stays alone and calls group by meaning, not by tool name',()=>{
 const a=msg('a',[{type:'tool_use',name:'Bash'}]),b=msg('b',[call('b')]),c=msg('c',[call('c','Grep')]),d=msg('d',[{type:'tool_use',id:'d',name:'Read',input:{file_path:'src/a.ts'}}]);
 const runs=groupActivityMessages([a,b,c,d],undefined,new Set([a]));
 assert.equal(runs.length,3);assert.deepEqual(runs[2].items?.map(i=>i.block.name),['Grep','Read']);
 assert.equal(summarizeActivity(runs[2].items!),'Explored 1 file · 1 search');
});
test('a plan update joins the surrounding group and brief mode folds a turn into one summary',()=>{
 const read=(id:string,file:string):Block=>({type:'tool_use',id,name:'Read',input:{file_path:file}});
 const todo:Block={type:'tool_use',id:'t',name:'TodoWrite',input:{todos:[{content:'Fix',status:'completed'},{content:'Test',status:'in_progress',activeForm:'Testing'}]}};
 const edit:Block={type:'tool_use',id:'e',name:'Edit',input:{file_path:'src/a.ts',old_string:'a\nb',new_string:'a\nc\nd'}};
 const messages=[msg('1',[read('r1','src/a.ts')]),msg('2',[todo]),msg('3',[read('r2','src/b.ts')]),msg('4',[call('x')]),msg('5',[edit])];
 assert.deepEqual(groupActivityMessages(messages).map(r=>r.items?.length),[3,1,1]);
 const brief=groupActivityMessages(messages,undefined,null,'brief');assert.equal(brief.length,1);
 assert.equal(summarizeActivity(brief[0].items!),'Explored 2 files · ran 1 command · edited 1 file +2 −1');
});
test('within-message groups preserve adjacent results, thinking and text order',()=>{
 const m=msg('one',[call('a'),{type:'tool_result',tool_use_id:'a',content:'ok'},call('b'),{type:'text',text:'Summary'},{type:'thinking',thinking:'one'},{type:'thinking',thinking:'two'}]);
 const groups=groupActivityBlocks(visibleMessageBlocks(m));assert.deepEqual(groups.map(g=>g.items.length),[2,1,2]);assert.equal(groups[0].items[0].result?.content,'ok');assert.equal(groups[1].items[0].block.text,'Summary');
});
