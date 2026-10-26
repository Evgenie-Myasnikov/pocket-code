import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
import {BoardStore} from '../server/boards.js';
import {createProjectBoard} from '../server/project-board.js';
import {BOARD_VERSION_LIMIT} from '../src/board-limits.js';

test('host and repository saves share the 64-version boundary; rejected additions preserve board and Git state',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-version-api-')),uploads=path.join(root,'uploads'),token='synthetic-version-host-key-'.repeat(3);
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init');git('-c','user.name=Synthetic','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','fixture');
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads,desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api',headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const call=(route:string,body?:unknown)=>fetch(base+route,{headers,method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body)});
 const versions=Array.from({length:BOARD_VERSION_LIMIT},(_,i)=>'1.0.'+i);
 try{
  for(const versionSource of ['planned','git']){
   const created=await (await call('/boards',{root,name:'Synthetic release history',example:false,versionSource})).json(),route='/boards/'+created.id;
   const save=await call(route,{revision:0,notes:[],versions:versions.slice(0,-1)});assert.equal(save.status,200);
   let current=await save.json();
   const added=await call(route+'/branch',{revision:current.revision,name:'release/last-'+versionSource});assert.equal(added.status,200);current=await added.json();
   assert.equal(current.versions.length,BOARD_VERSION_LIMIT);
   assert.equal((await call(route+'/branch',{revision:current.revision,name:'release/overflow-'+versionSource})).status,400);
   assert.equal((await call(route,{revision:current.revision,notes:[],versions:[...current.versions,'overflow']})).status,400);
   assert.deepEqual((await (await call(route)).json()).versions,current.versions);
   assert.equal((await (await call(route)).json()).revision,current.revision);
   const renamed=await call(route+'/branch',{revision:current.revision,previous:'release/last-'+versionSource,name:'release/renamed-'+versionSource});assert.equal(renamed.status,200);
   current=await renamed.json();assert.equal(current.versions.length,BOARD_VERSION_LIMIT);
   const reloaded=await new BoardStore(path.join(uploads,'.boards','workspaces.json')).load();assert.deepEqual(reloaded.getBoard(created.id)?.versions,current.versions);
   assert.equal((await call(route,{revision:current.revision,notes:[],versions:versions.slice(0,40)})).status,200);
  }
  assert.equal(git('branch','--list','release/overflow-git'),'');
  assert.equal(git('branch','--list','release/renamed-git'),'release/renamed-git');
  const board=await createProjectBoard(root,[],'en');
  const saved=await call('/project-board',{root,repositoryRevision:board.repositoryRevision,notes:board.notes,versions});assert.equal(saved.status,200);
  const current=await saved.json();assert.deepEqual(current.versions,versions);
  assert.equal((await call('/project-board',{root,repositoryRevision:current.repositoryRevision,notes:current.notes,versions:[...versions,'overflow']})).status,400);
  const after=await (await call('/project-board?root='+encodeURIComponent(root))).json();assert.equal(after.board.repositoryRevision,current.repositoryRevision);assert.deepEqual(after.board.versions,versions);
 }finally{jobs.close();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
