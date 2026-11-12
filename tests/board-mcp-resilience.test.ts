import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
import {boardSnapshot,historyPath,BOARD_LIMITS} from '../src/board-contract.js';
import {file,paragraph,longText,brokenBoard} from './board-broken-fixture';

/** Real host, real MCP worker over stdio, a synthetic repository board. */
async function setup(board:unknown){
 const temp=await mkdtemp(path.join(os.tmpdir(),'board-mcp-real-')),root=path.join(temp,'project'),data=path.join(temp,'data'),token=randomUUID();
 await mkdir(path.join(root,'project-boards'),{recursive:true});await mkdir(data);await writeFile(path.join(data,'connection-key.txt'),token);await writeFile(path.join(root,'project-boards',file),JSON.stringify(board,null,2));
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads:path.join(data,'uploads'),desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const client=new Client({name:'synthetic-resilience',version:'1'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:['scripts/board-mcp.mjs','demo='+root],env:{...process.env,POCKET_DATA_DIR:data,POCKET_PORT:String((server.address() as AddressInfo).port)} as Record<string,string>,stderr:'pipe'}));
 const invoke=async(name:string,args:Record<string,unknown>={})=>{const result:any=await client.callTool({name,arguments:{project:'demo',...args}});const text=result.content[0].text as string;let value:any;try{value=JSON.parse(text);}catch{value={text};}return {error:!!result.isError,value,size:text.length};};
 const close=async()=>{await client.close();jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});};
 return {root,invoke,close,stored:async()=>JSON.parse(await readFile(path.join(root,'project-boards',file),'utf8'))};
}

test('MCP reads a damaged board, explains the refused write and repairs it without losing text',async()=>{
 const {ids,board}=brokenBoard(),{root,invoke,close,stored}=await setup(board);
 try{
  const overview=(await invoke('board_overview')).value;assert.equal(overview.health.errors,3);assert.equal(overview.notes,4);
  const health=(await invoke('board_health')).value;
  assert.deepEqual(health.issues.filter((issue:any)=>issue.severity==='error').map((issue:any)=>[issue.id,issue.field,issue.limit]),[[ids.long,'description',20000],[ids.caption,'image caption',160],[ids.priority,'priority',undefined]]);assert.equal(health.limits.description,20000);
  const read=(await invoke('read_objects',{ids:[ids.long]})).value;assert.equal(read.notes[0].description,longText);
  const refused=await invoke('update_note',{revision:overview.revision,id:ids.good,patch:{title:'Edited while damaged'}});
  assert.equal(refused.error,true);assert.equal(refused.value.error.code,'board_needs_repair');assert.match(refused.value.error.message,/Card "Long history" \([0-9a-f]{8}\): description is [\d,]+ characters; the limit is 20,000/);assert.match(refused.value.error.message,/priority "medium" is not allowed/);assert.match(refused.value.error.hint,/repair_board/);
  assert.equal((await stored()).notes[0].title,'Healthy card');
  const repaired=(await invoke('repair_board',{revision:overview.revision})).value;assert.equal(repaired.fixed,3);assert.equal(repaired.health.errors,0);
  boardSnapshot.parse(await stored());assert.ok((await readFile(path.join(root,historyPath(ids.long)),'utf8')).includes(paragraph(20)));
  const edited=await invoke('update_note',{revision:repaired.revision,id:ids.good,patch:{title:'Edited after repair',status:'working'}});
  assert.equal(edited.error,false);assert.deepEqual(edited.value.changed.notes.map((note:any)=>note.id),[ids.good]);assert.equal(edited.value.changed.notes[0].statusHistory[0].status,'working');
  // The answer to a write is the changed objects and the new revision, not the whole board again.
  assert.ok(edited.size<2500,'compact write result: '+edited.size);assert.equal(edited.value.notes,undefined);assert.equal(edited.value.totals.notes,4);
 }finally{await close();}
});

test('MCP writes are validated with the card, field and limit; long text is archived instead of refused',async()=>{
 const a=randomUUID(),b=randomUUID(),sticky=randomUUID();
 const note=(id:string,title:string,dependencies:string[]=[])=>({id,title,description:'Synthetic card',branch:'',status:'idea',priority:'normal',x:200,y:200,dependencies});
 const {root,invoke,close,stored}=await setup({format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[note(a,'First card'),note(b,'Second card',[a])],canvas:{version:1,items:[{id:sticky,kind:'sticky',text:'Synthetic sticky',x:900,y:100,width:240,height:160,color:'mint'}],links:[]}});
 try{
  let revision=(await invoke('board_overview')).value.revision;
  // Field limits are part of the tool schema: the request never reaches the host.
  for(const patch of [{title:'t'.repeat(161)},{status:'started'},{priority:'medium'}]){const result=await invoke('update_note',{revision,id:a,patch});assert.equal(result.error,true);assert.match(JSON.stringify(result.value),new RegExp(Object.keys(patch)[0]));}
  // What only the host can judge comes back with its own explanation.
  const cycle=await invoke('update_note',{revision,id:a,patch:{dependencies:[b]}});assert.equal(cycle.error,true);assert.equal(cycle.value.error.code,'invalid_input');assert.match(cycle.value.error.message,/Dependencies cannot form a cycle \(card "/);
  const personal=await invoke('update_note',{revision,id:a,patch:{description:'Ask person@example.invalid'}});assert.equal(personal.error,true);assert.match(personal.value.error.message,/personal data/);
  const oversized=await invoke('canvas_patch',{revision,items:[{id:sticky,width:50}]});assert.equal(oversized.error,true);
  assert.equal((await stored()).notes[0].description,'Synthetic card');
  const long=await invoke('update_note',{revision,id:a,patch:{description:longText}});assert.equal(long.error,false);revision=long.value.revision;
  assert.ok(long.value.changed.notes[0].descriptionLength<=BOARD_LIMITS.description);assert.ok((await stored()).notes[0].description.includes(historyPath(a)));assert.ok((await readFile(path.join(root,historyPath(a)),'utf8')).includes(paragraph(20)));
  const checked=await invoke('update_note',{revision,id:b,patch:{checklist:[{text:'Frame time is measured',done:true},{text:'Screenshots attached',done:false}]}});assert.equal(checked.error,false);revision=checked.value.revision;
  assert.deepEqual((await stored()).notes[1].checklist,[{text:'Frame time is measured',done:true},{text:'Screenshots attached',done:false}]);
  const stale=await invoke('update_note',{revision:'f'.repeat(64),id:b,patch:{title:'Stale'}});assert.equal(stale.value.error.code,'revision_conflict');assert.equal(stale.value.error.currentRevision,revision);
 }finally{await close();}
});

test('MCP creates and updates a bar chart from data; a large board is summarised',async()=>{
 const card=randomUUID(),filler=Array.from({length:40},(_,i)=>({id:randomUUID(),title:'Card '+i,description:(paragraph(i)+'\n\n').repeat(5),branch:'',status:'idea',priority:'normal',x:i*10,y:0,dependencies:[]}));
 const {invoke,close,stored}=await setup({format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[{id:card,title:'Frame pacing',description:'Synthetic measurement card',branch:'',status:'review',priority:'high',x:400,y:300,dependencies:[]},...filler],canvas:{version:1,items:[{id:card,kind:'card',text:'Frame pacing',x:400,y:300,width:280,height:280,color:'sand'}],links:[]}});
 try{
  let revision=(await invoke('board_overview')).value.revision;
  const mismatch=await invoke('board_create_chart',{revision,title:'Broken',categories:['P50','P95'],series:[{name:'Before',values:[1]}]});assert.equal(mismatch.error,true);assert.equal(mismatch.value.error.code,'invalid_input');assert.match(mismatch.value.error.message,/one value per category/);
  const created=await invoke('board_create_chart',{revision,title:'Frame time, ms',categories:['P50','P95','P99'],series:[{name:'Before',values:[9.8,16.2,24.5]}],unit:'ms',lowerIsBetter:true,reference:{value:16.7,label:'60 fps'},near:card});
  assert.equal(created.error,false);revision=created.value.revision;const chartId=created.value.created.chart;
  let chart=(await stored()).canvas.items.find((item:any)=>item.id===chartId);
  assert.equal(chart.kind,'chart');assert.equal(chart.text,'Frame time, ms');assert.deepEqual(chart.chart.series,[{name:'Before',values:[9.8,16.2,24.5]}]);assert.equal(chart.x,400+280+80);assert.equal(chart.y,300);
  assert.ok((await stored()).canvas.links.some((link:any)=>link.from===card&&link.to===chartId&&link.style==='line'));
  const updated=await invoke('board_update_chart',{revision,id:chartId,setSeries:[{name:'After',values:[6.1,9.4,13]}]});assert.equal(updated.error,false);revision=updated.value.revision;
  chart=(await stored()).canvas.items.find((item:any)=>item.id===chartId);assert.deepEqual(chart.chart.series.map((series:any)=>series.name),['Before','After']);assert.equal(chart.chart.reference.value,16.7);
  assert.equal((await invoke('board_update_chart',{revision,id:card,title:'Not a chart'})).value.error.code,'not_found');
  assert.deepEqual((await invoke('search_board',{kinds:['chart']})).value.matches.map((match:any)=>match.id),[chartId]);
  boardSnapshot.parse(await stored());
  // A board that would cost an agent tens of thousands of tokens answers with a summary first.
  const summary=await invoke('read_board'),full=await invoke('read_board',{detail:'full'});
  assert.ok(full.size>60000);assert.ok(summary.size<full.size/2);assert.ok(summary.value.summary.fullCharacters>60000);assert.equal(summary.value.notes.length,41);assert.equal(summary.value.notes[1].descriptionLength,filler[0].description.length);assert.equal(full.value.notes[1].description,filler[0].description);
 }finally{await close();}
});
