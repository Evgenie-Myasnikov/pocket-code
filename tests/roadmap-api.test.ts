import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';
import {pocketCodeExample} from '../server/board-example.js';
test('old Pocket Code example migrates to current changelog and refresh never needs reseeding',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-roadmap-')),uploads=path.join(root,'uploads'),id=randomUUID(),token='synthetic-host-key-'.repeat(3);
 await writeFile(path.join(root,'package.json'),' {"name":"pocket-code"}');await writeFile(path.join(root,'CHANGELOG.md'),'# Changelog\n## 2026-10-03 - Updated (0.25.0)\n- Changed: Current release features.\n- Release: Published v0.25.0.\n');
 await mkdir(path.join(uploads,'.boards'),{recursive:true});await writeFile(path.join(uploads,'.boards','workspaces.json'),JSON.stringify({workspaces:[],boards:[{id,name:'Pocket Code',root,revision:0,versionSource:'planned',...pocketCodeExample()}]}));
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads,desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/boards/'+id,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 try{let board=await (await fetch(url,{headers})).json();assert.equal(board.source,'project-changelog');assert.deepEqual(board.versions,['0.25.0']);assert.equal(board.notes[0].status,'done');
 await writeFile(path.join(root,'CHANGELOG.md'),'# Changelog\n## 2026-10-04 - Next (0.25.1)\n- Changed: Latest feature.\n');board=await (await fetch(url,{headers})).json();assert.deepEqual(board.versions,['0.25.1']);assert.equal(board.notes[0].status,'review');assert.equal((await fetch(url,{headers,method:'POST',body:JSON.stringify({revision:board.revision,notes:[],versions:[]})})).status,403);
 }finally{jobs.close();terminals.close();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
});
