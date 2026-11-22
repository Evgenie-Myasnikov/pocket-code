import { memo, useState, useRef, useMemo, useEffect, useId, type ComponentProps, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import {Streamdown} from 'streamdown';
import remarkGfm from 'remark-gfm';
import {ChevronDown,Ellipsis,Lightbulb,WrapText,X} from 'lucide-react';
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
import {EditActivity} from './EditActivity';
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
export function CopyAction({text,label,compact=false}:{text:string|(()=>string);label:string;compact?:boolean}){
  const [result,setResult]=useState<'idle'|'copied'|'failed'>('idle');
  const attempt=useRef(0), reset=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const statusId=useId();
  const copied=result==='copied', failed=result==='failed';
  const message=failed?t('Не удалось скопировать. Выделите текст и скопируйте его вручную.'):copied?t('Скопировано'):'';
  useEffect(()=>()=>{attempt.current++;clearTimeout(reset.current);},[]);

  async function copy(){
    const current=++attempt.current;
    clearTimeout(reset.current);
    try{
      await navigator.clipboard.writeText(typeof text==='function'?text():text);
      if(current!==attempt.current)return;
      setResult('copied');
      reset.current=setTimeout(()=>setResult('idle'),1500);
    }catch{
      if(current===attempt.current)setResult('failed');
    }
  }
  return <span className="copy-control">
    <button type="button" className="copy-action" data-copied={copied||undefined}
      aria-label={label} aria-describedby={failed?statusId:undefined} title={label} onClick={copy}>
      {copied?<Check size={14} aria-hidden="true"/>:<Copy size={14} aria-hidden="true"/>}
      {!compact&&<span>{copied?t('Скопировано'):label}</span>}
    </button>
    <span id={statusId} role="status" className={failed?'copy-error':'visually-hidden'}>{message}</span>
  </span>;
}
/** Chat and project documents use the same code reader. Wrapping only changes presentation. */
export function CodeBlock({children}:{children?:ReactNode}){
  const pre=useRef<HTMLPreElement>(null);
  const block=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const [actionsOpen,setActionsOpen]=useState(false);
  const actionsId=useId();
  const [wrap,setWrap]=useState(false);
  const [moreToRight,setMoreToRight]=useState(false);
  useEffect(()=>{
    if(!actionsOpen)return;
    const outside=(event:PointerEvent)=>{
      if(!block.current?.contains(event.target as Node))setActionsOpen(false);
    };
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[actionsOpen]);
  useEffect(()=>{
    const element=pre.current;
    if(!element)return;
    const measure=()=>setMoreToRight(element.scrollWidth-element.clientWidth-element.scrollLeft>1);
    const observer=new ResizeObserver(measure);
    observer.observe(element);
    if(element.firstElementChild)observer.observe(element.firstElementChild);
    element.addEventListener('scroll',measure,{passive:true});
    measure();
    return ()=>{
      observer.disconnect();
      element.removeEventListener('scroll',measure);
    };
  },[]);
  const language=codeLanguage(children);
  const label=[t('Действия с кодом'),language].filter(Boolean).join(' · ');
  return <div className="code-block reader-code" ref={block} onBlur={event=>{
    if(!event.currentTarget.contains(event.relatedTarget))setActionsOpen(false);
  }} onKeyDown={event=>{
    if(actionsOpen&&event.key==='Escape'){
      event.preventDefault();event.stopPropagation();trigger.current?.focus();setActionsOpen(false);
    }
  }}>
    <button type="button" ref={trigger} className="code-options-trigger" aria-label={label} title={label}
      aria-expanded={actionsOpen} aria-controls={actionsOpen?actionsId:undefined} onClick={()=>setActionsOpen(value=>!value)}>
      <Ellipsis size={18} aria-hidden="true"/>
    </button>
    {actionsOpen&&<div id={actionsId} role="group" aria-label={label} className="reader-code-actions">
        <button type="button" className="copy-action code-wrap" aria-pressed={wrap} onClick={()=>setWrap(value=>!value)}>
          <WrapText size={15} aria-hidden="true"/><span>{t('Перенос')}</span>
        </button>
        <CopyAction text={()=>pre.current?.textContent?.replace(/\n$/,'')||''} label={t('Копировать')}/>
    </div>}
    <div className={'reader-code-scroll'+(moreToRight&&!wrap?' overflowing':'')}>
      <pre ref={pre} className={wrap?'wrap':undefined}>{children}</pre>
    </div>
  </div>;
}
const codeLanguage=(children:ReactNode)=>{const child=(Array.isArray(children)?children[0]:children) as {props?:{className?:string}}|undefined;return /language-([\w+#.-]+)/.exec(child?.props?.className||'')?.[1];};
// Keep a single AST so character-reveal offsets remain global across paragraphs.
const singleMarkdownBlock=(text:string)=>[text];

function MarkdownTable({children}:{children?:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null);
  const table=useRef<HTMLTableElement>(null);
  const [scrollable,setScrollable]=useState(false);
  useEffect(()=>{
    const container=viewport.current, content=table.current;
    if(!container||!content)return;
    const measure=()=>setScrollable(container.scrollWidth>container.clientWidth+1);
    const observer=new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    measure();
    return ()=>observer.disconnect();
  },[]);
  return <div ref={viewport} className="markdown-table-scroll" tabIndex={scrollable?0:undefined}
    role={scrollable?'group':undefined} aria-label={scrollable?t('Таблица с горизонтальной прокруткой'):undefined}>
    <table ref={table}>{children}</table>
  </div>;
}

const markdownElements:NonNullable<ComponentProps<typeof Streamdown>['components']>={
  strong:'strong', em:'em', p:'p', h1:'h1', h2:'h2', h3:'h3', h4:'h4', h5:'h5', h6:'h6',
  ul:'ul', ol:'ol', li:'li', blockquote:'blockquote', hr:'hr', thead:'thead', tbody:'tbody', tr:'tr',
  th:'th', td:'td', sup:'sup', sub:'sub', section:'section',
  code:({children,className})=><code className={className}>{children}</code>,
  table:({children})=><MarkdownTable>{children}</MarkdownTable>,
  pre:({children})=><CodeBlock>{children}</CodeBlock>,
  a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,
  img:({src,alt})=>{
    const url=safeWebUrl(typeof src==='string'?src:undefined);
    return url?<Picture key={url} src={url} alt={alt||t('Изображение')}/>:<span>📎 {alt||t('Изображение')}</span>;
  },
};

const MarkdownBody=memo(function MarkdownBody({text,reveal,streaming=false}:{text:string;reveal?:RevealOptions;streaming?:boolean}) {
  useLanguage();
  // Streamdown's memo comparison includes data attributes. Expire glyph spans without
  // remounting the table a reader has focused or scrolled while a reply is streaming.
  return <div className="markdown"><Streamdown data-revealing={reveal?true:undefined} mode={streaming?"streaming":"static"} parseIncompleteMarkdown={streaming} parseMarkdownIntoBlocksFn={singleMarkdownBlock} skipHtml controls={false} animated={false} remarkPlugins={[remarkGfm]} rehypePlugins={reveal?[[rehypeStreamingReveal,reveal]]:[]} components={markdownElements}>{text}</Streamdown></div>;
});
function StreamingMarkdown({text,animateInitial,streaming}:{text:string;animateInitial:boolean;streaming:boolean}){const speed=useStreamSpeed(),visible=usePacedText(text,animateInitial,speed,streaming);return <MarkdownBody text={visible} streaming={streaming||visible!==text} reveal={useStreamingReveal(visible,speed!==0,animateInitial)}/>;}
export const Markdown=memo(function Markdown({text,streaming=false,animateInitial=false}:{text:string;streaming?:boolean;animateInitial?:boolean}){
  const wasStreaming=useRef(streaming);if(streaming)wasStreaming.current=true;
  return wasStreaming.current?<StreamingMarkdown text={text} animateInitial={animateInitial} streaming={streaming}/>:<MarkdownBody text={text}/>;
});
// Native <details> hides content visually but still mounts/parses all of it.
// Long command output is materialized only while the user asks to inspect it.
export function Disclosure({className,summary,children,defaultOpen=false}:{className:string;summary:ReactNode;children:()=>ReactNode;defaultOpen?:boolean}){
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
export function ReasoningDisclosure({paragraphs,live=false}:{paragraphs:string[];live?:boolean}){
  const label=t('Рассуждения');
  if(!paragraphs.some(text=>text.trim()))return null;
  return <Disclosure className="thinking" defaultOpen={live} summary={<><Lightbulb size={15} aria-hidden="true"/><span>{label}</span><ChevronRight size={12} className="chat-disclosure-chevron" aria-hidden="true"/></>}>
    {()=> <div role="region" aria-label={label} tabIndex={0} className="reasoning-content">{paragraphs.map((text,index)=>text&&<p key={index}>{text}</p>)}</div>}
  </Disclosure>;
}
const TAIL=12;
/** Command output keeps its exact text: monospace, ANSI removed, the last lines first, with copy actions and an error stripe. */
export function ToolOutput({text,failed=false,command}:{text:string;failed?:boolean;command?:string}){
  const clean=useMemo(()=>stripAnsi(text).replace(/\s+$/,''),[text]),all=useMemo(()=>clean.split(/\r?\n/),[clean]),[expanded,setExpanded]=useState(false);
  const hidden=expanded?0:Math.max(0,all.length-TAIL);
  return <div className={'tool-output-block'+(failed?' failed':'')}>
    {hidden>0&&<button type="button" className="text-button tool-output-more" onClick={()=>setExpanded(true)}>{plural(hidden,['… ещё {0} строка','… ещё {0} строки','… ещё {0} строк'])}</button>}
    {clean?<pre className="tool-output" tabIndex={0} role="region" aria-label={t('Результат инструмента')}>{hidden?all.slice(-TAIL).join('\n'):clean}</pre>:<p className="tool-output-empty">{t('Нет вывода')}</p>}
    {(command||clean)&&<div className="tool-output-actions">{command&&<CopyAction compact text={command} label={t('Копировать команду')}/>}{clean&&<CopyAction compact text={clean} label={t('Копировать вывод')}/>}</div>}
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
  if(view.kind==='edit')return <EditActivity view={view} input={input} name={(block.name||'').toLowerCase()}
    created={!!result&&!result.is_error&&/^File created successfully at:/i.test(toolText(result.content).trim())}
    copy={(text,label)=><CopyAction text={text} label={label} compact/>} fallback={<ToolFields input={block.input}/>}
    result={result&&<div className="tool-result-content"><ToolResultContent block={result} depth={depth}/></div>}/>;
  const prose=view.kind==='agent'||view.kind==='web';
  const commandRow=view.kind==='command';
  return <Disclosure className={`tool-card activity-row ${commandRow?'command-row':''} ${result?'combined':''} ${view.failed?'failed':''}`} summary={<>
    {commandRow?<><ChevronDown size={14} className="command-chevron" aria-hidden="true"/><span className="command-label">{view.status==='failed'?t('Команда не выполнилась'):view.title}</span>
      {view.command&&<><span className="command-separator" aria-hidden="true">·</span><span className="tool-title mono" title={view.command}>{view.command}</span></>}</>:
      <><Icon size={16} aria-hidden="true"/><span className={'tool-title'+(view.mono?' mono':'')}>{view.title}</span></>}
    {commandRow&&view.status==='failed'?<span className="tool-state" data-status="failed"><X size={13} aria-hidden="true"/><span>{t('Не удалось')}</span></span>:<ToolState view={view}/>}
  </>}>{()=> <div className="activity-details">
    {commandRow?view.command&&<pre className="tool-command">{view.command}</pre>:view.plan?<PlanChecklist items={view.plan}/>:<ToolFields input={block.input}/>}
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
  if(block.type==='thinking')return <ReasoningDisclosure key={streaming&&running?'live':'done'} live={streaming&&running} paragraphs={[block.thinking||'']}/>;
  if(block.type==='redacted_thinking')return <p className="muted">{t('Этот блок размышлений скрыт провайдером')}</p>;
  return <Disclosure className="tool-card" summary={block.type==='codexItem'?t('Подробности действия'):<>{t('Дополнительные данные')} · {block.type}</>}>{()=> <pre>{JSON.stringify(block,null,2)}</pre>}</Disclosure>;
}
