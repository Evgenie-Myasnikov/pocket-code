import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareBoardConversation,attachBoardConversation,readBoardConversation} from '../src/board-conversation';
import type {BoardChat} from '../src/WorkBoards';
const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)}});
const target:BoardChat={root:'C:/Synthetic/Project',boardId:'11111111-1111-4111-8111-111111111111',context:{name:'Synthetic board',revision:'1'},prompt:'Synthetic context',note:{id:'11111111-1111-4111-8111-111111111111',title:'Board',description:'',owner:'',branch:'',status:'idea',x:0,y:0,dependencies:[]}};
const connection={url:'http://127.0.0.1:4318',token:'synthetic-account'};
test('board conversation persists and only explicit replacement rotates its generation',async()=>{
 const first=await prepareBoardConversation(connection,target,'claude');assert.ok(first.conversation);attachBoardConversation(first.conversation,'claude','session-original','job-original');
 const again=await prepareBoardConversation(connection,{...target,context:{name:'Synthetic board',revision:'2'}},'codex');assert.equal(again.note.chat?.sessionId,'session-original');assert.equal(again.note.chat?.provider,'claude');assert.equal(again.conversation?.generation,first.conversation.generation);
 const next=await prepareBoardConversation(connection,target,'codex',true);assert.notEqual(next.conversation?.generation,first.conversation.generation);assert.equal(next.note.chat,undefined);assert.equal(attachBoardConversation(first.conversation,'claude','old-late-answer'),false);assert.equal(readBoardConversation(next.conversation!.key)?.sessionId,undefined);assert.equal(attachBoardConversation(next.conversation!,'codex','new-session'),true);
});
test('boards, project roots and accounts remain isolated and pinned sessions cannot be overwritten',async()=>{
 const a=await prepareBoardConversation(connection,{...target,boardId:'22222222-2222-4222-8222-222222222222'},'claude');attachBoardConversation(a.conversation!,'claude','sticky-session');assert.equal(attachBoardConversation(a.conversation!,'claude','unrelated-session'),false);
 for(const [c,t] of [[{...connection,token:'another-account'},target],[connection,{...target,root:'C:/Synthetic/Another'}]] as const){const b=await prepareBoardConversation(c,t,'claude');assert.notEqual(a.conversation!.key,b.conversation!.key);assert.equal(b.note.chat,undefined);}
 assert.ok([...values.keys()].every(key=>!key.includes('Synthetic')&&!key.includes('account')));
});

test('a pending job is recoverable and storage failure does not replace a pinned conversation',async()=>{
 const fresh=await prepareBoardConversation(connection,{...target,boardId:'33333333-3333-4333-8333-333333333333'},'claude');assert.equal(attachBoardConversation(fresh.conversation!,'claude',undefined,'pending-job'),true);const reopened=await prepareBoardConversation(connection,{...target,boardId:'33333333-3333-4333-8333-333333333333'},'codex');assert.equal(reopened.resumeJobId,'pending-job');assert.equal(reopened.note.chat?.sessionId,'pending-pending-job');assert.equal(attachBoardConversation(fresh.conversation!,'claude',undefined,'unrelated-job'),false);
 const write=localStorage.setItem;localStorage.setItem=()=>{throw Error('Synthetic storage full');};try{await assert.rejects(prepareBoardConversation(connection,{...target,boardId:'33333333-3333-4333-8333-333333333333'},'claude',true));}finally{localStorage.setItem=write;}assert.equal(readBoardConversation(fresh.conversation!.key)?.jobId,'pending-job');
});
