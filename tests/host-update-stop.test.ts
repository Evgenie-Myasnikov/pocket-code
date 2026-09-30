import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {HostUpdater} from '../server/host-update.js';
test('closing the host prevents pending update preparation from downloading or starting a successor',{skip:process.platform!=='win32'},async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'host-stop-'));let resolve!:(value:any)=>void,downloads=0,shutdowns=0;
  const release=new Promise(r=>{resolve=r});
  const updater=new HostUpdater({enabled:true,hostRelease:()=>release,downloadHost:()=>{downloads++;throw Error('Must not download');}} as any,{version:'1.0.0',directory,previousDir:directory,roots:[directory],port:4318,host:'127.0.0.1',isBusy:()=>false,tunnel:()=>({}),shutdown:()=>shutdowns++});
  try{
    await updater.check('1.1.0');updater.close();resolve({version:'1.1.0'});await new Promise(r=>setImmediate(r));
    assert.equal(downloads,0);assert.equal(shutdowns,0);await assert.rejects(updater.check('1.1.0'),/shutting down/);assert.throws(()=>updater.handoff('1.1.0',process.pid));
  }finally{updater.close();await rm(directory,{recursive:true,force:true});}
});
