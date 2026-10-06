import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardView,saveBoardView} from '../src/board-view-preference';
import {preferences,savePreferences} from '../src/preferences';
test('board mode round-trips with repository isolation and Claude pinned models survive reload',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value)}});
 try{
  saveBoardView('repo-a','board-id','people');assert.equal(boardView('repo-a','board-id'),'people');assert.equal(boardView('repo-b','board-id'),'board');
  savePreferences('claude',{...preferences('claude'),model:'claude-sonnet-fixture[1m]'});assert.equal(preferences('claude').model,'claude-sonnet-fixture[1m]');assert.equal(preferences('codex').model,'');
  values.set('pocket-code-chat-preferences-claude',JSON.stringify({model:'unsafe\nmodel'}));assert.equal(preferences('claude').model,'');
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});
