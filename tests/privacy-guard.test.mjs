import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkContent} from '../scripts/privacy-guard.mjs';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
test('private values are detected in text and UTF-16 binaries without exposing them',()=>{
 const value=['synthetic','private','marker'].join('-');
 for(const encoding of ['utf8','utf16le'])assert.deepEqual(checkContent('sample.txt',Buffer.from(value,encoding),[value]),['local-private-value']);
});
test('credentials and forbidden files are rejected',()=>{
 assert.ok(checkContent('sample.txt',Buffer.from('gh'+'p_'+'x'.repeat(36))).includes('credential'));
 assert.ok(checkContent('sample.txt',Buffer.from('-----BEGIN '+'PRIVATE KEY-----')).includes('private-key'));
 for(const name of ['.env','nested/.env.production','uploads/photo.png','connection-key.txt','private.pem'])assert.ok(checkContent(name,Buffer.from('')).includes('private-file'));
});
test('synthetic source and documentation are accepted',()=>{
 assert.deepEqual(checkContent('src/example.ts',Buffer.from('const address="https://example.invalid";')),[]);
});
test('the guard checks staged blobs, historical commits and refuses the parent repository',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'pocket-privacy-'));
 const script=fileURLToPath(new URL('../scripts/privacy-guard.mjs',import.meta.url));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,stdio:'pipe'}).toString().trim();
 const scan=(args,cwd=dir)=>spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8'});
 try{
  git('init');git('config','user.name','Synthetic Tester');git('config','user.email','test@example.invalid');
  const secret='gh'+'p_'+'z'.repeat(36);writeFileSync(path.join(dir,'sample.txt'),secret);git('add','sample.txt');
  writeFileSync(path.join(dir,'sample.txt'),'safe working copy');
  const staged=scan(['--staged']);assert.equal(staged.status,1);assert.ok(!staged.stderr.includes(secret));
  git('commit','-m','Synthetic unsafe fixture');const old=git('rev-parse','HEAD');
  git('add','sample.txt');git('commit','-m','Synthetic clean fixture');
  assert.equal(scan(['--tree','HEAD']).status,0);assert.equal(scan(['--tree',old]).status,1);
  assert.equal(scan(['--tree','HEAD'],path.join(dir,'.git')).status,1);
  writeFileSync(path.join(dir,'.privacy-denylist.local.json'),'invalid json');assert.equal(scan(['--staged']).status,1);
 }finally{
  const resolved=path.resolve(dir);if(!resolved.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(resolved).startsWith('pocket-privacy-'))throw Error('Unexpected fixture cleanup path');
  rmSync(resolved,{recursive:true,force:true});
 }
});
