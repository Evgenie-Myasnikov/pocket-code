import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diffRows,inlineDiffRows,singleDiffSide,wordRanges,hunkLabel} from '../src/diff-rows.js';

test('inline replacement preserves deletion block followed by addition block',()=>{
 const rows=inlineDiffRows(diffRows('@@ -1,4 +1,4 @@\n context\n-old one\n-old two\n+new one\n+new two\n tail'));
 assert.deepEqual(rows.filter(row=>row.kind!=='hunk').map(row=>[row.sign||' ',row.left??row.right]),[[' ','context'],['-','old one'],['-','old two'],['+','new one'],['+','new two'],[' ','tail']]);
});
test('only wholly new or removed content uses the whole width',()=>{
 for(const [patch,side] of [['@@ -0,0 +1,2 @@\n+one\n+two','added'],['@@ -1,2 +0,0 @@\n-one\n-two','removed'],['@@ -8,0 +9,2 @@\n+one\n+two',null],['@@ -1 +1,2 @@\n context\n+two',null]] as const)assert.equal(singleDiffSide(patch,diffRows(patch)),side);
});
test('replaced line pairs mark only the changed words, in both layouts',()=>{
 const rows=diffRows('@@ -1 +1 @@\n-const total = formatDate(value);\n+const total = formatRelativeDate(value, now);');
 const change=rows.find(row=>row.kind==='change')!;
 assert.deepEqual(change.leftRanges?.map(([a,b])=>change.left!.slice(a,b)),['formatDate']);
 assert.deepEqual(change.rightRanges?.map(([a,b])=>change.right!.slice(a,b)),['formatRelativeDate',', now']);
 const inline=inlineDiffRows(rows).filter(row=>row.kind==='change');
 assert.deepEqual(inline.map(row=>row.ranges?.length),[1,2]);
});
test('unrelated, long or identical pairs keep whole-line highlighting',()=>{
 assert.equal(wordRanges('alpha beta gamma','completely different text here'),null);
 assert.equal(wordRanges('x'.repeat(501),'y'),null);
 assert.equal(wordRanges('same','same'),null);
});
test('hunk headers become readable line ranges with the enclosing context',()=>{
 assert.deepEqual(hunkLabel('@@ -14,14 +16,17 @@ type Props = {'),{start:16,end:32,context:'type Props = {'});
 assert.deepEqual(hunkLabel('@@ -3 +3 @@'),{start:3,end:3,context:''});
 assert.equal(hunkLabel('not a hunk'),null);
});
