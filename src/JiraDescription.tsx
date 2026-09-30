import {createElement,useMemo,type ReactNode} from 'react';
import {Markdown,safeWebUrl} from './RichBlocks';
import {t} from './i18n';

const allowed=new Set(['p','div','span','strong','b','em','i','u','s','del','ul','ol','li','pre','code','blockquote','br','hr','h1','h2','h3','h4','h5','h6','table','thead','tbody','tfoot','tr','th','td']);
const hidden=new Set(['script','style','iframe','object','embed','link','meta','base','form','input','button','textarea','select','template','svg','math']);
function htmlContent(html:string,baseUrl:string):ReactNode[] {
  // Template contents are inert: their scripts, frames and image resources never
  // join the document. Only whitelisted React elements are created below.
  const template=document.createElement('template');template.innerHTML=html;
  function href(value:string|null){try{return value?safeWebUrl(new URL(value,baseUrl).href):null;}catch{return null;}}
  function render(node:ChildNode,key:string):ReactNode {
    if(node.nodeType===Node.TEXT_NODE)return node.textContent;
    if(!(node instanceof Element))return null;
    const tag=node.tagName.toLowerCase();if(hidden.has(tag))return null;
    const children=[...node.childNodes].map((child,index)=>render(child,`${key}-${index}`));
    if(tag==='a'){
      const url=href(node.getAttribute('href'));
      return url?<a key={key} href={url} target="_blank" rel="noopener noreferrer">{children}</a>:<span key={key}>{children}</span>;
    }
    if(tag==='img'||tag==='video'||tag==='audio'||tag==='source'){
      const url=href(node.getAttribute('src'))||href(node.getAttribute('poster')),label=node.getAttribute('alt')||node.getAttribute('title')||t('Открыть вложение');
      return url?<a className="jira-attachment-link" key={key} href={url} target="_blank" rel="noopener noreferrer">📎 {label}</a>:<span key={key}>{label}</span>;
    }
    if(!allowed.has(tag))return <span key={key}>{children}</span>;
    const props:{key:string;colSpan?:number;rowSpan?:number}={key};
    if(tag==='td'||tag==='th')for(const [attribute,property] of [['colspan','colSpan'],['rowspan','rowSpan']] as const){const value=Number(node.getAttribute(attribute));if(Number.isInteger(value)&&value>0&&value<=100)props[property]=value;}
    return ['br','hr'].includes(tag)?createElement(tag,props):createElement(tag,props,...children);
  }
  return [...template.content.childNodes].map((node,index)=>render(node,String(index)));
}
export function JiraDescription({text,format='text',url}:{text:string;format?:'text'|'markdown'|'html';url:string}) {
  const html=useMemo(()=>format==='html'?htmlContent(text,url):null,[text,format,url]);
  if(format==='markdown')return <Markdown text={text}/>;
  if(format==='html')return <div className="markdown jira-html-description">{html}</div>;
  return <p>{text}</p>;
}
