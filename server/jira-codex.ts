import {discoverCodex,StdioCodexRpc,type CodexRpc} from './codex-rpc.js';
import {HttpError} from './security.js';
import type {ReadCall} from './jira-existing.js';
import {JiraConnectionError,JIRA_CODEX_LOGIN_REQUIRED} from './jira-connection-error.js';

const allowed=new Set(['getAccessibleAtlassianResources','searchJiraIssuesUsingJql','getJiraIssue','executeRead','transitionJiraIssue']);
const matches=(actual:string,wanted:string)=>actual===wanted||actual.endsWith('__'+wanted)||actual.endsWith('_'+wanted);
export class CodexJiraTools {
  private rpc?:CodexRpc;
  private ready?:Promise<{rpc:CodexRpc;threadId:string;server:string;tools:Record<string,string>}>;
  private closed=false;
  constructor(private cwd:string,private factory=async():Promise<CodexRpc>=>new StdioCodexRpc(await discoverCodex(),85000)){}
  close(){this.closed=true;this.rpc?.close();this.rpc=undefined;this.ready=undefined;}
  private connect(){
    if(this.closed)throw new Error('Jira connection is closed.');
    if(this.ready)return this.ready;
    const attempt=this.open();this.ready=attempt;
    void attempt.catch(()=>{if(this.ready===attempt){const rpc=this.rpc;this.rpc=undefined;this.ready=undefined;rpc?.close();}});
    return attempt;
  }
  private async open(){
    const rpc=await this.factory();if(this.closed){rpc.close();throw Error('Jira connection is closed.');}this.rpc=rpc;
    rpc.on('disconnect',()=>{if(this.rpc===rpc){this.ready=undefined;this.rpc=undefined;}});
    // No model turn is started. Unexpected approval/elicitation is never auto-approved.
    rpc.on('request',(message:any)=>rpc.reject(message.id,'Complete connector authorization in Codex on the PC.'));
    await rpc.request('initialize',{clientInfo:{name:'pocket_code_jira',version:'1.0.0'},capabilities:{experimentalApi:true}});
    rpc.notify('initialized');
    const started=await rpc.request('thread/start',{cwd:this.cwd,ephemeral:true,approvalPolicy:'never',sandbox:'read-only'});
    const threadId=started.thread?.id;if(typeof threadId!=='string')throw Error('Codex did not initialize Jira tools.');
    const candidates:{server:string;tools:Record<string,string>}[]=[];
    let jiraLoginRequired=false;
    let cursor:string|undefined;
    for(let page=0;page<20;page++){
      const result=await rpc.request('mcpServerStatus/list',{threadId,detail:'toolsAndAuthOnly',limit:100,...(cursor?{cursor}:{})});
      for(const server of result.data||[]){
        if(server.name==='jira'&&server.authStatus==='notLoggedIn')jiraLoginRequired=true;
        const tools:Record<string,string>={};
        for(const [key,value] of Object.entries(server.tools||{})){
          const name=(value as any)?.name||key;
          for(const wanted of allowed)if(matches(name,wanted))tools[wanted]=name;
        }
        if(tools.getAccessibleAtlassianResources&&tools.searchJiraIssuesUsingJql)candidates.push({server:server.name,tools});
      }
      if(!result.nextCursor)break;
      if(result.nextCursor===cursor)throw Error('Codex returned a repeated tool cursor.');
      cursor=result.nextCursor;
      if(page===19)throw Error('Codex tool discovery exceeded its page limit.');
    }
    if(!candidates.length&&jiraLoginRequired)throw new JiraConnectionError(JIRA_CODEX_LOGIN_REQUIRED);
    if(candidates.length!==1)throw new HttpError(409,candidates.length?'Multiple Jira connectors are enabled in Codex. Keep one enabled for Pocket Code.':'Connect Atlassian MCP in Codex on the PC, then retry. This Codex runtime must expose Jira tools through app-server.');
    return {rpc,threadId,...candidates[0]};
  }
  call:ReadCall=async(name,args)=>{
    if(!allowed.has(name)||(name==='executeRead'&&args.name!=='listJiraIssueTransitions'))throw Error('Unsupported Jira operation.');
    const {rpc,threadId,server,tools}=await this.connect();
    if(!tools[name])throw new HttpError(409,'This Jira tool is unavailable in the selected Codex connector.');
    // Exactly one call, including writes: never retry an uncertain remote mutation.
    const result=await rpc.request('mcpServer/tool/call',{threadId,server,tool:tools[name],arguments:args});
    if(result.isError)throw new HttpError(502,'The Codex Jira connector rejected the operation.');
    if(result.structuredContent!=null)return result.structuredContent;
    const text=(result.content||[]).filter((block:any)=>block.type==='text').map((block:any)=>block.text).join('\n');
    try{return JSON.parse(text||(name==='transitionJiraIssue'?'{}':''));}catch{throw new HttpError(502,'The Codex Jira connector returned an unsupported response.');}
  };
}
