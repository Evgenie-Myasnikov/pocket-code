import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Jobs} from '../server/jobs.js';
import {boardInstructions} from '../server/board-instructions.js';

test('Claude receives board guidance on both fresh and resumed runs without changing the visible request',async()=>{
 for(const sessionId of [undefined,'saved-session']){
  let options:any;
  const jobs=new Jobs((({options:value}:any)=>{options=value;return(async function*(){})();}) as any);
  const view=jobs.start({id:'fixture',cwd:process.cwd(),sessionId,text:'Explain this feature',mode:'default',maxBudgetUsd:1});
  assert.equal(options.resume,sessionId);
  assert.equal(options.systemPrompt.preset,'claude_code');
  assert.equal(options.systemPrompt.append,boardInstructions);
  assert.equal(view.messages[0].blocks[0].text,'Explain this feature');
 }
});
