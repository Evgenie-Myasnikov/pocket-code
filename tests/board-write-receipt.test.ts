import {test} from 'node:test';
import assert from 'node:assert/strict';
import {latestBoardWrite} from '../src/board-write-receipt';
import type {BoardEditActivity} from '../server/board-live';
const event=(id:string,phase:BoardEditActivity['phase'],ids:string[],extra:Partial<BoardEditActivity>={}):BoardEditActivity=>({id,phase,ids,expiresAt:200,action:'update',...extra});
test('receipt uses only the latest saved operation, not coalesced read targets',()=>{
 const value=latestBoardWrite([event('write','saved',['changed','changed']),event('read','reading',['unrelated'])],new Set(),100);
 assert.deepEqual(value,{id:'write',ids:['changed'],action:'update'});
 assert.deepEqual(latestBoardWrite([event('first','saved',['a']),event('last','saved',['b'])],new Set(),100)?.ids,['b']);
});
test('expired, failed, in-progress, inspect and empty events never imply a saved write',()=>{
 const events=[event('old','saved',['a'],{expiresAt:100}),event('fail','failed',['b']),event('editing','editing',['c']),event('inspect','saved',['d'],{action:'inspect'}),event('empty','saved',[])];
 assert.equal(latestBoardWrite(events,new Set(),100),null);
});
test('dismissed repeated event IDs stay suppressed; connection targets remain affected objects',()=>{
 assert.equal(latestBoardWrite([event('seen','saved',['a'])],new Set(['seen']),100),null);
 assert.deepEqual(latestBoardWrite([event('connection','saved',['a','b'],{action:'connect'})],new Set(),100),{id:'connection',ids:['a','b'],action:'connect'});
});
