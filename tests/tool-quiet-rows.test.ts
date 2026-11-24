import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceTool,trivialResult} from '../src/tool-registry';
import {visibleMessageBlocks} from '../src/activity-groups';

const result=(text:string,is_error=false)=>({type:'tool_result',tool_use_id:'x',content:[{type:'text',text}],is_error}) as never;

test('a result that only confirms success is trivial; output, errors and long text are not',()=>{
  assert.equal(trivialResult(result('File created successfully at: C:\\Demo\\notes.md')),true);
  assert.equal(trivialResult(result('The file C:\\Demo\\app.ts has been updated successfully.')),true);
  assert.equal(trivialResult(result('ok')),true);
  assert.equal(trivialResult(result('File created successfully at: C:\\Demo\\notes.md',true)),false);
  assert.equal(trivialResult(result('3 tests passed\n1 failed')),false);
  assert.equal(trivialResult(result('Build finished with 2 warnings')),false);
  assert.equal(trivialResult(undefined),false);
});

test("the host application's own bookkeeping tools are not shown as work",()=>{
  assert.equal(serviceTool('mcp__ccd_turn__wrap_up'),true);
  assert.equal(serviceTool('mcp__ccd_turn__update_plan'),true);
  assert.equal(serviceTool('mcp__pocket_board__canvas_apply'),false);
  assert.equal(serviceTool('Write'),false);
  const message={id:'m',role:'assistant',blocks:[
    {type:'tool_use',id:'a',name:'mcp__ccd_turn__wrap_up',input:{recap:'Done'}},
    {type:'tool_result',tool_use_id:'a',content:'ok'},
    {type:'tool_use',id:'b',name:'Write',input:{file_path:'notes.md',content:'x'}},
  ]} as never;
  const results=new Map([['a',{type:'tool_result',tool_use_id:'a',content:'ok'}]]) as never;
  assert.deepEqual(visibleMessageBlocks(message,results).map(item=>(item.block as {name?:string}).name),['Write']);
});
