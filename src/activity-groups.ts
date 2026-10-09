import type {Block,ChatMessage} from '../server/types';
import {toolActivity} from './tool-activity';

export type ActivityBlock={block:Block;result?:Block;index:number;messageId:string;running:boolean};
export function visibleMessageBlocks(message:ChatMessage,results?:Map<string,Block>,running=false):ActivityBlock[]{
 return message.blocks.flatMap((block,index)=>{
  const previous=message.blocks[index-1],next=message.blocks[index+1];
  if(block.type==='tool_result'&&block.tool_use_id&&(results?.has(block.tool_use_id)||previous?.type==='tool_use'&&previous.id===block.tool_use_id))return [];
  const result=block.type==='tool_use'&&block.id?(results?.get(block.id)||(next?.type==='tool_result'&&next.tool_use_id===block.id?next:undefined)):undefined;
  return [{block,result,index,messageId:message.id,running}];
 });
}
export function activityGroupKey({block,result,running}:ActivityBlock):string|undefined{
 if(block.type==='tool_use'){
  const a=toolActivity(block,result,running);
  // Errors must remain visible even when their surrounding calls are collapsed.
  return a.failed?undefined:[a.kind,a.label,a.kind==='tool'?block.name||'':''].join('|');
 }
 if(block.type==='thinking')return 'thinking';
 return undefined;
}
export type ActivityRun={key:string;items:ActivityBlock[]};
export function groupActivityBlocks(blocks:ActivityBlock[]):ActivityRun[]{
 const runs:ActivityRun[]=[];
 for(const item of blocks){const key=activityGroupKey(item),last=runs.at(-1);
  if(key&&last&&activityGroupKey(last.items[0])===key)last.items.push(item);
  else runs.push({key:`${item.messageId}:${item.index}`,items:[item]});
 }
 return runs;
}
export type TranscriptRun={key:string;message?:ChatMessage;items?:ActivityBlock[]};
export function groupActivityMessages(messages:ChatMessage[],results?:Map<string,Block>,running?:Set<ChatMessage>|null):TranscriptRun[]{
 const runs:TranscriptRun[]=[];
 for(const message of messages){
  const items=visibleMessageBlocks(message,results,running?.has(message));
  if(!items.length)continue;
  if(!items.every(item=>activityGroupKey(item)!==undefined)){runs.push({key:message.id,message});continue;}
  for(const item of items){const last=runs.at(-1);
   if(last?.items&&activityGroupKey(last.items[0])===activityGroupKey(item))last.items.push(item);
   else runs.push({key:`${message.id}:${item.index}`,items:[item]});
  }
 }
 return runs;
}
