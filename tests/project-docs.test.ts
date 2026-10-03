import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {projectDocuments,readProjectDocument,documentProjects} from '../server/project-docs.js';
import {execFileSync} from 'node:child_process';

test('document library offers only Git projects containing the selected document kind',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'pocket-library-'));
 try{const a=path.join(base,'atlas'),b=path.join(base,'orbit'),c=path.join(base,'ordinary');for(const folder of [a,b,c])await mkdir(folder);
 for(const folder of [a,b])execFileSync('git',['init',folder],{windowsHide:true,stdio:'ignore'});
 await writeFile(path.join(a,'CHANGELOG.md'),'# Current changes');await writeFile(path.join(b,'AGENTS.md'),'# Rules');await writeFile(path.join(c,'CHANGELOG.md'),'# Not a Git project');
 assert.deepEqual((await documentProjects([a,b,c],'changelog')).map(p=>p.root),[a]);assert.deepEqual((await documentProjects([a,b,c],'rules')).map(p=>p.root),[b]);
 }finally{await rm(base,{recursive:true,force:true});}
});

test('project rules and local changelog are discovered without unrelated Markdown or dependency traversal',async()=>{
  const base=await mkdtemp(path.join(os.tmpdir(),'pocket-docs-'));
  try {
    await mkdir(path.join(base,'.claude/rules/nested'),{recursive:true});await mkdir(path.join(base,'node_modules/pkg'),{recursive:true});await mkdir(path.join(base,'docs'),{recursive:true});
    for(const name of ['AGENTS.md','CLAUDE.md','changelog.md','README.md','.claude/rules/nested/testing.md','node_modules/pkg/AGENTS.md','docs/HISTORY.md'])await writeFile(path.join(base,name),'# '+name);
    const {documents}=await projectDocuments(base);
    assert.deepEqual(documents.map(doc=>doc.path).sort(),['.claude/rules/nested/testing.md','AGENTS.md','CLAUDE.md','changelog.md','docs/HISTORY.md'].sort());
    assert.equal(documents.find(doc=>doc.path==='CLAUDE.md')?.appliesTo,'claude');
    assert.equal((await readProjectDocument(base,'changelog.md')).content,'# changelog.md');
    await writeFile(path.join(base,'changelog.md'),'# Updated');
    assert.equal((await readProjectDocument(base,'changelog.md')).content,'# Updated');
    await assert.rejects(readProjectDocument(base,'README.md'),{status:404});
    await assert.rejects(readProjectDocument(base,'../AGENTS.md'),{status:400});
    await assert.rejects(readProjectDocument(base,'C:\\private\\AGENTS.md'),{status:400});
  } finally {await rm(base,{recursive:true,force:true});}
});

test('rules cannot escape through symlinked directories and oversized/binary documents fail explicitly',async()=>{
  const base=await mkdtemp(path.join(os.tmpdir(),'pocket-docs-'));const project=path.join(base,'project'),outside=path.join(base,'outside');
  try {
    await mkdir(project);await mkdir(outside);await mkdir(path.join(project,'.claude'));
    await writeFile(path.join(outside,'private.md'),'hidden');
    await symlink(outside,path.join(project,'.claude/rules'),process.platform==='win32'?'junction':'dir');
    assert.equal((await projectDocuments(project)).documents.length,0);
    await assert.rejects(readProjectDocument(project,'.claude/rules/private.md'),{status:404});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.alloc(1024*1024+1,65));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:413});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.from([65,0,66]));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:415});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.from([0xc0,0xaf]));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:415});
  } finally {await rm(base,{recursive:true,force:true});}
});
