import assert from 'node:assert/strict';
import {test} from 'node:test';
import {CustomProviders} from '../server/custom-providers.js';

const first='5fe92c52-a867-410b-b250-fce55fb24966';
const second='386fe249-f0f8-4b16-8086-1aa3cd4b12df';
const secret='synthetic-test-credential';
const model='local/editor-v2';
const profile={name:'Example',url:'https://example.invalid/v1',key:secret,id:first,
  messages:[{role:'user',content:'Text from an unrelated conversation'}]};
const catalog=()=>Response.json({data:[{id:model}]});
const completion=(content:string)=>Response.json({choices:[{message:{content}}]});
function fixture(send:typeof fetch,profiles=[profile]){
  return new CustomProviders({load:async()=>({profiles}),save:async()=>assert.fail('Task editing must not change provider history')},send);
}
const run=(service:CustomProviders,id=first,selectedModel=model,signal=new AbortController().signal)=>
  service.generateTaskText(id,selectedModel,'Write one task title.','Draft a catalog entry.',signal);

test('custom task text uses the selected account ID and real catalog without sending tools or chat history',async()=>{
  const requests:string[]=[];
  const both=[profile,{...profile,id:second,url:'https://other.invalid/v1',key:'second-example-key'}];
  const service=fixture(async(url,init)=>{
    requests.push(String(url));
    assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer second-example-key');
    assert.equal(init?.redirect,'error');
    if(String(url).endsWith('/models'))return catalog();
    assert.deepEqual(JSON.parse(String(init?.body)),{model,messages:[
      {role:'system',content:'Write one task title.'},{role:'user',content:'Draft a catalog entry.'}
    ],stream:false});
    return completion('  Create the catalog entry  ');
  },both);
  assert.equal(await run(service,second),'Create the catalog entry');
  assert.deepEqual(requests,['https://other.invalid/v1/models','https://other.invalid/v1/chat/completions']);
});

test('missing, keyless and stale custom selections cannot dispatch a completion',async()=>{
  let reads=0;
  const service=fixture(async url=>{assert.ok(String(url).endsWith('/models'));reads++;return catalog();},
    [profile,{...profile,id:second,key:''}]);
  await assert.rejects(run(service,'missing'),/Provider not found/);
  await assert.rejects(run(service,second),/API key/);
  assert.equal(reads,0);
  await assert.rejects(run(service,first,'removed-model'),/catalog/);
  assert.equal(reads,1);
});

test('custom suggestions reject nontext, tool, oversized and credential-bearing replies',async()=>{
  for(const reply of [
    {content:[]},{content:' '},{content:'x'.repeat(100001)},{content:'prefix '+secret},
    {content:'draft',tool_calls:[{type:'function'}]},{content:'draft',function_call:{name:'write'}}
  ]){
    const service=fixture(async url=>String(url).endsWith('/models')?catalog():Response.json({choices:[{message:reply}]}));
    await assert.rejects(run(service),error=>/Provider returned/.test(String(error))&&!String(error).includes(secret));
  }
});

test('provider status and broken streams produce bounded errors without upstream details',async()=>{
  const stream=()=>new Response(new ReadableStream({start(controller){controller.error(new Error(secret));}}));
  for(const response of [()=>new Response(secret,{status:401}),stream,()=>new Response('x'.repeat(2000001))]){
    const service=fixture(async url=>String(url).endsWith('/models')?catalog():response());
    await assert.rejects(run(service),error=>!String(error).includes(secret)&&String(error).length<200);
  }
});

test('disconnect cancels the active custom request during either catalog or generation',async()=>{
  for(const stage of ['models','chat/completions']){
    const controller=new AbortController();
    let started!:()=>void;
    const waiting=new Promise<void>(resolve=>{started=resolve;});
    const requests:string[]=[];
    const service=fixture(async(url,init)=>{
      requests.push(String(url));
      if(!String(url).endsWith(stage))return catalog();
      return new Promise<Response>((_,reject)=>{
        init?.signal?.addEventListener('abort',()=>reject(new Error(secret)),{once:true});
        started();
      });
    });
    const suggestion=run(service,first,model,controller.signal);
    await waiting;controller.abort();
    await assert.rejects(suggestion,/did not finish in time/);
    assert.equal(requests.length,stage==='models'?1:2);
  }
});
