import type {Block,ChatMessage} from './types.js';
import {extractChatOutputs} from '../src/chat-outputs.js';

/** Where a chat's latest image lives. A local path is served later through the attachment/artifact checks; inline data is re-read from the transcript, never cached or listed. */
export type PreviewImage={name:string;path?:string;inline?:true};
export type PreviewEntry={text:string;image:PreviewImage|null};
/** What the chat grid receives: plain text and an image name only. The thumbnail itself is a separate authenticated read. */
export type SessionPreview={sessionId:string;lastModified:number;text:string;image:{name:string}|null}|{sessionId:string;error:true};
export const PREVIEW_TEXT_LIMIT=400;
const imageTypes=/^image\/(png|jpeg|gif|webp)$/;

/** Markdown to one readable paragraph: code fences, images, link targets, markup and HTML are removed; the result is cut at a word boundary. */
export function plainText(markdown:string,limit=PREVIEW_TEXT_LIMIT){
  const text=markdown.slice(0,20000)
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|$(?![\s\S]))/gm,' ')
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g,' ')
    .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g,'$1')
    .replace(/\[([^\]\n]+)\]\[[^\]\n]*\]/g,'$1')
    .replace(/^\s{0,3}\[[^\]]+\]:\s*\S+.*$/gm,' ')
    .replace(/<\/?[a-z][^>\n]*>/gi,' ')
    .replace(/`([^`\n]*)`/g,'$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm,'')
    .replace(/^\s{0,3}>\s?/gm,'')
    .replace(/^\s*(?:[-*+]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?/gm,'')
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*$/gm,' ')
    .replace(/\|/g,' ')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm,' ')
    .replace(/(\*\*|__)(.+?)\1/g,'$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g,'$1$2')
    .replace(/~~(.+?)~~/g,'$1')
    .replace(/\s+/g,' ').trim();
  if(text.length<=limit)return text;
  const cut=text.slice(0,limit),space=cut.lastIndexOf(' ');
  return (space>limit*.6?cut.slice(0,space):cut).replace(/[\s,.;:!?-]+$/,'')+'…';
}
function assistantText(message:ChatMessage){
  return message.blocks.filter(block=>block.type==='text'&&typeof block.text==='string').map(block=>block.text).join('\n\n');
}
function inlineImage(block:Block|undefined){
  const source=block?.source;
  return source?.type==='base64'&&typeof source.data==='string'&&imageTypes.test(source.media_type||'')?{mimeType:source.media_type!,data:source.data}:null;
}
/** The newest assistant reply and the newest local or inline image (from either side of the chat). Remote URLs are never chosen: they would load without the person asking. */
export function previewFromMessages(messages:ChatMessage[]):PreviewEntry&{data?:{mimeType:string;data:string}}{
  let text='';
  for(let index=messages.length-1;index>=0&&!text;index--)if(messages[index].role==='assistant')text=plainText(assistantText(messages[index]));
  for(const output of extractChatOutputs(messages,600)){
    if(output.category!=='images'||output.href)continue;
    if(output.path)return {text,image:{name:output.title||output.path.split(/[\\/]/).pop()||'Image',path:output.path}};
    const data=inlineImage(output.block);
    if(data)return {text,image:{name:output.title||'Image',inline:true},data};
  }
  return {text,image:null};
}

/** Host-side preview cache: one entry per provider/session/lastModified, bounded size, at most `concurrency` transcript reads at a time, shared in-flight work. */
export class SessionPreviews{
  private entries=new Map<string,PreviewEntry>();
  private pending=new Map<string,Promise<PreviewEntry>>();
  private running=0;private waiting:(()=>void)[]=[];
  constructor(private options:{capacity?:number;concurrency?:number}={}){}
  private async slot<T>(work:()=>Promise<T>){
    if(this.running>=(this.options.concurrency??3))await new Promise<void>(resolve=>this.waiting.push(resolve));
    this.running++;
    try{return await work();}finally{this.running--;this.waiting.shift()?.();}
  }
  get(provider:string,sessionId:string,lastModified:number,read:()=>Promise<ChatMessage[]>):Promise<PreviewEntry>{
    const key=provider+':'+sessionId+':'+lastModified,cached=this.entries.get(key);
    if(cached){this.entries.delete(key);this.entries.set(key,cached);return Promise.resolve(cached);}
    const running=this.pending.get(key);if(running)return running;
    const promise=this.slot(async()=>{const {text,image}=previewFromMessages(await read());return {text,image};}).then(entry=>{
      // An older version of the same chat never outlives a newer one.
      for(const old of this.entries.keys())if(old.startsWith(provider+':'+sessionId+':'))this.entries.delete(old);
      this.entries.set(key,entry);
      while(this.entries.size>(this.options.capacity??500))this.entries.delete(this.entries.keys().next().value!);
      return entry;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,promise);return promise;
  }
  /** Inline image bytes are read again on request so the cache only ever holds short text and file names. */
  inline(read:()=>Promise<ChatMessage[]>){return this.slot(async()=>previewFromMessages(await read()).data||null);}
  get size(){return this.entries.size;}
}
export const isPreviewImageType=(mimeType:string)=>imageTypes.test(mimeType);
