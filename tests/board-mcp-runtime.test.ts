import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {BoardMcpRuntime} from '../server/board-mcp-runtime';

test('each board entry rotates a project generation, duplicate requests and unrelated projects do not',()=>{
 const runtime=new BoardMcpRuntime(path.resolve('synthetic-data'),4321),a=path.resolve('synthetic-a'),b=path.resolve('synthetic-b');
 const initial=runtime.read(a).generation,other=runtime.read(b).generation;
 assert.deepEqual(runtime.configuration(a),{});
 const first=runtime.open(a,'one');assert.notEqual(first.generation,initial);assert.equal(runtime.open(a,'one').generation,first.generation);assert.equal(runtime.read(b).generation,other);
 const next=runtime.open(a,'two');assert.notEqual(next.generation,first.generation);assert.equal(runtime.open(a,'one').generation,next.generation);
 const server=runtime.configuration(a)['pocket-code-boards'];assert.equal(server.command,process.execPath);assert.equal(server.args[1],`project=${a}`);assert.ok(path.isAbsolute(server.args[0]));assert.equal(server.env.POCKET_PORT,'4321');assert.deepEqual(runtime.configuration(b),{});
});

test('runtime reports the actual worker catalog and requests client refresh only for new openings',()=>{
 const entries:string[]=[],root=path.resolve('synthetic-runtime'),other=path.resolve('other-runtime'),runtime=new BoardMcpRuntime(path.resolve('synthetic-data'),4321,r=>entries.push(r));
 assert.equal(runtime.status(root).state,'waiting');const first=runtime.open(root,'one');runtime.open(root,'one');assert.deepEqual(entries,[root]);
 runtime.report(root,'worker',first.generation,'ready',['read_board','control_view']);assert.deepEqual(runtime.status(root),{state:'ready',connections:1,tools:['control_view','read_board']});assert.equal(runtime.status(other).state,'waiting');
 const second=runtime.open(root,'two');assert.equal(runtime.status(root).state,'restarting');runtime.report(root,'worker',second.generation,'error',[]);assert.equal(runtime.status(root).state,'error');runtime.report(root,'worker',second.generation,'ready',['read_board']);assert.equal(runtime.status(root).state,'ready');
});
