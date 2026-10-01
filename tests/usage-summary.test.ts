import {test} from 'node:test';
import assert from 'node:assert/strict';
import {remainingUsage} from '../src/usage-summary';
import type {CodexUsageSnapshot} from '../server/codex-usage';
const now=1_800_000_000_000;
const bucket=(name:string,values:(number|null)[])=>({id:name,name,windows:values.map((remainingPercent,index)=>({id:index?'secondary' as const:'primary' as const,usedPercent:null,remainingPercent,windowDurationMins:index?10080:300,resetsAt:null}))});
const snapshot=(...buckets:CodexUsageSnapshot['buckets']):CodexUsageSnapshot=>({checkedAt:now,ordinaryUsageAllowed:null,buckets});
test('compact allowance reflects the limiting shared or selected-model window',()=>{
  assert.equal(remainingUsage(snapshot(bucket('Codex',[73,39]),bucket('Other model',[1])), 'codex',['gpt-test'],now),39);
  assert.equal(remainingUsage(snapshot(bucket('Claude',[80,60]),bucket('Sonnet',[42]),bucket('Opus',[3])), 'claude',['claude-sonnet-test'],now),42);
  assert.equal(remainingUsage(snapshot(bucket('GPT Test',[27])), 'codex',['gpt-test'],now),27);
});
test('missing, expired, stale and ambiguous quotas never become a full allowance',()=>{
  assert.equal(remainingUsage(null,'codex',[],now),null);
  assert.equal(remainingUsage(snapshot(bucket('Codex',[null,null])),'codex',[],now),null);
  assert.equal(remainingUsage(snapshot(bucket('Other',[50])),'codex',[],now),null);
  const stale=snapshot(bucket('Codex',[80]));stale.checkedAt=now-120001;
  assert.equal(remainingUsage(stale,'codex',[],now),null);
  const expired=snapshot(bucket('Codex',[0,50]));expired.buckets[0].windows[0].resetsAt=now/1000;
  assert.equal(remainingUsage(expired,'codex',[],now),null);
  assert.equal(remainingUsage({...snapshot(),ordinaryUsageAllowed:false},'codex',[],now),0);
  assert.equal(remainingUsage(snapshot(bucket('Codex',[NaN])),'codex',[],now),null);
});
