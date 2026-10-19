import {test} from 'node:test';
import assert from 'node:assert/strict';

// Synthetic browser globals: an event target for window and an in-memory localStorage.
const events=new EventTarget();
Object.assign(globalThis,{window:events});
const data:Record<string,string>={};
let writes=0;
Object.defineProperty(globalThis,'localStorage',{value:new Proxy({getItem:(k:string)=>data[k]??null,setItem:(k:string,v:string)=>{writes++;data[k]=v;},removeItem:(k:string)=>{delete data[k];}},{ownKeys:()=>Object.keys(data),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})})});
const {backoff,proxyFailure,reportOk,reportFail,setPrimaryHost,getReachability,hostGate,resetReachability}=await import('../src/reachability');
const {startVisiblePoll}=await import('../src/visible-poll');
const {request}=await import('../src/api');
const {writeOffline,readOfflineEntry,clearOffline}=await import('../src/offline-data');
const host={url:'https://example.com',token:'synthetic-only'};

test('backoff grows to 30 s with bounded jitter and tunnel statuses count as unreachable',()=>{
  assert.equal(backoff(1,()=>0.5),1000);assert.equal(backoff(3,()=>0.5),4000);assert.equal(backoff(20,()=>0.5),30000);
  assert.ok(backoff(4,()=>0)>=6400&&backoff(4,()=>1)<=9600);
  for(const status of [502,503,504,520,530])assert.ok(proxyFailure(status),String(status));
  for(const status of [500,401,404,531])assert.ok(!proxyFailure(status),String(status));
});

test('one model: first failure connects, the next marks the PC unreachable, success sends one recovered event',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  resetReachability();let probes=0,recovered=0;const count=()=>recovered++;events.addEventListener('pocket-recovered',count);
  setPrimaryHost(host.url,async()=>{probes++;});
  reportFail('https://other.example',{cause:'network'});assert.equal(getReachability().status,'online','another host does not change the PC status');
  reportFail(host.url,{cause:'network'});assert.equal(getReachability().status,'connecting');
  reportFail(host.url,{cause:'tunnel',httpStatus:502});assert.equal(getReachability().status,'unreachable');assert.equal(getReachability().httpStatus,502);
  assert.equal(hostGate(host.url)(),false,'polls of the PC pause while it is away');assert.equal(hostGate('https://other.example')(),true);
  context.mock.timers.tick(5000);await Promise.resolve();assert.ok(probes>=1,'the supervisor probes with backoff');
  reportOk(host.url);reportOk(host.url);
  assert.equal(getReachability().status,'online');assert.equal(recovered,1);assert.equal(hostGate(host.url)(),true);
  events.removeEventListener('pocket-recovered',count);resetReachability();
});

test('a gated poll skips work while the PC is away and runs at once on recovery',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  resetReachability();setPrimaryHost(host.url,null);
  const source=Object.assign(new EventTarget(),{visibilityState:'visible' as DocumentVisibilityState});let calls=0;
  reportFail(host.url,{cause:'network'});reportFail(host.url,{cause:'network'});
  const stop=startVisiblePoll(async()=>{calls++;},10000,true,source,hostGate(host.url));
  await Promise.resolve();assert.equal(calls,0);
  reportOk(host.url);await Promise.resolve();await Promise.resolve();assert.equal(calls,1,'recovered runs the poll without waiting for its interval');
  stop();resetReachability();
});

test('a tunnel 502/530 for a cacheable read returns the saved copy; a host JSON error stays an error',async()=>{
  const original=globalThis.fetch;resetReachability();setPrimaryHost(host.url,null);
  try{
    globalThis.fetch=async()=>new Response(JSON.stringify({name:'Synthetic PC',roots:[],version:'0.0.0',protocol:1}),{status:200});
    await request(host,'/health');
    let offline=0;const mark=()=>offline++;events.addEventListener('pocket-offline-read',mark);
    globalThis.fetch=async()=>new Response('<html>Bad gateway</html>',{status:502});
    assert.equal((await request<{name:string}>(host,'/health')).name,'Synthetic PC');
    globalThis.fetch=async()=>new Response('<html>Origin error</html>',{status:530});
    assert.equal((await request<{name:string}>(host,'/health')).name,'Synthetic PC');
    assert.equal(offline,2);assert.notEqual(getReachability().status,'online');
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'Synthetic host failure'}),{status:503});
    await assert.rejects(request(host,'/health'),/Synthetic host failure/);
    assert.equal(getReachability().status,'online','a JSON answer proves the host is reachable');
    events.removeEventListener('pocket-offline-read',mark);
  }finally{globalThis.fetch=original;resetReachability();clearOffline();}
});

test('offline cache keeps its age, skips unchanged writes and evicts without parsing values',async()=>{
  clearOffline();
  await writeOffline(host,'/health',{name:'Synthetic PC'});
  const first=(await readOfflineEntry(host,'/health'))!.at;await new Promise(resolve=>setTimeout(resolve,5));
  const before=writes;await writeOffline(host,'/health',{name:'Synthetic PC'});
  const entry=await readOfflineEntry(host,'/health');assert.ok((entry?.at||0)>first,'the age is the last confirmation, not the last change');assert.deepEqual(entry?.value,{name:'Synthetic PC'});assert.ok((entry?.at||0)>0);
  assert.equal(writes-before,1,'an unchanged answer only refreshes the index');
  const parse=JSON.parse;let parsed=0;JSON.parse=((text:string,...rest:[])=>{parsed++;return parse(text,...rest);}) as typeof JSON.parse;
  try{for(let n=0;n<25;n++)await writeOffline(host,'/boards/'+n.toString(16).padStart(8,'0'),{id:n});}finally{JSON.parse=parse;}
  assert.ok(parsed<=1,'eviction reads only the index');
  assert.ok(Object.keys(data).filter(key=>key.startsWith('pocket-offline:')).length<=20);
  clearOffline();
});
