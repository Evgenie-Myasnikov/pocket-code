import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {whiteboardSchema,emptyWhiteboard,moveItems,removeItems,frameSelection,edgePoint,type WhiteboardItem} from '../src/whiteboard-model.js';
import {createProjectBoard,projectBoard,updateProjectBoard} from '../server/project-board.js';
const item=(extra:Partial<WhiteboardItem>={}):WhiteboardItem=>({id:randomUUID(),kind:'sticky',text:'Example',x:20,y:40,width:240,height:160,color:'sand',...extra});
test('canvas schema rejects broken links, duplicate IDs, oversized content and invalid coordinates',()=>{
 const a=item(),b=item(),valid={version:1,items:[a,b],links:[{id:randomUUID(),from:a.id,to:b.id}]};assert.ok(whiteboardSchema.safeParse(valid).success);
 for(const bad of [{...valid,items:[a,a]},{...valid,items:[a]},{...valid,items:[{...a,x:-1},b]},{...valid,items:[{...a,text:'x'.repeat(4001)},b]}])assert.equal(whiteboardSchema.safeParse(bad).success,false);
});
test('group move preserves relative positions at bounds; deleting objects removes visual links',()=>{const a=item({x:4}),b=item({x:60}),board={...emptyWhiteboard(),items:[a,b],links:[{id:randomUUID(),from:a.id,to:b.id}]};const moved=moveItems(board,[a.id,b.id],-100,20);assert.equal(moved.items[0].x,0);assert.equal(moved.items[1].x,56);assert.equal(removeItems(board,[a.id]).links.length,0);assert.equal(board.items[0].x,4);});
test('moving frame includes fully contained items and connector ends at item edge',()=>{const a=item({kind:'frame',x:0,y:0,width:600,height:400}),b=item(),c=item({x:700});assert.deepEqual(new Set(frameSelection({...emptyWhiteboard(),items:[a,b,c]},[a.id])),new Set([a.id,b.id]));assert.equal(edgePoint(b,c).x,b.x+b.width);});
test('canvas persists with legacy notes, omitted canvas preserves it, stale writes fail',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'canvas-board-'));
 try{const a=await createProjectBoard(root,[],'en'),canvas={...emptyWhiteboard(),items:[item()]};const saved=await updateProjectBoard(root,a.repositoryRevision,a.notes,a.versions,[],canvas);assert.deepEqual((await projectBoard(root))!.canvas,canvas);assert.deepEqual(saved.notes,a.notes);const later=await updateProjectBoard(root,saved.repositoryRevision,saved.notes,saved.versions,[]);assert.deepEqual(later.canvas,canvas);await assert.rejects(updateProjectBoard(root,a.repositoryRevision,a.notes,a.versions,[],emptyWhiteboard()),/changed/);await assert.rejects(updateProjectBoard(root,later.repositoryRevision,later.notes,later.versions,['Example'],canvas),/personal data/);}finally{await rm(root,{recursive:true,force:true});}
});
