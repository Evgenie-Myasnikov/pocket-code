import { memo, useState, useRef, useMemo, useEffect, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {Streamdown} from 'streamdown';
import remarkGfm from 'remark-gfm';
import {useStreamingReveal} from './useStreamingReveal';
import {usePacedText} from './usePacedText';
import {useStreamSpeed} from './stream-speed';
import {rehypeStreamingReveal,type RevealOptions} from './streaming-reveal';
import './streaming-reveal.css';
import './transcript.css';
import type { Block, SubagentView } from '../server/types';
import { t, useLanguage } from './i18n';
import {Terminal,Pencil,Wrench,FileText,Search,ListChecks,Bot,MessageCircle,Globe,Plug,LoaderCircle,Copy,Check,ChevronRight,Circle,CircleCheck,CircleDot,BellRing} from 'lucide-react';
import {describeTool,stripAnsi,toolText,type PlanItem,type ToolView} from './tool-registry';
import {plural} from './plural';
import {ImageViewer} from './ImageViewer';
import {isClaudeTaskNotificationPrefix, parseClaudeTaskNotification, type ClaudeTaskNotification} from './claude-task-notification';

import {Installer as Documents} from './native-update';
export function safeWebUrl(value?: string) {
  try {const url=new URL(value || '');return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;}catch{return null;}
}
export function imageSource(block: Block): string | null {
  const source=block.source, mime=source?.media_type || block.mimeType, data=source?.data || block.data;
  if(data && /^image\/(png|jpeg|gif|webp)$/.test(mime || '') && data.length<=14_000_000 && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(data))return `data:${mime};base64,${data}`;
  return safeWebUrl(source?.url);
}
function Picture({src,alt}:{src:string;alt:string}) {
  const [loaded,setLoaded]=useState(src.startsWith('data:')), [expanded,setExpanded]=useState(false), [failed,setFailed]=useState(false);
  if(failed)return <p className="attachment-chip">{t('Не удалось показать изображение')}</p>;
  if(!loaded)return <button className="secondary" onClick={()=>setLoaded(true)}>{t('Загрузить внешнее изображение')} · {alt}</button>;
  return <><button className="image-preview" aria-label={t('Открыть изображение')} onClick={()=>setExpanded(true)}><img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></button>{expanded&&<ImageViewer src={src} title={alt} onClose={()=>setExpanded(false)}/>}</>;
}
/** A labelled copy action; the text is read when pressed, so streamed or revealed content is copied in full. */
export function CopyAction({text,label}:{text:string|(()=>string);label:string}){
  const [copied,setCopied]=useState(false);
  return <button type="button" className="copy-action" data-copied={copied||undefined} aria-label={label} title={label} onClick={async()=>{try{await navigator.clipboard.writeText(typeof text==='function'?text():text);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setCopied(false);}}}>{copied?<Check size={14}/>:<Copy size={14}/>}<span>{copied?t('Скопировано'):label}</span></button>;
}
/** Fenced code keeps its language visible and has its own copy action. */
function CodeBlock({language,children}:{language?:string;children:ReactNode}){
  const pre=useRef<HTMLPreElement|null>(null);
  return <div className="code-block"><div className="code-block-bar"><span>{language||t('Код')}</span><CopyAction text={()=>pre.current?.innerText.replace(/\n$/,'')||''} label={t('Копировать')}/></div><pre ref={pre}>{children}</pre></div>;
}
const codeLanguage=(children:ReactNode)=>{const child=(Array.isArray(children)?children[0]:children) as {props?:{className?:string}}|undefined;return /language-([\w+#.-]+)/.exec(child?.props?.className||'')?.[1];};
// Keep a single AST so character-reveal offsets remain global across paragraphs.
const singleMarkdownBlock=(text:string)=>[text];
const MarkdownBody=memo(function MarkdownBody({text,reveal,streaming=false}:{text:string;reveal?:RevealOptions;streaming?:boolean}) {
  useLanguage();
  return <div className="markdown"><Streamdown mode={streaming?"streaming":"static"} parseIncompleteMarkdown={streaming} parseMarkdownIntoBlocksFn={singleMarkdownBlock} skipHtml controls={false} animated={false} remarkPlugins={[remarkGfm]} rehypePlugins={reveal?[[rehypeStreamingReveal,reveal]]:[]} components={{strong:'strong',em:'em',p:'p',h1:'h1',h2:'h2',h3:'h3',h4:'h4',h5:'h5',h6:'h6',ul:'ul',ol:'ol',li:'li',blockquote:'blockquote',hr:'hr',thead:'thead',tbody:'tbody',tr:'tr',th:'th',td:'td',sup:'sup',sub:'sub',section:'section',code:({children,className})=><code className={className}>{children}</code>,table:({children})=><table>{children}</table>,pre:({children})=><CodeBlock language={codeLanguage(children)}>{children}</CodeBlock>,a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({src,alt})=>safeWebUrl(typeof src==='string'?src:undefined)?<Picture src={safeWebUrl(src as string)!} alt={alt||t('Изображение')}/>:<span>📎 {alt||t('Изображение')}</span>}}>{text}</Streamdown></div>;
});
function StreamingMarkdown({text,animateInitial,streaming}:{text:string;animateInitial:boolean;streaming:boolean}){const speed=useStreamSpeed(),visible=usePacedText(text,animateInitial,speed);return <MarkdownBody text={visible} streaming={streaming||visible!==text} reveal={useStreamingReveal(visible,speed!==0,animateInitial)}/>;}
export const Markdown=memo(function Markdown({text,streaming=false,animateInitial=false}:{text:string;streaming?:boolean;animateInitial?:boolean}){
  const wasStreaming=useRef(streaming);if(streaming)wasStreaming.current=true;
  return wasStreaming.current?<StreamingMarkdown text={text} animateInitial={animateInitial} streaming={streaming}/>:<MarkdownBody text={text}/>;
});
// Native <details> hides content visually but still mounts/parses all of it.
// Long command output is materialized only while the user asks to inspect it.
function Disclosure({className,summary,children,defaultOpen=false}:{className:string;summary:ReactNode;children:()=>ReactNode;defaultOpen?:boolean}){
  const [open,setOpen]=useState(false),element=useRef<HTMLDetailsElement|null>(null);
  // Opened once on mount; afterwards the person alone decides.
  useEffect(()=>{if(defaultOpen&&element.current)element.current.open=true;},[]);
  return <details ref={element} className={className} onToggle={event=>setOpen(event.currentTarget.open)}><summary>{summary}</summary>{open&&children()}</details>;
}
function Document({block}:{block:Block}) {
  const [error,setError]=useState(''); const source=block.source;
  const pdf=source?.media_type==='application/pdf' && source.data && source.data.length<=14_000_000 && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(source.data) ? source.data : null;
  const title=block.title || t('Документ');
  return <section className="document-card"><strong>📎 {title}</strong>{source?.text && <pre>{source.text}</pre>}{pdf && (Capacitor.isNativePlatform()?<button className="secondary" onClick={()=>void Documents.openDocument({data:pdf,name:title}).catch(e=>setError(e.message))}>{t('Открыть PDF')}</button>:<a href={`data:application/pdf;base64,${pdf}`} download="document.pdf">{t('Скачать PDF')}</a>)}{safeWebUrl(source?.url) && <a href={safeWebUrl(source?.url)!} target="_blank" rel="noopener noreferrer">{t('Открыть документ')}</a>}{error && <p className="error-banner">{t(error)}</p>}</section>;
}
const TAIL=12;
/** Command output keeps its exact text: monospace, ANSI removed, the last lines first, with copy actions and an error stripe. */
export function ToolOutput({text,failed=false,command}:{text:string;failed?:boolean;command?:string}){
  const clean=useMemo(()=>stripAnsi(text).replace(/\s+$/,''),[text]),all=useMemo(()=>clean.split(/\r?\n/),[clean]),[expanded,setExpanded]=useState(false);
  const hidden=expanded?0:Math.max(0,all.length-TAIL);
  return <div className={'tool-output-block'+(failed?' failed':'')}>
    {hidden>0&&<button type="button" className="text-button tool-output-more" onClick={()=>setExpanded(true)}>{plural(hidden,['… ещё {0} строка','… ещё {0} строки','… ещё {0} строк'])}</button>}
    {clean?<pre className="tool-output">{hidden?all.slice(-TAIL).join('\n'):clean}</pre>:<p className="tool-output-empty">{t('Нет вывода')}</p>}
    {(command||clean)&&<div className="tool-output-actions">{command&&<CopyAction text={command} label={t('Копировать команду')}/>}{clean&&<CopyAction text={clean} label={t('Копировать вывод')}/>}</div>}
  </div>;
}
function ToolResultContent({block,depth,command,prose=false}:{block:Block;depth:number;command?:string;prose?:boolean}) {
  // Command output keeps its exact text: Markdown would merge lines and turn "> cmd" into quotes. Only prose tools (agents, web pages) render Markdown.
  const failed=Boolean(block.is_error);
  const text=(value:string,key?:number)=>prose&&!failed?<Markdown key={key} text={value}/>:<ToolOutput key={key} text={value} failed={failed} command={command}/>;
  if(!Array.isArray(block.content))return text(typeof block.content==='string'?block.content:JSON.stringify(block.content,null,2)||'');
  const textOnly=block.content.every((item:any)=>item?.type==='text'&&typeof item.text==='string');
  if(textOnly)return text(toolText(block.content));
  return <>{block.content.map((item:any,i:number)=>item?.type==='text'&&typeof item.text==='string'?text(item.text,i):item && typeof item==='object' && typeof item.type==='string'?<RichBlock block={item} depth={depth+1} key={i}/>:<pre key={i}>{JSON.stringify(item,null,2)}</pre>)}</>;
}
const kindIcons={explore:FileText,command:Terminal,edit:Pencil,plan:ListChecks,agent:Bot,question:MessageCircle,web:Globe,tool:Wrench};
export function toolIcon(view:ToolView){return view.kind==='explore'&&view.search?Search:view.mcp?Plug:kindIcons[view.kind];}
/** Every state is a word as well as a colour or a shape. */
function ToolState({view}:{view:ToolView}){
  if(view.status==='running')return <span className="tool-state" data-status="running"><LoaderCircle size={14} className="tool-spinner" aria-hidden="true"/><span className="visually-hidden">{t('Выполняется')}</span></span>;
  if(view.status==='failed')return <span className="tool-state" data-status="failed">{t('Ошибка')}</span>;
  if(view.status==='denied')return <span className="tool-state" data-status="denied">{t('Отклонено')}</span>;
  if(view.status==='nomatch')return <span className="tool-state" data-status="nomatch">{t('нет совпадений')}</span>;
  return null;
}
export function PlanChecklist({items}:{items:PlanItem[]}){
  return <ol className="plan-checklist">{items.map((item,index)=>{const Icon=item.status==='completed'?CircleCheck:item.status==='in_progress'?CircleDot:Circle;return <li key={index} data-status={item.status}><Icon size={16} aria-hidden="true"/><span>{item.status==='in_progress'&&item.active?item.active:item.text}</span><span className="visually-hidden">{t(item.status==='completed'?'выполнено':item.status==='in_progress'?'в работе':'ожидает')}</span></li>;})}</ol>;
}
export function DiffBody({input,name}:{input:Record<string,unknown>;name:string}){
  const str=(value:unknown)=>typeof value==='string'?value:'';
  const rows:string[]=[];
  const pair=(before:string,after:string)=>{if(before)rows.push(...before.replace(/\r\n/g,'\n').split('\n').map(line=>'-'+line));if(after)rows.push(...after.replace(/\r\n/g,'\n').split('\n').map(line=>'+'+line));};
  if(Array.isArray(input.changes))for(const change of input.changes as Record<string,unknown>[]){rows.push('@@ '+str(change?.path));rows.push(...str(change?.diff).replace(/\r\n/g,'\n').split('\n').filter(Boolean));}
  else if(str(input.patch)||str(input.input)||name==='apply_patch')rows.push(...(str(input.patch)||str(input.input)||str(input.content)).replace(/\r\n/g,'\n').split('\n'));
  else if(Array.isArray(input.edits))for(const edit of input.edits as Record<string,unknown>[])pair(str(edit?.old_string),str(edit?.new_string));
  else if((str(input.content)||str(input.file_text))&&!('old_string' in input))pair('',str(input.content)||str(input.file_text));
  else pair(str(input.old_string)||str(input.old_str),str(input.new_string)||str(input.new_str));
  const shown=rows.slice(0,2000);
  return <pre className="tool-diff">{shown.map((row,index)=><span key={index} data-line={row.startsWith('@@')||row.startsWith('***')?'meta':row.startsWith('+')&&!row.startsWith('+++')?'add':row.startsWith('-')&&!row.startsWith('---')?'del':undefined}>{row+'\n'}</span>)}{rows.length>shown.length&&<span data-line="meta">{t('… ещё {0} строк',rows.length-shown.length)}</span>}</pre>;
}
export function ToolFields({input}:{input:unknown}){
  if(!input||typeof input!=='object'||Array.isArray(input))return <pre>{JSON.stringify(input,null,2)}</pre>;
  const entries=Object.entries(input as Record<string,unknown>).filter(([,value])=>value!==undefined&&value!==null&&value!=='');
  if(!entries.length)return null;
  return <dl className="tool-fields">{entries.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{typeof value==='string'?value:JSON.stringify(value,null,2)}</dd></div>)}</dl>;
}
function ToolRow({block,result,running,depth}:{block:Block;result?:Block;running:boolean;depth:number}){
  const view=describeTool(block,result,running),Icon=toolIcon(view),input=(block.input&&typeof block.input==='object'?block.input:{}) as Record<string,unknown>;
  const prose=view.kind==='agent'||view.kind==='web';
  return <Disclosure className={`tool-card activity-row ${result?'combined':''} ${view.failed?'failed':''}`} summary={<>
    <Icon size={16} aria-hidden="true"/><span className={'tool-title'+(view.mono?' mono':'')} title={view.command||undefined}>{view.title}</span>
    {view.kind==='edit'&&(view.added>0||view.removed>0)&&<span className="tool-diffstat" aria-label={t('Добавлено строк: {0}, удалено: {1}',view.added,view.removed)}><b>+{view.added}</b> <i>−{view.removed}</i></span>}
    <ToolState view={view}/>
    {view.errorLines.length>0&&<span className="tool-error-lines">{view.errorLines.join('\n')}</span>}
  </>}>{()=> <div className="activity-details">
    {view.kind==='command'?view.command&&<pre className="tool-command">{view.command}</pre>:view.kind==='edit'?<DiffBody input={input} name={(block.name||'').toLowerCase()}/>:view.plan?<PlanChecklist items={view.plan}/>:<ToolFields input={block.input}/>}
    {result&&<div className="tool-result-content"><ToolResultContent block={result} depth={depth} command={view.command} prose={prose}/></div>}
  </div>}</Disclosure>;
}
const notificationTitles={running:'Фоновые задачи выполняются',completed:'Фоновые задачи завершены',failed:'Ошибка фоновых задач',stopped:'Фоновые задачи остановлены',unknown:'Уведомление о фоновых задачах'} as const;
/** A background-task notice is an event in the transcript, not something the person wrote. */
export function TaskNotificationEvent({notification}:{notification:ClaudeTaskNotification}){
  const first=notification.summary.split(/\r?\n/)[0];
  return <details className={`claude-task-notification transcript-event status-${notification.status}`} aria-label={t('Уведомление о фоновых задачах')}>
    <summary><BellRing size={14} aria-hidden="true"/><strong>{t(notificationTitles[notification.status])}</strong><span>{first}</span><ChevronRight size={14} className="event-chevron" aria-hidden="true"/></summary>
    {notification.taskCount>0&&<small>{t('Количество фоновых задач')}: {notification.taskCount}</small>}
    <p>{notification.summary}</p>{notification.note&&<p className="claude-task-note">{notification.note}</p>}
  </details>;
}
export const notificationSummary=(notification:ClaudeTaskNotification)=>t(notificationTitles[notification.status])+': '+notification.summary;
export function RichBlock({block,depth=0,result,onSubagent,running=false,streaming=false,animateInitial=false}:{block:Block;depth?:number;result?:Block;running?:boolean;streaming?:boolean;animateInitial?:boolean;onSubagent?(agent:SubagentView):void}) {
  if(depth>5)return <p>{t('Вложенный результат слишком большой для просмотра')}</p>;
  if(block.type==='text'){
    const text=block.text || '', notification=parseClaudeTaskNotification(text);
    if(notification)return <TaskNotificationEvent notification={notification}/>;
    if(isClaudeTaskNotificationPrefix(text))return <aside className="claude-task-notification transcript-event pending" aria-live="polite">{t('Обрабатывается уведомление о фоновых задачах')}</aside>;
    return <Markdown text={text} streaming={streaming} animateInitial={streaming&&animateInitial}/>;
  }
  if(block.type==='subagent' && block.agent) {
    const agent=block.agent,label=t(({running:'Работает',completed:'Готово',error:'Ошибка',stopped:'Остановлено',unknown:'Статус неизвестен'} as const)[agent.status]);
    return onSubagent?<button className="subagent-card" data-status={agent.status} onClick={()=>onSubagent(agent)}><span className="subagent-status-dot" aria-hidden="true"/><span><strong>{agent.name}</strong><small>{label}</small></span><ChevronRight size={16} className="subagent-card-chevron" aria-hidden="true"/></button>:<Disclosure className="subagent-inline" summary={<>{agent.name} · {label}</>}>{()=> <>{agent.prompt&&<Markdown text={agent.prompt}/>} {agent.result&&<Markdown text={agent.result}/>}</>}</Disclosure>;
  }
  if(block.type==='image'){const src=imageSource(block);return src?<Picture src={src} alt={block.title||t('Изображение')}/>:<span className="attachment-chip">📎 {t('Изображение недоступно в сохранённой истории')}</span>;}
  if(block.type==='document')return <Document block={block}/>;
  if(block.type==='tool_result')return <Disclosure className={`tool-card result ${block.is_error?'failed':''}`} summary={block.is_error?t('Ошибка инструмента'):t('Результат инструмента')}>{()=> <ToolResultContent block={block} depth={depth}/>}</Disclosure>;
  if(block.type==='tool_use')return <ToolRow block={block} result={result} running={running} depth={depth}/>;
  // Reasoning stays open while it is being written and folds once the turn moves on.
  if(block.type==='thinking')return <Disclosure key={streaming&&running?'live':'done'} defaultOpen={streaming&&running} className="thinking" summary={t('Рассуждения')}>{()=> <p>{block.thinking}</p>}</Disclosure>;
  if(block.type==='redacted_thinking')return <p className="muted">{t('Этот блок размышлений скрыт провайдером')}</p>;
  return <Disclosure className="tool-card" summary={block.type==='codexItem'?t('Подробности действия'):<>{t('Дополнительные данные')} · {block.type}</>}>{()=> <pre>{JSON.stringify(block,null,2)}</pre>}</Disclosure>;
}
