import {AssistantRuntimeProvider,MessageByIndexProvider,ThreadPrimitive,ActionBarPrimitive,useExternalStoreRuntime,useAuiState,WebSpeechSynthesisAdapter,type ThreadMessageLike} from '@assistant-ui/react';
import {createContext,useContext,useMemo,useRef,type ReactNode,type MouseEvent} from 'react';
import {Copy,Check,Quote,FileDown,Volume2,Square,CornerDownLeft} from 'lucide-react';
import type {ChatMessage} from '../server/types';
import {useLanguage,t} from './i18n';
import './assistant-chat.css';

type Bridge={onDraft(text:string):void;speech:boolean};
const BridgeContext=createContext<Bridge|null>(null);
export function assistantMessage(message:ChatMessage):ThreadMessageLike{
 return {id:message.id,role:message.role,content:message.blocks.filter(b=>b.type==='text'&&b.text).map(b=>({type:'text' as const,text:b.text!}))};
}
export function AssistantChatProvider({messages,partial,running,disabled,onSend,onStop,onDraft,children}:{messages:ChatMessage[];partial:string;running:boolean;disabled:boolean;onSend(text:string):Promise<void>;onStop():Promise<void>;onDraft(text:string):void;children:ReactNode}){
 const all=useMemo(()=>partial?[...messages,{id:'partial',role:'assistant' as const,blocks:[{type:'text',text:partial}]}]:messages,[messages,partial]);
 const speech=typeof window!=='undefined'&&'speechSynthesis' in window;
 const adapters=useMemo(()=>speech?{speech:new WebSpeechSynthesisAdapter()}:undefined,[speech]);
 const runtime=useExternalStoreRuntime({messages:all,convertMessage:assistantMessage,isRunning:running,isDisabled:disabled,onNew:async message=>onSend(message.content.filter(p=>p.type==='text').map(p=>p.text).join('\n')),onCancel:onStop,adapters});
 const draft=useRef(onDraft);draft.current=onDraft;
 const bridge=useMemo(()=>({speech,onDraft:(text:string)=>draft.current(text)}),[speech]);
 return <AssistantRuntimeProvider runtime={runtime}><BridgeContext.Provider value={bridge}><ThreadPrimitive.Root asChild>{children}</ThreadPrimitive.Root></BridgeContext.Provider></AssistantRuntimeProvider>;
}
export function useAssistantChat(){return useContext(BridgeContext);}
const messageIndices=new WeakMap<readonly {id:string}[],Map<string,number>>();
function indexOf(messages:readonly {id:string}[],id:string){let indices=messageIndices.get(messages);if(!indices){indices=new Map(messages.map((message,index)=>[message.id,index]));messageIndices.set(messages,indices);}return indices.get(id)??-1;}
export function AssistantMessageActions({id,text,user=false}:{id:string;text:string;user?:boolean}){
 const index=useAuiState(s=>indexOf(s.thread.messages,id));
 return index<0?null:<MessageByIndexProvider index={index}><MessageActions text={text} user={user}/></MessageByIndexProvider>;
}
function MessageActions({text,user=false}:{text:string;user?:boolean}){
 const bridge=useContext(BridgeContext)!,ru=useLanguage()==='ru',copied=useAuiState(s=>s.message.isCopied),speaking=useAuiState(s=>Boolean(s.message.speech));
 const draft=(event:MouseEvent<HTMLButtonElement>,value:string)=>{bridge.onDraft(value);const input=event.currentTarget.closest('.app')?.querySelector<HTMLTextAreaElement>('.composer textarea');requestAnimationFrame(()=>input?.focus());};
 return <ActionBarPrimitive.Root className="assistant-message-actions" hideWhenRunning={false}>
  <ActionBarPrimitive.Copy className="icon-button copy-button" aria-label={t('Копировать')} title={t('Копировать')} data-copied={copied||undefined}>{copied?<Check size={15}/>:<Copy size={15}/>}</ActionBarPrimitive.Copy>
  <button className="icon-button" aria-label={ru?'Цитировать в ответе':'Quote in reply'} title={ru?'Цитировать в ответе':'Quote in reply'} onClick={event=>draft(event,text.split('\n').map(line=>'> '+line).join('\n')+'\n\n')}><Quote size={15}/></button>
  {user&&<button className="icon-button" aria-label={ru?'Использовать в черновике':'Use in draft'} title={ru?'Использовать в черновике':'Use in draft'} onClick={event=>draft(event,text)}><CornerDownLeft size={15}/></button>}
  <ActionBarPrimitive.ExportMarkdown filename="message.md" className="icon-button" aria-label={ru?'Скачать сообщение Markdown':'Download message Markdown'} title={ru?'Скачать сообщение Markdown':'Download message Markdown'}><FileDown size={15}/></ActionBarPrimitive.ExportMarkdown>
  {!user&&bridge.speech&&(speaking?<ActionBarPrimitive.StopSpeaking className="icon-button" aria-label={ru?'Остановить чтение':'Stop reading aloud'}><Square size={15}/></ActionBarPrimitive.StopSpeaking>:<ActionBarPrimitive.Speak className="icon-button" aria-label={ru?'Читать вслух':'Read aloud'} title={ru?'Читать вслух':'Read aloud'}><Volume2 size={15}/></ActionBarPrimitive.Speak>)}
 </ActionBarPrimitive.Root>;
}
