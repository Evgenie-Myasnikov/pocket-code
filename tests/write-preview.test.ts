import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {Jobs} from '../server/jobs';
import type {JobView} from '../server/types';
import {ToolInputPreviews} from '../server/write-preview';
import {waitFor} from './wait-for';

const streamEvent=(event:unknown,parent_tool_use_id:string|null=null)=>({type:'stream_event',event,parent_tool_use_id});
const start=(index:number,name:string,id:string)=>streamEvent({type:'content_block_start',index,content_block:{type:'tool_use',name,id,input:{}}});
const delta=(index:number,partial_json:string,parent:string|null=null)=>streamEvent({type:'content_block_delta',index,delta:{type:'input_json_delta',partial_json}},parent);

for(const account of [undefined,'synthetic-custom']){
  test((account?'Configured Claude Code account':'Claude')+' streams a decoded Write before commit without modifying the transcript',async()=>{
    const source=new PassThrough({objectMode:true});
    const jobs=new Jobs((()=>source) as any);
    const id='fixture';
    const read=()=>jobs.view(jobs.get(id));
    try{
      jobs.start({id,account,cwd:process.cwd(),mode:'default',text:'Synthetic',maxBudgetUsd:1});
      source.write({type:'system',subtype:'init',session_id:'synthetic-session'});
      source.write(start(0,'Write','writing'));
      source.write(start(1,'Bash','command'));
      source.write(delta(1,'{"file_path":"other","content":"never show a shell argument"}'));
      source.write(delta(0,'{"file_path":"child","content":"child only"}','child-agent'));
      source.write(delta(0,'{"metadata":{"content":"private argument"},"file_path":"sample.ts","content":"first\\n'));
      await waitFor(()=>Boolean(read().writePreviews));
      assert.deepEqual(read().writePreviews,[{id:'writing',tool:'Write',path:'sample.ts',content:'first\n',totalBytes:6,totalLines:1}]);
      const revision=read().revision, messagesRevision=read().messagesRevision;
      assert.equal(typeof messagesRevision,'number');
      source.write(delta(0,'\\uD83D\\u'));
      source.write(delta(0,'DE80"}'));
      await waitFor(()=>read().writePreviews?.[0].content==='first\n🚀');
      assert.equal(read().writePreviews![0].totalBytes,10);
      assert.equal(read().writePreviews![0].totalLines,2);
      assert.equal(read().messages.length,1);assert.equal(read().messagesRevision,messagesRevision);
      assert.ok(read().revision>revision);assert.equal(jobs.list()[0].writePreviews,undefined);
      source.write({type:'assistant',uuid:'commit',message:{content:[{type:'tool_use',id:'writing',name:'Write',input:{file_path:'sample.ts',content:'first\n🚀'}}]}});
      await waitFor(()=>read().messages.length===2);
      assert.equal(read().writePreviews,undefined);
      source.write(start(2,'Edit','editing'));source.write(delta(2,'{"file_path":"sample.ts","old_string":"not public","new_string":"replacement'));
      await waitFor(()=>read().writePreviews?.[0].content==='replacement');
      jobs.stop(id);
      assert.equal(read().writePreviews,undefined);
      source.end(delta(2,' text"}'));
      await waitFor(()=>read().status==='stopped');
      assert.equal(read().writePreviews,undefined);assert.equal(read().messages.length,2);
    }finally{jobs.close();source.destroy();}
  });
}
test('Claude exposes only parent thinking previews and replaces them with the authoritative message',async()=>{
  const source=new PassThrough({objectMode:true});
  const jobs=new Jobs((()=>source) as any),id='thinking-fixture';
  const view=()=>jobs.view(jobs.get(id));
  const preview=()=>view().reasoningPreviews?.[0]?.blocks[0]?.thinking;
  const think=(index:number,thinking:string,parent?:string)=>streamEvent({type:'content_block_delta',index,delta:{type:'thinking_delta',thinking}},parent);
  try{
    jobs.start({id,cwd:process.cwd(),mode:'default',text:'Synthetic',maxBudgetUsd:1});
    source.write(streamEvent({type:'message_start',message:{id:'m1',model:'fixture',usage:{}}}));
    source.write(streamEvent({type:'content_block_start',index:0,content_block:{type:'redacted_thinking',data:'opaque'}}));
    source.write(think(0,'hidden'));
    source.write(streamEvent({type:'content_block_start',index:1,content_block:{type:'thinking',thinking:''}}));
    source.write(think(1,'From child','child'));
    source.write(think(1,'Checking'));source.write(think(1,' inputs'));
    await waitFor(()=>preview()==='Checking inputs');
    assert.equal(view().reasoningPreviews?.length,1);
    assert.equal(view().messages.length,1);
    assert.equal(jobs.list()[0].reasoningPreviews,undefined);
    source.write({uuid:'canonical',type:'assistant',message:{id:'m1',content:[{type:'thinking',thinking:'Checked'}]}});
    await waitFor(()=>view().messages.length===2);
    assert.equal(view().reasoningPreviews,undefined);
    assert.equal(view().messages[1].blocks[0].thinking,'Checked');
  }finally{jobs.close();source.destroy();}
});
test('file-input decoder retains a bounded tail and exact received counts across escaped fragments',()=>{
  const job={} as JobView, tracker=new ToolInputPreviews();
  const content='x\n'.repeat(20_000)+'🚀';
  const body=JSON.stringify({ignored:[{file_path:'nested',content:'hidden'}],new_string:content,old_string:'hidden',file_path:'sample'});
  tracker.start('edit','Edit',0);
  for(let i=0;i<body.length;i+=41) tracker.append(job,0,body.slice(i,i+41));
  const preview=job.writePreviews![0];
  assert.ok(preview.truncated && preview.content.length<=16_384 && content.endsWith(preview.content));
  assert.equal(preview.totalBytes,Buffer.byteLength(content));assert.equal(preview.totalLines,20_001);
  assert.deepEqual(Object.keys(preview).sort(),['id','tool','path','content','totalBytes','totalLines','truncated'].sort());
  tracker.remove(job,'edit');
  assert.equal(job.writePreviews,undefined);
});
