import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {normalizeBoard,archiveDescription,boardSnapshot,boardErrors,boardWarnings,historyPath,BOARD_LIMITS} from '../src/board-contract.js';
import {projectBoard,updateProjectBoard,repairProjectBoard,restoreProjectBoard,projectBoardBackups,createProjectBoard} from '../server/project-board.js';
import {BoardBackups} from '../server/board-backups.js';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

import {file,paragraph,longText,brokenBoard} from './board-broken-fixture';
async function project(board:unknown){const root=await mkdtemp(path.join(os.tmpdir(),'board-resilience-'));await mkdir(path.join(root,'project-boards'));await writeFile(path.join(root,'project-boards',file),typeof board==='string'?board:JSON.stringify(board,null,2));return root;}
const read=(root:string)=>readFile(path.join(root,'project-boards',file),'utf8');

test('the tolerant reader keeps every card and names the card, field and limit of each violation',()=>{
 const {ids,board}=brokenBoard();assert.equal(longText.length>BOARD_LIMITS.description,true);
 const result=normalizeBoard(board),errors=boardErrors(result.issues);
 assert.equal(result.board.notes.length,4);assert.equal(result.board.canvas!.items.length,2);assert.equal(result.board.canvas!.links.length,1);
 assert.deepEqual(errors.map(issue=>[issue.id,issue.field,issue.code,issue.limit,issue.actual]),[[ids.long,'description','too_long',20000,longText.length],[ids.caption,'image caption','too_long',160,170],[ids.priority,'priority','invalid_value',undefined,'medium']]);
 assert.match(errors[0].message,/description is [\d,]+ characters; the limit is 20,000/);assert.match(errors[2].message,/Allowed: critical, high, normal, low/);
 // Display keeps the complete text; nothing is cut while the file is only being read.
 assert.equal(result.board.notes[1].description,longText);assert.equal(result.board.notes[2].images![0].caption.length,170);assert.equal(result.board.notes[3].priority,'normal');
 assert.equal(JSON.stringify(board).includes('"medium"'),true);
});

test('repair returns a strict board and moves removed text word for word',()=>{
 const {ids,board}=brokenBoard(),fixed=normalizeBoard(board,'repair');
 const strict=boardSnapshot.parse(fixed.board),note=strict.notes.find(n=>n.id===ids.long)!;
 assert.ok(note.description.length<=BOARD_LIMITS.description);assert.ok(note.description.startsWith('Goal: keep the synthetic board readable.'));assert.ok(note.description.endsWith(paragraph(59)));assert.ok(note.description.includes(historyPath(ids.long)));
 const moved=fixed.moved.find(entry=>entry.noteId===ids.long&&entry.label==='Description history')!.text;
 for(let i=0;i<60;i++)assert.equal(Number(note.description.includes(paragraph(i)))+Number(moved.includes(paragraph(i))),1,'paragraph '+i+' is kept exactly once');
 assert.equal(strict.notes.find(n=>n.id===ids.caption)!.images![0].caption.length,160);assert.equal(fixed.moved.some(entry=>entry.text==='c'.repeat(170)),true);
 assert.equal(strict.notes.find(n=>n.id===ids.priority)!.priority,'normal');assert.equal(fixed.moved.some(entry=>entry.label==='Original priority'&&entry.text==='medium'),true);
 // The card text is stored once: its canvas object keeps geometry and the title.
 assert.equal(strict.canvas!.items.find(item=>item.id===ids.long)!.description,undefined);
});

test('archiving keeps the task statement, pinned context and the newest paragraphs inside the limit',()=>{
 const context='Creation context:\nWhy the synthetic card exists.',text=['Statement of the task.',...Array.from({length:80},(_,i)=>paragraph(i)),context,'Newest record.'].join('\n\n');
 const {kept,moved}=archiveDescription(text,'[pointer]');
 assert.ok(kept.length<=BOARD_LIMITS.description*.75+50);assert.ok(kept.startsWith('Statement of the task.'));assert.ok(kept.endsWith('Newest record.'));assert.ok(kept.includes(context));assert.ok(kept.includes('[pointer]'));
 assert.equal(moved.includes(paragraph(20)),true);assert.equal(moved.includes('Newest record.'),false);
 assert.deepEqual(archiveDescription('short','[pointer]'),{kept:'short',moved:''});
 const single=archiveDescription('x'.repeat(30000),'[pointer]');assert.ok(single.kept.length<=BOARD_LIMITS.description);assert.equal(single.kept.replace('[pointer]','').replace(/\n/g,'').length+single.moved.length,30000);
});

test('structural damage is reported per record: ids, dependencies, connections and unknown fields',()=>{
 const a=randomUUID(),b=randomUUID(),item=randomUUID();
 const result=normalizeBoard({format:'pocket-code-board',version:1,name:'Synthetic',versions:[],extra:true,
  notes:[{id:a,title:'First',description:'',branch:'',status:'in-progress',priority:'normal',x:0,y:0,dependencies:[b,randomUUID()],owner:'x'},{id:b,title:'Second',description:'',branch:'',status:'idea',priority:'normal',x:-5,y:0,dependencies:[a]},{id:a,title:'Duplicate',description:'',branch:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[]},'text'],
  canvas:{version:1,items:[{id:item,kind:'sticky',text:'ok',x:0,y:0,width:10,height:160},{id:randomUUID(),kind:'hologram',text:'future',x:0,y:0,width:240,height:160}],links:[{id:randomUUID(),from:item,to:randomUUID()},{id:randomUUID(),from:item,to:a}]}});
 const codes=boardErrors(result.issues).map(issue=>issue.code);
 for(const code of ['unknown_field','invalid_value','missing_dependency','out_of_range','duplicate_id','not_object','dependency_cycle','unsupported_kind','invalid_link'])assert.ok(codes.includes(code),code);
 assert.equal(result.board.notes.length,3);assert.equal(new Set(result.board.notes.map(n=>n.id)).size,3);assert.equal(result.board.notes[0].status,'working');
 // A connection to a card that has no stored geometry is valid: the card joins the canvas.
 assert.equal(result.board.canvas!.links.length,1);assert.ok(result.board.canvas!.items.some(entry=>entry.id===a&&entry.kind==='card'));
 // Objects from a newer format cannot be converted silently.
 assert.equal(result.issues.find(issue=>issue.code==='unsupported_kind')!.fix,undefined);
});

test('a board with violations opens with diagnostics, refuses edits, and repairs without losing text',async()=>{
 const {ids,board}=brokenBoard(),root=await project(board),options={backups:new BoardBackups(path.join(root,'private-backups'))};
 try{
  const opened=(await projectBoard(root,options))!,original=await read(root);
  assert.equal(opened.notes.length,4);assert.equal(opened.health.errors,3);assert.equal(opened.notes[1].description,longText);
  assert.deepEqual(boardErrors(opened.issues).map(issue=>issue.id),[ids.long,ids.caption,ids.priority]);
  await assert.rejects(updateProjectBoard(root,opened.repositoryRevision,opened.notes,opened.versions,[],undefined,options),(error:any)=>error.code==='board_needs_repair'&&/Long history/.test(error.message)&&/the limit is 20,000/.test(error.message));
  assert.equal(await read(root),original,'a refused write leaves the file untouched');
  await assert.rejects(repairProjectBoard(root,'0'.repeat(64),options),/changed/);
  const repaired=await repairProjectBoard(root,opened.repositoryRevision,options);
  assert.equal(repaired.board.health.errors,0);assert.equal(repaired.fixed,3);assert.deepEqual(repaired.history,['project-boards/history/card-'+ids.long+'.md','project-boards/history/card-'+ids.caption+'.md','project-boards/history/card-'+ids.priority+'.md']);
  boardSnapshot.parse(JSON.parse(await read(root)));
  const history=await readFile(path.join(root,historyPath(ids.long)),'utf8'),saved=repaired.board.notes.find(n=>n.id===ids.long)!;
  for(let i=0;i<60;i++)assert.ok(saved.description.includes(paragraph(i))||history.includes(paragraph(i)));
  assert.match(history,/^# Long history\n\nCard: /);
  // The broken original is kept privately and can be put back.
  const backups=await projectBoardBackups(root,options);assert.equal(backups.some(entry=>!entry.valid),true);
  const edited=await updateProjectBoard(root,repaired.board.repositoryRevision,repaired.board.notes.map(n=>n.id===ids.good?{...n,title:'Edited after repair'}:n),repaired.board.versions,[],undefined,options);
  assert.equal(edited.notes.find(n=>n.id===ids.good)!.title,'Edited after repair');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a file that is not JSON shows the last good cards and can be rolled back',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-rollback-')),options={backups:new BoardBackups(path.join(root,'private-backups'))};
 try{
  const created=await createProjectBoard(root,[],'en',options),good=await read(root);
  const saved=await updateProjectBoard(root,created.repositoryRevision,created.notes.map((n,i)=>i?n:{...n,title:'Known good title'}),created.versions,[],undefined,options);
  await writeFile(path.join(root,'project-boards',file),'{"format":"pocket-code-board", broken');
  const broken=(await projectBoard(root,options))!;
  assert.equal(broken.issues[0].code,'invalid_json');assert.match(broken.issues[0].message,/line 1, column/);assert.ok(broken.health.recovered);assert.equal(broken.notes[0].title,'Known good title');
  await assert.rejects(updateProjectBoard(root,broken.repositoryRevision,broken.notes,broken.versions,[],undefined,options),(error:any)=>error.code==='board_needs_repair');
  await assert.rejects(repairProjectBoard(root,broken.repositoryRevision,options),/not valid JSON/);
  await assert.rejects(createProjectBoard(root,[],'en',options),/cannot be read/);
  const backups=await projectBoardBackups(root,options);assert.ok(backups.filter(entry=>entry.valid).length>=2);
  const restored=await restoreProjectBoard(root,broken.repositoryRevision,broken.health.recovered!.id,options);
  assert.equal(restored.health.errors,0);assert.equal(restored.notes[0].title,'Known good title');assert.equal(restored.repositoryRevision,saved.repositoryRevision);
  // An older snapshot stays available too.
  const oldest=backups.filter(entry=>entry.valid).at(-1)!,older=await restoreProjectBoard(root,restored.repositoryRevision,oldest.id,options);assert.equal(await read(root),good);assert.equal(older.notes[0].title,created.notes[0].title);
  await assert.rejects(restoreProjectBoard(root,older.repositoryRevision,'1700000000000-'+'f'.repeat(16)+'-ok',options),/not found/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('host writes store card text once, archive overflow, record status history and reject invalid records clearly',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-write-'));
 try{
  const created=await createProjectBoard(root,[],'en'),first=created.notes[0],canvas={version:1 as const,items:[{id:first.id,kind:'card' as const,text:first.title,description:first.description,x:first.x,y:first.y,width:280,height:280,color:'sand' as const}],links:[]};
  const saved=await updateProjectBoard(root,created.repositoryRevision,created.notes.map((n,i)=>i?n:{...n,description:longText,status:'working' as const,statusHistory:[{status:'done' as const,at:'2020-01-01'}]}),created.versions,[],canvas);
  const stored=JSON.parse(await read(root)),note=stored.notes[0];
  assert.equal(stored.canvas.items[0].description,undefined);assert.equal(stored.canvas.items[0].text,first.title);
  assert.ok(note.description.length<=BOARD_LIMITS.description);assert.ok(note.description.includes(historyPath(first.id)));
  assert.ok((await readFile(path.join(root,historyPath(first.id)),'utf8')).includes(paragraph(20)));
  assert.equal(note.statusHistory.length,1);assert.equal(note.statusHistory[0].status,'working');assert.match(note.statusHistory[0].at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const again=await updateProjectBoard(root,saved.repositoryRevision,saved.notes.map(({statusHistory:_,...n})=>n),saved.versions,[]);assert.deepEqual(again.notes[0].statusHistory,note.statusHistory,'a client cannot drop the history');
  const before=await read(root);
  await assert.rejects(updateProjectBoard(root,again.repositoryRevision,again.notes.map((n,i)=>i?n:{...n,title:'t'.repeat(161)}),again.versions,[]),(error:any)=>error.code==='board_invalid'&&error.status===400&&error.issues[0].id===first.id&&error.issues[0].field==='title'&&error.issues[0].limit===160&&/title is 161 characters; the limit is 160/.test(error.message)&&error.message.includes('Card "'+first.title+'"'));
  await assert.rejects(updateProjectBoard(root,again.repositoryRevision,again.notes.map((n,i)=>i?n:{...n,priority:'medium' as any}),again.versions,[]),(error:any)=>error.code==='board_invalid'&&/priority/.test(error.message));
  assert.equal(await read(root),before);assert.deepEqual((await readdir(path.join(root,'project-boards'))).filter(name=>name.endsWith('.tmp')),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('warnings flag records close to a limit without blocking edits',()=>{
 const id=randomUUID(),board=boardSnapshot.parse({format:'pocket-code-board',version:1,name:'Synthetic',versions:[],notes:[{id,title:'Almost full',description:'d'.repeat(18500),branch:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[]}]});
 const warnings=boardWarnings(board,1_900_000);assert.deepEqual(warnings.map(issue=>[issue.severity,issue.code,issue.field,issue.limit,issue.actual]),[['warning','near_limit','description',20000,18500],['warning','near_limit','fileBytes',2000000,1900000]]);assert.equal(warnings[0].id,id);
 assert.deepEqual(boardWarnings({...board,notes:[{...board.notes[0],description:'short'}]},1000),[]);
});

test('the board API opens a damaged board, explains refused writes, and keeps repair with the host',async()=>{
 const {ids,board}=brokenBoard(),root=await project(board),token='synthetic-resilience-host-'.repeat(2);
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api',query='?root='+encodeURIComponent(root);
 const call=async(route:string,data?:unknown)=>{const response=await fetch(url+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,body:await response.json()};};
 try{
  const opened=await call('/project-board'+query);assert.equal(opened.status,200);assert.equal(opened.body.board.notes.length,4);assert.equal(opened.body.board.health.errors,3);
  assert.deepEqual(opened.body.board.issues.filter((issue:any)=>issue.severity==='error').map((issue:any)=>issue.id),[ids.long,ids.caption,ids.priority]);
  const live=await call('/project-board/live'+query+'&file='+file);assert.equal(live.status,200);assert.equal(live.body.board.notes.length,4);
  const refused=await call('/project-board',{root,repositoryRevision:opened.body.board.repositoryRevision,notes:opened.body.board.notes.filter((n:any)=>n.id===ids.good),versions:opened.body.board.versions});
  assert.equal(refused.status,409);assert.equal(refused.body.code,'board_needs_repair');assert.match(refused.body.error,/read-only until it is repaired/);assert.equal(refused.body.issues.length,3);
  const repaired=await call('/project-board/repair',{root,repositoryRevision:opened.body.board.repositoryRevision});assert.equal(repaired.status,200);assert.equal(repaired.body.board.health.errors,0);
  const invalid=await call('/project-board',{root,repositoryRevision:repaired.body.board.repositoryRevision,notes:repaired.body.board.notes.map((n:any)=>n.id===ids.good?{...n,status:'started'}:n),versions:repaired.body.board.versions});
  assert.equal(invalid.status,400);assert.equal(invalid.body.code,'board_invalid');assert.match(invalid.body.error,/Card "Healthy card"/);assert.match(invalid.body.error,/status/);assert.equal(invalid.body.issues[0].id,ids.good);
  const cycle=await call('/project-board',{root,repositoryRevision:repaired.body.board.repositoryRevision,notes:repaired.body.board.notes.map((n:any)=>n.id===ids.good?{...n,dependencies:[ids.good]}:n),versions:repaired.body.board.versions});
  assert.equal(cycle.status,400);assert.match(cycle.body.error,/cycle \(card "Healthy card"/);
  const backups=await call('/project-board/backups'+query);assert.equal(backups.status,200);assert.ok(backups.body.backups.length>=1);
  assert.equal((await readdir(path.join(root,'uploads','.boards','backups'))).length,1);
 }finally{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
