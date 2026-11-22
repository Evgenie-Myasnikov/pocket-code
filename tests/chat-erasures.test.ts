import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {ChatLibrary} from '../server/chat-library';
import {mountChatErasures} from '../server/chat-erasures';

test('personal erasure feed pages only confirmed originals and detects intervening writes',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'pocket-erase-feed-')),library=new ChatLibrary(path.join(root,'state.json'));
 const app=express();app.set('env','test');let personal=true;mountChatErasures(app,library,()=>personal);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});});
 const api=(query='')=>fetch('http://127.0.0.1:'+(server.address() as {port:number}).port+'/api/chat-library/erasures'+query);
 await library.edit(data=>{
   for(let i=0;i<204;i++)data.chats['codex:'+String(i).padStart(3,'0')]={deleted:true,title:'Private title',originalRemoval:{cwd:'Private project',status:'done'}};
   data.chats['claude:pending']={originalRemoval:{status:'pending',cwd:'Private project'}};
   data.chats['claude:hidden']={deleted:true};data.chats['claude:active']={};
 });
 let page=await(await api()).json();assert.equal(page.entries.length,200);assert.equal(page.next,200);
 assert.deepEqual(page.entries[0],{provider:'codex',sessionId:'000'});
 assert.ok(!JSON.stringify(page).includes('Private'));assert.match(page.revision,/^[a-f0-9]{64}$/);
 const first=page.revision;
 page=await(await api('?snapshot='+first+'&offset=200')).json();assert.deepEqual(page.entries.map((item:{sessionId:string})=>item.sessionId),['200','201','202','203']);assert.equal(page.next,null);
 assert.deepEqual(await(await api('?known='+first)).json(),{revision:first,unchanged:true});
 await library.edit(data=>{data.chats['claude:pending']={deleted:true,originalRemoval:{cwd:'Private project',status:'done'}};});
 page=await(await api('?snapshot='+first+'&offset=200')).json();assert.equal(page.restart,true);assert.notEqual(page.revision,first);
 assert.deepEqual((await(await api('?known='+first)).json()).entries[0],{provider:'claude',sessionId:'pending'});
 personal=false;assert.equal((await api('?known='+page.revision)).status,403);
});
