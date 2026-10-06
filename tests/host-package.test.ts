import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { compareVersions, unpackHost, validateHostAsset } from '../server/host-package.js';
import { buildHostBundle } from '../scripts/build-host.mjs';
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
    for(const badPath of ['../outside','server/../../outside','server\\outside','server/CON.txt','server/file.','server/index.ts','SERVER/index.ts','project-boards/../outside','project-boards/private/token.json','project-boards/assets/private.png']){
      const bad=fixture([{path:badPath}]);await assert.rejects(unpackHost(bad.bytes,validateHostAsset(bad.manifest,bad.release),dir));
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('the real host packager preserves Miro support and portable boards through verified installation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'host-packager-test-'));try{
    const root=path.join(dir,'source');
    const files:Record<string,string>={
      'package.json':JSON.stringify({name:'pocket-code',version:'1.2.3'}),'package-lock.json':'{}','tsconfig.json':'{}',
      'server/index.ts':'synthetic host','server/miro-auth.ts':'synthetic Miro adapter','src/App.tsx':'synthetic UI','dist/index.html':'synthetic built UI',
      'scripts/host-update-worker.mjs':'synthetic updater','scripts/board-cli.mjs':'synthetic board helper','scripts/miro-cli.mjs':'synthetic Miro helper',
      'project-boards/README.md':'Synthetic public product board','project-boards/board-fixture.json':JSON.stringify({format:'pocket-code-board',version:1,notes:[]}),
      ['project-boards/assets/'+ 'a'.repeat(64)+'.png']:'synthetic image bytes',
    };
    for(const [name,content] of Object.entries(files)){const target=path.join(root,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,content);}
    const built=await buildHostBundle(root);
    const asset={version:'1.2.3',asset:built.asset,size:built.bytes.length,sha256:createHash('sha256').update(built.bytes).digest('hex'),protocol:1,releaseId:7};
    const installed=await unpackHost(built.bytes,asset,path.join(dir,'install'));
    assert.equal(built.fileCount,Object.keys(files).length);
    for(const [name,content] of Object.entries(files))assert.equal(await readFile(path.join(installed,name),'utf8'),content,name);
    await writeFile(path.join(root,'server','.env'),'synthetic private setting');
    await assert.rejects(buildHostBundle(root),/Private files cannot be packaged/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
