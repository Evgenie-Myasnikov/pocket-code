import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shareMessages,shareSnapshot} from '../src/chat-snapshot';

test('unchanged poll snapshots retain identities and changed branches stay current',()=>{
  const first={revision:1,messages:[{id:'m1',blocks:[{type:'text',text:'Saved text'}]}],partial:'hello'};
  assert.equal(shareSnapshot(first,JSON.parse(JSON.stringify(first))),first);
  const latest=shareSnapshot(first,{...JSON.parse(JSON.stringify(first)),revision:2,partial:'hello world'});
  assert.equal(latest.messages,first.messages);
  assert.equal(latest.messages[0].blocks,first.messages[0].blocks);
  assert.equal(latest.partial,'hello world');assert.equal(latest.revision,2);
  const changed=shareSnapshot(latest,{...latest,messages:[{id:'m1',blocks:[{type:'text',text:'Edited text'}]}]});
  assert.notEqual(changed.messages[0],first.messages[0]);assert.equal(changed.messages[0].blocks[0].text,'Edited text');
});

test('history prepends retain existing message references while removal and metadata changes survive',()=>{
  const messages=[{id:'b',blocks:[{type:'text',text:'B'}]},{id:'c',blocks:[{type:'text',text:'C'}]}];
  const cloned=JSON.parse(JSON.stringify(messages));assert.equal(shareMessages(messages,cloned),messages);
  const expanded=shareMessages(messages,[{id:'a',blocks:[]},...cloned]);
  assert.equal(expanded[1],messages[0]);assert.equal(expanded[2],messages[1]);
  const removed=shareMessages(expanded,[{id:'c',blocks:[{type:'text',text:'Updated C'}]}]);
  assert.equal(removed.length,1);assert.equal(removed[0].blocks[0].text,'Updated C');
  assert.deepEqual(shareSnapshot({extra:true,optional:undefined},{optional:undefined}),{optional:undefined});
});
