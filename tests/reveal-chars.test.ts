import test from 'node:test';
import assert from 'node:assert/strict';
import type {ReactNode} from 'react';
import {REVEAL_TAIL,revealCharacters,revealWindow} from '../src/reveal-chars';

test('the reveal window never reaches back behind characters already shown',()=>{
  const first=revealWindow(600-REVEAL_TAIL,600,REVEAL_TAIL);
  assert.equal(first.tailStart,600-REVEAL_TAIL);assert.equal(first.shown,600);
  // A stream append animates only the new characters; the older part of the tail stays written.
  const appended=revealWindow(first.shown,610,REVEAL_TAIL);
  assert.equal(appended.tailStart,600);assert.equal(appended.shown,610);
  // Rebuilding the same tail (a paragraph split, a shifted line window, a remount of the block) animates nothing again.
  assert.equal(revealWindow(appended.shown,610,REVEAL_TAIL).tailStart,610);
  // A block mounted mid-stream still animates its newest tail once.
  assert.equal(revealWindow(Math.max(0,1000-REVEAL_TAIL),1000,REVEAL_TAIL).tailStart,1000-REVEAL_TAIL);
  // A batch larger than the tail animates its newest `tail` characters.
  assert.equal(revealWindow(100,700,REVEAL_TAIL).tailStart,340);
});

const isElement=(node:ReactNode)=>!!node&&typeof node==='object'&&'props'in(node as any);

test('characters before the window are plain text and later ones animate by absolute index',()=>{
  const nodes=revealCharacters('ab cd',0,3,()=>0);
  assert.equal(nodes[0],'ab ','characters already written stay plain text');
  const word=nodes[1] as any;
  assert.equal(word.props.className,'rc-word');
  assert.deepEqual(word.props.children.map((span:any)=>[span.key,span.props.className,span.props.children]),[['3','rc','c'],['4','rc','d']]);
  // The same run rebuilt with the whole text written produces no animated spans at all.
  assert.deepEqual(revealCharacters('ab cd',0,5,()=>0),['ab cd']);
});
