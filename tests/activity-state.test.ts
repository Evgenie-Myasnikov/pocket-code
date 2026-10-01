import test from 'node:test';
import assert from 'node:assert/strict';
import type {ActivityItem} from '../server/types';
import {pruneSeen,rememberViewed,validActivity,visibleActivity} from '../src/activity-state';

const item=(id:string,status:ActivityItem['status']='done',provider:ActivityItem['provider']='codex',version='v1'):ActivityItem=>({id,provider,cwd:'C:\\Workspace\\activity-demo',title:id,status,startedAt:1,version});
test('viewing terminal work removes exactly that provider/id/version',()=>{
  const done=item('same-id'),other=item('same-id','done','claude');const seen=rememberViewed([],done,1);
  assert.deepEqual(visibleActivity([done,other],seen),[other]);
  assert.equal(visibleActivity([{...done,version:'v2'}],seen).length,1);
});
test('running and unanswered work remain visible and cannot be acknowledged',()=>{
  for(const status of ['running','needs_input'] as const){
    const active=item('active',status);assert.deepEqual(rememberViewed([],active),[]);
    const previouslyViewed=rememberViewed([],{...active,status:'done'});assert.deepEqual(visibleActivity([active],previouslyViewed),[active]);
  }
});
test('acknowledgements retain only safe fields and the newest 500 unique versions',()=>{
  const input=Array.from({length:510},(_,index)=>({...item(String(index)),viewedAt:index,token:'discard',title:'discard'}));
  const seen=pruneSeen([null,{id:3},...input,input[0]]);assert.equal(seen.length,500);assert.equal(seen[0].id,'509');assert.equal(seen.at(-1)?.id,'10');
  assert.deepEqual(Object.keys(seen[0]).sort(),['id','provider','version','viewedAt']);assert.deepEqual(pruneSeen({}),[]);
});
test('history is bounded and deduplicated without dropping active work',()=>{
  const completed=Array.from({length:510},(_,index)=>({...item(String(index)),startedAt:index}));
  const active=[item('running','running'),item('question','needs_input')];const visible=visibleActivity([...completed,...active,completed[0]],[]);
  assert.equal(visible.length,502);assert.equal(visible[0].id,'509');assert.ok(visible.some(value=>value.id==='running'));assert.ok(visible.some(value=>value.id==='question'));
});
test('activity validation rejects malformed responses instead of showing fake work',()=>{
  assert.equal(validActivity([item('a')]),true);assert.equal(validActivity([]),true);
  for(const value of [{items:[]},null,[{...item('a'),status:'unknown'}],[{...item('a'),provider:'other'}],[{...item('a'),startedAt:NaN}]])assert.equal(validActivity(value),false);
});
