import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diffRows,inlineDiffRows,singleDiffSide} from '../src/diff-rows.js';

test('inline replacement preserves deletion block followed by addition block',()=>{
 const rows=inlineDiffRows(diffRows('@@ -1,4 +1,4 @@\n context\n-old one\n-old two\n+new one\n+new two\n tail'));
 assert.deepEqual(rows.filter(row=>row.kind!=='hunk').map(row=>[row.sign||' ',row.left??row.right]),[[' ','context'],['-','old one'],['-','old two'],['+','new one'],['+','new two'],[' ','tail']]);
});
test('only wholly new or removed content uses the whole width',()=>{
 for(const [patch,side] of [['@@ -0,0 +1,2 @@\n+one\n+two','added'],['@@ -1,2 +0,0 @@\n-one\n-two','removed'],['@@ -8,0 +9,2 @@\n+one\n+two',null],['@@ -1 +1,2 @@\n context\n+two',null]] as const)assert.equal(singleDiffSide(patch,diffRows(patch)),side);
});
