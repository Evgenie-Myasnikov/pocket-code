import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mountTaskText} from '../server/task-text.js';

function host(answer:string|(()=>Promise<string>),busy=new Set<string>()){
  const prompts:{system:string;prompt:string}[]=[],custom:string[]=[];
  const run=async(system:string,prompt:string)=>{prompts.push({system,prompt});return typeof answer==='string'?answer:answer();};
  const service=mountTaskText(express(),{busy,providers:async()=>({providers:['claude','codex']}),allowProject:async()=>{},
    executors:async()=>[],generate:{claude:run,codex:run},accounts:async()=>[],
    custom:async(account,model,system,prompt)=>{custom.push(account+'/'+model);prompts.push({system,prompt});return typeof answer==='string'?answer:answer();}});
  return {service,prompts,custom};
}

test("a new chat is named in a few words by its own provider from the first message",async()=>{
  const {service,prompts}=host('"Синхронизация доски и задач."\nA second line the model added');
  const title=await service.chatTitle({provider:'codex',cwd:'C:\\Demo\\Atlas'},'давай весь проект приведём в порядок и синхронизируем доску с задачами');
  assert.equal(title,'Синхронизация доски и задач');
  assert.match(prompts[0].system,/2 to 6 words, at most 48 characters/);
  assert.equal(prompts[0].prompt,'давай весь проект приведём в порядок и синхронизируем доску с задачами');
  service();
});

test('an API connection names the chat with its own model; a busy, failing or long answer leaves no title',async()=>{
  const api=host('Local model checks');
  assert.equal(await api.service.chatTitle({provider:'custom',account:'acct',model:'strata-coder',cwd:'C:\\Demo'},'Check the local model'),'Local model checks');
  assert.deepEqual(api.custom,['acct/strata-coder']);api.service();
  const busy=host('Anything',new Set(['claude']));
  assert.equal(await busy.service.chatTitle({provider:'claude',cwd:'C:\\Demo'},'Hello'),undefined);busy.service();
  const failing=host(async()=>{throw new Error('offline');});
  assert.equal(await failing.service.chatTitle({provider:'claude',cwd:'C:\\Demo'},'Hello'),undefined);failing.service();
  const long=host('A'.repeat(80));
  assert.equal(await long.service.chatTitle({provider:'claude',cwd:'C:\\Demo'},'Hello'),undefined);long.service();
  const unavailable=host('Copilot title');
  assert.equal(await unavailable.service.chatTitle({provider:'copilot',cwd:'C:\\Demo'},'Hello'),undefined);unavailable.service();
});
