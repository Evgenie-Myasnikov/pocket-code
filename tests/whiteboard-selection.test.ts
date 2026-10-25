import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {BoardNote} from '../server/boards.js';
import {randomUUID} from 'node:crypto';
import {copySelection,pasteSelection,itemsInRect,selectionRect} from '../src/whiteboard-selection.js';
import {whiteboardSchema,type Whiteboard,type WhiteboardItem} from '../src/whiteboard-model.js';
import {canvasNotes,copyCanvasCards} from '../src/board-canvas.js';
const item=(x:number,kind:WhiteboardItem['kind']='card'):WhiteboardItem=>({id:randomUUID(),kind,text:'Synthetic task',description:'Acceptance criteria',x,y:40,width:160,height:120,color:'sand'});
test('area selection is direction-independent, intersects nodes and requires whole frames',()=>{
 const a=item(20),b=item(400),frame={...item(0,'frame'),y:0,width:800,height:600},board:Whiteboard={version:1,items:[a,b,frame],links:[]};
 const rect=selectionRect({x:200,y:200},{x:0,y:0});assert.deepEqual(itemsInRect(board,rect),[a.id]);assert.deepEqual(itemsInRect(board,{x:0,y:0,width:900,height:700}),[a.id,b.id,frame.id]);
});
test('copy remaps internal links, preserves ports and loose ends, and excludes outside links',()=>{
 const a=item(20),b=item(400),outside=item(800),board:Whiteboard={version:1,items:[a,b,outside],links:[{id:randomUUID(),from:a.id,to:b.id,fromSide:'e',toSide:'w'},{id:randomUUID(),from:b.id,to:outside.id},{id:randomUUID(),from:a.id,fromSide:'n',toPoint:{x:20,y:10}}]};
 const clipboard=copySelection(board,[a.id,b.id]),result=pasteSelection(board,clipboard)!;
 assert.equal(clipboard.links.length,2);assert.equal(result.board.items.length,5);assert.equal(result.board.links.length,5);assert.ok(whiteboardSchema.safeParse(result.board).success);
 const link=result.board.links[3];assert.equal(link.from,result.ids[a.id]);assert.equal(link.to,result.ids[b.id]);assert.equal(link.fromSide,'e');assert.deepEqual(result.board.links[4].toPoint,{x:52,y:42});assert.equal(board.items[0].x,20);
});
test('task copies retain product metadata after source deletion without copying private fields',()=>{
 const a=item(20),b=item(400),notes:BoardNote[]=[{...a,description:a.description||'',title:a.text,owner:'synthetic-owner',branch:'1.0',status:'review' as const,priority:'high' as const,dependencies:[b.id],images:[{path:'project-boards/assets/'+ 'a'.repeat(64)+'.png',caption:'Synthetic diagram'}],assigneeIds:[randomUUID()],chat:{provider:'codex' as const,sessionId:'synthetic-session'}},{...b,description:b.description||'',title:b.text,owner:'',branch:'1.0',status:'ready' as const,dependencies:[]}];
 const cards=copyCanvasCards(notes),clipboard=copySelection({version:1,items:[a,b],links:[]},[a.id,b.id]),result=pasteSelection({version:1,items:[],links:[]},clipboard)!;
 const copied=canvasNotes([],result.board,{cards,ids:result.ids});assert.equal(copied[0].status,'review');assert.equal(copied[0].priority,'high');assert.equal(copied[0].branch,'1.0');assert.deepEqual(copied[0].images,notes[0].images);assert.deepEqual(copied[0].dependencies,[result.ids[b.id]]);assert.equal(copied[0].owner,'');assert.equal(copied[0].chat,undefined);assert.equal(copied[0].assigneeIds,undefined);
});
test('paste keeps group spacing at bounds and refuses capacity overflow atomically',()=>{
 const a=item(19980),b=item(19900),clip:Whiteboard={version:1,items:[a,b],links:[]},empty:Whiteboard={version:1,items:[],links:[]},result=pasteSelection(empty,clip,{x:100,y:-200})!;
 assert.deepEqual(result.board.items.map(i=>i.x),[20000,19920]);assert.deepEqual(result.board.items.map(i=>i.y),[0,0]);assert.equal(pasteSelection({...empty,items:Array.from({length:499},()=>item(20))},clip),null);assert.equal(pasteSelection(empty,{version:1,items:[],links:[]}),null);
});
