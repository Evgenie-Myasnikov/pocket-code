import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
import {plainText,previewFromMessages,SessionPreviews} from '../server/session-previews.js';
import type {ChatMessage} from '../server/types.js';

// Synthetic transcripts only. A 1×1 PNG stands in for every image.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==','base64');

test('preview text is plain, trimmed and cut at a word boundary',()=>{
  assert.equal(plainText('# Result\n\n**Done**: see [the guide](https://example.com/guide) and `npm test`.\n\n```ts\nconst hidden=1;\n```\n\n- first item\n- second item\n\n![shot](C:/x/shot.png)'),'Result Done: see the guide and npm test. first item second item');
  assert.equal(plainText('| a | b |\n|---|---|\n| 1 | 2 |'),'a b 1 2');
  const long=plainText('word '.repeat(200));
  assert.ok(long.length<=401);assert.ok(long.endsWith('…'));assert.doesNotMatch(long,/wor…$/);
});

test('the latest assistant reply and the latest local or inline image are chosen; remote images are not',()=>{
  const messages:ChatMessage[]=[
    {id:'1',role:'user',blocks:[{type:'text',text:'Draw it'}]},
    {id:'2',role:'assistant',blocks:[{type:'text',text:'Older reply'}]},
    {id:'3',role:'assistant',blocks:[{type:'tool_use',id:'t',name:'Read',input:{}},{type:'tool_result',tool_use_id:'t',content:[{type:'image',source:{type:'base64',media_type:'image/png',data:png.toString('base64')}}]} as any]},
    {id:'4',role:'assistant',blocks:[{type:'text',text:'Newest **reply** ![remote](https://example.com/remote.png)'}]},
    {id:'5',role:'assistant',blocks:[{type:'tool_use',id:'u',name:'Bash',input:{}}]},
  ];
  const preview=previewFromMessages(messages);
  assert.equal(preview.text,'Newest reply');
  assert.deepEqual(preview.image,{name:'Image',inline:true});assert.equal(preview.data?.mimeType,'image/png');
  const local=previewFromMessages([...messages,{id:'6',role:'assistant',blocks:[{type:'text',text:'Saved ![chart](charts/result.png)'}]}]);
  assert.deepEqual(local.image,{name:'chart',path:'charts/result.png'});assert.equal(local.text,'Saved');
  assert.deepEqual(previewFromMessages([{id:'1',role:'user',blocks:[{type:'text',text:'Only a question'}]}]),{text:'',image:null});
});

test('the cache keys on lastModified, shares in-flight reads and bounds concurrency',async()=>{
  const cache=new SessionPreviews({capacity:2,concurrency:1});let reads=0,active=0,peak=0;
  const read=(text:string)=>async()=>{reads++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return [{id:text,role:'assistant' as const,blocks:[{type:'text',text}]}];};
  const [a,b]=await Promise.all([cache.get('claude','s1',1,read('one')),cache.get('claude','s1',1,read('one'))]);
  assert.equal(a,b);assert.equal(reads,1);
  await Promise.all([cache.get('claude','s2',1,read('two')),cache.get('claude','s3',1,read('three'))]);
  assert.equal(peak,1);assert.equal(cache.size,2);
  assert.equal((await cache.get('claude','s3',2,read('three, updated'))).text,'three, updated');assert.equal(cache.size,2);
});

test('preview endpoints return text and image names, serve thumbnails through access checks and never leak other folders',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'pocket-previews-'));
  const root=path.join(temporary,'project'),outside=path.join(temporary,'outside'),uploads=path.join(temporary,'uploads');
  await mkdir(path.join(root,'charts'),{recursive:true});await mkdir(outside);await writeFile(path.join(root,'charts','result.png'),png);await writeFile(path.join(outside,'secret.png'),png);
  const withImage=randomUUID(),textOnly=randomUUID(),escaping=randomUUID(),hidden=randomUUID(),token='p'.repeat(43);let reads=0;
  const transcripts:Record<string,any[]>={
    [withImage]:[{type:'user',uuid:'u1',message:{content:'Make a chart'}},{type:'assistant',uuid:'a1',message:{content:[{type:'text',text:'Here is the **chart**:\n\n![Result chart](charts/result.png)'}]}}],
    [textOnly]:[{type:'user',uuid:'u2',message:{content:'Explain'}},{type:'assistant',uuid:'a2',message:{content:[{type:'text',text:'A plain synthetic answer.'}]}}],
    [escaping]:[{type:'assistant',uuid:'a3',message:{content:[{type:'text',text:'![x](../outside/secret.png)'}]}}],
    [hidden]:[{type:'assistant',uuid:'a4',message:{content:[{type:'text',text:'Hidden'}]}}],
  };
  const sdk:any={
    listSessions:async()=>[{sessionId:withImage,summary:'Chart',cwd:root,lastModified:1000},{sessionId:textOnly,summary:'Text',cwd:root,lastModified:2000},{sessionId:escaping,summary:'Escape',cwd:root,lastModified:3000},{sessionId:hidden,summary:'Hidden',cwd:outside,lastModified:4000}],
    getSessionMessages:async(id:string)=>{reads++;return transcripts[id]||[];},
  };
  const jobs=new Jobs((()=>{throw Error('no runs');}) as any);
  const {app,closeTaskServices}=await createApp({desktopSessionIndexes:[],roots:[root],token,hostName:'Synthetic PC',uploads},jobs,sdk);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,headers={authorization:`Bearer ${token}`};
  const get=async(url:string)=>{const response=await fetch(base+url,{headers});return {status:response.status,body:await response.json() as any};};
  try{
    assert.equal((await fetch(`${base}/sessions/previews?ids=${withImage}`)).status,401);
    const {status,body}=await get(`/sessions/previews?provider=claude&ids=${[withImage,textOnly,escaping,hidden,randomUUID()].join(',')}`);
    assert.equal(status,200);
    const byId=Object.fromEntries(body.previews.map((p:any)=>[p.sessionId,p]));
    assert.deepEqual(byId[withImage],{sessionId:withImage,lastModified:1000,text:'Here is the chart:',image:{name:'Result chart'}});
    assert.deepEqual(byId[textOnly],{sessionId:textOnly,lastModified:2000,text:'A plain synthetic answer.',image:null});
    assert.equal(byId[hidden].error,true);assert.equal(Object.values(byId).filter((p:any)=>p.error).length,2);
    assert.doesNotMatch(JSON.stringify(body),/base64|iVBOR|charts\/result/);
    const before=reads;await get(`/sessions/previews?provider=claude&ids=${withImage},${textOnly}`);assert.equal(reads,before,'cached per session version');
    const image=await get(`/sessions/${withImage}/preview-image?provider=claude`);
    assert.equal(image.status,200);assert.equal(image.body.mimeType,'image/png');assert.equal(image.body.data,png.toString('base64'));
    assert.equal((await get(`/sessions/${textOnly}/preview-image?provider=claude`)).status,404);
    assert.equal((await get(`/sessions/${escaping}/preview-image?provider=claude`)).status,403);
    assert.equal((await get(`/sessions/${hidden}/preview-image?provider=claude`)).status,404);
    assert.equal((await get(`/sessions/previews?provider=claude&ids=not-a-uuid`)).status,400);
  }finally{jobs.close();await new Promise<void>(r=>server.close(()=>r()));await closeTaskServices?.();await rm(temporary,{recursive:true,force:true});}
});
