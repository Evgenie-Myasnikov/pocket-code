import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copilotUsage} from '../server/copilot-usage';
import {remainingUsage} from '../src/usage-summary';

const snapshot=(entitlement:number,used:number,extra:Record<string,unknown>={})=>({isUnlimitedEntitlement:false,entitlementRequests:entitlement,usedRequests:used,remainingPercentage:-1,usageAllowedWithExhaustedQuota:true,overageAllowedWithExhaustedQuota:false,overage:0,resetDate:'2026-11-01T00:00:00Z',...extra});

test('Copilot quota maps premium, chat and completion limits onto the shared usage format',()=>{
  const now=Date.parse('2026-10-15T00:00:00Z');
  const usage=copilotUsage({premium_interactions:snapshot(300,75),chat:snapshot(50,40),completions:snapshot(2000,1990)},now);
  assert.deepEqual(usage.buckets.map(bucket=>[bucket.id,bucket.windows[0].remainingPercent]),[['premium_interactions',75],['chat',20],['completions',0.5]]);
  assert.equal(usage.buckets[0].windows[0].resetsAt,Date.parse('2026-11-01T00:00:00Z')/1000);
  assert.equal(usage.ordinaryUsageAllowed,null);
  // The composer ring follows premium requests and chat, never editor completions.
  assert.equal(remainingUsage(usage,'copilot',['auto'],now),20);
});

test('unlimited Copilot entitlements stay usable and hide unlimited chat and completions',()=>{
  const now=Date.now(),unlimited={isUnlimitedEntitlement:true,entitlementRequests:-1,usedRequests:12,remainingPercentage:100};
  const usage=copilotUsage({premium_interactions:unlimited,chat:unlimited,completions:unlimited},now);
  assert.deepEqual(usage.buckets.map(bucket=>bucket.id),['premium_interactions']);
  assert.equal(remainingUsage(usage,'copilot',[],now),100);
});

test('an exhausted premium quota without overage blocks ordinary usage, and missing data stays empty',()=>{
  const usage=copilotUsage({premium_interactions:snapshot(300,300,{usageAllowedWithExhaustedQuota:false})},Date.now());
  assert.equal(usage.ordinaryUsageAllowed,false);assert.equal(usage.buckets[0].windows[0].remainingPercent,0);
  assert.deepEqual(copilotUsage(undefined,1).buckets,[]);
  assert.equal(copilotUsage({premium_interactions:{remainingPercentage:42}},1).buckets[0].windows[0].remainingPercent,42);
});
