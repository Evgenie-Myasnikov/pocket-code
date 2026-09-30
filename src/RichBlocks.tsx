import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Block } from '../server/types';
import { t } from './i18n';

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
  return <><button className="image-preview" aria-label={t('Открыть изображение')} onClick={()=>setExpanded(true)}><img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/></button>{expanded && <div className="image-overlay" role="dialog" aria-label={t('Изображение')} aria-modal="true"><button className="secondary" autoFocus onClick={()=>setExpanded(false)}>{t('Закрыть')}</button><div><img src={src} alt={alt} referrerPolicy="no-referrer"/></div></div>}</>;
}
export function Markdown({text}:{text:string}) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({src,alt})=>safeWebUrl(typeof src==='string'?src:undefined)?<Picture src={safeWebUrl(src as string)!} alt={alt||t('Изображение')}/>:<span>📎 {alt||t('Изображение')}</span>}}>{text}</ReactMarkdown></div>;
}
function Document({block}:{block:Block}) {
  const [error,setError]=useState(''); const source=block.source;
  const pdf=source?.media_type==='application/pdf' && source.data && source.data.length<=14_000_000 && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(source.data) ? source.data : null;
  const title=block.title || t('Документ');
  return <section className="document-card"><strong>📎 {title}</strong>{source?.text && <pre>{source.text}</pre>}{pdf && (Capacitor.isNativePlatform()?<button className="secondary" onClick={()=>void Documents.openDocument({data:pdf,name:title}).catch(e=>setError(e.message))}>{t('Открыть PDF')}</button>:<a href={`data:application/pdf;base64,${pdf}`} download="document.pdf">{t('Скачать PDF')}</a>)}{safeWebUrl(source?.url) && <a href={safeWebUrl(source?.url)!} target="_blank" rel="noopener noreferrer">{t('Открыть документ')}</a>}{error && <p className="error">{t(error)}</p>}</section>;
}
export function RichBlock({block,depth=0}:{block:Block;depth?:number}) {
  if(depth>5)return <p>{t('Вложенный результат слишком большой для просмотра')}</p>;
  if(block.type==='text')return <Markdown text={block.text || ''}/>;
  if(block.type==='image'){const src=imageSource(block);return src?<Picture src={src} alt={block.title||t('Изображение')}/>:<span className="attachment-chip">📎 {t('Изображение недоступно в сохранённой истории')}</span>;}
  if(block.type==='document')return <Document block={block}/>;
  if(block.type==='tool_result')return <details className={`tool-card result ${block.is_error?'failed':''}`}><summary>{block.is_error?t('Ошибка инструмента'):t('Результат инструмента')}</summary>{Array.isArray(block.content)?block.content.map((item:any,i:number)=>item && typeof item==='object' && typeof item.type==='string'?<RichBlock block={item} depth={depth+1} key={i}/>:<pre key={i}>{JSON.stringify(item,null,2)}</pre>):<Markdown text={typeof block.content==='string'?block.content:JSON.stringify(block.content,null,2)||''}/>}</details>;
  if(block.type==='tool_use')return <details className="tool-card"><summary><strong>{block.name}</strong> · {t('Вызов инструмента')}</summary><pre>{JSON.stringify(block.input,null,2)}</pre></details>;
  if(block.type==='thinking')return <details className="thinking"><summary>{t('Размышления Claude')}</summary><p>{block.thinking}</p></details>;
  if(block.type==='redacted_thinking')return <p className="muted">{t('Этот блок размышлений скрыт провайдером')}</p>;
  return <details className="tool-card"><summary>{t('Дополнительные данные')} · {block.type}</summary><pre>{JSON.stringify(block,null,2)}</pre></details>;
}
