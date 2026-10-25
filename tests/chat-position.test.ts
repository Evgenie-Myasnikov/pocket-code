import {test} from 'node:test';
import assert from 'node:assert/strict';
import {savePosition,readPosition,positionOnOpen,markRunningOnLeave,positionKey,flushPositions} from '../src/chat-position';
test('working chat departure resumes latest messages once; idle chat retains its anchor and scope',()=>{
 const a=positionKey('pc-one','codex','alpha'),b=positionKey('pc-two','codex','alpha');
 const anchor={top:220,window:400,fromStart:true,bottom:false,messageId:'earlier',offset:15};savePosition(a,anchor);savePosition(b,anchor);
 markRunningOnLeave(a,true);assert.equal(readPosition(a)?.followOnReturn,true);
 assert.deepEqual(positionOnOpen(a),{top:0,window:100,fromStart:false,bottom:true});assert.equal(readPosition(a)?.followOnReturn,undefined);assert.deepEqual(positionOnOpen(b),anchor);
 savePosition(a,anchor);markRunningOnLeave(a,false);assert.deepEqual(positionOnOpen(a),{...anchor,followOnReturn:false});flushPositions();
});

test('a currently running chat overrides a stored history anchor on every open',()=>{
 const key=positionKey('synthetic-live-host','claude','live');savePosition(key,{top:1800,window:700,fromStart:true,bottom:false,messageId:'old'});assert.deepEqual(positionOnOpen(key,true),{top:0,window:100,fromStart:false,bottom:true});
});
