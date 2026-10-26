import test from 'node:test';
import assert from 'node:assert/strict';
import {boardSelectionContext,matchingBoardSelection} from '../src/board-selection-context';
import {boardChatContext} from '../src/board-chat-context';
import type {BoardView} from '../src/WorkBoards';
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222',stale='33333333-3333-4333-8333-333333333333';
const connection={url:'http://127.0.0.1:4319',token:'synthetic-preview-token',workspaceId:'synthetic-workspace'};
function board(){return {id:'44444444-4444-4444-8444-444444444444',root:'C:/Synthetic/Atlas',name:'Atlas',versionSource:'planned',revision:0,versions:[],branches:[],notes:[{id:first,owner:'',title:'First concept',description:'Synthetic context',branch:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[],images:[{path:'project-boards/assets/'+'a'.repeat(64)+'.png',caption:'Concept preview'}]}],canvas:{version:1,items:[{id:first,kind:'card',text:'First concept',x:0,y:0,width:240,height:180,color:'sand'},{id:second,kind:'sticky',text:'',x:300,y:0,width:240,height:180,color:'sand'}],links:[]}} as BoardView;}
test('preview metadata stays separate from the unchanged selected-message snapshot',()=>{
 const view=board(),selection=boardSelectionContext(connection,view,[first,second,first,stale])!;
 assert.deepEqual(selection.ids,[first,second]);assert.equal(selection.content,boardChatContext(view,[first,second]));assert.equal(selection.boardName,'Atlas');assert.equal(selection.objects?.[1].title,'');assert.equal(selection.objects?.[1].kind,'sticky');assert.ok(!selection.titles.includes(second));assert.ok(!selection.content.includes(connection.token));assert.ok(!selection.content.includes(connection.workspaceId));
 view.notes[0].images![0].caption='Changed after selection';view.notes[0].title='Changed title';assert.equal(selection.objects?.[0].images?.[0].caption,'Concept preview');assert.equal(selection.objects?.[0].title,'First concept');
});
test('empty or stale-only selections do not leave a preview attachment',()=>{assert.equal(boardSelectionContext(connection,board(),[]),null);assert.equal(boardSelectionContext(connection,board(),[stale]),null);});
test('preview matching remains isolated by connection, project, board and workspace',()=>{const view=board(),selection=boardSelectionContext(connection,view,[first])!;assert.equal(matchingBoardSelection(selection,connection,view.root,view.id),selection);for(const next of [{...connection,token:'synthetic-other-token'},{...connection,workspaceId:'synthetic-other-workspace'}])assert.equal(matchingBoardSelection(selection,next,view.root,view.id),null);assert.equal(matchingBoardSelection(selection,connection,'C:/Synthetic/Other',view.id),null);assert.equal(matchingBoardSelection(selection,connection,view.root,stale),null);});
