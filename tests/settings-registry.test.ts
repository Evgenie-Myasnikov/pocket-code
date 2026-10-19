import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoriesFor,categoryIcon,groupedCategories,settingsCategories,settingsGroups} from '../src/settings-registry';
import {english} from '../src/translations';
import {clampBudget,parseBudget} from '../src/preferences';
import {limitLevel,durationLabel,narrowestWindow,usagePace,usageTone} from '../src/usage-format';
import type {CodexUsageSnapshot,CodexUsageWindow} from '../server/codex-usage';

test('settings registry: unique icons per platform and every section on both platforms or with a reason',()=>{
  for(const platform of ['phone','desktop'] as const){
    const icons=categoriesFor(platform).map(item=>categoryIcon(item,platform));
    assert.equal(new Set(icons).size,icons.length,`duplicate icon on ${platform}`);
  }
  for(const item of settingsCategories)assert.ok(item.platforms.length===2||item.reasonIfMissing,`${item.id} needs both platforms or a reason`);
  const keys=new Set(Object.keys(english).map(key=>key.trim()));
  for(const text of [...settingsGroups.map(group=>group.title),...settingsCategories.flatMap(item=>[item.title,item.hint,item.storage,item.reasonIfMissing,...Object.values(item.titles||{}),...Object.values(item.hints||{})])].filter((value):value is string=>!!value&&value!=='Pocket Code'&&value!=='Miro'&&value!=='Jira'))assert.ok(keys.has(text),`missing English for ${text}`);
});
test('settings registry keeps Connection first on the phone and drops empty groups',()=>{
  const phone=groupedCategories('phone',['jira']);
  assert.equal(phone[0].items[0].id,'connection');
  assert.ok(phone.every(group=>group.items.length));
  assert.ok(categoriesFor('desktop').some(item=>item.id==='notifications'),'desktop has notifications');
  assert.ok(!categoriesFor('desktop').some(item=>item.id==='jira'));
});
test('budget input is parsed and kept within the host range',()=>{
  assert.equal(parseBudget('0,5'),0.5);assert.equal(parseBudget(' $5 '),5);assert.equal(parseBudget('5s'),null);assert.equal(parseBudget('$ 20'),20);assert.equal(parseBudget(''),null);assert.equal(parseBudget('abc'),null);
  assert.equal(clampBudget(150),100);assert.equal(clampBudget(0),0.1);assert.equal(clampBudget(Number.NaN),5);assert.equal(clampBudget(undefined,7),7);assert.equal(clampBudget(2.345),2.35);
});
test('usage tone, relative duration and pace come only from provider windows',()=>{
  assert.equal(usageTone(9),'danger');assert.equal(usageTone(25),'warning');assert.equal(usageTone(26),'ok');
  assert.equal(durationLabel(108*60000),'1 h 48 min');assert.equal(durationLabel(30_000),'less than a minute');assert.equal(durationLabel((26*60+5)*60000),'1 d 2 h');
  const now=Date.UTC(2026,0,1,12),window:CodexUsageWindow={id:'primary',usedPercent:60,remainingPercent:40,windowDurationMins:300,resetsAt:(now+4*3600_000)/1000};
  const pace=usagePace(window,40,now)!;assert.ok(Math.abs(pace.elapsed-0.2)<1e-9);assert.equal(pace.ahead,true);assert.ok(pace.runsOutAt!>now&&pace.runsOutAt!<now+4*3600_000);
  assert.equal(usagePace({...window,windowDurationMins:null},40,now),null);
  assert.equal(usagePace({...window,remainingPercent:85,usedPercent:15},85,now)!.ahead,false);
  const snapshot={checkedAt:now,ordinaryUsageAllowed:null,buckets:[{id:'a',name:'A',windows:[window,{...window,id:'secondary',remainingPercent:12}]}]} satisfies CodexUsageSnapshot;
  assert.equal(narrowestWindow(snapshot,now)!.remaining,12);
  assert.equal(narrowestWindow({...snapshot,checkedAt:now-10*60_000},now),null,'stale reads are unavailable, not a value');
});
test('limit alerts follow the used share of the tightest window: 75, 90 and 100 percent',()=>{
  assert.equal(limitLevel(26),null);assert.equal(limitLevel(25),'75');assert.equal(limitLevel(10),'90');assert.equal(limitLevel(0.5),'90');assert.equal(limitLevel(0),'100');
});
