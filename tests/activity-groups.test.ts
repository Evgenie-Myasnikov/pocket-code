import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupActivityBlocks,groupActivityMessages,visibleMessageBlocks} from '../src/activity-groups';
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
test('different tool names and running/completed states never share a label',()=>{
 const a=msg('a',[{type:'tool_use',name:'Bash'}]),b=msg('b',[call('b')]),c=msg('c',[call('c','Search')]),d=msg('d',[call('d','Read')]);
 assert.equal(groupActivityMessages([a,b,c,d],undefined,new Set([a])).length,4);
});
test('within-message groups preserve adjacent results, thinking and text order',()=>{
 const m=msg('one',[call('a'),{type:'tool_result',tool_use_id:'a',content:'ok'},call('b'),{type:'text',text:'Summary'},{type:'thinking',thinking:'one'},{type:'thinking',thinking:'two'}]);
 const groups=groupActivityBlocks(visibleMessageBlocks(m));assert.deepEqual(groups.map(g=>g.items.length),[2,1,2]);assert.equal(groups[0].items[0].result?.content,'ok');assert.equal(groups[1].items[0].block.text,'Summary');
});
