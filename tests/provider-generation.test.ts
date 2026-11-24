import assert from 'node:assert/strict';
import test from 'node:test';
import {PassThrough} from 'node:stream';
import type {SDKMessage} from '@anthropic-ai/claude-agent-sdk';
import type {SessionEvent} from '@github/copilot-sdk';
import {ClaudeGeneration,CopilotGeneration} from '../server/provider-generation';
import {Jobs} from '../server/jobs';
import type {JobView} from '../server/types';
import {waitFor} from './wait-for';

test('Claude measures increasing native counters inside a single message, separates turns, and uses cumulative model totals',()=>{
  let now=1000;const job={} as JobView,meter=new ClaudeGeneration(()=>now);
  const put=(e:unknown)=>meter.observe(job,e as SDKMessage);
  const stream=(event:unknown,parent_tool_use_id:string|null=null)=>put({type:'stream_event',parent_tool_use_id,event});
  const msg=(id:string,n:number)=>({id,model:'atlas',usage:{input_tokens:12,cache_read_input_tokens:3,cache_creation_input_tokens:1,output_tokens:n}});
  stream({type:'message_start',message:msg('a',1)});now+=200;
  stream({type:'message_delta',usage:{output_tokens:21}});
  assert.deepEqual(job.generation,{outputTokens:21,contextTokens:37,outputTokensPerSecond:100});
  put({type:'assistant',message:msg('a',21)});
  stream({type:'message_start',message:msg('child',999)},'child-call');
  assert.equal(job.generation!.outputTokens,21);
  now+=10000;stream({type:'message_start',message:msg('b',5)});put({type:'assistant',message:msg('a',21)});
  assert.equal(job.generation!.outputTokens,26);assert.equal(job.generation!.outputTokensPerSecond,undefined);
  put({type:'result',usage:{output_tokens:26},modelUsage:{atlas:{inputTokens:500,outputTokens:100,cacheReadInputTokens:100,cacheCreationInputTokens:50,contextWindow:200},child:{inputTokens:10,outputTokens:10,cacheReadInputTokens:0,cacheCreationInputTokens:0,contextWindow:100}}});
  assert.deepEqual(job.generation,{contextTokens:21,outputTokens:26,totalTokens:770,contextWindow:200});
  meter.nextTurn(job);put({type:'assistant',message:msg('c',3)});
  assert.deepEqual(job.generation,{totalTokens:770,outputTokens:3,contextTokens:19});
});

test('Claude emits no invented count from unmetered text and persists provider usage through its real Jobs view',async()=>{
  const pipe=new PassThrough({objectMode:true}),jobs=new Jobs((()=>pipe) as any);
  let final:JobView|undefined;jobs.recordGeneration=j=>{final=j;};
  try{
    jobs.start({id:'fixture',cwd:process.cwd(),mode:'default',text:'Sample',maxBudgetUsd:1});
    pipe.write({type:'system',session_id:'synthetic'});
    pipe.write({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text:'received sample'}},parent_tool_use_id:null});
    await waitFor(()=>jobs.view(jobs.get('fixture')).partial==='received sample');
    assert.equal(jobs.view(jobs.get('fixture')).generation,undefined);
    pipe.write({type:'assistant',uuid:'sample',message:{id:'model-msg',model:'atlas',content:[{type:'text',text:'Sample'}],usage:{input_tokens:20,output_tokens:5}}});
    await waitFor(()=>jobs.view(jobs.get('fixture')).generation?.outputTokens===5);
    pipe.end({type:'result',is_error:false,usage:{output_tokens:5},modelUsage:{atlas:{inputTokens:20,outputTokens:5,cacheReadInputTokens:0,cacheCreationInputTokens:0,contextWindow:1000}}});
    await waitFor(()=>!!final);
    assert.deepEqual(final!.generation,{outputTokens:5,totalTokens:25,contextTokens:25,contextWindow:1000});
  }finally{pipe.end();jobs.close();}
});

test('Copilot preserves request and session scope, native timing and context counts',()=>{
  const job={} as JobView,meter=new CopilotGeneration(true);
  const put=(e:unknown)=>meter.observe(job,e as SessionEvent);
  put({type:'user.message',id:'question'});
  const usage={type:'assistant.usage',id:'one',data:{providerCallId:'call',inputTokens:80,outputTokens:21,interTokenLatencyMs:20}};
  put(usage);put({...usage,id:'duplicate'});
  assert.deepEqual(job.generation,{outputTokens:21,totalTokens:101,outputTokensPerSecond:50});
  put({type:'session.usage_info',data:{currentTokens:88,tokenLimit:100}});
  put({type:'assistant.usage',id:'two',data:{inputTokens:60,outputTokens:31,duration:1200,timeToFirstTokenMs:200}});
  assert.deepEqual(job.generation,{outputTokens:52,totalTokens:192,contextTokens:88,contextWindow:100,outputTokensPerSecond:30});
  put({type:'assistant.usage',id:'child',agentId:'subagent',data:{outputTokens:9999}});
  assert.equal(job.generation!.outputTokens,52);assert.equal(job.generation!.totalTokens,undefined);
  put({type:'user.message',id:'next'});put({type:'assistant.usage',id:'three',data:{inputTokens:500,outputTokens:4,duration:65000}});
  assert.equal(job.generation!.outputTokens,4);assert.equal(job.generation!.outputTokensPerSecond,undefined);
  const resume={} as JobView,restored=new CopilotGeneration(false);
  restored.observe(resume,usage as SessionEvent);assert.equal(resume.generation!.totalTokens,undefined);
  restored.observe(resume,{
    type:'session.shutdown',id:'61d47a1a-cf49-4cf3-9fd5-c6ec47623aaa',parentId:null,timestamp:'2026-11-22T00:00:02Z',
    data:{sessionStartTime:0,totalApiDurationMs:2000,shutdownType:'routine',codeChanges:{filesModified:[],linesAdded:0,linesRemoved:0},
      modelMetrics:{atlas:{requests:{count:2},usage:{inputTokens:1000,outputTokens:300,cacheReadTokens:0,cacheWriteTokens:0}}}},
  });
  assert.equal(resume.generation!.totalTokens,1300);
  put({type:'assistant.usage',id:'unmetered',data:{}});
  assert.equal(job.generation!.outputTokens,undefined);
  put({...usage,id:'later',data:{...usage.data,providerCallId:'later'}});
  assert.equal(job.generation!.outputTokens,undefined);
  assert.equal(job.generation!.outputTokensPerSecond,50);
  put({type:'user.message',id:'third'});
  put({...usage,id:'last',data:{...usage.data,providerCallId:'last'}});
  assert.equal(job.generation!.outputTokens,21);
});

test("an API connection's chat shows the context it was started with, never Claude Code's guess for an unknown model",async()=>{
  for(const [known,expected] of [[32768,32768],[undefined,undefined]] as const){
    const pipe=new PassThrough({objectMode:true}),jobs=new Jobs((()=>pipe) as any);
    let final:JobView|undefined;jobs.recordGeneration=j=>{final=j;};
    jobs.contextWindowFor=account=>account==='5b7c0d3e-0000-4000-8000-00000000a001'?known:undefined;
    try{
      jobs.start({id:'local',cwd:process.cwd(),mode:'default',text:'Sample',maxBudgetUsd:1,account:'5b7c0d3e-0000-4000-8000-00000000a001'} as any);
      pipe.write({type:'system',session_id:'synthetic-local'});
      pipe.write({type:'assistant',uuid:'sample',message:{id:'m',model:'local-coder',content:[{type:'text',text:'pong'}],usage:{input_tokens:17000,output_tokens:4}}});
      // Claude Code reports a 1,000,000-token window for a model name it does not know.
      pipe.end({type:'result',is_error:false,usage:{output_tokens:4},modelUsage:{'local-coder':{inputTokens:17000,outputTokens:4,cacheReadInputTokens:0,cacheCreationInputTokens:0,contextWindow:1000000}}});
      await waitFor(()=>!!final);
      assert.equal(final!.generation?.contextWindow,expected);
      assert.equal(final!.generation?.contextTokens,17004);
    }finally{pipe.end();jobs.close();}
  }
});

test('a model that reports no output count while it writes gets an estimate from the streamed text, which is never saved',()=>{
  let now=1000;const job={} as JobView,meter=new ClaudeGeneration(()=>now);
  meter.observe(job,{type:'stream_event',event:{type:'message_start',message:{id:'local',model:'qwen-local',usage:{input_tokens:100,output_tokens:0}}},parent_tool_use_id:null} as any);
  meter.observe(job,{type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'x'.repeat(40)}},parent_tool_use_id:null} as any);
  assert.equal(job.generation?.estimatedTokens,10);
  now+=500;meter.observe(job,{type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'y'.repeat(41)}},parent_tool_use_id:null} as any);
  assert.equal(job.generation?.estimatedTokens,21);
  // the turn's own result replaces the estimate with what the provider counted
  meter.observe(job,{type:'result',usage:{output_tokens:30},modelUsage:{'qwen-local':{inputTokens:100,outputTokens:30,cacheReadInputTokens:0,cacheCreationInputTokens:0,contextWindow:32768}}} as any);
  assert.equal(job.generation?.estimatedTokens,undefined);assert.equal(job.generation?.outputTokens,30);assert.equal(job.generation?.totalTokens,130);
});

test('a model that reports its output count gets no estimate',()=>{
  const job={} as JobView,meter=new ClaudeGeneration(()=>1000);
  meter.observe(job,{type:'stream_event',event:{type:'message_start',message:{id:'real',model:'sonnet',usage:{input_tokens:10,output_tokens:1}}},parent_tool_use_id:null} as any);
  meter.observe(job,{type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'z'.repeat(80)}},parent_tool_use_id:null} as any);
  assert.equal(job.generation?.estimatedTokens,undefined);assert.equal(job.generation?.outputTokens,1);
});
