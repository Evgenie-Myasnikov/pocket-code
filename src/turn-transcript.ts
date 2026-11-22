import type {Block,ChatMessage} from '../server/types';
import {canonicalCalls,startsTurn} from './turn-changes';
import {groupActivityMessages,type DetailMode,type TranscriptRun} from './activity-groups';

type Reasoning={key:string;paragraphs:string[];live:boolean};
type DisplayRun=TranscriptRun&{reasoning?:Reasoning};

export const uniqueMessages=(messages:ChatMessage[])=>[...new Map(messages.map(message=>[message.id,message])).values()];

export function turnTranscript(messages:ChatMessage[],results:Map<string,Block>|undefined,running:Set<ChatMessage>|null|undefined,mode:DetailMode|undefined,openCommands:Set<string>,previousKeys?:Map<string,string>){
  const runs:DisplayRun[]=[],activeMessages=new Set<ChatMessage>();
  const reasoningKeys=new Map<string,string>(),usedKeys=new Set<string>();
  let start=0;
  function render(end:number){
    if(end<=start)return;
    const turn=messages.slice(start,end),paragraphs:string[]=[];
    const projected=canonicalCalls(turn).map((message,index)=>{
      const thinking=message.role==='assistant'&&message.blocks.some(block=>block.type==='thinking');
      if(thinking)for(const block of message.blocks){
        if(block.type==='thinking'&&block.thinking?.trim())paragraphs.push(block.thinking);
      }
      const display=thinking?{...message,blocks:message.blocks.filter(block=>block.type!=='thinking')}:message;
      if(running?.has(turn[index]))activeMessages.add(display);
      return display;
    });
    const first=projected[0],body=startsTurn(first)?projected.slice(1):projected;
    if(body!==projected)runs.push({key:first.id,message:first});
    if(paragraphs.length){
      // Commands and writes may follow the summary and keep streaming independently.
      const live=end===messages.length&&turn.some(message=>running?.has(message));
      // A saved provider prompt can have a different ID from the local prompt.
      // Other messages in the same turn keep the existing disclosure mounted.
      let key='turn-reasoning:'+first.id;
      for(const message of turn){
        const known=previousKeys?.get(message.id);
        if(known&&!usedKeys.has(known)){key=known;break;}
      }
      while(usedKeys.has(key))key+=':turn';
      usedKeys.add(key);
      for(const message of turn)reasoningKeys.set(message.id,key);
      const reasoning={key,paragraphs,live};
      runs.push({key:reasoning.key,reasoning});
    }
    runs.push(...groupActivityMessages(body,results,activeMessages,mode,openCommands));
  }
  for(let index=1;index<messages.length;index++)if(startsTurn(messages[index])){render(index);start=index;}
  render(messages.length);
  return {runs,activeMessages,reasoningKeys};
}
