import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoardMcpProxy} from '../scripts/board-mcp-proxy.mjs';

test('rotation drains the active write once and queues later calls for the fresh worker',async()=>{
 let finish,notifications=0;const started=[],closed=[],calls=[];
 const proxy=new BoardMcpProxy(async generation=>{started.push(generation);return {callTool:async input=>{calls.push([generation,input]);if(input==='write')await new Promise(resolve=>{finish=resolve;});return generation;},close:async()=>{closed.push(generation);}};},()=>notifications++);
 await proxy.refresh('first');const write=proxy.call('callTool','write');await Promise.resolve();
 const refresh=proxy.refresh('second'),queued=proxy.call('callTool','next');await Promise.resolve();assert.deepEqual(started,['first']);assert.deepEqual(closed,[]);
 finish();assert.equal(await write,'first');await refresh;assert.equal(await queued,'second');assert.deepEqual(calls,[['first','write'],['second','next']]);assert.deepEqual(closed,['first']);assert.equal(notifications,1);
 await proxy.refresh('second');assert.equal(started.length,2);await proxy.refresh('third');assert.equal(started.length,3);await proxy.close();assert.deepEqual(closed,['first','second','third']);
});

test('failed replacement preserves the old worker and retries discovery without replaying writes',async()=>{
 let fail=true,writes=0,notifications=0;
 const proxy=new BoardMcpProxy(async generation=>{if(generation==='new'&&fail)throw Error('Synthetic launch failure');return {callTool:async()=>{writes++;return generation;},close:async()=>{}};},()=>notifications++);
 await proxy.refresh('old');await assert.rejects(proxy.refresh('new'),/Synthetic/);assert.equal(await proxy.call('callTool',{}),'old');assert.equal(writes,1);assert.equal(notifications,0);
 fail=false;await proxy.refresh('new');assert.equal(await proxy.call('callTool',{}),'new');assert.equal(writes,2);assert.equal(notifications,1);await proxy.close();
});

test('closing a proxy waiting for an active operation does not launch another worker',async()=>{
 let finish;const started=[];const proxy=new BoardMcpProxy(async generation=>{started.push(generation);return {callTool:()=>new Promise(resolve=>{finish=resolve;}),close:async()=>{finish?.('closed');}};});
 await proxy.refresh('old');const call=proxy.call('callTool',{});await Promise.resolve();const refresh=proxy.refresh('new');await proxy.close();await refresh;await call;assert.deepEqual(started,['old']);
});
