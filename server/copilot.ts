import type {BoardMcpConfiguration} from './board-mcp-runtime.js';
import { userInputBlocks } from './user-input-blocks.js';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {projectBoardInstructions} from './project-rules.js';
import {CopilotLogin} from './copilot-login.js';
import {CopilotClient,type CopilotSession,type SessionEvent} from '@github/copilot-sdk';
import {allowedPath,HttpError} from './security.js';
import type {Block,ChatMessage,JobView} from './types.js';
import {Followups,type FollowupInput} from './followups.js';
import {coalesceReads} from './read-coalescer.js';
import {ToolInputPreviews} from './write-preview.js';
import {CopilotGeneration} from './provider-generation.js';
import {copilotUsage} from './copilot-usage.js';
import type {CodexUsageSnapshot} from './codex-usage.js';

export function copilotMessage(event:SessionEvent):ChatMessage|null{
 const data=event.data as any;
 if(event.type==='assistant.reasoning'&&!event.agentId&&data.content)
   return{id:'copilot-reasoning:'+data.reasoningId,role:'assistant',blocks:[{type:'thinking',thinking:data.content}]};
 if(event.type==='user.message'||event.type==='assistant.message')return{id:event.id,role:event.type==='user.message'?'user':'assistant',blocks:[{type:'text',text:data.content||''}]};
 if(event.type==='tool.execution_start')return{id:event.id,role:'assistant',blocks:[{type:'tool_use',id:data.toolCallId,name:data.toolName,input:data.arguments}]};
 if(event.type==='tool.execution_complete')return{id:event.id,role:'assistant',blocks:[{type:'tool_result',tool_use_id:data.toolCallId,content:data.result?.content||data.error?.message||'',is_error:!data.success}]};
 return null;
}
type Input={id:string;cwd:string;sessionId?:string;text:string;displayText?:string;model?:string;mode:'default'|'plan';maxBudgetUsd:number;approvalTimeoutMs?:number;access?:'full'|'ask';baseMessageCount?:number;attachmentPaths?:string[];jira?:JobView['jira']};
type Run={view:JobView;session?:CopilotSession;pending:Map<string,(allow:boolean,answers?:Record<string,string>)=>void>;followups:Followups;approvalTimeoutMs:number};
export class CopilotService{
 recordGeneration?:(job:JobView)=>void;
 async refreshAuthentication(){if(this.list().some(job=>job.status==='running'))throw new HttpError(409,'Provider is busy');await this.client.stop();this.starting=undefined;}
 private boardMcp:BoardMcpConfiguration=()=>({});
 setBoardMcpConfiguration(config:BoardMcpConfiguration){this.boardMcp=config;}
 private closed=false;private client:CopilotClient;private starting?:Promise<void>;private runs=new Map<string,Run>();private authLogin=new CopilotLogin(async()=>{await this.client.stop();this.starting=undefined;return (await this.status()).authenticated;});
  private configuredRoots:string[];
  constructor(private roots:string[],client?:CopilotClient){this.configuredRoots=[...roots];this.client=client||new CopilotClient({workingDirectory:roots[0],useLoggedInUser:true});}
  /** Only verified host-owned task working copies may extend provider access. */
  setManagedTaskRoots(roots:string[]){this.roots=[...this.configuredRoots,...roots];}
 private async connect(){if(this.closed)throw new HttpError(503,'Copilot host is stopping');if(!this.starting)this.starting=this.client.start().catch(error=>{this.starting=undefined;throw error;});await this.starting;return this.client;}
 async generateTaskText(system:string,prompt:string,directory:string,abort:AbortController):Promise<string>{
   const client=await this.connect();
   abort.signal.throwIfAborted();
   const sessionId=randomUUID();
   const session=await client.createSession({sessionId,workingDirectory:directory,configDirectory:directory,
     systemMessage:{mode:'replace',content:system},availableTools:[],excludedTools:['builtin:*','mcp:*','custom:*'],
     mcpServers:{},enableConfigDiscovery:false,skipCustomInstructions:true,enableOnDemandInstructionDiscovery:false,
     enableFileHooks:false,enableSkills:false,enableHostGitOperations:false,enableSessionStore:false,
     memory:{enabled:false},infiniteSessions:{enabled:false},enableSessionTelemetry:false,manageScheduleEnabled:false,
     onPermissionRequest:()=>({kind:'denied-interactively-by-user'})});
   const cancel=()=>{void session.abort().catch(()=>{});};
   abort.signal.addEventListener('abort',cancel,{once:true});
   try{
     abort.signal.throwIfAborted();
     const message=await session.sendAndWait({prompt},80000);
     return message?.data.content||'';
   } finally {
     abort.signal.removeEventListener('abort',cancel);
     try{await session.disconnect();}finally{await client.deleteSession(sessionId);}
   }
 }
 async logout(){if(this.list().some(job=>job.status==='running'))throw new HttpError(409,'Provider is busy');await(await this.connect()).rpc.account.logout({});}
 private quota?:{at:number;value:CodexUsageSnapshot};
 // Account quota is shared by every chat; a short cache keeps per-minute polling from every device cheap.
 async usage():Promise<CodexUsageSnapshot>{
  if(this.quota&&Date.now()-this.quota.at<30_000)return this.quota.value;
  const client=await this.connect(),auth=await client.getAuthStatus();
  if(!auth.isAuthenticated)return{checkedAt:Date.now(),ordinaryUsageAllowed:null,buckets:[]};
  const value=copilotUsage((await client.rpc.account.getQuota({})).quotaSnapshots,Date.now());this.quota={at:Date.now(),value};return value;
 }
 async status(){
  try{
   const client=await this.connect(),auth=await client.getAuthStatus();
   if(!auth.isAuthenticated)return{available:true,authenticated:false,access:'sign-in-required',models:[],error:'Sign in to GitHub Copilot on the PC.'};
   try{const models=await client.listModels();return{available:true,authenticated:true,access:'ready',models:models.map(model=>({id:model.id,name:model.name,isDefault:model.id==='auto'})),error:''};}
   catch{return{available:true,authenticated:true,access:'models-unavailable',models:[],error:'Signed in, but Copilot models could not be loaded. Check network, subscription and organization access.'};}
  }catch{return{available:false,authenticated:false,access:'verification-failed',models:[],error:'GitHub Copilot is unavailable. Check the PC runtime.'};}
 }
 async sessions(){const sessions=await(await this.connect()).listSessions();return Promise.all(sessions.filter(item=>!item.isRemote).map(async item=>{const cwd=item.context?.workingDirectory||'';let readOnly=true;try{await allowedPath(this.roots,cwd,true);readOnly=false;}catch{}return{sessionId:item.sessionId,summary:item.summary||'Copilot chat',cwd,lastModified:new Date(item.modifiedTime).getTime(),source:'copilot',provider:'copilot' as const,readOnly};}));}
 private historyReads=coalesceReads<string,ChatMessage[]>(0,8);
 async messages(id:string){return this.historyReads(id,()=>this.loadMessages(id));}
 async eraseOriginal(id:string,cwd:string,outsideRoots=false) {
   if(this.list().some(job=>job.sessionId===id&&job.status==='running'))throw new HttpError(409,'Stop the current turn before erasing this chat.');
   const client=await this.connect();
   const matches=(await client.listSessions()).filter(item=>item.sessionId===id);
   if(!matches.length)return;
   const [original]=matches;
   if(matches.length!==1||original.isRemote||!original.context?.workingDirectory||path.relative(cwd,original.context.workingDirectory)!=='')
     throw new HttpError(409,'The local original chat could not be verified in this project.');
   if(!outsideRoots)await allowedPath(this.roots,cwd,true);
   await client.deleteSession(id);
 }
 forgetSession(id:string) {
   for(const [jobId,run] of this.runs)if(run.view.sessionId===id&&run.view.status!=='running')this.runs.delete(jobId);
 }
 async forkBeforeMessage(id:string,messageId:string){
  if(this.list().some(job=>job.sessionId===id&&job.status==='running'))throw new HttpError(409,'Stop the current turn before branching.');
  const found=(await this.messages(id)).find(m=>m.id===messageId&&m.role==='user');
  if(!found)throw new HttpError(404,'The selected user message is unavailable.');
  const client=await this.connect();if(!client.rpc?.sessions?.fork)throw new HttpError(409,'Update Copilot to enable conversation branching.');
  const fork=await client.rpc.sessions.fork({sessionId:id,toEventId:messageId});
  if(!fork.sessionId||fork.sessionId===id)throw new HttpError(502,'Copilot did not create a separate conversation.');
  return fork.sessionId;
 }
 private async loadMessages(id:string){
  const live=[...this.runs.values()].find(run=>run.view.sessionId===id&&run.view.status==='running');
  if(live?.session)return(await live.session.getEvents()).map(copilotMessage).filter((message):message is ChatMessage=>!!message);
  const client=await this.connect();const session=await client.resumeSession(id,{onPermissionRequest:()=>({kind:'denied-interactively-by-user'}),onUserInputRequest:()=>({answer:'',wasFreeform:true})});
  try{return(await session.getEvents()).map(copilotMessage).filter((message):message is ChatMessage=>!!message);}finally{await session.disconnect();}
 }
 list(){return [...this.runs.values()].map(run=>({...run.view,messages:[],partial:'',writePreviews:undefined,reasoningPreviews:undefined}));}
 get(id:string){const run=this.runs.get(id);if(!run)throw new HttpError(404,'Copilot task not found.');return run.view;}
 view(job:JobView){return job;}
 start(input:Input){
  if(this.runs.has(input.id))return this.get(input.id);
  if([...this.runs.values()].some(run=>run.view.status==='running'&&input.sessionId&&run.view.sessionId===input.sessionId))throw new HttpError(409,'This Copilot chat is already running. Send a follow-up to its active turn.');
  for(const [id,run] of this.runs)if(run.view.status!=='running'&&this.runs.size>=90)this.runs.delete(id);
  if(this.runs.size>=100||this.list().filter(job=>job.status==='running').length>=3)throw new HttpError(429,'Too many Copilot jobs.');
  const view:JobView={id:input.id,provider:'copilot',cwd:input.cwd,sessionId:input.sessionId,status:'running',messages:[{id:randomUUID(),role:'user',blocks:userInputBlocks(input)}],partial:'',approvals:[],startedAt:Date.now(),revision:0,baseMessageCount:input.baseMessageCount||0,jira:input.jira};
  const run:Run={view,pending:new Map(),followups:new Followups(),approvalTimeoutMs:input.approvalTimeoutMs??0};this.runs.set(input.id,run);void this.execute(run,input);return view;
 }
 private ask(run:Run,tool:string,input:Record<string,unknown>){return new Promise<{allow:boolean;answers?:Record<string,string>}>(resolve=>{
  // Without a timeout setting the request waits until it is answered or the run stops.
  const id=randomUUID(),timeout=run.approvalTimeoutMs,timer=timeout>0?setTimeout(()=>{(run.view.expiredApprovals??=[]).push({tool,at:Date.now()});finish(false);},timeout):undefined;timer?.unref();
  const finish=(allow:boolean,answers?:Record<string,string>)=>{clearTimeout(timer);run.pending.delete(id);run.view.approvals=run.view.approvals.filter(item=>item.id!==id);run.view.revision++;resolve({allow,answers});};
  run.pending.set(id,finish);run.view.approvals.push({id,tool,input,expiresAt:timeout>0?Date.now()+timeout:0});run.view.revision++;
 });}
 private async execute(run:Run,input:Input){let unsubscribe:(()=>void)|undefined;
  const commands=new Map<string,{block:Block;arguments:Record<string,unknown>}>();
  function clearStreaming(){
    delete run.view.reasoningPreviews;
    delete run.view.writePreviews;
    for(const command of commands.values())command.block.input=command.arguments;
    commands.clear();
  }
  try{
  const client=await this.connect();await allowedPath(this.roots,input.cwd,true);if(run.view.status!=='running')return;
  const mcpServers=this.boardMcp(input.cwd);
  const config={workingDirectory:input.cwd,...(Object.keys(mcpServers).length?{mcpServers}:{}),model:input.model||'auto',streaming:true,systemMessage:{mode:'append' as const,content:await projectBoardInstructions(input.cwd)},
   onPermissionRequest:async(request:any)=>{if(run.view.status!=='running')return{kind:'denied-interactively-by-user' as const};if(input.access==='full')return{kind:'approved' as const};const response=await this.ask(run,request.kind||'Copilot tool',request);return{kind:response.allow?'approved' as const:'denied-interactively-by-user' as const};},
   onUserInputRequest:async(request:any)=>{if(run.view.status!=='running')return{answer:'Cancelled',wasFreeform:true};if(input.access==='full')return{answer:'No user is available to answer questions during this scheduled run. Proceed using the supplied instructions and reasonable, reversible assumptions.',wasFreeform:true};const response=await this.ask(run,'AskUserQuestion',{questions:[{question:request.question,allowFreeform:request.allowFreeform,options:request.choices?.map((label:string)=>({label}))}]});const answer=response.allow?response.answers?.[request.question]||'':'Cancelled';return{answer,wasFreeform:!response.allow||!request.choices?.includes(answer)};}};
  run.session=input.sessionId?await client.resumeSession(input.sessionId,config):await client.createSession(config);run.view.sessionId=run.session.sessionId;run.view.revision++;
  if(run.view.status!=='running'){await run.session.abort();return;}
  const previews=new ToolInputPreviews();
  const generation=new CopilotGeneration(!input.sessionId);
  unsubscribe=run.session.on(event=>{
    if(run.view.status!=='running')return;
    generation.observe(run.view,event);
    if(!event.agentId){
      if(event.type==='assistant.tool_call_delta'){
        const {toolCallId,inputDelta,toolName}=event.data;
        if(!toolName||toolName==='create'||toolName==='edit') previews.append(run.view,toolCallId,inputDelta,toolName);
      }
      if(event.type==='tool.execution_start'||event.type==='tool.execution_complete') previews.remove(run.view,event.data.toolCallId);
      if(event.type==='assistant.reasoning_delta'){
        const {reasoningId,deltaContent}=event.data;
        const id='copilot-reasoning:'+reasoningId;
        if(reasoningId&&deltaContent&&!run.view.messages.some(message=>message.id===id)){
          const rows=run.view.reasoningPreviews??=[];
          let row=rows.find(message=>message.id===id);
          if(!row){row={id,role:'assistant',blocks:[{type:'thinking',thinking:''}]};rows.push(row);}
          row.blocks[0].thinking=((row.blocks[0].thinking||'')+deltaContent).slice(0,65_536);
        }
      }
      if(event.type==='assistant.reasoning'&&run.view.reasoningPreviews){
        const id='copilot-reasoning:'+event.data.reasoningId;
        run.view.reasoningPreviews=run.view.reasoningPreviews.filter(message=>message.id!==id);
        if(!run.view.reasoningPreviews.length)delete run.view.reasoningPreviews;
      }
      if(event.type==='tool.execution_partial_result'){
        const command=commands.get(event.data.toolCallId);
        if(command&&event.data.partialOutput){
          const input=command.block.input as Record<string,unknown>;
          const output=(typeof input.output==='string'?input.output:'')+event.data.partialOutput;
          command.block.input={...command.arguments,output:output.slice(-16_384)};
        }
      }
      if(event.type==='tool.execution_complete'){
        const command=commands.get(event.data.toolCallId);
        if(command){command.block.input=command.arguments;commands.delete(event.data.toolCallId);}
      }
    }
    if(event.type==='assistant.message_delta')run.view.partial+=event.data.deltaContent||'';
    const message=copilotMessage(event);
    if(message&&message.role!=='user'){
      run.view.messages.push(message);
      if(event.type==='assistant.message')run.view.partial='';
      if(!event.agentId&&event.type==='tool.execution_start'&&['shell','bash','powershell'].includes(event.data.toolName)){
        const block=message.blocks[0];
        if(block.input&&typeof block.input==='object')commands.set(event.data.toolCallId,{block,arguments:block.input as Record<string,unknown>});
      }
    }
    if(event.type==='session.error'){clearStreaming();run.view.error=event.data.message||'Copilot failed';run.view.status='error';}
    run.view.revision++;
  });
  await run.session.sendAndWait({prompt:input.text,attachments:input.attachmentPaths?.map(file=>({type:'file' as const,path:file}))},3600000);
  if(run.view.status==='running')run.view.status='done';
 }catch(error){if(run.view.status!=='stopped'){run.view.status='error';run.view.error=error instanceof Error?error.message:'Copilot failed';}}
 finally{unsubscribe?.();clearStreaming();if(this.runs.get(run.view.id)===run)this.recordGeneration?.(run.view);for(const finish of run.pending.values())finish(false);run.view.partial='';run.view.revision++;await run.session?.disconnect().catch(()=>{});}}
 async followup(id:string,input:FollowupInput){const run=this.runs.get(id);if(!run)throw new HttpError(404,'Copilot task not found');await run.followups.run(input,async()=>{if(run.view.status!=='running'||!run.session)throw new HttpError(409,'Copilot is not ready for a follow-up. Your draft is preserved.');await run.session.send({prompt:input.text,mode:'enqueue',attachments:input.attachmentPaths?.map(file=>({type:'file' as const,path:file}))});run.view.messages.push({id:input.id,role:'user',blocks:userInputBlocks(input)});run.view.revision++;});return run.view;}
 stop(id:string){const run=this.runs.get(id);if(!run)return;delete run.view.writePreviews;delete run.view.reasoningPreviews;run.view.status='stopped';run.view.revision++;for(const finish of run.pending.values())finish(false);void run.session?.abort().catch(()=>{});}
 approve(id:string,approval:string,allow:boolean,answers?:Record<string,string>,_decision?:{message?:string;remember?:boolean;mode?:string}){const run=this.runs.get(id),finish=run?.pending.get(approval);if(!finish)throw new HttpError(404,'This question is no longer pending');finish(allow,answers);}
 loginStatus(){return this.authLogin.status();}
 async login(){if(this.list().some(job=>job.status==='running'))throw new HttpError(409,'Finish Copilot jobs before signing in.');if((await this.status()).authenticated)return{state:'connected',error:''};return this.authLogin.start();}
 async close(){this.closed=true;this.authLogin.close();for(const id of this.runs.keys())if(this.get(id).status==='running')this.stop(id);await this.starting?.catch(()=>{});await this.client.stop();}
}
