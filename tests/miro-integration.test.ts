import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MiroIntegration,miroUpdate} from '../server/miro-integration';

const root='/synthetic/project',board='synthetic_board=';
function fixture(initial:any={}){
 let stored:any={projects:[],...initial},current:any={id:'1234',type:'sticky_note',data:{content:'<p>Original</p>'},modifiedAt:'2026-01-01T00:00:00Z'};
 const calls:{url:string;init:RequestInit}[]=[];
 const transport=async(url:any,init:RequestInit={})=>{calls.push({url:String(url),init});const p=new URL(String(url)).pathname;if(p==='/v1/oauth/token')return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:'boards:read boards:write'});if(init.method==='PATCH'){current={...current,data:JSON.parse(String(init.body)).data,modifiedAt:'2026-01-02T00:00:00Z'};return Response.json(current);}if(p.endsWith('/items'))return Response.json({data:[current],cursor:'next-page'});if(p.includes('/items/'))return Response.json(current);return Response.json({id:board});};
 const store={load:async()=>structuredClone(stored),save:async(value:any)=>{stored=structuredClone(value);}};
 return {service:new MiroIntegration(store,transport as typeof fetch),store,transport,calls,get stored(){return stored;},set current(value:any){current=value;}};
}
test('Miro access is opt-in, exact-project/exact-board scoped and credentials never appear in status',async()=>{
 const f=fixture();await f.service.setToken('synthetic-token',board);
 assert.equal((await f.service.status(root,board)).authenticated,true);
 assert.equal(JSON.stringify(await f.service.status(root,board)).includes('synthetic-token'),false);
 await assert.rejects(f.service.items(root,board),/Enable AI access/);
 await f.service.access(root,board,true,false);
 const page=await f.service.items(root,board,'next &? cursor');assert.equal(page.items[0].content,'<p>Original</p>');assert.equal(page.cursor,'next-page');
 assert.equal(new URL(f.calls.at(-1)!.url).searchParams.get('cursor'),'next &? cursor');
 await assert.rejects(f.service.items('/different/project',board),/Enable AI access/);
 await assert.rejects(f.service.items(root,'different_board'),/Enable AI access/);
 await assert.rejects(f.service.update(root,board,{root,itemId:'1234',revision:page.items[0].revision,content:'Changed'}),/Enable AI editing/);
 await f.service.disconnect();assert.equal((await f.service.status(root,board)).enabled,false);assert.equal(f.stored.accessToken,undefined);
});
test('Miro updates check revisions, escape plain text and never replay a stale edit',async()=>{
 const f=fixture();await f.service.setToken('synthetic-token',board);await f.service.access(root,board,true,true);const {items}=await f.service.items(root,board);
 const input={root,itemId:'1234',revision:items[0].revision,content:'New <script> &\nnext'};
 const result=await f.service.update(root,board,input);assert.equal(result.content,'<p>New &lt;script&gt; &amp;<br>next</p>');
 assert.equal(f.calls.find(c=>c.init.method==='PATCH')?.url,'https://api.miro.com/v2/boards/synthetic_board%3D/sticky_notes/1234');
 await assert.rejects(f.service.update(root,board,input),/changed/);assert.equal(f.calls.filter(c=>c.init.method==='PATCH').length,1);
 assert.equal(miroUpdate.safeParse({...input,itemId:'../evil'}).success,false);assert.equal(miroUpdate.safeParse({...input,url:'https://invalid.example'}).success,false);
});
test('Miro revision remains stable across JSON property order and rejects unsupported item types',async()=>{
 const f=fixture();await f.service.setToken('synthetic-token',board);await f.service.access(root,board,true,true);
 f.current={id:'1234',type:'card',data:{description:'Before',title:'Title'}};const first=await f.service.items(root,board);
 f.current={id:'1234',type:'card',data:{title:'Title',description:'Before'}};
 const result=await f.service.update(root,board,{root,itemId:'1234',revision:first.items[0].revision,title:'Next title',content:'Next content'});assert.equal(result.title,'Next title');
 for(const type of ['image','toString']){f.current={id:'1234',type,data:{}};const page=await f.service.items(root,board);assert.equal(page.items[0].editable,false);await assert.rejects(f.service.update(root,board,{root,itemId:'1234',revision:page.items[0].revision,content:'No'}),/Only sticky/);}
});
test('OAuth uses single-use expiring state, a loopback callback and sanitized token exchange',async()=>{
 const f=fixture();await f.service.configure('synthetic-client','synthetic-secret');
 await assert.rejects(f.service.start('https://invalid.example/miro/oauth/callback'),/Invalid Miro callback/);
 const login=await f.service.start('http://127.0.0.1:4318/miro/oauth/callback'),state=new URL(login.url).searchParams.get('state')!;
 assert.equal(new URL(login.url).origin,'https://miro.com');assert.equal(login.url.includes('synthetic-secret'),false);
 await assert.rejects(f.service.callback('wrong','synthetic-code'),/expired/);assert.equal(f.calls.length,0);
 await f.service.callback(state,'synthetic-code');assert.equal((await f.service.status()).authenticated,true);
 const call=f.calls[0];assert.equal(call.url,'https://api.miro.com/v1/oauth/token');assert.equal(call.init.redirect,'error');assert.equal(new URLSearchParams(String(call.init.body)).get('client_secret'),'synthetic-secret');
 await assert.rejects(f.service.callback(state,'synthetic-code'),/expired/);assert.equal(f.calls.length,1);
 let now=1000;const expired=new MiroIntegration(f.store,f.transport as typeof fetch,()=>now);const second=await expired.start('http://127.0.0.1:4318/miro/oauth/callback');now+=600001;
 await assert.rejects(expired.callback(new URL(second.url).searchParams.get('state')!,'synthetic-code'),/expired/);
});
test('OAuth refresh coalesces and a disconnect prevents late token resurrection',async()=>{
 const f=fixture({clientId:'synthetic-client',clientSecret:'synthetic-secret',accessToken:'synthetic-old',refreshToken:'synthetic-refresh',expiresAt:1,projects:[{root,boardId:board,enabled:true,allowWrite:false}]});
 await Promise.all([f.service.items(root,board),f.service.items(root,board)]);assert.equal(f.calls.filter(c=>c.url.endsWith('/oauth/token')).length,1);
 let finish!:(value:Response)=>void;const slow=new MiroIntegration(f.store,(async()=>await new Promise<Response>(resolve=>{finish=resolve;})) as typeof fetch);
 const login=await slow.start('http://127.0.0.1:4318/miro/oauth/callback'),pending=slow.callback(new URL(login.url).searchParams.get('state')!,'synthetic-code');
 await new Promise(resolve=>setImmediate(resolve));await slow.disconnect();finish(Response.json({access_token:'late-token'}));await assert.rejects(pending,/changed/);assert.equal((await slow.status()).authenticated,false);
});
test('Remote failures never expose response secrets and writes are not automatically retried',async()=>{
 let patches=0;const f=fixture({accessToken:'synthetic-access',projects:[{root,boardId:board,enabled:true,allowWrite:true}]});
 const service=new MiroIntegration(f.store,(async(url,init)=>{if(init?.method==='PATCH'){patches++;return new Response('private remote response synthetic-token',{status:500});}return f.transport(url,init);}) as typeof fetch);
 const {items}=await service.items(root,board);await assert.rejects(service.update(root,board,{root,itemId:'1234',revision:items[0].revision,content:'Next'}),error=>error instanceof Error&&!error.message.includes('synthetic-token')&&error.message.includes('Refresh'));assert.equal(patches,1);
});
