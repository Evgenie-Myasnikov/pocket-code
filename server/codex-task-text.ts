import path from 'node:path';
import {CODEX_TASK_TEXT_BYTES} from '../src/task-text-limit.js';
import {discoverCodex, readCodexVersion, StdioCodexRpc, type RpcEnvelope} from './codex-rpc.js';
import {compareCodexVersions} from './codex-runtime.js';
import {HttpError} from './security.js';
import type {GenerateText} from './task-text.js';

// This protocol combination was verified with codex-cli 0.171.0.
export function supportsCodexSampling(version?:string) {
  return !!version && /^\d+\.\d+\.\d+$/.test(version) && compareCodexVersions(version,'0.171.0') >= 0;
}
let cached: {executable:string; until:number; supported:boolean} | undefined;
async function textExecutable(refresh=false) {
  const executable=await discoverCodex();
  if(refresh||cached?.executable!==executable||cached.until<=Date.now()){
    const version=await readCodexVersion(executable);
    cached={executable,until:Date.now()+30000,supported:supportsCodexSampling(version)};
  }
  if(!cached.supported)throw new HttpError(503,'Codex text editing requires Codex CLI 0.171.0 or newer on the PC.');
  return executable;
}
export async function codexTaskTextAvailable(refresh=false) {
  try {await textExecutable(refresh);return true;} catch {return false;}
}

type SamplingRpc=Pick<StdioCodexRpc,'request'|'startRequest'|'notify'|'reject'|'close'> & {
  on(event:string,listener:(message:RpcEnvelope)=>void):unknown;
  off(event:string,listener:(message:RpcEnvelope)=>void):unknown;
};

// The native sampler requires a completed turn on a loaded persistent root.
// Token-budget manual compaction creates that turn with a local context reset.
// Only the fixed editing template enters the root. User input goes to the
// sampler's ephemeral fork; Codex intercepts its response before tool dispatch.
function resetForSample(rpc:SamplingRpc,threadId:string,signal:AbortSignal):Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{
      clearTimeout(timer); signal.removeEventListener('abort',cancel);
      rpc.off('notification',notification);rpc.off('disconnect',disconnect);
    };
    function cancel(){cleanup();reject(signal.reason);}
    function disconnect(){cleanup();reject(new Error('Codex disconnected.'));}
    function notification(message:RpcEnvelope){
      if(message.method!=='turn/completed'||message.params?.threadId!==threadId)return;
      cleanup();
      const turn=message.params.turn;
      if(turn?.status==='completed' && typeof turn.id==='string' && turn.id)resolve(turn.id);
      else reject(new Error('Codex did not prepare the sample.'));
    }
    const timer=setTimeout(()=>{cleanup();reject(new Error('Codex context reset timed out.'));},15000);
    rpc.on('notification',notification);rpc.on('disconnect',disconnect);
    signal.addEventListener('abort',cancel,{once:true});
    rpc.request('thread/compact/start',{threadId}).catch(error=>{cleanup();reject(error);});
  });
}

export async function sampleCodexText(rpc:SamplingRpc,system:string,prompt:string,cwd:string,signal:AbortSignal) {
  let threadId:string|undefined;
  try {
    signal.throwIfAborted();
    if(Buffer.byteLength(prompt)>CODEX_TASK_TEXT_BYTES)throw new HttpError(422,'Codex text input exceeds 4,000 UTF-8 bytes.');
    rpc.on('request',(message:RpcEnvelope)=>{if(message.id!==undefined)rpc.reject(message.id,'Text sampling only.');});
    await rpc.request('initialize',{clientInfo:{name:'pocket_code',title:'Pocket Code task editor',version:'1'},capabilities:{experimentalApi:true}});
    rpc.notify('initialized');signal.throwIfAborted();
    const root=await rpc.request('thread/start',{
      cwd,modelProvider:'openai',historyMode:'paginated',sandbox:'read-only',approvalPolicy:'never',environments:[],
      dynamicTools:[],selectedCapabilityRoots:[],baseInstructions:system,developerInstructions:'',
      config:{project_doc_max_bytes:0,include_environment_context:false,web_search:'disabled',
        'features.token_budget':true,'features.apps':false,'features.plugins':false,'features.hooks':false,'features.image_generation':false}
    });
    if(typeof root?.thread?.id!=='string'||!root.thread.id||typeof root.thread.cwd!=='string'||path.relative(cwd,root.thread.cwd)!=='')
      throw new Error('Invalid Codex editor source.');
    threadId=root.thread.id as string;
    const expectedTurnId=await resetForSample(rpc,threadId,signal);
    signal.throwIfAborted();
    const sample=rpc.startRequest('thread/sample',{threadId,expectedTurnId,prompt,disableMcp:true,interruptOnCancel:true});
    const cancel=()=>{void rpc.request('thread/sample/cancel',{requestId:sample.id}).catch(()=>{});};
    signal.addEventListener('abort',cancel,{once:true});
    try {
      const answer=await sample.response;
      signal.throwIfAborted();
      if(answer?.sourceTurnId!==expectedTurnId||typeof answer.text!=='string'||!answer.text.trim())
        throw new HttpError(502,'Codex returned no text suggestion. Try a shorter or more specific request.');
      return answer.text;
    } finally {signal.removeEventListener('abort',cancel);}
  } finally {
    try {
      if(threadId) {
        await rpc.request('thread/unsubscribe',{threadId}).catch(()=>{});
        await rpc.request('thread/delete',{threadId});
      }
    } finally {rpc.close();}
  }
}
export const generateCodexTaskText:GenerateText=async(system,prompt,cwd,abort)=>{
  const executable=await textExecutable();
  abort.signal.throwIfAborted();
  const rpc=new StdioCodexRpc(executable,35000,{cwd,configArgs:[
    '--disable','hooks','--disable','apps','--disable','plugins','--disable','image_generation','-c','web_search="disabled"'
  ]});
  return sampleCodexText(rpc,system,prompt,cwd,abort.signal);
};
