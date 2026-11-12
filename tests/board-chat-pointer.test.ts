import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {prepareBoardConversation,adoptBoardConversation,attachBoardConversation,readBoardConversation,type BoardConversationHost,type SharedConversation} from '../src/board-conversation';
import type {BoardChat} from '../src/WorkBoards';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)}});
const target=(boardId:string):BoardChat=>({root:'C:/Synthetic/Project',boardId,context:{name:'Synthetic board',revision:'1'},prompt:'Synthetic context',note:{id:boardId,title:'Board',description:'',owner:'',branch:'',status:'idea',x:0,y:0,dependencies:[]}});
const connection={url:'http://127.0.0.1:4318',token:'synthetic-account'},phone={url:'http://127.0.0.1:4318',token:'synthetic-phone'};
/** One host shared by two devices, as the PC is. */
function sharedHost(){
 const pointers=new Map<string,SharedConversation>(),writes:(SharedConversation|null)[]=[];
 const host:BoardConversationHost={async read(root,boardId){return pointers.get(root+'|'+boardId)||null;},async write(root,boardId,value){writes.push(value);if(value)pointers.set(root+'|'+boardId,value);else pointers.delete(root+'|'+boardId);}};
 return {host,pointers,writes};
}

test('two devices resume one board chat: the host says which conversation is current',async()=>{
 const {host,pointers}=sharedHost(),board=target(randomUUID());
 // The PC starts the board chat; its session becomes the board's chat on the host.
 const desktop=await prepareBoardConversation(connection,board,'claude',false,host);assert.equal(desktop.note.chat,undefined);
 assert.equal(attachBoardConversation(desktop.conversation!,'claude','session-desktop','job-1'),true);await host.write(board.root,board.boardId,{provider:'claude',sessionId:'session-desktop'});
 // The phone has no local association: it resumes the same conversation instead of starting a second one.
 const mobile=await prepareBoardConversation(phone,board,'codex',false,host);assert.deepEqual(mobile.note.chat,{provider:'claude',sessionId:'session-desktop'});assert.notEqual(mobile.conversation!.key,desktop.conversation!.key);
 // The phone starts a new board chat; the PC follows it the next time the board chat opens.
 const fresh=await prepareBoardConversation(phone,board,'claude',true,host);assert.equal(fresh.note.chat,undefined);assert.equal(pointers.size,0);
 assert.equal(attachBoardConversation(fresh.conversation!,'claude','session-phone'),true);await host.write(board.root,board.boardId,{provider:'claude',sessionId:'session-phone'});
 const again=await prepareBoardConversation(connection,board,'claude',false,host);assert.equal(again.note.chat?.sessionId,'session-phone');assert.notEqual(again.conversation!.generation,desktop.conversation!.generation);
 // A late answer of the replaced conversation cannot take the board back.
 assert.equal(attachBoardConversation(desktop.conversation!,'claude','session-desktop'),false);assert.equal(readBoardConversation(again.conversation!.key)?.sessionId,'session-phone');
});

test('a device that already knows the board chat tells a host that does not; an unreachable host changes nothing',async()=>{
 const {host,pointers,writes}=sharedHost(),board=target(randomUUID());
 const local=await prepareBoardConversation(connection,board,'claude');attachBoardConversation(local.conversation!,'claude','session-known');
 const published=await prepareBoardConversation(connection,board,'claude',false,host);assert.equal(published.conversation!.generation,local.conversation!.generation);await Promise.resolve();
 assert.deepEqual(pointers.get(board.root+'|'+board.boardId),{provider:'claude',sessionId:'session-known'});
 const before=writes.length,offline:BoardConversationHost={read:async()=>undefined,write:async()=>{throw Error('Synthetic host unavailable');}};
 const kept=await prepareBoardConversation(connection,board,'codex',false,offline);assert.equal(kept.note.chat?.sessionId,'session-known');assert.equal(kept.conversation!.generation,local.conversation!.generation);assert.equal(writes.length,before);
});

test('a discussion opened from the chat list becomes the board chat on this device and on the host',async()=>{
 const {host,pointers}=sharedHost(),board=target(randomUUID());
 const first=await prepareBoardConversation(connection,board,'claude',false,host);attachBoardConversation(first.conversation!,'claude','session-current');
 const adopted=await adoptBoardConversation(connection,board,'claude','session-older',host);
 assert.deepEqual(adopted.note.chat,{provider:'claude',sessionId:'session-older'});assert.notEqual(adopted.conversation!.generation,first.conversation!.generation);assert.deepEqual(pointers.get(board.root+'|'+board.boardId),{provider:'claude',sessionId:'session-older'});
 // Writing in it keeps the association: the board shows this chat the next time it opens.
 assert.equal(attachBoardConversation(adopted.conversation!,'claude','session-older','job-2'),true);
 const reopened=await prepareBoardConversation(connection,board,'claude',false,host);assert.equal(reopened.note.chat?.sessionId,'session-older');assert.equal(reopened.conversation!.generation,adopted.conversation!.generation);
 // Adopting the chat that is already current does not rotate the conversation.
 assert.equal((await adoptBoardConversation(connection,board,'claude','session-older',host)).conversation!.generation,adopted.conversation!.generation);
});

test('the host keeps one current chat per board and project, hides a deleted chat and refuses other folders',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-chat-pointer-')),outside=await mkdtemp(path.join(os.tmpdir(),'board-chat-outside-')),token='synthetic-pointer-host-'.repeat(3),sessionId=randomUUID(),other=randomUUID(),board='00000000-0000-4000-8000-000000000001';
 const sdk={listSessions:async()=>[{sessionId,summary:'Synthetic board chat',cwd:root,lastModified:Date.now()}],getSessionMessages:async()=>[]};
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},new Jobs(),sdk as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api',query='/project-board/chat?'+new URLSearchParams({root,board});
 const call=async(route:string,data?:unknown,key=token)=>{const response=await fetch(url+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,body:await response.json().catch(()=>null)};};
 try{
  assert.deepEqual((await call(query)).body,{chat:null});
  assert.equal((await call('/project-board/chat',{root,board,provider:'claude',sessionId})).status,200);assert.deepEqual((await call(query)).body,{chat:{provider:'claude',sessionId}});
  // Another board of the same project has its own chat.
  assert.deepEqual((await call('/project-board/chat?'+new URLSearchParams({root,board:'11111111-1111-4111-8111-111111111111'}))).body,{chat:null});
  assert.equal((await call('/project-board/chat',{root,board,provider:'codex',sessionId:other})).status,200);assert.deepEqual((await call(query)).body,{chat:{provider:'codex',sessionId:other}});
  assert.equal((await call('/project-board/chat',{root,board,sessionId:null})).status,200);assert.deepEqual((await call(query)).body,{chat:null});
  // A chat removed from the list no longer opens with the board.
  await call('/project-board/chat',{root,board,provider:'claude',sessionId});assert.equal((await call('/sessions/'+sessionId+'/manage',{provider:'claude',action:'delete'})).status,200);assert.deepEqual((await call(query)).body,{chat:null});
  assert.equal((await call('/project-board/chat',{root,board,provider:'claude',sessionId:'not-a-session'})).status,400);assert.equal((await call('/project-board/chat',{root,board:'../escape',provider:'claude',sessionId})).status,400);
  assert.equal((await call('/project-board/chat',{root:outside,board,provider:'claude',sessionId})).status,403);assert.equal((await call(query,undefined,'wrong')).status,401);
 }finally{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});await rm(outside,{recursive:true,force:true});}
});
