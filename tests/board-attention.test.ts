import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {BoardStore} from '../server/boards.js';
import {addNotice} from '../server/board-attention.js';

test('board assignments notify once, persist read state and reject unknown or pending recipients',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'board-attention-')),file=path.join(dir,'store.json');
 try{const store=await new BoardStore(file).load(),workspaceId=randomUUID(),boardId=randomUUID(),person=randomUUID(),pending=randomUUID(),noteId=randomUUID();
 await store.mutate(data=>{data.workspaces.push({id:workspaceId,name:'Example',roots:[dir],password:'',hostPeople:[],members:[{id:person,name:'Alex Example',role:'developer',tokenHash:'synthetic',approval:'approved'},{id:pending,name:'Sam Example',role:'developer',tokenHash:'synthetic-pending',approval:'pending'}]});data.boards.push({id:boardId,workspaceId,name:'Example board',root:dir,revision:0,versionSource:'planned',versions:[],notes:[{id:noteId,title:'Example task',description:'Which format?',branch:'',status:'idea',owner:'',x:0,y:0,dependencies:[]}]});});
 let board=store.getBoard(boardId)!;board.notes[0].assigneeIds=[person];await store.save(boardId,0,board.notes);assert.equal(store.snapshot().notices.length,1);assert.equal(store.snapshot().notices[0].recipientId,person);
 await store.save(boardId,1,board.notes);assert.equal(store.snapshot().notices.length,1);
 board.notes[0].status='questions';await store.save(boardId,2,board.notes);assert.equal(store.snapshot().notices[0].kind,'question');
 board.notes[0].assigneeIds=[pending];await assert.rejects(()=>store.save(boardId,3,board.notes),/approved/);assert.equal(store.getBoard(boardId)!.revision,3);
 await store.mutate(data=>{const b=data.boards[0];addNotice(data,b,b.notes[0],'host','question','Clarify','same-request');addNotice(data,b,b.notes[0],'host','question','Clarify','same-request');data.notices[0].readAt=123;});
 const loaded=await new BoardStore(file).load();assert.equal(loaded.snapshot().notices.filter(n=>n.id==='same-request').length,1);assert.equal(loaded.snapshot().notices[0].readAt,123);
 }finally{await rm(dir,{recursive:true,force:true});}
});
