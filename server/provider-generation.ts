import type {SDKMessage} from '@anthropic-ai/claude-agent-sdk';
import type {SessionEvent} from '@github/copilot-sdk';
import type {JobView} from './types.js';

const count=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
type ClaudeUsage={input_tokens?:number|null;output_tokens?:number|null;cache_read_input_tokens?:number|null;cache_creation_input_tokens?:number|null};

export class ClaudeGeneration {
  private outputs=new Map<string,number>();
  private current='';
  private model='';
  private input?:number;
  private anchor?:{at:number;tokens:number};
  /** Messages whose provider reported an output count; text of the others is estimated. */
  private measured=new Set<string>();
  private streamed=0;
  constructor(private now=()=>performance.now()){}

  private message(job:JobView,id:string,model:string,usage:ClaudeUsage|undefined){
    if(!id||!usage)return;
    const previous=this.outputs.get(id);
    if(this.current!==id){
      if(previous!==undefined)return; // A late final envelope for an earlier tool call.
      this.current=id;this.input=undefined;this.anchor=undefined;
      if(job.generation){
        delete job.generation.outputTokensPerSecond;
        delete job.generation.contextTokens;
        if(model!==this.model)delete job.generation.contextWindow;
      }
      this.model=model;
    }
    if(count(usage.input_tokens)){
      const cached=usage.cache_read_input_tokens??0,written=usage.cache_creation_input_tokens??0;
      if(count(cached)&&count(written))this.input=usage.input_tokens+cached+written;
    }
    const output=usage.output_tokens;
    if(count(output)&&output>0)this.measured.add(id);
    if(!count(output)||previous!==undefined&&output<previous)return;
    const stats=job.generation??={};
    stats.outputTokens=(stats.outputTokens??0)+output-(previous??0);
    this.outputs.set(id,output);
    if(count(this.input))stats.contextTokens=this.input+output;
    const now=this.now();
    if(!this.anchor)this.anchor={at:now,tokens:output};
    else if(output>(previous??0)&&now-this.anchor.at>=100)stats.outputTokensPerSecond=(output-this.anchor.tokens)*1000/(now-this.anchor.at);
  }
  observe(job:JobView,event:SDKMessage){
    if('parent_tool_use_id' in event&&event.parent_tool_use_id)return;
    if(event.type==='stream_event'){
      const part=event.event;
      if(part.type==='message_start')this.message(job,part.message.id,part.message.model,part.message.usage);
      if(part.type==='message_delta')this.message(job,this.current,this.model,part.usage);
      // A model that reports no output count while it writes (a local model behind a proxy): the streamed text gives an estimate.
      if(part.type==='content_block_delta'&&this.current&&!this.measured.has(this.current)){
        const delta=part.delta as {text?:string;thinking?:string;partial_json?:string};
        const added=(delta.text||delta.thinking||delta.partial_json||'').length;
        if(added){this.streamed+=added;(job.generation??={}).estimatedTokens=Math.ceil(this.streamed/4);}
      }
    }else if(event.type==='assistant')this.message(job,event.message.id,event.message.model,event.message.usage);
    else if(event.type==='result'){
      if(job.generation)delete job.generation.estimatedTokens;
      const output=event.usage?.output_tokens;
      if(count(output)&&output>0)(job.generation??={}).outputTokens=output; // Native per-turn main-loop count.
      const models=Object.entries(event.modelUsage??{});
      if(!models.length)return;
      const parts=models.flatMap(([,m])=>[m.inputTokens,m.outputTokens,m.cacheReadInputTokens,m.cacheCreationInputTokens]);
      if(parts.every(count)){
        const total=parts.reduce((sum,n)=>sum+n,0);
        if(total>0)(job.generation??={}).totalTokens=total; // Native cumulative session snapshot, including internal calls.
      }
      const model=models.find(([key,m])=>key===this.model||m.canonicalModel===this.model)?.[1];
      if(count(model?.contextWindow)&&model.contextWindow>0&&count(job.generation?.contextTokens))job.generation!.contextWindow=model.contextWindow;
    }
  }
  nextTurn(job:JobView){
    this.outputs.clear();this.current='';this.model='';this.input=undefined;this.anchor=undefined;this.measured.clear();this.streamed=0;
    const totalTokens=job.generation?.totalTokens;
    job.generation=count(totalTokens)?{totalTokens}:undefined;
  }
}

export class CopilotGeneration {
  private seen=new Set<string>();
  private userMessage='';
  private wholeTurn=true;
  private wholeSession:boolean;
  private summed=0;
  constructor(fresh:boolean){this.wholeSession=fresh;}
  observe(job:JobView,event:SessionEvent){
    if(event.agentId){
      // A main-turn subtotal cannot represent a session with other billable agents.
      if(event.type==='assistant.usage'){this.wholeSession=false;if(job.generation)delete job.generation.totalTokens;}
      return;
    }
    if(event.type==='user.message'){
      if(this.userMessage&&this.userMessage!==event.id){
        this.wholeTurn=true;
        if(job.generation){delete job.generation.outputTokens;delete job.generation.outputTokensPerSecond;}
      }
      this.userMessage=event.id;
    }else if(event.type==='session.usage_info'){
      const {currentTokens,tokenLimit}=event.data;
      if(count(currentTokens)&&count(tokenLimit)&&tokenLimit>0)Object.assign(job.generation??={},{contextTokens:currentTokens,contextWindow:tokenLimit});
    }else if(event.type==='assistant.usage'){
      const d=event.data;
      if(d.parentToolCallId||d.initiator==='sub-agent'||d.initiator==='mcp-sampling'||d.interactionType==='conversation-subagent'){
        this.wholeSession=false;if(job.generation)delete job.generation.totalTokens;
        return;
      }
      const id=d.providerCallId||d.serviceRequestId||event.id;
      if(!id||this.seen.has(id))return;
      this.seen.add(id);
      const output=d.outputTokens;
      if(!count(output)||!count(d.inputTokens))this.wholeSession=false;
      if(!this.wholeSession&&job.generation)delete job.generation.totalTokens;
      if(!count(output)){
        this.wholeTurn=false;
        if(job.generation){delete job.generation.outputTokens;delete job.generation.outputTokensPerSecond;}
        return;
      }
      const stats=job.generation??={};
      if(this.wholeTurn)stats.outputTokens=(stats.outputTokens??0)+output;
      delete stats.outputTokensPerSecond;
      if(output>1){
        if(positive(d.interTokenLatencyMs))stats.outputTokensPerSecond=1000/d.interTokenLatencyMs;
        else{
          const ttft=d.timeToFirstTokenMs??d.outputTtftMs;
          if(positive(d.duration)&&typeof ttft==='number'&&Number.isFinite(ttft)&&ttft>=0&&d.duration>ttft)
            stats.outputTokensPerSecond=(output-1)*1000/(d.duration-ttft);
        }
      }
      if(this.wholeSession&&count(d.inputTokens)){
        this.summed+=d.inputTokens+output;
        stats.totalTokens=this.summed;
      }
    }else if(event.type==='session.shutdown'){
      const entries=Object.values(event.data.modelMetrics??{});
      if(!entries.length||!entries.every(m=>count(m?.usage?.inputTokens)&&count(m?.usage?.outputTokens)))return;
      const total=entries.reduce((n,m)=>n+m!.usage.inputTokens+m!.usage.outputTokens,0);
      if(total>0)(job.generation??={}).totalTokens=total;
    }
  }
}
