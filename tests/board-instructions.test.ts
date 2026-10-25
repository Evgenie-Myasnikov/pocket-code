import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Jobs} from '../server/jobs.js';
import {boardInstructions} from '../server/board-instructions.js';

test('Claude attaches managed board MCP to fresh and resumed runs while retaining project settings',async()=>{
 for(const sessionId of [undefined,'saved-session']){
  let options:any;const server={command:'node',args:['board-proxy.mjs'],env:{POCKET_PORT:'4318'}};
  const jobs=new Jobs((({options:value}:any)=>{options=value;return(async function*(){})();}) as any);
  jobs.setBoardMcpConfiguration(cwd=>{assert.equal(cwd,process.cwd());return {'pocket-code-boards':server};});
  jobs.start({id:'fixture',cwd:process.cwd(),sessionId,text:'Inspect board',mode:'default',maxBudgetUsd:1});
  for(let n=0;n<200&&!options;n++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(options.mcpServers,{'pocket-code-boards':server});assert.equal(options.resume,sessionId);
  assert.ok(options.settingSources.includes('project'));assert.equal(options.strictMcpConfig,undefined);jobs.close();
 }
});

test('Claude receives board guidance on both fresh and resumed runs without changing the visible request',async()=>{
 for(const sessionId of [undefined,'saved-session']){
  let options:any;
  const jobs=new Jobs((({options:value}:any)=>{options=value;return(async function*(){})();}) as any);
  const view=jobs.start({id:'fixture',cwd:process.cwd(),sessionId,text:'Explain this feature',mode:'default',maxBudgetUsd:1});
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(options.resume,sessionId);
  assert.equal(options.systemPrompt.preset,'claude_code');
  assert.equal(options.systemPrompt.append,boardInstructions);
  assert.equal(view.messages[0].blocks[0].text,'Explain this feature');
 }
});
