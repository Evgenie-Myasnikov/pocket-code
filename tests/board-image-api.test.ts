import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {AddressInfo} from 'node:net';
import {createApp} from '../server/app.js';
import {Jobs} from '../server/jobs.js';

test('board image API requires authentication, confines roots and enforces viewer permissions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-image-api-')),outside=await mkdtemp(path.join(os.tmpdir(),'board-image-outside-')),token='synthetic-board-host-'.repeat(3);
 const {app,jobs,terminals}=await createApp({roots:[root],token,hostName:'Synthetic',uploads:path.join(root,'uploads'),desktopSessionIndexes:[]},new Jobs(),{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api';
 const call=(route:string,data?:unknown,key=token)=>fetch(url+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 try{
  const data={root,caption:'Synthetic image',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII='};
  assert.equal((await call('/project-board/image',data,'wrong')).status,401);
  assert.equal((await call('/project-board/image',{...data,root:outside})).status,403);
  const upload=await call('/project-board/image',data);assert.equal(upload.status,200);const image=await upload.json();
  const get='/project-board/image?root='+encodeURIComponent(root)+'&path='+encodeURIComponent(image.path);
  assert.equal((await (await call(get)).json()).data,data.data);
  const ws=await (await call('/workspaces',{name:'Synthetic images',password:'synthetic password',roots:[root]})).json();
  const guest=await (await call('/workspace-login',{name:'Synthetic images',password:'synthetic password',displayName:'Reader Example'},'')).json();
  assert.equal((await call('/workspaces/'+ws.id+'/member',{memberId:guest.memberId,role:'viewer',approval:'approved'})).status,200);
  assert.equal((await call(get,undefined,guest.token)).status,200);
  assert.equal((await call('/project-board/image',data,guest.token)).status,403);
  assert.equal((await call(get.replace(encodeURIComponent(root),encodeURIComponent(outside)),undefined,guest.token)).status,403);
 }finally{jobs.close();terminals.close();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
