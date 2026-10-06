import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Root,RootContent} from 'hast';
import {rehypeStreamingReveal,revealCharacterLimit} from '../src/streaming-reveal';
const node=(value:string,start=0)=>({type:'text' as const,value,position:{start:{line:1,column:start+1,offset:start},end:{line:1,column:start+value.length+1,offset:start+value.length}}});
function text(nodes:RootContent[]):string{return nodes.map(n=>n.type==='text'?n.value:'children'in n?text(n.children):'').join('');}
test('stream reveal preserves graphemes and text and only marks appended characters',()=>{
 const content='Saved text Привет 👨‍👩‍👧‍👦 é',tree:Root={type:'root',children:[node(content)]};
 rehypeStreamingReveal({ranges:[{start:11,end:content.length,at:10}],now:20})(tree);
 assert.equal(text(tree.children),content);assert.equal(tree.children[0].type,'text');
 const spans=tree.children.filter(n=>n.type==='element');assert.ok(spans.length>0);assert.ok(spans.every(n=>Number(n.properties['data-stream-offset'])>=11));
 assert.ok(spans.some(n=>text(n.children)==='👨‍👩‍👧‍👦'));assert.ok(spans.some(n=>text(n.children)==='é'));
});
test('stream reveal has a hard node limit, never animates code or expired snapshots',()=>{
 const content='x'.repeat(5000),tree:Root={type:'root',children:[node(content)]};
 rehypeStreamingReveal({ranges:[{start:0,end:content.length,at:0}],now:10})(tree);
 assert.equal(tree.children.filter(n=>n.type==='element').length,revealCharacterLimit);assert.equal(text(tree.children),content);
 const code:Root={type:'root',children:[{type:'element',tagName:'code',properties:{},children:[node('source')]}]};
 const before=JSON.stringify(code);rehypeStreamingReveal({ranges:[{start:0,end:6,at:0}],now:10})(code);assert.equal(JSON.stringify(code),before);
 const expired:Root={type:'root',children:[node('snapshot')]};rehypeStreamingReveal({ranges:[{start:0,end:8,at:0}],now:1000})(expired);assert.equal(expired.children.length,1);assert.equal(expired.children[0].type,'text');
});
