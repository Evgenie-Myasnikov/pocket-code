import assert from 'node:assert/strict';
import test from 'node:test';
import {editFiles} from '../src/edit-diff';

test('replacement preserves internal context, indentation and actual blank lines',()=>{
  const [file]=editFiles({file_path:'src/colors.ts',old_string:'old\n\tkeep\n\nlast\n',new_string:'new\r\n\tkeep\r\n\r\nnext\r\n'},'edit');
  assert.equal(file.path,'src/colors.ts');
  assert.deepEqual(file.lines.map(row=>[row.kind,row.text]),[['del','old'],['add','new'],['context','\tkeep'],['context',''],['del','last'],['add','next']]);
});

test('write reports actual content and reserves addition counts for confirmed new files',()=>{
  const content='  first\n\nthird\n',input={file_path:'sample.ts',content};
  const [write]=editFiles(input,'write'),[create]=editFiles(input,'write',true);
  assert.equal(write.content,content);assert.equal(write.counted,false);
  assert.deepEqual(write.lines.map(row=>row.text),['  first','','third']);
  assert.deepEqual(create.lines.map(row=>row.kind),['add','add','add']);
  assert.equal(editFiles({old_string:'a',new_string:'b',replace_all:true},'edit')[0].counted,false);
});

test('unified and apply_patch formats keep file boundaries and literal leading signs',()=>{
  const patch='--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n--- old\n+++ new\n--- /dev/null\n+++ b/b.ts\n@@ -0,0 +1 @@\n+ second\n';
  const files=editFiles({patch},'apply_patch');
  assert.deepEqual(files.map(file=>file.path),['a.ts','b.ts']);
  assert.deepEqual(files[0].lines.slice(1),[{kind:'del',text:'-- old'},{kind:'add',text:'++ new'}]);
  const changes=editFiles({input:'*** Begin Patch\n*** Add File: a.ts\n+one\n+\n*** Delete File: old.ts\n*** End Patch'},'apply_patch');
  assert.deepEqual(changes.map(f=>f.path),['a.ts','old.ts']);
  assert.deepEqual(changes[0].lines.map(row=>row.text),['one','']);assert.equal(changes[1].counted,false);
});

test('Codex raw added content and file edit diffs retain the path and code',()=>{
  const [added,edited]=editFiles({changes:[{path:'added.ts',kind:{type:'add'},diff:'  let x=0;\n++x;\n'},{path:'main.ts',kind:{type:'update'},diff:'@@\n- old\n+ next'}]},'file changes');
  assert.deepEqual(added.lines,[{kind:'add',text:'  let x=0;'},{kind:'add',text:'++x;'}]);assert.equal(edited.path,'main.ts');
  assert.deepEqual(edited.lines.slice(1).map(r=>[r.kind,r.text]),[['del',' old'],['add',' next']]);
});
