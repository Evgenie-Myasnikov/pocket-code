import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {SessionGeneration} from '../server/session-generation';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import type {JobView} from '../server/types';

test('persist last-reply metrics across restart, isolate provider and account and discard late older runs',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'metrics-store-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new SessionGeneration(dir),id=randomUUID(),account=randomUUID();
  const job={provider:'claude',sessionId:id,account,startedAt:10,generation:{outputTokens:480,outputTokensPerSecond:60}} as JobView;
  await store.record(job);
  await store.record({...job,startedAt:2,generation:{outputTokens:1}});
  const reopened=new SessionGeneration(dir);
  assert.deepEqual(await reopened.get('claude',id,account),job.generation);
  assert.equal(await reopened.get('claude',id),undefined);
  assert.equal(await reopened.get('codex',id,account),undefined);
  await reopened.record({...job,startedAt:12,generation:undefined});
  assert.equal(await reopened.get('claude',id,account),undefined);
  await Promise.all([store.record({...job,startedAt:15}),store.forget('claude',id)]);
  assert.equal(await reopened.get('claude',id,account),undefined);
});

test('saved measurements are returned only for a visible chat in the requested provider',async t=>{
  const dir=await mkdtemp(path.join(tmpdir(),'metrics-endpoint-')),id=randomUUID(),token='generation-fixture-'.repeat(3),jobs=new Jobs();
  const {app,closeTaskServices}=await createApp({hostName:'Demo',roots:[dir],token,uploads:dir,desktopSessionIndexes:[]},jobs,{
    listSessions:async()=>[{sessionId:id,cwd:dir,summary:'Demo',lastModified:1}],getSessionMessages:async()=>[]
  });
  const http=app.listen(0,'127.0.0.1');await new Promise<void>(r=>http.once('listening',r));
  t.after(async()=>{await closeTaskServices();await new Promise<void>(r=>http.close(()=>r()));await rm(dir,{recursive:true,force:true});});
  const address=http.address();assert.ok(address&&typeof address==='object');
  const get=(session:string,auth=token)=>fetch('http://127.0.0.1:'+address.port+'/api/sessions/'+session+'/generation?provider=claude',{headers:{Authorization:'Bearer '+auth}});
  jobs.recordGeneration?.({provider:'claude',sessionId:id,startedAt:1,generation:{outputTokens:55}} as JobView);
  assert.deepEqual(await (await get(id)).json(),{generation:{outputTokens:55}});
  assert.equal((await get(randomUUID())).status,404);
  assert.equal((await get(id,'incorrect')).status,401);
});
