import {spawn,execFile,type ChildProcess} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {access,readdir,readFile,stat,rm,open} from 'node:fs/promises';
import {realpath} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {allowedPath,HttpError} from './security.js';
import {projectBoardInstructions} from './project-rules.js';
import {userInputBlocks} from './user-input-blocks.js';
import {Followups,type FollowupInput} from './followups.js';
import type {ChatMessage,JobView} from './types.js';
import type {ProviderModel} from './provider-model.js';

/**
 * Google Gemini through the official Gemini CLI (`@google/gemini-cli`), signed in with the user's Google account.
 * Every turn is one headless CLI run (`--output-format stream-json`); the CLI keeps the conversation in its own
 * history (~/.gemini/tmp/<project>/chats), which Pocket Code reads for the chat list and resumes with `--resume <id>`.
 * No API key is read, stored or passed: an account set to an API key is reported as not supported.
 */
export type GeminiCommand={command:string;args:string[]};
export type GeminiAccess='default'|'auto_edit'|'yolo'|'plan';
type Input={id:string;cwd:string;sessionId?:string;text:string;displayText?:string;model?:string;mode?:'default'|'plan';access?:GeminiAccess;baseMessageCount?:number;attachmentPaths?:string[];jira?:JobView['jira']};
type Run={view:JobView;child?:ChildProcess;followups:Followups;queue:FollowupInput[];input:Input};
type Options={
  /** Tests: a fixed CLI instead of discovering the installed one. */command?:GeminiCommand|null;
  /** Tests: the folder that holds `.gemini` (GEMINI_CLI_HOME). */home?:string;
  env?:NodeJS.ProcessEnv;
};
export type GeminiStatus={available:boolean;authenticated:boolean;access:'ready'|'not-installed'|'sign-in-required'|'api-key-not-supported'|'models-unavailable'|'verification-failed';models:ProviderModel[];error:string;version?:string};

const cliScripts=[['bundle','gemini.js'],['dist','index.js']];
/** The installed CLI, run by this Node with its script: the npm shim (gemini.cmd) would need a shell and quoting of the prompt. */
export async function discoverGemini(env:NodeJS.ProcessEnv=process.env):Promise<GeminiCommand>{
  const run=(file:string):GeminiCommand=>/\.[cm]?js$/i.test(file)?{command:process.execPath,args:[file]}:{command:file,args:[]};
  if(env.POCKET_GEMINI_CLI){const file=path.resolve(env.POCKET_GEMINI_CLI);await access(file);return run(file);}
  const packages:string[]=[];
  const dirs=(env.PATH||env.Path||'').split(path.delimiter).filter(Boolean);
  for(const dir of dirs){packages.push(path.join(dir,'node_modules','@google','gemini-cli'),path.join(dir,'..','lib','node_modules','@google','gemini-cli'));}
  if(env.APPDATA)packages.push(path.join(env.APPDATA,'npm','node_modules','@google','gemini-cli'));
  for(const root of packages)for(const parts of cliScripts){const file=path.join(root,...parts);try{await access(file);return run(file);}catch{/* Next candidate. */}}
  if(process.platform!=='win32')for(const dir of dirs){const file=path.join(dir,'gemini');try{await access(file);return run(file);}catch{/* Next candidate. */}}
  throw new Error('Gemini CLI not installed');
}

/** JSON with // and block comments (Gemini settings allow them); strings are kept intact. */
export function parseSettings(text:string):any{
  let out='',inString=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inString){out+=c;if(c==='\\'){out+=text[++i]??'';}else if(c==='"')inString=false;continue;}
    if(c==='"'){inString=true;out+=c;continue;}
    if(c==='/'&&text[i+1]==='/'){while(i<text.length&&text[i]!=='\n')i++;out+='\n';continue;}
    if(c==='/'&&text[i+1]==='*'){i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;i++;continue;}
    out+=c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g,'$1'));
}
const exists=async(file:string)=>{try{await access(file);return true;}catch{return false;}};
/**
 * Sign-in as the CLI records it, without running it or reading a credential: the selected auth type in settings.json
 * and a stored Google credential. Account names and tokens are never read into Pocket Code.
 */
export async function geminiAuth(home:string,env:NodeJS.ProcessEnv=process.env):Promise<'google'|'sign-in-required'|'api-key'>{
  const dir=path.join(home,'.gemini');let settings:any={};
  try{settings=parseSettings(await readFile(path.join(dir,'settings.json'),'utf8'));}catch{/* No settings: not signed in yet. */}
  const selected=settings?.security?.auth?.selectedType??settings?.selectedAuthType??(env.GOOGLE_GENAI_USE_GCA==='true'?'oauth-personal':undefined);
  if(selected&&selected!=='oauth-personal')return 'api-key';
  if(!selected)return 'sign-in-required';
  if(await exists(path.join(dir,'oauth_creds.json'))||await exists(path.join(dir,'gemini-credentials.json')))return 'google';
  // Credentials kept in the system keychain leave only the active account marker (its value is not read here).
  try{const accounts=JSON.parse(await readFile(path.join(dir,'google_accounts.json'),'utf8'));if(typeof accounts?.active==='string'&&accounts.active)return 'google';}catch{/* Not signed in. */}
  return 'sign-in-required';
}

const contextStart='<pocket-code-context>',contextEnd='</pocket-code-context>';
/** Pocket Code's project guidance travels in front of the first prompt of a chat; history hides it again. */
export function withContext(text:string,context:string){return context?`${contextStart}\n${context}\n${contextEnd}\n\n${text}`:text;}
export function withoutContext(text:string){return text.startsWith(contextStart)?text.slice(text.indexOf(contextEnd)+contextEnd.length).replace(/^\s+/,''):text;}
/** The host lists attached files after the text (app.ts); the transcript shows the person's own words. */
const attachmentNote='\n\nFiles attached by the user (read these local files as needed):\n';
function stripAttachments(text:string){const at=text.lastIndexOf(attachmentNote);return at>=0&&/^(".+"\n?)+$/.test(text.slice(at+attachmentNote.length))?text.slice(0,at):text;}
const partText=(content:unknown):string=>typeof content==='string'?content:Array.isArray(content)?content.map(part=>typeof part==='string'?part:part&&typeof part==='object'&&typeof (part as any).text==='string'&&!(part as any).thought?(part as any).text:'').join(''):'';
const toolOutput=(call:any):string=>{
  if(typeof call?.resultDisplay==='string')return call.resultDisplay;
  const parts=Array.isArray(call?.result)?call.result:[];
  for(const part of parts){const output=part?.functionResponse?.response?.output??part?.functionResponse?.response?.error;if(typeof output==='string')return output;}
  return '';
};

/** One Gemini CLI history record as transcript messages. */
export function geminiMessages(record:any):ChatMessage[]{
  if(!record||typeof record!=='object'||typeof record.id!=='string')return [];
  if(record.type==='user'){const text=stripAttachments(withoutContext(partText(record.content)));return text?[{id:record.id,role:'user',blocks:[{type:'text',text}]}]:[];}
  if(record.type!=='gemini')return [];
  const out:ChatMessage[]=[];
  const thoughts=Array.isArray(record.thoughts)?record.thoughts.map((t:any)=>[t?.subject,t?.description].filter(v=>typeof v==='string'&&v).join(': ')).filter(Boolean).join('\n\n'):'';
  if(thoughts)out.push({id:record.id+':thinking',role:'assistant',blocks:[{type:'thinking',thinking:thoughts}]});
  for(const call of Array.isArray(record.toolCalls)?record.toolCalls:[]){
    if(typeof call?.id!=='string')continue;
    out.push({id:record.id+':tool:'+call.id,role:'assistant',blocks:[{type:'tool_use',id:call.id,name:String(call.name||'tool'),input:call.args??{}}]});
    if(call.status&&call.status!=='executing'&&call.status!=='scheduled'&&call.status!=='validating'&&call.status!=='awaiting_approval')
      out.push({id:record.id+':result:'+call.id,role:'assistant',blocks:[{type:'tool_result',tool_use_id:call.id,content:toolOutput(call),is_error:call.status==='error'||call.status==='cancelled'}]});
  }
  const text=partText(record.content);
  if(text)out.push({id:record.id,role:'assistant',blocks:[{type:'text',text}]});
  return out;
}
type Conversation={sessionId:string;projectHash?:string;startTime?:string;kind?:string;summary?:string;records:any[]};
/** Reads a CLI history file the way the CLI does: later records of one id replace it, rewinds cut, `$set` replaces all. */
export function parseConversation(text:string):Conversation|null{
  const trimmed=text.trimStart();
  if(trimmed.startsWith('{')&&!trimmed.includes('\n{')){try{const value=JSON.parse(trimmed);if(typeof value?.sessionId==='string')return{sessionId:value.sessionId,projectHash:value.projectHash,startTime:value.startTime,kind:value.kind,summary:value.summary,records:Array.isArray(value.messages)?value.messages:[]};}catch{/* JSONL below. */}}
  let meta:any={};const records=new Map<string,any>();
  for(const line of text.split('\n')){
    if(!line.trim())continue;let record:any;try{record=JSON.parse(line);}catch{continue;}
    if(!record||typeof record!=='object')continue;
    if(typeof record.$rewindTo==='string'){let cut=false;for(const id of [...records.keys()]){if(id===record.$rewindTo)cut=true;if(cut)records.delete(id);}if(!cut)records.clear();continue;}
    if(record.$set&&typeof record.$set==='object'){if(Array.isArray(record.$set.messages)){records.clear();for(const m of record.$set.messages)if(typeof m?.id==='string')records.set(m.id,m);}const {messages:_m,...rest}=record.$set;meta={...meta,...rest};continue;}
    if(typeof record.id==='string'&&typeof record.type==='string'){records.set(record.id,{...records.get(record.id),...record});continue;}
    if(typeof record.sessionId==='string'){const {messages,...rest}=record;meta={...meta,...rest};if(Array.isArray(messages))for(const m of messages)if(typeof m?.id==='string')records.set(m.id,m);}
  }
  return typeof meta.sessionId==='string'?{sessionId:meta.sessionId,projectHash:meta.projectHash,startTime:meta.startTime,kind:meta.kind,summary:meta.summary,records:[...records.values()]}:null;
}
export const projectHash=(root:string)=>createHash('sha256').update(root).digest('hex');
type Listed={file:string;mtime:number;sessionId:string;cwd:string;summary:string;hash?:string};

export class GeminiService{
  recordGeneration?:(job:JobView)=>void;
  private runs=new Map<string,Run>();private closed=false;private configuredRoots:string[];
  private files=new Map<string,Listed>();
  private models?:{at:number;value:ProviderModel[]};private loadingModels?:Promise<ProviderModel[]>;
  constructor(private roots:string[],private options:Options={}){this.configuredRoots=[...roots];}
  setManagedTaskRoots(roots:string[]){this.roots=[...this.configuredRoots,...roots];}
  private get home(){return this.options.home||this.env.GEMINI_CLI_HOME||homedir();}
  private get env(){return this.options.env||process.env;}
  private async cli(){if(this.options.command)return this.options.command;if(this.options.command===null)throw new Error('Gemini CLI not installed');return discoverGemini(this.env);}
  private childEnv(){const env={...this.env};if(this.options.home)env.GEMINI_CLI_HOME=this.options.home;
    // Keep the user's Google sign-in: an API key in the host environment must not switch the CLI to paid API billing.
    delete env.GEMINI_API_KEY;delete env.GOOGLE_API_KEY;return env;}
  private exec(args:string[],cwd:string,timeout=30000){return this.cli().then(cli=>new Promise<{code:number;stdout:string}>(resolve=>execFile(cli.command,[...cli.args,...args],{cwd,env:this.childEnv(),windowsHide:true,timeout,maxBuffer:4*1024*1024},(error,stdout)=>resolve({code:error?Number((error as any).code)||1:0,stdout:String(stdout)}))));}
  async version(){const result=await this.exec(['--version'],this.roots[0]||this.home,15000);return result.code===0?result.stdout.match(/\b\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*\b/)?.[0]||'':'';}
  /** The CLI's own model catalog (`--list-models`), read at most every ten minutes. */
  private async catalog():Promise<ProviderModel[]>{
    if(this.models&&Date.now()-this.models.at<600_000)return this.models.value;
    if(!this.loadingModels)this.loadingModels=this.exec(['--list-models','--output-format','json'],this.roots[0]||this.home,45000).then(result=>{
      if(result.code!==0)throw new Error('models');
      const list=JSON.parse(result.stdout.slice(result.stdout.indexOf('[')));
      const value:ProviderModel[]=(Array.isArray(list)?list:[]).filter((m:any)=>typeof (m?.id??m?.modelId)==='string').slice(0,64).map((m:any)=>({id:String(m.id??m.modelId),name:String(m.displayName||m.name||m.id||m.modelId),...(m.description?{description:String(m.description).slice(0,300)}:{})}));
      this.models={at:Date.now(),value};return value;
    }).finally(()=>{this.loadingModels=undefined;});
    return this.loadingModels;
  }
  async status():Promise<GeminiStatus>{
    try{await this.cli();}catch{return{available:false,authenticated:false,access:'not-installed',models:[],error:'Gemini CLI is not installed on the PC. Install it with: npm install -g @google/gemini-cli'};}
    let auth:Awaited<ReturnType<typeof geminiAuth>>;
    try{auth=await geminiAuth(this.home,this.env);}catch{return{available:true,authenticated:false,access:'verification-failed',models:[],error:'Gemini CLI sign-in could not be checked on the PC.'};}
    if(auth==='api-key')return{available:true,authenticated:false,access:'api-key-not-supported',models:[],error:'Gemini CLI is set to an API key. Pocket Code uses your Google account: run gemini on the PC, type /auth and choose Sign in with Google.'};
    if(auth!=='google')return{available:true,authenticated:false,access:'sign-in-required',models:[],error:'Sign in to Gemini on the PC: run gemini once in a terminal and choose Sign in with Google.'};
    try{return{available:true,authenticated:true,access:'ready',models:await this.catalog(),error:''};}
    catch{return{available:true,authenticated:true,access:'models-unavailable',models:[],error:''};}
  }
  /** Login is interactive in the CLI itself; Pocket Code never handles the Google sign-in. */
  async refreshAuthentication(){this.models=undefined;}
  private async scan(){
    const base=path.join(this.home,'.gemini','tmp');let projects:string[]=[];
    try{projects=await readdir(base);}catch{return [];}
    const seen=new Set<string>(),out:Listed[]=[];
    for(const project of projects){
      const chats=path.join(base,project,'chats');let names:string[];try{names=await readdir(chats);}catch{continue;}
      let root='';try{root=(await readFile(path.join(base,project,'.project_root'),'utf8')).trim();}catch{/* Older layout: the folder is the project hash. */}
      if(root)try{root=await new Promise<string>((resolve,reject)=>realpath.native(root,(error,value)=>error?reject(error):resolve(value)));}catch{/* The project folder is gone; the chat stays read-only. */}
      for(const name of names){
        if(!/^session-.*\.jsonl?$/.test(name)&&!/\.jsonl$/.test(name))continue;
        const file=path.join(chats,name);let info;try{info=await stat(file);}catch{continue;}
        seen.add(file);const cached=this.files.get(file);
        if(cached&&cached.mtime===info.mtimeMs){out.push(cached);continue;}
        const head=name.endsWith('.json')?(info.size<8*1024*1024?await readFile(file,'utf8').catch(()=>''):''):await readHead(file,256*1024),conversation=head?parseConversation(head):null;
        if(!conversation||conversation.kind==='subagent')continue;
        const first=conversation.records.find(r=>r?.type==='user'),summary=conversation.summary||(first?stripAttachments(withoutContext(partText(first.content))):'')||'Gemini chat';
        const row={file,mtime:info.mtimeMs,sessionId:conversation.sessionId,cwd:root,summary:summary.replace(/\s+/g,' ').slice(0,200),hash:conversation.projectHash};
        this.files.set(file,row);out.push(row);
      }
    }
    for(const file of this.files.keys())if(!seen.has(file))this.files.delete(file);
    return out;
  }
  async sessions(){
    const rows=await this.scan(),latest=new Map<string,Listed>();
    for(const row of rows){const old=latest.get(row.sessionId);if(!old||old.mtime<row.mtime)latest.set(row.sessionId,row);}
    // A chat Pocket Code started knows its folder even when the CLI's project marker is missing.
    for(const run of this.runs.values())if(run.view.sessionId){const row=latest.get(run.view.sessionId);if(row&&!row.cwd)row.cwd=run.view.cwd;}
    return Promise.all([...latest.values()].map(async row=>{let readOnly=true;if(row.cwd)try{await allowedPath(this.roots,row.cwd,true);readOnly=false;}catch{/* Outside the allowed folders. */}
      return{sessionId:row.sessionId,summary:row.summary,cwd:row.cwd,lastModified:Math.round(row.mtime),source:'gemini',provider:'gemini' as const,readOnly};}));
  }
  private async fileOf(id:string){let row=[...this.files.values()].find(r=>r.sessionId===id);if(!row){await this.scan();row=[...this.files.values()].filter(r=>r.sessionId===id).sort((a,b)=>b.mtime-a.mtime)[0];}return row;}
  async messages(id:string):Promise<ChatMessage[]>{
    const row=await this.fileOf(id);
    if(!row){const live=[...this.runs.values()].find(run=>run.view.sessionId===id);return live?live.view.messages:[];}
    const conversation=parseConversation(await readFile(row.file,'utf8'));
    return conversation?conversation.records.flatMap(geminiMessages):[];
  }
  async eraseOriginal(id:string,cwd:string,outsideRoots=false){
    if(this.list().some(job=>job.sessionId===id&&job.status==='running'))throw new HttpError(409,'Stop the current turn before erasing this chat.');
    await this.scan();const rows=[...this.files.values()].filter(r=>r.sessionId===id);if(!rows.length)return;
    if(rows.some(r=>!r.cwd||path.relative(cwd,r.cwd)!==''))throw new HttpError(409,'The local original chat could not be verified in this project.');
    if(!outsideRoots)await allowedPath(this.roots,cwd,true);
    for(const row of rows){await rm(row.file,{force:true});this.files.delete(row.file);}
  }
  forgetSession(id:string){for(const [jobId,run] of this.runs)if(run.view.sessionId===id&&run.view.status!=='running')this.runs.delete(jobId);}
  async forkBeforeMessage(_id:string,_messageId:string):Promise<string>{throw new HttpError(409,'Gemini CLI chats cannot be branched from a message yet.');}
  list(){return [...this.runs.values()].map(run=>({...run.view,messages:[],partial:'',writePreviews:undefined,reasoningPreviews:undefined}));}
  get(id:string){const run=this.runs.get(id);if(!run)throw new HttpError(404,'Gemini task not found.');return run.view;}
  view(job:JobView){return job;}
  start(input:Input){
    if(this.closed)throw new HttpError(503,'Gemini host is stopping');
    if(this.runs.has(input.id))return this.get(input.id);
    if(input.sessionId&&[...this.runs.values()].some(run=>run.view.status==='running'&&run.view.sessionId===input.sessionId))throw new HttpError(409,'This Gemini chat is already running. Send a follow-up to its active turn.');
    for(const [id,run] of this.runs)if(run.view.status!=='running'&&this.runs.size>=90)this.runs.delete(id);
    if(this.runs.size>=100||this.list().filter(job=>job.status==='running').length>=3)throw new HttpError(429,'Too many Gemini jobs.');
    const sessionId=input.sessionId||randomUUID();
    const view:JobView={id:input.id,provider:'gemini',cwd:input.cwd,sessionId,status:'running',messages:[{id:randomUUID(),role:'user',blocks:userInputBlocks(input)}],partial:'',approvals:[],startedAt:Date.now(),revision:0,baseMessageCount:input.baseMessageCount||0,jira:input.jira};
    const run:Run={view,followups:new Followups(),queue:[],input};this.runs.set(input.id,run);
    void this.execute(run,input,!input.sessionId);return view;
  }
  /** A follow-up waits for the current CLI run and is sent as the next turn of the same chat. */
  async followup(id:string,input:FollowupInput){
    const run=this.runs.get(id);if(!run)throw new HttpError(404,'Gemini task not found');
    await run.followups.run(input,async()=>{
      if(run.view.status!=='running')throw new HttpError(409,'Gemini is not ready for a follow-up. Your draft is preserved.');
      run.queue.push(input);run.view.queued=[...(run.view.queued||[]),{id:input.id,text:input.displayText??input.text,attachments:input.attachmentPaths?.length||0}];run.view.revision++;
    });
    return run.view;
  }
  stop(id:string){const run=this.runs.get(id);if(!run)return;run.view.status='stopped';run.queue=[];delete run.view.queued;run.view.partial='';run.view.revision++;if(run.child)killTree(run.child);}
  approve(_id:string,_approval:string,_allow:boolean){throw new HttpError(404,'This question is no longer pending');}
  private async execute(run:Run,input:Input,fresh:boolean){
    try{
      await allowedPath(this.roots,input.cwd,true);
      let turn:{text:string;attachmentPaths?:string[]}=input,first=fresh;
      for(;;){
        if(run.view.status!=='running')return;
        const context=first?await projectBoardInstructions(input.cwd).catch(()=>''):'';
        await this.turn(run,input,withContext(turn.text,context),first,turn.attachmentPaths||[]);
        first=false;
        if(run.view.status!=='running'||!run.queue.length)break;
        const next=run.queue.splice(0);delete run.view.queued;
        for(const item of next)run.view.messages.push({id:item.id,role:'user',blocks:userInputBlocks(item)});
        turn={text:next.map(item=>item.text).join('\n\n'),attachmentPaths:next.flatMap(item=>item.attachmentPaths||[])};run.view.revision++;
      }
      if(run.view.status==='running')run.view.status='done';
    }catch(error){if(run.view.status!=='stopped'){run.view.status='error';run.view.error=error instanceof Error?error.message:'Gemini failed';}}
    finally{run.view.partial='';delete run.view.queued;run.child=undefined;run.view.revision++;if(this.runs.get(run.view.id)===run)this.recordGeneration?.(run.view);}
  }
  private async turn(run:Run,input:Input,prompt:string,fresh:boolean,attachments:string[]){
    const cli=await this.cli();
    const access:GeminiAccess=input.mode==='plan'?'plan':input.access||'auto_edit';
    const dirs=[...new Set(attachments.map(file=>path.dirname(file)))];
    const args=[...cli.args,'--output-format','stream-json','--skip-trust','--approval-mode',access,
      ...(input.model?['--model',input.model]:[]),...(fresh?['--session-id',run.view.sessionId!]:['--resume',run.view.sessionId!]),
      ...dirs.flatMap(dir=>['--include-directories',dir])];
    const child=spawn(cli.command,args,{cwd:input.cwd,env:this.childEnv(),windowsHide:true,stdio:['pipe','pipe','pipe']});
    run.child=child;
    const tools=new Map<string,ChatMessage>();let text='',textId=randomUUID(),stderr='',failure='',buffer='';
    const flushText=()=>{if(text){run.view.messages.push({id:textId,role:'assistant',blocks:[{type:'text',text}]});text='';textId=randomUUID();}run.view.partial='';};
    const handle=(event:any)=>{
      if(run.view.status!=='running'||!event||typeof event!=='object')return;
      if(event.type==='init'&&typeof event.session_id==='string'&&event.session_id!==run.view.sessionId){run.view.sessionId=event.session_id;}
      else if(event.type==='message'&&event.role==='assistant'&&typeof event.content==='string'){if(event.delta){text+=event.content;run.view.partial=text;}else{text=event.content;flushText();}}
      else if(event.type==='tool_use'&&typeof event.tool_id==='string'){flushText();const message:ChatMessage={id:'gemini-tool:'+event.tool_id,role:'assistant',blocks:[{type:'tool_use',id:event.tool_id,name:String(event.tool_name||'tool'),input:event.parameters??{}}]};tools.set(event.tool_id,message);run.view.messages.push(message);}
      else if(event.type==='tool_result'&&typeof event.tool_id==='string'){flushText();run.view.messages.push({id:'gemini-result:'+event.tool_id,role:'assistant',blocks:[{type:'tool_result',tool_use_id:event.tool_id,content:typeof event.output==='string'?event.output.slice(-65_536):event.error?.message||'',is_error:event.status==='error'}]});}
      else if(event.type==='error'&&event.severity==='error'&&typeof event.message==='string'){failure=event.message;}
      else if(event.type==='result'){flushText();
        const stats=event.stats;if(stats&&typeof stats.output_tokens==='number'){const seconds=typeof stats.duration_ms==='number'&&stats.duration_ms>0?stats.duration_ms/1000:0;
          run.view.generation={...run.view.generation,outputTokens:stats.output_tokens,...(seconds?{outputTokensPerSecond:Math.round(stats.output_tokens/seconds*10)/10}:{}),...(typeof stats.total_tokens==='number'?{totalTokens:stats.total_tokens}:{})};}
        if(event.status==='error'&&!failure)failure=event.error?.message||'Gemini failed';}
      run.view.revision++;
    };
    child.stdout!.setEncoding('utf8');child.stderr!.setEncoding('utf8');
    child.stdout!.on('data',(chunk:string)=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at).trim();buffer=buffer.slice(at+1);if(!line.startsWith('{'))continue;try{handle(JSON.parse(line));}catch{/* Not an event line. */}}});
    child.stderr!.on('data',(chunk:string)=>{stderr=(stderr+chunk).slice(-8192);});
    child.stdin!.on('error',()=>{});child.stdin!.end(prompt);
    const code=await new Promise<number|null>(resolve=>{child.once('error',()=>resolve(-1));child.once('close',resolve);});
    if(buffer.trim().startsWith('{'))try{handle(JSON.parse(buffer.trim()));}catch{/* Partial line. */}
    flushText();
    if(run.view.status!=='running')return;
    if(failure||code!==0)throw new Error(failure||geminiFailure(stderr)||'Gemini CLI stopped unexpectedly.');
  }
  loginStatus(){return{state:'idle',error:''};}
  async close(){this.closed=true;for(const id of this.runs.keys())if(this.get(id).status==='running')this.stop(id);}
}
/** A short reason from the CLI's error output, without paths or account details. */
export function geminiFailure(stderr:string){
  if(/auth|login|credential|sign in|oauth/i.test(stderr))return 'Gemini CLI is not signed in. Run gemini on the PC and choose Sign in with Google.';
  if(/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(stderr))return 'Gemini usage limit reached. Try again later or choose another model.';
  if(/trust/i.test(stderr))return 'Gemini CLI does not trust this folder. Open it once in gemini on the PC and trust it.';
  return '';
}
async function readHead(file:string,limit:number){
  const handle=await open(file,'r').catch(()=>null);if(!handle)return '';
  try{const buffer=Buffer.alloc(limit);const {bytesRead}=await handle.read(buffer,0,limit,0);let text=buffer.subarray(0,bytesRead).toString('utf8');if(bytesRead===limit)text=text.slice(0,text.lastIndexOf('\n')+1);return text;}
  finally{await handle.close();}
}
function killTree(child:ChildProcess){if(child.pid&&process.platform==='win32')execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill();}
