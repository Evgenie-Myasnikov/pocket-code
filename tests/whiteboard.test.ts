import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {whiteboardSchema,emptyWhiteboard,moveItems,removeItems,frameSelection,edgePoint,type WhiteboardItem} from '../src/whiteboard-model.js';
import {createProjectBoard,projectBoard,updateProjectBoard} from '../server/project-board.js';
import {boardCanvas,canvasNotes,canvasMigrationIssues} from '../src/board-canvas.js';
import {BoardStore} from '../server/boards.js';
const item=(extra:Partial<WhiteboardItem>={}):WhiteboardItem=>({id:randomUUID(),kind:'sticky',text:'Example',x:20,y:40,width:240,height:160,color:'sand',...extra});
test('legacy cards migrate without losing IDs, metadata or attachments and canvas edits round-trip',()=>{
 const id=randomUUID(),other=randomUUID(),notes=[{id,title:'Plan',description:'Criteria',branch:'1.0',status:'review' as const,owner:'',priority:'high' as const,x:40,y:80,dependencies:[other],images:[{path:'project-boards/assets/'+ 'a'.repeat(64)+'.png',caption:'Example'}]},{id:other,title:'Dependency',description:'',branch:'',status:'ready' as const,owner:'',x:400,y:80,dependencies:[]}];
 const canvas=boardCanvas(notes);assert.equal(canvas.items.length,2);canvas.items[0]={...canvas.items[0],text:'Changed',description:'New criteria',x:90,width:400};
 const updated=canvasNotes(notes,canvas);assert.equal(updated[0].id,id);assert.equal(updated[0].title,'Changed');assert.equal(updated[0].status,'review');assert.deepEqual(updated[0].images,notes[0].images);assert.deepEqual(updated[0].dependencies,[other]);assert.equal(boardCanvas(updated,canvas).items[0].width,400);
 assert.deepEqual(canvasNotes(notes,removeItems(canvas,[other]))[0].dependencies,[]);
});
test('canvas schema rejects broken links, duplicate IDs, oversized content and invalid coordinates',()=>{
 const a=item(),b=item(),valid={version:1,items:[a,b],links:[{id:randomUUID(),from:a.id,to:b.id}]};assert.ok(whiteboardSchema.safeParse(valid).success);
 for(const bad of [{...valid,items:[a,a]},{...valid,items:[a]},{...valid,items:[{...a,x:-1},b]},{...valid,items:[{...a,text:'x'.repeat(4001)},b]}])assert.equal(whiteboardSchema.safeParse(bad).success,false);
});
test('group move preserves relative positions at bounds; deleting objects removes visual links',()=>{const a=item({x:4}),b=item({x:60}),board={...emptyWhiteboard(),items:[a,b],links:[{id:randomUUID(),from:a.id,to:b.id}]};const moved=moveItems(board,[a.id,b.id],-100,20);assert.equal(moved.items[0].x,0);assert.equal(moved.items[1].x,56);assert.equal(removeItems(board,[a.id]).links.length,0);assert.equal(board.items[0].x,4);});
test('migration retains orphan legacy cards and links; malformed references are reported, not discarded',()=>{
 const a=item({kind:'card',description:'Legacy text'}),b=item(),link={id:randomUUID(),from:a.id,to:b.id},canvas={...emptyWhiteboard(),items:[a,b],links:[link]};
 assert.deepEqual(boardCanvas([],canvas),canvas);assert.equal(canvasNotes([],canvas)[0].description,'Legacy text');assert.deepEqual(canvasMigrationIssues([],canvas),[]);
 const invalid={...canvas,links:[{...link,to:randomUUID()}]};assert.deepEqual(boardCanvas([],invalid).links,invalid.links);assert.deepEqual(canvasMigrationIssues([],invalid),['Invalid visual connections']);
});
test('moving frame includes fully contained items and connector ends at item edge',()=>{const a=item({kind:'frame',x:0,y:0,width:600,height:400}),b=item(),c=item({x:700});assert.deepEqual(new Set(frameSelection({...emptyWhiteboard(),items:[a,b,c]},[a.id])),new Set([a.id,b.id]));assert.equal(edgePoint(b,c).x,b.x+b.width);});
test('canvas persists with legacy notes, omitted canvas preserves it, stale writes fail',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'canvas-board-'));
 try{const a=await createProjectBoard(root,[],'en'),canvas={...emptyWhiteboard(),items:[item()]};const saved=await updateProjectBoard(root,a.repositoryRevision,a.notes,a.versions,[],canvas);assert.deepEqual((await projectBoard(root))!.canvas,canvas);assert.deepEqual(saved.notes,a.notes);const later=await updateProjectBoard(root,saved.repositoryRevision,saved.notes,saved.versions,[]);assert.deepEqual(later.canvas,canvas);await assert.rejects(updateProjectBoard(root,a.repositoryRevision,a.notes,a.versions,[],emptyWhiteboard()),/changed/);await assert.rejects(updateProjectBoard(root,later.repositoryRevision,later.notes,later.versions,['Example'],canvas),/personal data/);}finally{await rm(root,{recursive:true,force:true});}
});
test('workspace board store retains canvas across reload and omitted updates',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'canvas-store-'));
 try{const file=path.join(root,'boards.json'),store=await new BoardStore(file).load(),id=randomUUID();await store.mutate(data=>{data.boards.push({id,name:'Example',root,revision:0,versionSource:'planned',versions:[],notes:[]});});const canvas={...emptyWhiteboard(),items:[item()]};await store.save(id,0,[],[],canvas);await store.save(id,1,[]);assert.deepEqual((await new BoardStore(file).load()).getBoard(id)?.canvas,canvas);await assert.rejects(store.save(id,0,[],[],emptyWhiteboard()),/changed/);}finally{await rm(root,{recursive:true,force:true});}
});
