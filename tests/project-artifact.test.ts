import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {projectArtifact} from '../server/project-artifact.js';
test('artifact previews return inert text or signature-checked images/PDF, bounded inside selected project',async()=>{
  const base=await mkdtemp(path.join(os.tmpdir(),'pocket-artifacts-')),project=path.join(base,'project'),outside=path.join(base,'outside');
  try {
    await mkdir(project);await mkdir(outside);
    await writeFile(path.join(project,'result.md'),'# Result\n\n**Ready**');
    assert.equal((await projectArtifact(project,'result.md')).mimeType,'text/markdown');
    await writeFile(path.join(project,'untrusted.html'),'<script>alert(1)</script>');
    assert.equal((await projectArtifact(project,'untrusted.html')).mimeType,'text/plain');
    await writeFile(path.join(project,'fake.png'),'<svg onload="alert(1)">');
    assert.equal((await projectArtifact(project,'fake.png')).mimeType,'text/plain');
    await writeFile(path.join(project,'image.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSW0AAAAASUVORK5CYII=','base64'));
    assert.equal((await projectArtifact(project,'image.png')).mimeType,'image/png');
    await writeFile(path.join(project,'result.pdf'),'%PDF-1.7\n');
    assert.equal((await projectArtifact(project,'result.pdf')).mimeType,'application/pdf');
    await writeFile(path.join(project,'binary.bin'),Buffer.from([0,1,2]));await assert.rejects(projectArtifact(project,'binary.bin'),{status:415});
    await writeFile(path.join(project,'large.txt'),Buffer.alloc(1024*1024+1,65));await assert.rejects(projectArtifact(project,'large.txt'),{status:413});
    await writeFile(path.join(outside,'private.md'),'private');
    await assert.rejects(projectArtifact(project,path.join(outside,'private.md')),{status:403});
    await assert.rejects(projectArtifact(project,'https://example.test/result.png'),{status:400});
    await assert.rejects(projectArtifact(project,'../outside/private.md'),{status:403});
    await symlink(outside,path.join(project,'escape'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(projectArtifact(project,'escape/private.md'),{status:403});
  } finally {await rm(base,{recursive:true,force:true});}
});
