import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EngineUpdates,pocketSource,compatibilityPrompt} from '../server/engine-updates.js';
async function fixture(t:any){const root=await mkdtemp(path.join(tmpdir(),'engine-updates-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,file:path.join(root,'state.json')};}
test('version baseline, duplicate polls and restarts never repeat a compatibility task',async t=>{
 const {file}=await fixture(t);let versions={codex:'1.0.0',claude:'2.0.0'};const monitor=new EngineUpdates(file,async()=>versions);
 await monitor.check();assert.equal((await monitor.status()).changes.length,0);
 versions={codex:'1.1.0',claude:'2.0.0'};await Promise.all([monitor.check(),monitor.check()]);let count=0;
 await Promise.all([monitor.dispatch(async task=>{count++;assert.equal(task.provider,'codex');assert.match(task.prompt,/1.0.0 -> 1.1.0/);}),monitor.dispatch(async()=>{count++;})]);assert.equal(count,1);
 const restored=new EngineUpdates(file,async()=>versions);await restored.check();await restored.dispatch(async()=>{count++;});assert.equal(count,1);assert.equal((await restored.status()).changes[0].state,'started');
});
test('disabled tasks wait, use the current provider, and failed launches do not loop',async t=>{
 const {file}=await fixture(t);let version='1.0.0';const monitor=new EngineUpdates(file,async()=>({codex:version}));await monitor.check();await monitor.configure(false,'claude');version='1.1.0';await monitor.check();let count=0;
 await monitor.dispatch(async()=>{count++;});assert.equal(count,0);await monitor.configure(true,'claude');
 await monitor.dispatch(async task=>{count++;assert.equal(task.provider,'claude');throw Error('offline');});await monitor.dispatch(async()=>{count++;});assert.equal(count,1);assert.equal((await monitor.status()).changes[0].state,'failed');
});
test('unavailable probes retain known versions and a later installation establishes its own baseline',async t=>{
 const {file}=await fixture(t);let values:Record<string,string>={codex:'1.0.0'};const monitor=new EngineUpdates(file,async()=>values);await monitor.check();values={};await monitor.check();values={codex:'1.0.0',claude:'2.0.0'};await monitor.check();assert.equal((await monitor.status()).changes.length,0);
});
test('source discovery excludes a deployed bundle and unrelated shared projects',async t=>{
 const {root}=await fixture(t);await writeFile(path.join(root,'package.json'),JSON.stringify({name:'pocket-code'}));assert.equal(await pocketSource([root]),undefined);
 await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'src'));await writeFile(path.join(root,'scripts/build-android.ps1'),'');await writeFile(path.join(root,'src/App.tsx'),'');assert.equal(await pocketSource([root]),root);
 assert.match(compatibilityPrompt([]),/official vendor/);assert.match(compatibilityPrompt([]),/Do not stop active servers/);
});
