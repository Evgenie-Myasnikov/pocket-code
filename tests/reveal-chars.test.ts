import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidElement,type ReactElement} from 'react';
import {revealCharacters} from '../src/reveal-chars';

const words=(nodes:unknown[])=>nodes.filter(isValidElement) as ReactElement<{className?:string;children:ReactElement<{className:string}>[]}>[];

test('the animated part starts at the beginning of a word, so a word is never split between plain and animated text',()=>{
  const nodes=revealCharacters('alpha beta',0,8,()=>0);
  assert.equal(nodes[0],'alpha ');
  const [beta]=words(nodes);
  assert.equal(beta.props.children.length,4);
});

test('a character past its entrance is drawn without animation, a new one with its delay',()=>{
  const nodes=revealCharacters('ab',0,0,index=>index*10,index=>index===1);
  const [word]=words(nodes);
  assert.deepEqual(word.props.children.map(child=>child.props.className),['rc rc-done','rc']);
});

test('text before the animated part is plain',()=>{
  assert.deepEqual(revealCharacters('ab cd',0,5,()=>0),['ab cd']);
});
