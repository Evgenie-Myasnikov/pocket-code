import type {Block,ChatMessage} from '../server/types';
import {describeTool} from './tool-registry';
import {parseClaudeTaskNotification} from './claude-task-notification';
import {resultPath} from './project-path';

export type TurnChanges={files:string[];added:number;removed:number;countsUnknown?:boolean;deleted?:string[]};
/** A turn starts with something the person wrote; tool results and background notices do not start one. */
export const startsTurn=(message:ChatMessage)=>message.role==='user'&&message.blocks.some(block=>block.type==='text'&&!parseClaudeTaskNotification(block.text||'')||block.type==='image'||block.type==='document'||block.type==='attachment');
/** Resolve later snapshots of one invocation at its original position. One snapshot
 * can contain multiple file blocks. Distinct calls and user turns stay separate. */
export function canonicalCalls(messages:ChatMessage[]):ChatMessage[]{
 const edits=new Map<number,Map<Block,Block[]>>(),calls=new Map<string,{index:number;blocks:Block[]}>();
 function replace(index:number,block:Block,withBlocks:Block[]){
   if(!edits.has(index))edits.set(index,new Map());
   edits.get(index)!.set(block,withBlocks);
 }
 for(const [index,message] of messages.entries()){
   if(startsTurn(message))calls.clear();
   if(message.role!=='assistant')continue;
   const snapshot=new Map<string,Block[]>();
   for(const block of message.blocks)if(block.type==='tool_use'&&block.id){
     if(!snapshot.has(block.id))snapshot.set(block.id,[]);
     snapshot.get(block.id)!.push(block);
   }
   for(const [id,blocks] of snapshot){
     const first=calls.get(id);
     if(!first){calls.set(id,{index,blocks});continue;}
     first.blocks.forEach((block,i)=>replace(first.index,block,i===0?blocks:[]));
     for(const block of blocks)replace(index,block,[]);
   }
 }
 if(!edits.size)return messages;
 return messages.map((message,i)=>{const changes=edits.get(i);return changes?{...message,blocks:message.blocks.flatMap(block=>changes.get(block)??[block])}:message;});
}
/** Files changed in each finished turn, keyed by the turn's last message, from the edit calls' own input. */
export function turnChanges(messages:ChatMessage[],results?:Map<string,Block>,running=false,cwd?:string):Map<string,TurnChanges>{
 const changes=new Map<string,TurnChanges>(),files=new Map<string,boolean>();let added=0,removed=0,last='',countsUnknown=false;
 const close=()=>{
   const deleted=[...files].filter(([,gone])=>gone).map(([file])=>file);
   if(files.size&&last)changes.set(last,{files:[...files.keys()],added,removed,...(deleted.length?{deleted}:{}),...(countsUnknown?{countsUnknown}: {})});
   files.clear();added=0;removed=0;last='';countsUnknown=false;
 };
 for(const message of canonicalCalls(messages)){
  if(startsTurn(message))close();
  for(const block of message.blocks){
   if(block.type!=='tool_use')continue;
   const view=describeTool(block,block.id?results?.get(block.id):undefined);
   if(view.kind!=='edit'||view.status!=='done')continue;
   const input=(block.input||{}) as Record<string,unknown>,name=block.name?.toLowerCase();
   const details=Array.isArray(input.changes)?input.changes as {path?:string;kind?:string|{type?:string};diff?:string}[]:[];
   const patch=String(input.patch||input.input||(name==='apply_patch'?input.content:'')||'');
   const deleted=new Set(details.filter(c=>c&&(typeof c.kind==='object'?c.kind?.type:c.kind)==='delete').map(c=>c.path));
   for(const match of patch.matchAll(/^\*\*\* Delete File: (.+)$/gm))deleted.add(match[1].trim());
   let contained=0;
   for(const file of view.files){const path=cwd?resultPath(cwd,file):file;if(!path)continue;files.set(path,name==='delete_file'||deleted.has(file));contained++;}
   if(!contained)continue;
   // A plain write may overwrite existing lines; a delete can omit the old file contents.
   const measured=details.length?details.every(c=>c&&typeof c.diff==='string'&&Boolean(c.diff)&&
     ((typeof c.kind==='object'?c.kind?.type:c.kind)==='add'||/^[+-](?![+-]{2})/m.test(c.diff))):
     patch?(!deleted.size||/^-(?!--)/m.test(patch)):
     name==='create'||!input.replace_all&&(Array.isArray(input.edits)||typeof(input.old_string??input.old_str)==='string'&&typeof(input.new_string??input.new_str)==='string');
   if(!measured||contained!==view.files.length)countsUnknown=true;
   added+=view.added;removed+=view.removed;
  }
  if(message.role==='assistant')last=message.id;
 }
 if(!running)close();
 return changes;
}
