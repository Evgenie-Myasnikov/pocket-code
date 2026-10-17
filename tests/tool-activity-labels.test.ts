import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toolActivity} from '../src/tool-activity.js';
import {describeTool,stripAnsi} from '../src/tool-registry.js';
import {turnChanges} from '../src/turn-changes.js';
import type {ChatMessage} from '../server/types';
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
  {id:'a1',role:'assistant',blocks:[{type:'tool_use',id:'e1',name:'Write',input:{file_path:'new.ts',content:'a\nb'}}]},
  {id:'a2',role:'assistant',blocks:[{type:'text',text:'Done'}]},
  {id:'u2',role:'user',blocks:[{type:'text',text:'Next'}]},
  {id:'a3',role:'assistant',blocks:[{type:'tool_use',id:'e2',name:'Edit',input:{file_path:'x.ts',old_string:'a',new_string:'b'}}]},
 ];
 assert.deepEqual(turnChanges(messages,undefined,true).get('a2'),{files:['new.ts'],added:2,removed:0});
 assert.equal(turnChanges(messages,undefined,true).has('a3'),false);
 assert.deepEqual(turnChanges(messages).get('a3'),{files:['x.ts'],added:1,removed:1});
});
