import { memo, useState, useRef, type ReactNode } from 'react';
import { useModal } from './navigation';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Block, SubagentView } from '../server/types';
import { t, useLanguage } from './i18n';
import {Terminal, Pencil, ChevronRight, Wrench} from 'lucide-react';
import {toolActivity} from './tool-activity';
import {ImageViewer} from './ImageViewer';

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
export const Markdown=memo(function Markdown({text}:{text:string}) {
  useLanguage();
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({src,alt})=>safeWebUrl(typeof src==='string'?src:undefined)?<Picture src={safeWebUrl(src as string)!} alt={alt||t('Изображение')}/>:<span>📎 {alt||t('Изображение')}</span>}}>{text}</ReactMarkdown></div>;
});
// Native <details> hides content visually but still mounts/parses all of it.
// Long command output is materialized only while the user asks to inspect it.
function Disclosure({className,summary,children}:{className:string;summary:ReactNode;children:()=>ReactNode}){
  const [open,setOpen]=useState(false);
  return <details className={className} onToggle={event=>setOpen(event.currentTarget.open)}><summary>{summary}</summary>{open&&children()}</details>;
}
function Document({block}:{block:Block}) {
  const [error,setError]=useState(''); const source=block.source;
  const pdf=source?.media_type==='application/pdf' && source.data && source.data.length<=14_000_000 && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(source.data) ? source.data : null;
  const title=block.title || t('Документ');
  return <section className="document-card"><strong>📎 {title}</strong>{source?.text && <pre>{source.text}</pre>}{pdf && (Capacitor.isNativePlatform()?<button className="secondary" onClick={()=>void Documents.openDocument({data:pdf,name:title}).catch(e=>setError(e.message))}>{t('Открыть PDF')}</button>:<a href={`data:application/pdf;base64,${pdf}`} download="document.pdf">{t('Скачать PDF')}</a>)}{safeWebUrl(source?.url) && <a href={safeWebUrl(source?.url)!} target="_blank" rel="noopener noreferrer">{t('Открыть документ')}</a>}{error && <p className="error">{t(error)}</p>}</section>;
}
function ToolResultContent({block,depth}:{block:Block;depth:number}) {
  return <>{Array.isArray(block.content)?block.content.map((item:any,i:number)=>item && typeof item==='object' && typeof item.type==='string'?<RichBlock block={item} depth={depth+1} key={i}/>:<pre key={i}>{JSON.stringify(item,null,2)}</pre>):<Markdown text={typeof block.content==='string'?block.content:JSON.stringify(block.content,null,2)||''}/>}</>;
}
export function RichBlock({block,depth=0,result,onSubagent,running=false}:{block:Block;depth?:number;result?:Block;running?:boolean;onSubagent?(agent:SubagentView):void}) {
  if(depth>5)return <p>{t('Вложенный результат слишком большой для просмотра')}</p>;
  if(block.type==='text')return <Markdown text={block.text || ''}/>;
  if(block.type==='subagent' && block.agent) {
    const agent=block.agent,label=t(({running:'Работает',completed:'Завершён',error:'Ошибка',stopped:'Остановлен',unknown:'Статус неизвестен'} as const)[agent.status]);
    return onSubagent?<button className={`subagent-card subagent-${agent.status}`} onClick={()=>onSubagent(agent)}><span className="subagent-status-dot" aria-hidden="true"/><span><strong>{agent.name}</strong><small>{label}</small></span><ChevronRight className="subagent-chevron" size={16} aria-hidden="true"/></button>:<Disclosure className="subagent-inline" summary={<>{agent.name} · {label}</>}>{()=> <>{agent.prompt&&<Markdown text={agent.prompt}/>} {agent.result&&<Markdown text={agent.result}/>}</>}</Disclosure>;
  }
  if(block.type==='image'){const src=imageSource(block);return src?<Picture src={src} alt={block.title||t('Изображение')}/>:<span className="attachment-chip">📎 {t('Изображение недоступно в сохранённой истории')}</span>;}
  if(block.type==='document')return <Document block={block}/>;
  if(block.type==='tool_result')return <Disclosure className={`tool-card result ${block.is_error?'failed':''}`} summary={block.is_error?t('Ошибка инструмента'):t('Результат инструмента')}>{()=> <ToolResultContent block={block} depth={depth}/>}</Disclosure>;
  if(block.type==='tool_use'){
    const activity=toolActivity(block,result,running),Icon=activity.kind==='command'?Terminal:activity.kind==='edit'?Pencil:Wrench;
    return <Disclosure className={`tool-card activity-row ${result?'combined':''} ${activity.failed?'failed':''}`} summary={<><Icon size={16}/><span>{t(activity.label)}{activity.kind==='tool'&&block.name?` · ${block.name}`:''}</span><ChevronRight className="activity-chevron" size={14}/></>}>{()=> <div className="activity-details"><strong>{block.name}</strong><pre>{JSON.stringify(block.input,null,2)}</pre>{result&&<div className="tool-result-content"><ToolResultContent block={result} depth={depth}/></div>}</div>}</Disclosure>;
  }
  if(block.type==='thinking')return <Disclosure className="thinking" summary={t('Рассуждения')}>{()=> <p>{block.thinking}</p>}</Disclosure>;
  if(block.type==='redacted_thinking')return <p className="muted">{t('Этот блок размышлений скрыт провайдером')}</p>;
  return <Disclosure className="tool-card" summary={block.type==='codexItem'?t('Подробности действия'):<>{t('Дополнительные данные')} · {block.type}</>}>{()=> <pre>{JSON.stringify(block,null,2)}</pre>}</Disclosure>;
}
