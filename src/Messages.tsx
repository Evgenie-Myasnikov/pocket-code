import {AssistantMessageActions,useAssistantChat} from './AssistantChat';
import './chat-motion.css';
import {MessageAttachment} from './MessageAttachment';
import {userAttachmentBlocks} from './user-attachments';
import type {Connection} from './api';
import { RichBlock, TaskNotificationEvent } from './RichBlocks';
import {parseClaudeTaskNotification} from './claude-task-notification';
import type {TurnChanges} from './turn-changes';
import {ActivityGroup} from './ActivityGroup';
import {groupThinkingMessages,groupActivityBlocks,visibleMessageBlocks,activityGroupKey,type DetailMode} from './activity-groups';
import { t, useLanguage } from "./i18n";import { Fragment, memo, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { ChatMessage, SubagentView, Block } from '../server/types';
import './messages.css';
import {QuestionDialog} from './QuestionDialog';
function CopyButton({ text }: {text: string;}) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button copy-button" data-copied={copied||undefined} aria-label={t("Копировать")} onClick={async () => {try {await navigator.clipboard.writeText(text);setCopied(true);setTimeout(() => setCopied(false), 1500);} catch {setCopied(false);}}}>{copied ? <Check size={14} /> : <Copy size={14} />}</button>;
}
type MessageProps={connection?:Connection|null;cwd?:string;message: ChatMessage;provider?: 'claude' | 'codex' | 'copilot';onSubagent?(agent:SubagentView):void;agents?:Map<string,SubagentView>;toolResults?:Map<string,Block>;running?:boolean;streaming?:boolean;animateInitial?:boolean;mode?:DetailMode;live?:boolean};
export function PartialMessage({text,...shared}:Omit<MessageProps,'message'|'animateInitial'>&{text:string}){
  const startedEmpty=useRef(!text);
  return text?<Message {...shared} animateInitial={startedEmpty.current} message={{id:'partial',role:'assistant',blocks:[{type:'text',text}]}}/>:null;
}
export const MessageList=memo(function MessageList({messages,partialText,runningMessages,turnChanges,onReview,...shared}:Omit<MessageProps,'message'|'running'>&{messages:ChatMessage[];partialText?:string;runningMessages?:Set<ChatMessage>|null;turnChanges?:Map<string,TurnChanges>;onReview?:(changes:TurnChanges)=>void}){
  // Messages already present when this transcript mounts are a snapshot, even
  // if their run is still active. Only newly arriving messages start from empty.
  const initialIds=useRef(new Set(messages.map(message=>message.id)));
  const sequence=useRef(0),mounted=useRef(false);
  const textOf=(message:ChatMessage)=>message.blocks.filter(block=>block.type==='text').map(block=>block.text||'').join('\n');
  const pending=useRef<{text:string;key:string;animate:boolean;seen:Map<string,string>}|null>(null),delivered=useRef(new Map<string,{key:string;animate:boolean}>());
  let completed:ChatMessage|undefined;
  if(pending.current){
    const prior=pending.current;
    completed=[...messages].reverse().find(message=>message.role==='assistant'&&prior.seen.get(message.id)!==textOf(message)&&message.blocks.some(block=>block.type==='text'&&block.text&&(block.text.startsWith(prior.text)||!partialText)));
    if(completed){delivered.current.set(completed.id,prior);pending.current=null;}
  }
  if(partialText&&(!completed||!completed.blocks.some(block=>block.type==='text'&&block.text?.startsWith(partialText)))){
    if(pending.current)pending.current.text=partialText;
    else pending.current={text:partialText,key:`live-response:${++sequence.current}`,animate:mounted.current,seen:new Map(messages.map(message=>[message.id,textOf(message)]))};
  }
  mounted.current=true;
  const runs=groupThinkingMessages(messages,shared.toolResults,runningMessages),visibleIds=new Set(runs.flatMap(run=>run.message?[run.message.id]:[]));
  const content=runs.map(run=>{
    const anchors=run.message?[run.message.id]:[...new Set(run.items!.map(item=>item.messageId))].filter(id=>!visibleIds.has(id));
    const ids=anchors.length?anchors:[run.key];
    const delivery=run.message?delivered.current.get(run.message.id):undefined,key=delivery?.key||run.key;
    const body=run.message?
    <Message key={key} message={run.message} running={runningMessages?.has(run.message)||false} live={run.message===messages.at(-1)} {...shared} animateInitial={delivery?.animate??!initialIds.current.has(run.message.id)}/>:
    <article data-enter={shared.streaming&&ids.some(id=>!initialIds.current.has(id))||undefined} key={run.key} className="message assistant tool-result" data-message-id={ids[0]}>
      {ids.slice(1).map(id=><span key={id} className="activity-message-anchor" data-message-id={id} aria-hidden="true"/>)}
      <ActivityGroup items={run.items!}/>
    </article>;
    return <Fragment key={key}>{body}</Fragment>;
  });
  const partial=pending.current;
  if(partial){
    const body=<Fragment key={partial.key}><Message key={partial.key} {...shared} animateInitial={partial.animate} message={{id:'partial',role:'assistant',blocks:[{type:'text',text:partial.text}]}}/></Fragment>;
    content.splice(runs.at(-1)?.items?content.length-1:content.length,0,body);
  }
  return content;
});
export const Message=memo(function Message({ message, provider = 'claude', onSubagent, agents,toolResults,running=false,streaming=false,animateInitial=false,connection,cwd,mode,live=false }: MessageProps) {
  useLanguage();
  const assistantChat=useAssistantChat();
  // A message made only of background-task notices is an event line, not the person's bubble.
  const notices=message.role==='user'?message.blocks.map(block=>block.type==='text'?parseClaudeTaskNotification(block.text||''):undefined):[];
  if(notices.length&&notices.every(Boolean))return <article data-message-id={message.id} className="message transcript-event-message">{notices.map((notice,index)=><TaskNotificationEvent key={index} notification={notice!}/>)}</article>;
  if(message.blocks.length&&message.blocks.every(b=>b.type==='tool_result'&&b.tool_use_id&&toolResults?.has(b.tool_use_id)))return null;
  const toolOnly = message.blocks.length > 0 && message.blocks.every((b) => ['tool_result','tool_use','thinking','codexItem','subagent'].includes(b.type));
  const isUser = message.role === 'user' && !toolOnly;
  const displayBlocks=isUser?userAttachmentBlocks(message.blocks):message.blocks;
  const plain=displayBlocks.filter(block=>block.type==='text').map(block=>block.text).join('\n');
  const attachments=isUser?displayBlocks.filter(block=>['attachment','image','document'].includes(block.type)):[];
  const displayMessage=isUser?{...message,blocks:displayBlocks.filter(block=>!attachments.includes(block))}:message;
  const content = groupActivityBlocks(visibleMessageBlocks(displayMessage,toolResults,running,live),mode).map(run => {
      const {block,result}=run.items[0];
      if(activityGroupKey(run.items[0],mode))return <ActivityGroup key={run.key} items={run.items}/>;
      return <RichBlock key={block.type==='text'?`text:${message.blocks.slice(0,run.items[0].index).filter(item=>item.type==='text').length}`:run.key} running={running} streaming={streaming&&message.role==='assistant'} animateInitial={animateInitial} block={block.agent && agents?.has(block.agent.id)?{...block,agent:agents.get(block.agent.id)}:block} result={result} onSubagent={onSubagent}/>;
    });
  if(!content.length&&!attachments.length)return null;
  return <article data-enter={animateInitial&&(streaming||running)||undefined} data-message-id={message.id} aria-label={isUser?t("ВЫ"):message.role==='assistant'?provider:undefined} className={`message ${toolOnly?'assistant':message.role} ${toolOnly ? 'tool-result' : ''}`}>
    {isUser ? <>{plain && !assistantChat && <CopyButton text={plain}/>}<div className="user-message-content">{attachments.length>0&&<div className="message-attachments">{attachments.map((block,index)=><MessageAttachment key={block.attachmentPath||index} block={block} connection={connection} cwd={cwd}/>)}</div>}{content}</div>{plain&&assistantChat&&<AssistantMessageActions id={message.id} text={plain} user/>}</> : <>
      {!toolOnly && message.role!=='assistant' && <div className="message-label">{t("СИСТЕМА")}{plain && <CopyButton text={plain} />}</div>}
      {content}
      {!toolOnly && message.role==='assistant' && plain && <div className="message-actions">{assistantChat?<AssistantMessageActions id={message.id} text={plain}/>:<CopyButton text={plain}/>}</div>}
    </>}
  </article>;
},(before,after)=>{
  if(before.connection!==after.connection||before.cwd!==after.cwd||before.message!==after.message||before.provider!==after.provider||before.running!==after.running||before.streaming!==after.streaming||before.animateInitial!==after.animateInitial||before.onSubagent!==after.onSubagent||before.mode!==after.mode||before.live!==after.live)return false;
  // A result or agent update affects only the messages that refer to it.
  return after.message.blocks.every(block=>{
    if(block.agent&&before.agents?.get(block.agent.id)!==after.agents?.get(block.agent.id))return false;
    const id=block.type==='tool_use'?block.id:block.type==='tool_result'?block.tool_use_id:undefined;
    return !id||before.toolResults?.get(id)===after.toolResults?.get(id);
  });
});
/** Kept here so existing imports keep working; the card lives in ApprovalCard.tsx. */
export {ApprovalCard} from './ApprovalCard';
