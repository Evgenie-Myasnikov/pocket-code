import type {Block,ChatMessage} from '../server/types';
import {describeTool,basename,serviceTool} from './tool-registry';
import {plural} from './plural';
import {t} from './i18n';
import {startsTurn} from './turn-changes';

/** Brief folds a turn's routine activity into one line; detailed groups it by meaning. Errors, questions and running calls always stay visible. */
export type DetailMode='brief'|'detailed';
export type ActivityBlock={block:Block;result?:Block;index:number;messageId:string;running:boolean;live?:boolean;retained?:boolean};
/** `live` marks the newest message of a running turn: its trailing reasoning is still being written and stays open, outside any group. */
export function visibleMessageBlocks(message:ChatMessage,results?:Map<string,Block>,running=false,live=false):ActivityBlock[]{
 const items=message.blocks.flatMap((block,index):ActivityBlock[]=>{
  const previous=message.blocks[index-1],next=message.blocks[index+1];
  if(block.type==='tool_result'&&block.tool_use_id&&(results?.has(block.tool_use_id)||previous?.type==='tool_use'&&previous.id===block.tool_use_id))return [];
  if(block.type==='tool_use'&&serviceTool(block.name))return [];
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
 if(block.type==='thinking')return live?undefined:'thinking';
 return undefined;
}
// A plan update never splits the work around it: it joins the group it falls into.
const joins=(key:string|undefined,current:string|undefined)=>{
 if(!key||!current)return false;
 return key===current||(key!=='thinking'&&current!=='thinking'&&(key==='plan'||current==='plan'));
};
export type ActivityRun={key:string;items:ActivityBlock[]};
export type CommandSlots=Map<number,ActivityBlock[]>;
export const commandKey=(messageId:string,callId:string)=>JSON.stringify([messageId,callId]);
export function groupActivityBlocks(blocks:ActivityBlock[],mode:DetailMode='detailed',commandSlots?:CommandSlots):ActivityRun[]{
 const runs:ActivityRun[]=[];
 let current:string|undefined;
 for(const item of blocks){const key=commandSlots?.has(item.index)?undefined:activityGroupKey(item,mode),last=runs.at(-1);
  if(last&&joins(key,current)){last.items.push(item);if(current==='plan')current=key;}
  else {runs.push({key:`${item.messageId}:${item.index}`,items:[item]});current=key;}
 }
 return runs;
}
export type TranscriptRun={key:string;message?:ChatMessage;items?:ActivityBlock[];commandSlots?:CommandSlots};
export function groupActivityMessages(messages:ChatMessage[],results?:Map<string,Block>,running?:Set<ChatMessage>|null,mode:DetailMode='detailed',retained?:Set<string>):TranscriptRun[]{
 const runs:TranscriptRun[]=[];
 let current:string|undefined;
 let history:ActivityBlock[]|undefined;
 for(const message of messages){
  if(mode==='brief'&&startsTurn(message))history=undefined;
  const items=visibleMessageBlocks(message,results,running?.has(message),message===messages.at(-1));
  if(!items.length){if(!message.blocks.length)runs.push({key:message.id,message});continue;}
  if((mode==='brief'||retained?.size)&&message.role==='assistant'){
   // Keep all transcript messages and block indexes. The first completed command
   // owns the history and the other slots become scroll anchors in their original messages.
   const commandSlots:CommandSlots=new Map();
   for(const item of items){
    if(item.block.type!=='tool_use')continue;
    const view=describeTool(item.block,item.result,item.running);
    if(item.block.id&&retained?.has(commandKey(message.id,item.block.id))){commandSlots.set(item.index,[{...item,retained:true}]);continue;}
    if(mode!=='brief'||view.kind!=='command'||(view.status!=='done'&&view.status!=='nomatch'))continue;
    if(!history){history=[];commandSlots.set(item.index,history);}
    else commandSlots.set(item.index,[]);
    history.push(item);
   }
   if(commandSlots.size){runs.push({key:message.id,message,commandSlots});current=undefined;continue;}
  }
  const keys=items.map(item=>activityGroupKey(item,mode));
  if(keys.includes(undefined)){runs.push({key:message.id,message});current=undefined;continue;}
  for(const [index,item] of items.entries()){const last=runs.at(-1),key=keys[index];
   if(last?.items&&joins(key,current)){last.items.push(item);if(current==='plan')current=key;}
   else {runs.push({key:`${message.id}:${item.index}`,items:[item]});current=key;}
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
