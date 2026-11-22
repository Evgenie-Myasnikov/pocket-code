import type {Block,ChatMessage} from '../server/types';
import {describeTool} from './tool-registry';
import {parseClaudeTaskNotification} from './claude-task-notification';
import {resultPath} from './project-path';

export type TurnChanges={files:string[];added:number;removed:number;countsUnknown?:boolean;deleted?:string[]};
/** A turn starts with something the person wrote; tool results and background notices do not start one. */
export const startsTurn=(message:ChatMessage)=>message.role==='user'&&message.blocks.some(block=>block.type==='text'&&!parseClaudeTaskNotification(block.text||'')||block.type==='image'||block.type==='document'||block.type==='attachment');
/** Files changed in each finished turn, keyed by the turn's last message, from the edit calls' own input. */
export function turnChanges(messages:ChatMessage[],results?:Map<string,Block>,running=false,cwd?:string):Map<string,TurnChanges>{
 const changes=new Map<string,TurnChanges>(),files=new Map<string,boolean>();let added=0,removed=0,last='',countsUnknown=false;
 const close=()=>{
   const deleted=[...files].filter(([,gone])=>gone).map(([file])=>file);
   if(files.size&&last)changes.set(last,{files:[...files.keys()],added,removed,...(deleted.length?{deleted}:{}),...(countsUnknown?{countsUnknown}: {})});
   files.clear();added=0;removed=0;last='';countsUnknown=false;
 };
 for(const message of messages){
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
