import type {Block,ChatMessage} from '../server/types';
import {describeTool,basename} from './tool-registry';
import {plural} from './plural';
import {t} from './i18n';

/** Brief folds a turn's routine activity into one line; detailed groups it by meaning. Errors, questions and running calls always stay visible. */
export type DetailMode='brief'|'detailed';
export type ActivityBlock={block:Block;result?:Block;index:number;messageId:string;running:boolean;live?:boolean};
/** `live` marks the newest message of a running turn: its trailing reasoning is still being written and stays open, outside any group. */
export function visibleMessageBlocks(message:ChatMessage,results?:Map<string,Block>,running=false,live=false):ActivityBlock[]{
 const items=message.blocks.flatMap((block,index):ActivityBlock[]=>{
  const previous=message.blocks[index-1],next=message.blocks[index+1];
  if(block.type==='tool_result'&&block.tool_use_id&&(results?.has(block.tool_use_id)||previous?.type==='tool_use'&&previous.id===block.tool_use_id))return [];
  const result=block.type==='tool_use'&&block.id?(results?.get(block.id)||(next?.type==='tool_result'&&next.tool_use_id===block.id?next:undefined)):undefined;
  return [{block,result,index,messageId:message.id,running}];
 });
 const last=items.at(-1);if(live&&running&&last?.block.type==='thinking')last.live=true;
 return items;
}
export function activityGroupKey({block,result,running,live}:ActivityBlock,mode:DetailMode='detailed'):string|undefined{
 if(block.type==='tool_use'){
  const view=describeTool(block,result,running);
  // Errors, denials, questions and the call in progress must remain visible even when their surroundings are collapsed.
  if(view.failed||view.status==='denied'||view.active||view.kind==='question')return undefined;
  if(mode==='brief')return 'activity';
  return view.kind==='tool'?'tool|'+(view.mcp||block.name||''):view.kind;
 }
 if(block.type==='thinking')return live?undefined:mode==='brief'?'activity':'thinking';
 return undefined;
}
// A plan update never splits the work around it: it joins the group it falls into.
const runKey=(items:ActivityBlock[],mode:DetailMode)=>items.map(item=>activityGroupKey(item,mode)).find(key=>key!=='plan')||'plan';
const joins=(key:string|undefined,items:ActivityBlock[]|undefined,mode:DetailMode)=>{if(!key||!items)return false;const current=runKey(items,mode);return current!==undefined&&activityGroupKey(items[0],mode)!==undefined&&(key===current||key==='plan'||current==='plan');};
export type ActivityRun={key:string;items:ActivityBlock[]};
export function groupActivityBlocks(blocks:ActivityBlock[],mode:DetailMode='detailed'):ActivityRun[]{
 const runs:ActivityRun[]=[];
 for(const item of blocks){const key=activityGroupKey(item,mode),last=runs.at(-1);
  if(joins(key,last?.items,mode))last!.items.push(item);
  else runs.push({key:`${item.messageId}:${item.index}`,items:[item]});
 }
 return runs;
}
export type TranscriptRun={key:string;message?:ChatMessage;items?:ActivityBlock[]};
export function groupActivityMessages(messages:ChatMessage[],results?:Map<string,Block>,running?:Set<ChatMessage>|null,mode:DetailMode='detailed'):TranscriptRun[]{
 const runs:TranscriptRun[]=[];
 for(const message of messages){
  const items=visibleMessageBlocks(message,results,running?.has(message),message===messages.at(-1));
  if(!items.length)continue;
  if(!items.every(item=>activityGroupKey(item,mode)!==undefined)){runs.push({key:message.id,message});continue;}
  for(const item of items){const last=runs.at(-1);
   if(joins(activityGroupKey(item,mode),last?.items,mode))last!.items!.push(item);
   else runs.push({key:`${message.id}:${item.index}`,items:[item]});
  }
 }
 return runs;
}
/** "Explored 5 files · 2 searches · ran 3 commands · edited 2 files +24 −5", counted from what the calls touched. */
export function summarizeActivity(items:ActivityBlock[]){
 const read=new Set<string>(),edited=new Set<string>();let searches=0,commands=0,web=0,tools=0,thinking=0,plans=0,added=0,removed=0;
 for(const {block,result,running} of items){
  if(block.type==='thinking'){thinking++;continue;}
  if(block.type!=='tool_use')continue;
  const view=describeTool(block,result,running);
  if(view.kind==='explore'){if(view.search)searches++;else if(view.files.length)view.files.forEach(file=>read.add(basename(file)));else tools++;}
  else if(view.kind==='command')commands++;
  else if(view.kind==='edit'){view.files.forEach(file=>edited.add(file));if(!view.files.length)edited.add(block.id||String(edited.size));added+=view.added;removed+=view.removed;}
  else if(view.kind==='web')web++;
  else if(view.kind==='plan')plans++;
  else tools++;
 }
 const parts:string[]=[];
 if(read.size)parts.push(t('Изучил')+' '+plural(read.size,['{0} файл','{0} файла','{0} файлов']));
 if(searches)parts.push(plural(searches,['{0} поиск','{0} поиска','{0} поисков']));
 if(commands)parts.push(t('Выполнил')+' '+plural(commands,['{0} команду','{0} команды','{0} команд']));
 if(edited.size)parts.push(t('Изменил')+' '+plural(edited.size,['{0} файл','{0} файла','{0} файлов'])+(added||removed?` +${added} −${removed}`:''));
 if(web)parts.push(plural(web,['{0} запрос в интернет','{0} запроса в интернет','{0} запросов в интернет']));
 if(tools)parts.push(plural(tools,['{0} действие','{0} действия','{0} действий']));
 if(!parts.length&&plans)parts.push(t('Обновил план'));
 if(thinking)parts.push(t('Рассуждения'));
 return parts.map((part,index)=>index?part.charAt(0).toLowerCase()+part.slice(1):part).join(' · ');
}

/** One disclosure per turn; images and the last answer stay in the transcript. */
export function groupThinkingMessages(messages:ChatMessage[],results?:Map<string,Block>,running?:Set<ChatMessage>|null):TranscriptRun[]{
 const runs:TranscriptRun[]=[];let turn:ChatMessage[]=[];
 const flush=()=>{
  if(!turn.length)return;
  const all=turn.flatMap(message=>visibleMessageBlocks(message,results,running?.has(message)));
  const tail=[...all].reverse().find(item=>item.block.type!=='image');
  const final=tail?.block.type==='text'&&turn.find(m=>m.id===tail.messageId)?.role==='assistant'?tail:undefined;
  const activity=all.filter(item=>item!==final&&item.block.type!=='image');
  if(activity.length)runs.push({key:`thinking:${turn[0].id}`,items:activity});
  for(const item of all)if(item===final||item.block.type==='image')runs.push({key:`${item.messageId}:${item.index}`,message:{id:item===final?item.messageId:`${item.messageId}:${item.index}`,role:'assistant',blocks:[item.block]}});
  turn=[];
 };
 for(const message of messages){
  if(message.role==='user'&&message.blocks.some(b=>b.type!=='tool_result')){flush();runs.push({key:message.id,message});}
  else turn.push(message);
 }
 flush();return runs;
}
