import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compareVersions, unpackHost, validateHostAsset } from '../server/host-package.js';
function fixture(extra: {path:string;content?:string}[] = []) {
  const files = [...['package.json','package-lock.json','server/index.ts','scripts/host-update-worker.mjs','dist/index.html'].map(p=>({path:p,content:p==='package.json'?JSON.stringify({name:'pocket-code',version:'1.2.3'}):'example'})),...extra].map(f=>{const b=Buffer.from(f.content||'content');return{path:f.path,content:b.toString('base64'),sha256:createHash('sha256').update(b).digest('hex')};});
  const bytes=gzipSync(Buffer.from(JSON.stringify({format:1,version:'1.2.3',files})));
  const host={asset:'Pocket-Code-Host-1.2.3.json.gz',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),protocol:1};
  const release={id:7,tag_name:'v1.2.3',assets:[{name:host.asset,size:host.size,state:'uploaded',digest:'sha256:'+host.sha256}]};
  return{bytes,host,release,manifest:{applicationId:'app.pocketcode.mobile',version:'1.2.3',host}};
}
test('host release must match the exact stable tag, uploaded asset and digest',()=>{
  const f=fixture();assert.equal(validateHostAsset(f.manifest,f.release).version,'1.2.3');
  for(const bad of [{...f.release,draft:true},{...f.release,prerelease:true},{...f.release,tag_name:'v9.0.0'},{...f.release,assets:[]}])assert.throws(()=>validateHostAsset(f.manifest,bad));
  assert.throws(()=>validateHostAsset({...f.manifest,host:{...f.host,asset:'../../outside'}},f.release));
  assert.equal(compareVersions('0.13.0','0.12.0')>0,true);assert.equal(compareVersions('0.9.0','0.13.0')<0,true);assert.throws(()=>compareVersions('latest','0.13.0'));
});
test('host bundle is verified before writing a separate installation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'host-bundle-test-'));try{
    const f=fixture();const asset=validateHostAsset(f.manifest,f.release);const installed=await unpackHost(f.bytes,asset,dir);
    assert.equal(JSON.parse(await readFile(path.join(installed,'package.json'),'utf8')).version,'1.2.3');
    await assert.rejects(unpackHost(Buffer.from('tampered'),asset,dir));
    for(const badPath of ['../outside','server/../../outside','server\\outside','server/CON.txt','server/file.','server/index.ts','SERVER/index.ts']){
      const bad=fixture([{path:badPath}]);await assert.rejects(unpackHost(bad.bytes,validateHostAsset(bad.manifest,bad.release),dir));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
