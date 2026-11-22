import type {Block,ChatMessage,WritePreview} from '../server/types';
import {startsTurn} from './turn-changes';

function fileBlock(preview:WritePreview):Block{
  const {tool,id,path,content,totalBytes,totalLines,truncated}=preview;
  const data=tool==='Patch'?{patch:content}:tool==='Edit'?{new_string:content}:{content};
  return {type:'tool_use',id,name:tool==='Patch'?'apply_patch':tool,input:{
    ...data,file_path:path,status:'running',preview_bytes:totalBytes,preview_lines:totalLines,preview_truncated:truncated,
  }};
}

/** Merge live arguments for display only. History, clipboard exports and saved messages use the provider transcript. */
export function withLiveWrites(messages:ChatMessage[],previews?:WritePreview[]):ChatMessage[]{
  if(!previews?.length)return messages;
  const byTool=new Map<string,Block[]>();
  for(const preview of previews){
    const blocks=byTool.get(preview.id)||[];
    blocks.push(fileBlock(preview));byTool.set(preview.id,blocks);
  }
  const latestSnapshot=new Map<string,ChatMessage>();
  let start=messages.length;
  while(start>0){start--;if(startsTurn(messages[start]))break;}
  for(let index=start;index<messages.length;index++)for(const block of messages[index].blocks){
    if(block.type==='tool_result'&&block.tool_use_id)byTool.delete(block.tool_use_id);
    if(block.type==='tool_use'&&block.id)latestSnapshot.set(block.id,messages[index]);
  }
  if(!byTool.size)return messages;
  const display=messages.map(message=>{
    if(!message.blocks.some(block=>block.type==='tool_use'&&block.id&&byTool.has(block.id)&&latestSnapshot.get(block.id)===message))return message;
    const replaced=new Set<string>();
    const blocks=message.blocks.flatMap(block=>{
      if(block.type==='tool_use'&&block.id&&replaced.has(block.id))return [];
      const replacement=block.type==='tool_use'&&block.id&&latestSnapshot.get(block.id)===message?byTool.get(block.id):undefined;
      if(!replacement)return [block];
      byTool.delete(block.id!);replaced.add(block.id!);
      return replacement;
    });
    return {...message,blocks};
  });
  for(const [id,blocks] of byTool)display.push({id:'live-write:'+id,role:'assistant',blocks});
  return display;
}
