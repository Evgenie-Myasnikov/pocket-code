import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {saveBoardImage,readBoardImage,boardImages} from '../server/board-images.js';
import {createProjectBoard,updateProjectBoard,projectBoard} from '../server/project-board.js';
import {publicBoard} from '../server/board-snapshots.js';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
test('images survive repository saves; detach preserves shared bytes and old boards still load',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-image-'));
 try{
  const board=await createProjectBoard(root,[],'en'),image=await saveBoardImage(root,png,'Synthetic concept');
  assert.deepEqual(await saveBoardImage(root,png,'Synthetic concept'),image);
  const notes=board.notes.map((n,i)=>i? n:{...n,images:[image]});
  let saved=await updateProjectBoard(root,board.repositoryRevision,notes,board.versions,[]);
  assert.deepEqual((await projectBoard(root))!.notes[0].images,[image]);assert.equal((await readBoardImage(root,image.path)).data,png);
  saved=await updateProjectBoard(root,saved.repositoryRevision,saved.notes.map(n=>({...n,images:[]})),saved.versions,[]);
  assert.equal((await readFile(path.join(root,image.path))).toString('base64'),png);
  assert.deepEqual(saved.notes[0].images,[]);
  assert.throws(()=>publicBoard({...saved,notes:[{...notes[0],images:[{...image,caption:'person@example.invalid'}]}]}),/personal data/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('image storage rejects active content, traversal, oversized payloads, corruption and directory links',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'board-image-')),outside=await mkdtemp(path.join(os.tmpdir(),'board-outside-'));
 try{
  await assert.rejects(saveBoardImage(root,Buffer.from('<svg onload="alert(1)"/>').toString('base64'),'unsafe'),/PNG/);
  await assert.rejects(saveBoardImage(root,'a'.repeat(13981020),'large'),/10 MB/);
  await assert.rejects(saveBoardImage(root,'!!!','bad'),/encoding/);
  await assert.rejects(readBoardImage(root,'../private.png'));
  assert.equal(boardImages.safeParse(Array.from({length:13},()=>({path:'project-boards/assets/'+'a'.repeat(64)+'.png',caption:''}))).success,false);
  const image=await saveBoardImage(root,png,'Test');await writeFile(path.join(root,image.path),Buffer.from(png,'base64').subarray(0,10));
  await assert.rejects(readBoardImage(root,image.path),/changed/);
  const linked=path.join(root,'linked');await mkdir(linked);await symlink(outside,path.join(linked,'project-boards'),'junction');
  await assert.rejects(saveBoardImage(linked,png,'Test'),/Linked/);
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
