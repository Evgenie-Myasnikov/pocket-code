import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startVisiblePoll} from '../src/visible-poll';

class Visibility extends EventTarget {
  visibilityState:DocumentVisibilityState='visible';
  set(value:DocumentVisibilityState){this.visibilityState=value;this.dispatchEvent(new Event('visibilitychange'));}
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};

test('UI polls pause when hidden, resume immediately and never overlap',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  const source=new Visibility();let calls=0,resolve!:()=>void;
  const stop=startVisiblePoll(async()=>{calls++;await new Promise<void>(done=>{resolve=done;});},100,true,source);
  assert.equal(calls,1);
  source.set('hidden');context.mock.timers.tick(1000);source.set('visible');
  assert.equal(calls,1,'resume must not overlap the in-flight snapshot');
  resolve();await settle();source.set('hidden');context.mock.timers.tick(1000);assert.equal(calls,1);
  source.set('visible');assert.equal(calls,2,'resume reads latest state immediately');
  resolve();await settle();stop();context.mock.timers.tick(1000);source.set('visible');assert.equal(calls,2);
});

test('a completed poll removes resume listeners and stopped in-flight polls cannot restart',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  const source=new Visibility();let calls=0;
  const stop=startVisiblePoll(async()=>{calls++;return false;},100,false,source);
  assert.equal(calls,0);context.mock.timers.tick(100);await settle();assert.equal(calls,1);
  source.set('hidden');source.set('visible');context.mock.timers.tick(1000);assert.equal(calls,1);stop();
  let finish!:()=>void;
  const stopPending=startVisiblePoll(async()=>{calls++;await new Promise<void>(done=>finish=done);},100,true,source);
  stopPending();finish();await settle();context.mock.timers.tick(1000);assert.equal(calls,2);
});
