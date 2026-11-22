import type {Block,ChatMessage,WritePreview} from '../server/types';

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
  for(const {blocks} of messages)for(const block of blocks){
    if(block.type==='tool_result'&&block.tool_use_id)byTool.delete(block.tool_use_id);
  }
  if(!byTool.size)return messages;
  const display=messages.map(message=>{
    if(!message.blocks.some(block=>block.type==='tool_use'&&block.id&&byTool.has(block.id)))return message;
    const blocks=message.blocks.flatMap(block=>{
      const replacement=block.type==='tool_use'&&block.id?byTool.get(block.id):undefined;
      if(!replacement)return [block];
      byTool.delete(block.id!);
      return replacement;
    });
    return {...message,blocks};
  });
  for(const [id,blocks] of byTool)display.push({id:'live-write:'+id,role:'assistant',blocks});
  return display;
}
