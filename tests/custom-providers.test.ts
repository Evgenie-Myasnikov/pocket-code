import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CustomProviders,providerUrl,parseModelCatalog} from '../server/custom-providers.js';
test('custom providers validate URLs and use a real model catalog',async()=>{
 for(const url of ['http://example.com/v1','https://user:pass@example.com','https://example.com/?key=x','file:///etc/passwd'])assert.throws(()=>providerUrl(url));
 assert.equal(providerUrl('http://localhost:11434/v1/'),'http://localhost:11434/v1');assert.deepEqual(parseModelCatalog({data:[{id:'b'},{id:'a'},{id:'b'}]}),['a','b']);assert.throws(()=>parseModelCatalog({models:[]}));
 let stored:any={},calls:string[]=[];const service=new CustomProviders({load:async()=>stored,save:async value=>{stored=structuredClone(value);}},async(url,options)=>{calls.push(String(url));assert.equal(options?.redirect,'error');return Response.json(String(url).endsWith('/models')?{data:[{id:'actual-model'}]}:{choices:[{message:{content:'Synthetic reply'}}]});});
 const {id}=await service.save({name:'Example',url:'https://example.com/v1',key:'synthetic-test-key'});assert.equal('key' in (await service.list())[0],false);assert.deepEqual(await service.models(id),['actual-model']);await assert.rejects(service.chat(id,{model:'invented',text:'Hello'}),/catalog/);assert.equal((await service.chat(id,{model:'actual-model',text:'Hello'}))[1].content,'Synthetic reply');assert.equal((await service.history(id)).length,2);assert.ok(calls.includes('https://example.com/v1/chat/completions'));await service.remove(id);assert.deepEqual(await service.list(),[]);
});
test('provider errors never expose response bodies or credentials',async()=>{let stored:any={};const service=new CustomProviders({load:async()=>stored,save:async value=>{stored=value;}},async()=>new Response('secret upstream diagnostics',{status:401}));const {id}=await service.save({name:'Example',url:'https://example.com/v1',key:'synthetic'});await assert.rejects(service.models(id),e=>String(e).includes('401')&&!String(e).includes('secret'));});
test('provider accounts report key status and update in place without losing history',async()=>{
 let stored:any={},status=200;const service=new CustomProviders({load:async()=>stored,save:async value=>{stored=structuredClone(value);}},async(url,options)=>{const auth=(options?.headers as Record<string,string>)?.Authorization;if(String(url).endsWith('/models'))return status===200&&auth==='Bearer good-key'?Response.json({data:[{id:'m1'},{id:'m2'}]}):new Response('denied',{status:auth?status:401});return Response.json({choices:[{message:{content:'Synthetic reply'}}]});});
 const {id}=await service.save({name:'Example',url:'https://example.com/v1',key:''});
 assert.equal((await service.list(true))[0].status?.state,'no-key');
 await service.save({id,key:'bad-key'});status=401;assert.equal((await service.list(true))[0].status?.state,'unauthorized');
 status=200;await service.save({id,key:'good-key'});const ready=(await service.list(true))[0];assert.equal(ready.status?.state,'ready');assert.equal(ready.status?.models,2);assert.equal(ready.hasKey,true);assert.equal('key' in ready,false);
 await service.chat(id,{model:'m1',text:'Hello'});await service.save({id,name:'Renamed',url:'https://example.org/v1'});
 const renamed=(await service.list())[0];assert.equal(renamed.name,'Renamed');assert.equal(renamed.url,'https://example.org/v1');assert.equal(renamed.hasKey,true);assert.equal((await service.history(id)).length,2);
 await service.save({id,clearKey:true});assert.equal((await service.list())[0].hasKey,false);
 await assert.rejects(service.save({id,key:'x',clearKey:true}),/not both/);await assert.rejects(service.save({id:'00000000-0000-4000-8000-000000000000',name:'X'}),/not found/);await assert.rejects(service.save({name:'No URL'}),/required/);
 const offline=new CustomProviders({load:async()=>stored,save:async value=>{stored=value;}},async()=>{throw new TypeError('fetch failed');});assert.equal((await offline.list(true))[0].status?.state,'unreachable');
});
