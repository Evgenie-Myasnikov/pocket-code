import './chat-motion.css';
import {MessageAttachment} from './MessageAttachment';
import {userAttachmentBlocks} from './user-attachments';
import type {Connection} from './api';
import { RichBlock, TaskNotificationEvent } from './RichBlocks';
import {parseClaudeTaskNotification} from './claude-task-notification';
import type {TurnChanges} from './turn-changes';
import {plural} from './plural';
import {ActivityGroup} from './ActivityGroup';
import {groupActivityMessages,groupActivityBlocks,visibleMessageBlocks,activityGroupKey,type DetailMode} from './activity-groups';
import { t, useLanguage } from "./i18n";import { Fragment, memo, useRef, useState } from 'react';
import { Copy, Check, GitCompareArrows } from 'lucide-react';
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
/** The end of a turn that edited files says how much changed and leads to Review. */
function TurnChangesChip({changes,onReview}:{changes:TurnChanges;onReview?:(changes:TurnChanges)=>void}){
  const label=t('Изменено')+' '+plural(changes.files.length,['{0} файл','{0} файла','{0} файлов'])+` · +${changes.added} −${changes.removed}`;
  return onReview?<button className="turn-changes" title={changes.files.join(', ')} onClick={()=>onReview(changes)}><GitCompareArrows size={16} aria-hidden="true"/>{label}</button>:<p className="turn-changes" title={changes.files.join(', ')}><GitCompareArrows size={16} aria-hidden="true"/>{label}</p>;
}
export const MessageList=memo(function MessageList({messages,runningMessages,turnChanges,onReview,...shared}:Omit<MessageProps,'message'|'running'>&{messages:ChatMessage[];runningMessages?:Set<ChatMessage>|null;turnChanges?:Map<string,TurnChanges>;onReview?:(changes:TurnChanges)=>void}){
  // Messages already present when this transcript mounts are a snapshot, even
  // if their run is still active. Only newly arriving messages start from empty.
  const initialIds=useRef(new Set(messages.map(message=>message.id)));
  return groupActivityMessages(messages,shared.toolResults,runningMessages,shared.mode).map(run=>{
    const ids=run.message?[run.message.id]:[...new Set(run.items!.map(item=>item.messageId))],ended=ids.map(id=>turnChanges?.get(id)).find(Boolean);
    const body=run.message?
    <Message key={run.key} message={run.message} running={runningMessages?.has(run.message)||false} live={run.message===messages.at(-1)} {...shared} animateInitial={!initialIds.current.has(run.message.id)}/>:
    <article data-enter={shared.streaming&&ids.some(id=>!initialIds.current.has(id))||undefined} key={run.key} className="message assistant tool-result" data-message-id={ids[0]}>
      {ids.slice(1).map(id=><span key={id} className="activity-message-anchor" data-message-id={id} aria-hidden="true"/>)}
      <ActivityGroup items={run.items!}/>
    </article>;
    return ended?<Fragment key={run.key}>{body}<TurnChangesChip changes={ended} onReview={onReview}/></Fragment>:body;
  });
});
export const Message=memo(function Message({ message, provider = 'claude', onSubagent, agents,toolResults,running=false,streaming=false,animateInitial=false,connection,cwd,mode,live=false }: MessageProps) {
  useLanguage();
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
      return <RichBlock key={run.key} running={running} streaming={streaming&&message.role==='assistant'} animateInitial={animateInitial} block={block.agent && agents?.has(block.agent.id)?{...block,agent:agents.get(block.agent.id)}:block} result={result} onSubagent={onSubagent}/>;
    });
  if(!content.length&&!attachments.length)return null;
  return <article data-enter={animateInitial&&(streaming||running)||undefined} data-message-id={message.id} aria-label={isUser?t("ВЫ"):message.role==='assistant'?provider:undefined} className={`message ${toolOnly?'assistant':message.role} ${toolOnly ? 'tool-result' : ''}`}>
    {isUser ? <>{plain && <CopyButton text={plain}/>}<div className="user-message-content">{attachments.length>0&&<div className="message-attachments">{attachments.map((block,index)=><MessageAttachment key={block.attachmentPath||index} block={block} connection={connection} cwd={cwd}/>)}</div>}{content}</div></> : <>
      {!toolOnly && message.role!=='assistant' && <div className="message-label">{t("СИСТЕМА")}{plain && <CopyButton text={plain} />}</div>}
      {content}
      {!toolOnly && message.role==='assistant' && plain && <div className="message-actions"><CopyButton text={plain}/></div>}
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
