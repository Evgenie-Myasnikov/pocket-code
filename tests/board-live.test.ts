import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
import {BoardLiveActivity} from '../server/board-live';
import {changedBoardObjects} from '../src/board-live-changes';

test('change detection keeps note and canvas namespaces distinct and ignores private assignments',()=>{
 const id=randomUUID(),note={id,title:'Before',description:'Criteria',status:'idea',priority:'normal',branch:'',x:0,y:0,dependencies:[]};
 const before:any={notes:[note],canvas:{items:[{id,kind:'card',text:'Before'}]}};
 assert.deepEqual(changedBoardObjects(before,{...before,notes:[{...note,title:'After'}]}),[id]);
 assert.deepEqual(changedBoardObjects(before,{...before,notes:[{...note,assigneeIds:['synthetic-id']}]}),[]);
});

test('live activity expires and metadata polling observes changes without replacing unchanged snapshots',async()=>{
 const events=new BoardLiveActivity(),item=randomUUID();events.set('board',[item,item],'editing');assert.deepEqual(events.get('board')?.ids,[item]);events.get('board')!.expiresAt=0;assert.equal(events.get('board'),null);
 const temporary=await mkdtemp(path.join(tmpdir(),'board-live-')),root=path.join(temporary,'project'),dataDir=path.join(temporary,'data'),token=randomUUID();
 await mkdir(path.join(root,'project-boards'),{recursive:true});const id=randomUUID(),file=`board-${id}.json`,target=path.join(root,'project-boards',file);
 const board={format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[]};await writeFile(target,JSON.stringify(board));
 const jobs=new Jobs();const {app,closeTaskServices}=await createApp({token,hostName:'Synthetic PC',roots:[root],uploads:path.join(dataDir,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`,headers={authorization:`Bearer ${token}`},query=new URLSearchParams({root,file});
 try{
  assert.equal((await fetch(base+'/project-board/live?'+query)).status,401);
  const response=await fetch(base+'/project-board/live?'+query,{headers});assert.equal(response.status,200);const first:any=await response.json();assert.equal(first.board.name,board.name);assert.match(first.version,/^[a-f0-9]{64}$/);
  query.set('known',first.version);const same:any=await (await fetch(base+'/project-board/live?'+query,{headers})).json();assert.equal(same.unchanged,true);assert.equal(same.board,undefined);
  const activity=await fetch(base+'/project-board/activity',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({root,file,ids:[item],phase:'saved'})});assert.equal(activity.status,200);
  const signal:any=await (await fetch(base+'/project-board/live?'+query,{headers})).json();assert.equal(signal.unchanged,true);assert.deepEqual(signal.activity.ids,[item]);
  await writeFile(target,JSON.stringify({...board,name:'Updated synthetic board'}));const next:any=await (await fetch(base+'/project-board/live?'+query,{headers})).json();assert.notEqual(next.version,first.version);assert.equal(next.board.name,'Updated synthetic board');
  query.set('root',temporary);assert.equal((await fetch(base+'/project-board/live?'+query,{headers})).status,403);query.set('root',root);query.set('file','../board.json');assert.equal((await fetch(base+'/project-board/live?'+query,{headers})).status,400);
 }finally{jobs.close();await new Promise<void>(r=>server.close(()=>r()));await closeTaskServices?.();await rm(temporary,{recursive:true,force:true});}
});
