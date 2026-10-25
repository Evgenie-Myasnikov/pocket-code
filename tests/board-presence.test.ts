import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {ToolListChangedNotificationSchema} from '@modelcontextprotocol/sdk/types.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';

test('real MCP edits wake two live viewers, support scoped reads and sparse patches, and retain unrelated data',async()=>{
 const temporary=await mkdtemp(path.join(tmpdir(),'board-presence-')),root=path.join(temporary,'project'),dataDir=path.join(temporary,'data'),token=randomUUID();
 await mkdir(path.join(root,'project-boards'),{recursive:true});await mkdir(dataDir);await writeFile(path.join(dataDir,'connection-key.txt'),token);
 const id=randomUUID(),file=`board-${randomUUID()}.json`,note={id,title:'Synthetic card',description:'Criteria',branch:'Next',status:'ready',priority:'high',x:20,y:40,dependencies:[]};
 const item={id,kind:'card',text:note.title,description:note.description,x:20,y:40,width:300,height:260,color:'mint'};
 await writeFile(path.join(root,'project-boards',file),JSON.stringify({format:'pocket-code-board',version:1,name:'Synthetic board',versions:['Next'],notes:[note],canvas:{version:1,items:[item],links:[]}}));
 const jobs=new Jobs(),{app,closeTaskServices}=await createApp({token,hostName:'Synthetic PC',roots:[root],uploads:path.join(dataDir,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const port=(server.address() as AddressInfo).port,base=`http://127.0.0.1:${port}/api`,headers={authorization:`Bearer ${token}`};
 const client=new Client({name:'synthetic-test',version:'1.0.0'});let catalogs=0;client.setNotificationHandler(ToolListChangedNotificationSchema,async()=>{catalogs++;});
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:['scripts/board-mcp.mjs','demo='+root],env:{...process.env,POCKET_PORT:String(port),POCKET_DATA_DIR:dataDir},stderr:'pipe'}));
  const invoke=async(name:string,args:Record<string,unknown>)=>{const result:any=await client.callTool({name,arguments:{project:'demo',...args}});assert.ok(!result.isError,JSON.stringify(result));return JSON.parse(result.content[0].text);};
  const lifecycle=base+'/project-board/mcp',opening=randomUUID();
  const enter=async(id=opening)=>{const r=await fetch(lifecycle,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({root,opening:id})});assert.equal(r.status,200);return r.json() as Promise<any>;};
  const firstEntry=await enter();assert.equal((await enter()).generation,firstEntry.generation);
  const waitCatalog=async(count:number)=>{const deadline=Date.now()+5000;while(catalogs<count&&Date.now()<deadline)await new Promise(r=>setTimeout(r,30));assert.equal(catalogs,count);};
  await waitCatalog(1);assert.ok((await client.listTools()).tools.some(t=>t.name==='canvas_patch'));
  assert.equal((await enter()).generation,firstEntry.generation);assert.equal((await invoke('read_board',{})).notes.length,1);
  assert.notEqual((await enter(randomUUID())).generation,firstEntry.generation);await waitCatalog(2);
  assert.equal((await fetch(lifecycle,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({root:temporary,opening:randomUUID()})})).status,403);
  const query=new URLSearchParams({root,file}),live=async()=>{const response=await fetch(base+'/project-board/live?'+query,{headers});assert.equal(response.status,200);return response.json() as Promise<any>;};
  const initial=await live(),before=await invoke('read_board',{});query.set('known',initial.version);query.set('after',initial.activityCursor);query.set('wait','1000');
  const viewers=[live(),live()];const edited=await invoke('canvas_patch',{revision:before.revision,items:[{id,x:1200,y:900}]});
  for(const viewer of await Promise.all(viewers)){assert.ok(viewer.activities.length);assert.equal(viewer.activities[0].phase,'editing');assert.equal(viewer.activities[0].action,'move');assert.deepEqual(viewer.activities[0].targets,[{id,x:1200,y:900,width:300,height:260}]);}
  const delivered=await live();assert.deepEqual(delivered.activities.map((v:any)=>v.phase),['editing','saved']);assert.equal(delivered.board.notes[0].x,1200);assert.equal(delivered.board.notes[0].priority,'high');assert.equal(edited.canvas.items[0].color,'mint');
  query.set('known',delivered.version);query.set('after',delivered.activityCursor);query.set('wait','0');
  const failed:any=await client.callTool({name:'canvas_patch',arguments:{project:'demo',revision:before.revision,items:[{id,text:'Stale'}]}});assert.ok(failed.isError);assert.equal((await live()).activities.length,0);
  const unknown:any=await client.callTool({name:'canvas_patch',arguments:{project:'demo',revision:edited.revision,items:[{id:randomUUID(),text:'Missing'}]}});assert.ok(unknown.isError);
  const focus=await invoke('focus_objects',{revision:edited.revision,ids:[id]});assert.equal(focus.activityDelivered,true);
  const inspect=await invoke('read_objects',{ids:[id]});assert.equal(inspect.notes[0].description,'Criteria');assert.equal(inspect.items[0].x,1200);assert.equal(inspect.revision,edited.revision);
  const overview=await invoke('board_overview',{});assert.equal(overview.notes,1);assert.equal(overview.objects,1);assert.equal(JSON.stringify(overview).includes('Criteria'),false);
  const reading=await live();assert.deepEqual(reading.activities.map((v:any)=>v.phase),['reading','reading']);assert.equal(reading.unchanged,true);
  const sticky={id:randomUUID(),kind:'sticky',text:'New object',x:1800,y:900,width:240,height:180,color:'sand'};
  await invoke('canvas_apply',{revision:edited.revision,items:[sticky],context:{summary:'Synthetic object',sources:['docs/BOARD-MCP.md']}});
  const created=await live();assert.equal(created.activity.action,'create');assert.equal(created.activity.targets[0].id,sticky.id);
  const current=await invoke('read_board',{}),link={id:randomUUID(),from:id,to:sticky.id,fromSide:'e',toSide:'w'};
  await invoke('canvas_apply',{revision:current.revision,items:[],links:[link]});const connected=await live();assert.equal(connected.activity.action,'connect');assert.deepEqual(new Set(connected.activity.ids),new Set([id,sticky.id]));
 }finally{await client.close();jobs.close();await new Promise<void>(r=>server.close(()=>r()));await closeTaskServices?.();await rm(temporary,{recursive:true,force:true});}
});
