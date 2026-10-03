import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createProjectBoard,projectBoard,updateProjectBoard,deleteProjectBoard} from '../server/project-board.js';
test('each project has one persisted board; creation is idempotent and stale edits cannot overwrite it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'project-board-'));
 try{
  assert.equal(await projectBoard(root),null);
  const [a,b]=await Promise.all([createProjectBoard(root,[],'en'),createProjectBoard(root,[],'en')]);assert.equal(a.id,b.id);assert.equal((await readdir(path.join(root,'project-boards'))).length,1);
  const notes=a.notes.map((n,i)=>i===0?{...n,title:'Updated idea',owner:'Private Person',assigneeIds:['private-id']}:n);
  const saved=await updateProjectBoard(root,a.repositoryRevision,notes,a.versions,[]);assert.equal(saved.notes[0].title,'Updated idea');assert.equal(saved.notes[0].owner,'');assert.deepEqual(saved.notes[0].assigneeIds,[]);
  await assert.rejects(updateProjectBoard(root,a.repositoryRevision,a.notes,a.versions,[]),/changed/);
  assert.equal((await projectBoard(root))!.notes[0].title,'Updated idea');
  await writeFile(path.join(root,'project-boards',a.repositoryFile),'{invalid');await assert.rejects(createProjectBoard(root,[],'en'));
 }finally{await rm(root,{recursive:true,force:true});}
});

 test('project board deletion rejects stale revisions and preserves other project files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'project-board-delete-'));
 try{
 const board=await createProjectBoard(root,[],'en');
 await writeFile(path.join(root,'README.md'),'Keep the project');
 await writeFile(path.join(root,'project-boards','image.png'),'Keep image assets');
 const changed=await updateProjectBoard(root,board.repositoryRevision,board.notes.map((n,i)=>i===0?{...n,title:'Changed'}:n),board.versions,[]);
 await assert.rejects(deleteProjectBoard(root,board.repositoryRevision),/changed/);assert.ok(await projectBoard(root));
 await deleteProjectBoard(root,changed.repositoryRevision);assert.equal(await projectBoard(root),null);
 assert.deepEqual((await readdir(path.join(root,'project-boards'))),['image.png']);assert.deepEqual((await readdir(root)).sort(),['README.md','project-boards'].sort());
 await assert.rejects(deleteProjectBoard(root,changed.repositoryRevision),/not found/);
 }finally{await rm(root,{recursive:true,force:true});}
 });
