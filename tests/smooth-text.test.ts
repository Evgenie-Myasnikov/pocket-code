import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startReveal,stepReveal,wordStop} from '../src/smooth-text.js';

test('a reveal stops after a whole word and its spaces, never inside a word',()=>{
 const text='one two  three';
 assert.equal(wordStop(text,0),0);assert.equal(wordStop(text,2),0);assert.equal(wordStop(text,4),4);assert.equal(wordStop(text,6),4);
 assert.equal(wordStop(text,9),9);assert.equal(wordStop(text,11),9);assert.equal(wordStop(text,text.length),text.length);
});

test('waiting text is shown evenly and is all there when the window ends',()=>{
 let state=startReveal(0,1000,0,500);
 state=stepReveal(state,1000,250,500);assert.equal(Math.round(state.shown),500);
 state=stepReveal(state,1000,375,500);assert.equal(Math.round(state.shown),750);
 state=stepReveal(state,1000,500,500);assert.equal(state.shown,1000);
});

test('text that arrives meanwhile moves the end of the window to its own arrival plus the window',()=>{
 let state=startReveal(0,100,0,500);
 state=stepReveal(state,100,250,500);assert.equal(Math.round(state.shown),50);
 state=stepReveal(state,300,250,500);assert.equal(state.deadline,750);assert.equal(Math.round(state.shown),50);
 state=stepReveal(state,300,500,500);assert.ok(state.shown>50&&state.shown<300);
 state=stepReveal(state,300,750,500);assert.equal(state.shown,300);
});

test('a window of zero, or text that became shorter, shows everything at once',()=>{
 assert.equal(stepReveal(startReveal(0,500,0,500),500,10,0).shown,500);
 assert.equal(stepReveal(startReveal(0,500,0,500),200,10,500).shown,200);
});
