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
 assert.deepEqual((await documentProjects([a,b,c],'changelog')).map(p=>p.root),[a]);const rules=await documentProjects([a,b,c],'rules');assert.deepEqual(rules.map(p=>[p.root,Boolean(p.builtInOnly)]),[[b,false],[a,true]],'authored rules first, built-in-only projects last');assert.ok(rules.every(p=>p.documents.every(doc=>!doc.builtIn)),'the built-in rule never makes a project look authored');
 assert.deepEqual((await documentProjects([a,b,c],'files')).map(p=>p.root).sort(),[a,b].sort());
 }finally{await rm(base,{recursive:true,force:true});}
});

test('project rules and local changelog are discovered without unrelated Markdown or dependency traversal',async()=>{
  const base=await mkdtemp(path.join(os.tmpdir(),'pocket-docs-'));
  try {
    await mkdir(path.join(base,'.claude/rules/nested'),{recursive:true});await mkdir(path.join(base,'node_modules/pkg'),{recursive:true});await mkdir(path.join(base,'docs'),{recursive:true});
    for(const name of ['AGENTS.md','CLAUDE.md','changelog.md','README.md','.claude/rules/nested/testing.md','node_modules/pkg/AGENTS.md','docs/HISTORY.md'])await writeFile(path.join(base,name),'# '+name);
    const {documents}=await projectDocuments(base);
    assert.deepEqual(documents.map(doc=>doc.path).sort(),['.claude/rules/nested/testing.md','AGENTS.md','CLAUDE.md','changelog.md','docs/HISTORY.md','pocket-code:board-maintenance'].sort());
    assert.deepEqual(documents.find(doc=>doc.path==='AGENTS.md')?.readers,[{provider:'claude',status:'shadowed',reason:'claude-md'},{provider:'codex',status:'loaded'},{provider:'copilot',status:'loaded'}]);
    assert.equal(documents.find(doc=>doc.path==='CLAUDE.md')?.readers?.find(item=>item.provider==='codex')?.status,'not-read');
    const first=await readProjectDocument(base,'changelog.md');assert.equal(first.content,'# changelog.md');
    const same=await readProjectDocument(base,'changelog.md',first.version);assert.equal(same.unchanged,true);assert.equal(same.content,undefined,'an unchanged document is not resent');
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
    assert.equal((await projectDocuments(project)).documents.filter(d=>d.source!=='Pocket Code').length,0);
    await assert.rejects(readProjectDocument(project,'.claude/rules/private.md'),{status:404});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.alloc(1024*1024+1,65));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:413});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.from([65,0,66]));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:415});
    await writeFile(path.join(project,'AGENTS.md'),Buffer.from([0xc0,0xaf]));
    await assert.rejects(readProjectDocument(project,'AGENTS.md'),{status:415});
  } finally {await rm(base,{recursive:true,force:true});}
});

test('Copilot instruction files and .claude/CLAUDE.md are found with honest reader labels and frontmatter scope',async()=>{
  const base=await mkdtemp(path.join(os.tmpdir(),'pocket-docs-'));
  try {
    await mkdir(path.join(base,'.github/instructions'),{recursive:true});await mkdir(path.join(base,'.claude/rules'),{recursive:true});await mkdir(path.join(base,'.agents/rules'),{recursive:true});
    await writeFile(path.join(base,'AGENTS.md'),'# Shared');await writeFile(path.join(base,'.github/copilot-instructions.md'),'# Copilot');
    await writeFile(path.join(base,'.github/instructions/api.instructions.md'),'---\napplyTo: "src/api/**"\n---\n# API');await writeFile(path.join(base,'.github/instructions/notes.md'),'# Not an instruction file');
    await writeFile(path.join(base,'.claude/CLAUDE.md'),'# Claude project');await writeFile(path.join(base,'.claude/rules/ui.md'),'---\npaths:\n  - "src/ui/**"\n---\n# UI');await writeFile(path.join(base,'.agents/rules/style.md'),'# Style');
    const {documents}=await projectDocuments(base),find=(file:string)=>documents.find(doc=>doc.path===file)!;
    assert.deepEqual(documents.filter(doc=>!doc.builtIn).map(doc=>doc.path).sort(),['.agents/rules/style.md','.claude/CLAUDE.md','.claude/rules/ui.md','.github/copilot-instructions.md','.github/instructions/api.instructions.md','AGENTS.md'].sort());
    assert.equal(find('AGENTS.md').readers?.find(item=>item.provider==='claude')?.status,'loaded','without a root CLAUDE.md Claude reads AGENTS.md');
    assert.equal(find('.github/copilot-instructions.md').appliesTo,'copilot');
    assert.deepEqual(find('.github/instructions/api.instructions.md').readers?.find(item=>item.provider==='copilot'),{provider:'copilot',status:'on-demand',reason:'apply-to'});assert.equal(find('.github/instructions/api.instructions.md').scope,'src/api/**');
    assert.equal(find('.claude/rules/ui.md').scope,'src/ui/**');assert.equal(find('.claude/CLAUDE.md').appliesTo,'claude');
    assert.ok(find('.agents/rules/style.md').readers?.every(item=>item.status==='on-demand'&&item.reason==='linked'),'.agents/rules is read only when linked, not by Claude automatically');
  } finally {await rm(base,{recursive:true,force:true});}
});
