import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {publicBoard,saveBoardSnapshot,readBoardSnapshot,listBoardSnapshots} from '../server/board-snapshots';
import type {ProjectBoard} from '../server/boards';
const example=():ProjectBoard=>({id:randomUUID(),workspaceId:randomUUID(),name:'Product ideas',root:'C:\\Private\\Project',revision:4,versionSource:'planned',versions:['1.0'],notes:[{id:randomUUID(),title:'Improve search',description:'Add filtering by status.',status:'idea',branch:'1.0',priority:'high',owner:'Alex Example',assigneeId:'person',assigneeIds:['person'],chat:{provider:'codex',sessionId:'private-chat'},x:24,y:70,dependencies:[]}]});
test('shared snapshots whitelist board content and reject obvious personal text',()=>{
 const board=example(),json=JSON.stringify(publicBoard(board,['Alex Example']));for(const excluded of ['Alex Example','Private','private-chat','workspaceId','assignee','owner','revision'])assert.equal(json.includes(excluded),false);
 assert.equal(publicBoard(board).notes[0].priority,'high');board.notes[0].description='Discuss with Alex Example';assert.throws(()=>publicBoard(board,['Alex Example']),/personal data/);board.notes[0].description='Email person@example.invalid';assert.throws(()=>publicBoard(board),/personal data/);
});
test('repository snapshots roundtrip without committing and reject traversal/private metadata',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pocket-snapshot-'));try{
 execFileSync('git',['init',root],{windowsHide:true,stdio:'ignore'});assert.deepEqual(await listBoardSnapshots(root),[]);
 const board=example(),saved=await saveBoardSnapshot(root,board,['Alex Example']),file=path.basename(saved.path);assert.equal((await listBoardSnapshots(root))[0].name,board.name);assert.deepEqual(await readBoardSnapshot(root,file),publicBoard(board));assert.equal((await readFile(path.join(root,saved.path),'utf8')).includes('private-chat'),false);
 await assert.rejects(()=>readBoardSnapshot(root,'../secret.json'));const invalid={...publicBoard(board),participants:[{name:'Hidden identity'}]};await writeFile(path.join(root,saved.path),JSON.stringify(invalid));await assert.rejects(()=>readBoardSnapshot(root,file));assert.deepEqual(await listBoardSnapshots(root),[]);
 await mkdir(path.join(root,'nested'));await assert.rejects(()=>saveBoardSnapshot(path.join(root,'nested'),board,[]),/repository root/);
 assert.equal(execFileSync('git',['-C',root,'status','--porcelain'],{windowsHide:true,encoding:'utf8'}).trim(),'?? project-boards/');
 }finally{await rm(root,{recursive:true,force:true});}
});
