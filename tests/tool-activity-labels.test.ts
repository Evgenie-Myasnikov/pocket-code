import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolActivity} from '../src/tool-activity.js';
import {describeTool,stripAnsi} from '../src/tool-registry.js';
import {canonicalCalls,turnChanges,type TurnChanges} from '../src/turn-changes.js';
import type {Block,ChatMessage} from '../server/types';
/** Totals without the per-file diff lines, which one test checks on their own. */
const totals=(value:TurnChanges|undefined):Omit<TurnChanges,'byFile'>|undefined=>{if(!value)return value;const {byFile:_lines,...rest}=value;return rest;};
test('activity rows name the object of the action and keep an explicit state',()=>{
 assert.equal(toolActivity({type:'tool_use',name:'Command',input:{command:'npm run lint',status:'inProgress'}}).label,'npm run lint');
 assert.equal(toolActivity({type:'tool_use',name:'Command',input:{status:'inProgress'}}).status,'running');
 assert.equal(toolActivity({type:'tool_use',name:'Read',input:{file_path:'C:/Sample/src/list.tsx'}},{type:'tool_result',content:'ok'}).label,'Read list.tsx');
 assert.equal(toolActivity({type:'tool_use',name:'Grep',input:{pattern:'validateEmail',path:'src'}}).label,'Search “validateEmail” in src');
 assert.equal(toolActivity({type:'tool_use',name:'Bash',input:{command:'exit 3'}},{type:'tool_result',is_error:true,content:'line one\nline two\nline three\nfinal error'}).status,'failed');
 assert.deepEqual(describeTool({type:'tool_use',name:'Bash',input:{command:'x'}},{type:'tool_result',is_error:true,content:'a\nb\nc\nd'}).errorLines,['b','c','d']);
 assert.equal(toolActivity({type:'tool_use',name:'mcp__playwright__browser_take_screenshot',input:{}}).label,'Playwright · Screenshot');
 assert.equal(toolActivity({type:'tool_use',name:'TodoWrite',input:{todos:[{content:'A',status:'completed'},{content:'B',status:'pending'}]}}).label,'Plan · 1/2');
});
test('grep with no matches is an answer, not a failure; user denial is its own state',()=>{
 const view=describeTool({type:'tool_use',name:'Bash',input:{command:'rg missingName src'}},{type:'tool_result',is_error:true,content:'Exit code 1'});
 assert.equal(view.status,'nomatch');assert.equal(view.failed,false);
 assert.equal(describeTool({type:'tool_use',name:'Edit',input:{file_path:'a.ts'}},{type:'tool_result',is_error:true,content:"The user doesn't want to proceed with this tool use."}).status,'denied');
 assert.equal(stripAnsi('\u001b[31mred\u001b[0m'),'red');
});
test('edit counts come from the call input, including patches and Codex file changes',()=>{
 const edit=describeTool({type:'tool_use',name:'Edit',input:{file_path:'src/a.ts',old_string:'one\ntwo\nthree',new_string:'one\n2\nthree'}});
 assert.deepEqual([edit.added,edit.removed,edit.title],[1,1,'Edited a.ts']);
 const patch=describeTool({type:'tool_use',name:'apply_patch',input:{input:'*** Begin Patch\n*** Update File: src/b.ts\n@@\n-old\n+new\n+more\n*** End Patch'}});
 assert.deepEqual([patch.files,patch.added,patch.removed],[['src/b.ts'],2,1]);
 const codex=describeTool({type:'tool_use',name:'File changes',input:{changes:[{path:'c.ts',kind:{type:'update'},diff:'@@\n-a\n+b'},{path:'d.ts',kind:{type:'update'},diff:'+x'}]}});
 assert.deepEqual([codex.files.length,codex.added,codex.removed,codex.title],[2,2,1,'Edited c.ts and 1 more']);
});
test('a finished turn reports its changed files on its last assistant message',()=>{
 const messages:ChatMessage[]=[
  {id:'u1',role:'user',blocks:[{type:'text',text:'Fix it'}]},
  {id:'a1',role:'assistant',blocks:[{type:'tool_use',id:'e1',name:'Create',input:{file_path:'new.ts',content:'a\nb',status:'completed'}}]},
  {id:'a2',role:'assistant',blocks:[{type:'text',text:'Done'}]},
  {id:'u2',role:'user',blocks:[{type:'text',text:'Next'}]},
  {id:'a3',role:'assistant',blocks:[{type:'tool_use',id:'e2',name:'Edit',input:{file_path:'x.ts',old_string:'a',new_string:'b',status:'completed'}}]},
 ];
 assert.deepEqual(totals(turnChanges(messages,undefined,true).get('a2')),{files:['new.ts'],added:2,removed:0});
 // each file keeps its own diff lines and counts for the side panel
 assert.deepEqual(turnChanges(messages,undefined,true).get('a2')?.byFile?.['new.ts'],{lines:[{kind:'add',text:'a'},{kind:'add',text:'b'}],added:2,removed:0});
 assert.equal(turnChanges(messages,undefined,true).has('a3'),false);
 assert.deepEqual(totals(turnChanges(messages).get('a3')),{files:['x.ts'],added:1,removed:1});
});
test('turn results use confirmed scoped files and omit line counts for partial evidence',()=>{
 const msg=(name:string,input:Record<string,unknown>):ChatMessage[]=>[{id:'done',role:'assistant',blocks:[{type:'tool_use',id:'call',name,input}]}];
 const scope='C:\\Projects\\App';
 const read=(name:string,input:Record<string,unknown>)=>totals(turnChanges(msg(name,input),undefined,false,scope).get('done'));
 assert.equal(read('Edit',{file_path:'src/a.ts',new_string:'a'}),undefined);
 assert.equal(read('Edit',{status:'failed',file_path:'src/a.ts'}),undefined);
 assert.equal(read('Edit',{status:'completed',file_path:'C:\\Projects\\Outside\\private.ts'}),undefined);
 assert.equal(read('Edit',{status:'completed',file_path:'src/../private.ts'}),undefined);
 assert.deepEqual(read('File changes',{status:'completed',changes:[
   {kind:{type:'add'},path:'C:/Projects/App/src/new.ts',diff:'one\ntwo'},
   {kind:{type:'delete'},path:'src/old.ts',diff:'@@\n-old'}
 ]}),{files:['src/new.ts','src/old.ts'],added:2,removed:1,deleted:['src/old.ts']});
 assert.equal(read('Write',{status:'completed',file_path:'src/a.ts',content:'replacement'})?.countsUnknown,true);
 assert.equal(read('delete_file',{status:'completed',path:'src/a.ts'})?.countsUnknown,true);
});

test('turns reconcile file snapshots by invocation and preserve unrelated calls',()=>{
 const create=(path:string,content:string):Block=>({id:'save',type:'tool_use',name:'Create',input:{file_path:path,content,status:'completed'}});
 const command=(id:string):Block=>({id,type:'tool_use',name:'Bash',input:{command:'npm test',status:'completed'}});
 const first=command('one'),second=command('two'),head:Block={type:'text',text:'Working on the examples.'};
 const finalA=create('a.ts','one\ntwo'),finalB=create('b.ts','three');
 const messages:ChatMessage[]=[
  {id:'ask',role:'user',blocks:[{type:'text',text:'Create two examples.'}]},
  {id:'initial',role:'assistant',blocks:[head,create('a.ts','one'),first,create('b.ts','draft')]},
  {id:'update',role:'assistant',blocks:[create('a.ts','one\ntwo'),second]},
  {id:'settled',role:'assistant',blocks:[finalA,finalB]},
  {id:'ask-again',role:'user',blocks:[{type:'text',text:'Create another example.'}]},
  {id:'more',role:'assistant',blocks:[create('c.ts','four'),command('one')]}
 ];
 const projected=canonicalCalls(messages);
 assert.deepEqual(projected.map(m=>m.id),messages.map(m=>m.id));
 assert.deepEqual(projected[1].blocks,[head,finalA,finalB,first]);
 assert.deepEqual(projected[2].blocks,[second]);
 assert.deepEqual(projected[3].blocks,[]);
 assert.deepEqual(projected[5].blocks,messages[5].blocks);
 assert.equal(messages[1].blocks.length,4);
 assert.deepEqual([...turnChanges(messages)].map(([key,value])=>[key,totals(value)]),[
  ['settled',{files:['a.ts','b.ts'],added:3,removed:0}],
  ['more',{files:['c.ts'],added:1,removed:0}]
 ]);
});
