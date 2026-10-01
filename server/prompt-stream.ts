import type {SDKUserMessage} from '@anthropic-ai/claude-agent-sdk';
export class PromptStream implements AsyncIterable<SDKUserMessage>{
  private queue:SDKUserMessage[]=[];
  private wake?:()=>void;
  private closed=false;
  push(id:string,text:string,sessionId=''){
    if(this.closed)throw new Error('Input stream is closed');
    this.queue.push({type:'user',uuid:id as SDKUserMessage['uuid'],session_id:sessionId,parent_tool_use_id:null,message:{role:'user',content:text}});
    this.wake?.();
  }
  close(){this.closed=true;this.wake?.();}
  async *[Symbol.asyncIterator](){
    while(true){
      if(this.queue.length){yield this.queue.shift()!;continue;}
      if(this.closed)return;
      await new Promise<void>(resolve=>{this.wake=resolve;});this.wake=undefined;
    }
  }
}
