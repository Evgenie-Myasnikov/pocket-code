import type {Block,ChatMessage} from '../server/types';
import {describeTool} from './tool-registry';
import {parseClaudeTaskNotification} from './claude-task-notification';

export type TurnChanges={files:string[];added:number;removed:number};
/** A turn starts with something the person wrote; tool results and background notices do not start one. */
const startsTurn=(message:ChatMessage)=>message.role==='user'&&message.blocks.some(block=>block.type==='text'&&!parseClaudeTaskNotification(block.text||'')||block.type==='image'||block.type==='document'||block.type==='attachment');
/** Files changed in each finished turn, keyed by the turn's last message, from the edit calls' own input. */
export function turnChanges(messages:ChatMessage[],results?:Map<string,Block>,running=false):Map<string,TurnChanges>{
 const changes=new Map<string,TurnChanges>();let files=new Set<string>(),added=0,removed=0,last='';
 const close=()=>{if(files.size&&last)changes.set(last,{files:[...files],added,removed});files=new Set();added=0;removed=0;last='';};
 for(const message of messages){
  if(startsTurn(message))close();
  for(const block of message.blocks){
   if(block.type!=='tool_use')continue;
   const view=describeTool(block,block.id?results?.get(block.id):undefined);
   if(view.kind!=='edit'||view.failed||view.status==='denied')continue;
   view.files.forEach(file=>files.add(file));added+=view.added;removed+=view.removed;
  }
  if(message.role==='assistant')last=message.id;
 }
 if(!running)close();
 return changes;
}
