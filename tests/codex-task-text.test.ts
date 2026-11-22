import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sampleCodexText,supportsCodexSampling} from '../server/codex-task-text';
import {codexTaskTextBytes,taskTextSource} from '../src/task-text-limit';

class SampleRpc extends EventEmitter {
  calls:{method:string;params:any}[]=[];
  closed=false;
  failReset=false;
  onSample?:()=>void;
  resolveSample?:(value:unknown)=>void;
  answer:string|null='Approved title';
  cwd=process.cwd();
  async request(method:string,params:any){
    this.calls.push({method,params});
    if(method==='thread/start')return {thread:{id:'owned',cwd:this.cwd}};
    if(method==='thread/compact/start'){
      if(this.failReset)throw Error('Reset failed');
      this.emit('notification',{method:'turn/completed',params:{threadId:'owned',turn:{status:'completed',id:'seed'}}});
    }
    if(method==='thread/sample/cancel')this.resolveSample?.({text:null});
    return {};
  }
  startRequest(method:string,params:unknown) {
    this.calls.push({method,params});
    const response=this.onSample?new Promise(resolve=>{this.resolveSample=resolve;queueMicrotask(this.onSample!);}):
      Promise.resolve({sourceTurnId:'seed',text:this.answer});
    return {id:12,response};
  }
  notify(){} reject(){} close(){this.closed=true;}
}
test('Codex text capability and byte boundary follow the native sampling protocol',()=>{
  assert.equal(supportsCodexSampling('0.171.0'),true);assert.equal(supportsCodexSampling('0.170.9'),false);
  assert.equal(supportsCodexSampling(undefined),false);
  const text='🙂\n"текст"';
  assert.equal(codexTaskTextBytes(text,'описание'),Buffer.byteLength(taskTextSource(text,'описание')));
});
test('only the ephemeral Codex sample sees the field, with no ordinary agent turn or session resume',async()=>{
  const rpc=new SampleRpc(),prompt=taskTextSource('Private synthetic field','Brief');
  assert.equal(await sampleCodexText(rpc,'Editor template',prompt,rpc.cwd,new AbortController().signal),'Approved title');
  assert.deepEqual(rpc.calls.map(c=>c.method),['initialize','thread/start','thread/compact/start','thread/sample','thread/unsubscribe','thread/delete']);
  const start=rpc.calls[1].params;
  assert.equal(start.baseInstructions,'Editor template');assert.equal(start.config['features.token_budget'],true);
  assert.deepEqual(start.environments,[]);assert.deepEqual(start.dynamicTools,[]);
  assert.equal(rpc.calls.filter(c=>JSON.stringify(c.params).includes('Private synthetic field')).length,1);
  assert.deepEqual(rpc.calls[3].params,{threadId:'owned',expectedTurnId:'seed',prompt,disableMcp:true,interruptOnCancel:true});
  assert.equal(rpc.calls.at(-1)?.params.threadId,'owned');assert.equal(rpc.closed,true);
});
test('Codex cancels an outstanding sample and cleans the source after cancellation, failed setup or a tool attempt',async()=>{
  for(const reason of ['cancel','setup','tool']){
    const rpc=new SampleRpc(),abort=new AbortController();
    if(reason==='setup')rpc.failReset=true;
    if(reason==='tool')rpc.answer=null;
    if(reason==='cancel')rpc.onSample=()=>abort.abort();
    await assert.rejects(sampleCodexText(rpc,'Template','Sample',rpc.cwd,abort.signal));
    if(reason==='cancel')assert.deepEqual(rpc.calls.find(c=>c.method==='thread/sample/cancel')?.params,{requestId:12});
    assert.deepEqual(rpc.calls.at(-1),{method:'thread/delete',params:{threadId:'owned'}});assert.equal(rpc.closed,true);
  }
});
