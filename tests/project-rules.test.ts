import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {projectRuleSettings,saveProjectRuleSettings,projectBoardInstructions} from '../server/project-rules.js';
import {boardInstructions} from '../server/board-instructions.js';
import {projectDocuments,readProjectDocument} from '../server/project-docs.js';

test('built-in board rule defaults on, persists per repository, and remains readable when disabled',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'pocket-rules-'));
  const other=await mkdtemp(path.join(os.tmpdir(),'pocket-rules-'));
  try{
    assert.equal((await projectRuleSettings(root)).boardMaintenance,true);
    assert.equal(await projectBoardInstructions(root),boardInstructions);
    await saveProjectRuleSettings(root,false);
    assert.equal((await projectRuleSettings(root)).boardMaintenance,false);
    assert.match(await projectBoardInstructions(root),/disabled/);
    assert.equal(await projectBoardInstructions(other),boardInstructions);
    const rule=(await projectDocuments(root)).documents.find(d=>d.source==='Pocket Code')!;
    assert.equal((await readProjectDocument(root,rule.path)).content,boardInstructions);
    await saveProjectRuleSettings(root,true);
    assert.equal(await projectBoardInstructions(root),boardInstructions);
  }finally{await rm(root,{recursive:true,force:true});await rm(other,{recursive:true,force:true});}
});
