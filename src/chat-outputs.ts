import type {Block,ChatMessage} from '../server/types';

export type OutputCategory='images'|'documents'|'code'|'links'|'tools';
export type OutputSource='results'|'sources';
export type ChatOutput={id:string;messageId:string;source:OutputSource;category:OutputCategory;title:string;path?:string;href?:string;text?:string;language?:string;block?:Block};
export const OUTPUT_LIMIT=800;
const imageExtensions=/\.(png|jpe?g|gif|webp)$/i;
const codeExtensions=/\.(c|cc|cpp|cs|css|go|h|hpp|html?|java|js|jsx|json|kt|kts|lua|php|ps1|py|rb|rs|sh|sql|swift|toml|ts|tsx|vue|xml|ya?ml)$/i;
const documentExtensions=/\.(md|markdown|txt|pdf|docx?|xlsx?|csv|pptx?|rtf|log|svg)$/i;
const string=(value:unknown)=>typeof value==='string'?value:undefined;
const record=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;

/** A reference is displayed only when its protocol is understood. Local authorization remains on the host. */
export function outputReference(value:string):{path?:string;href?:string}|null{
  let raw=value.trim().replace(/^<|>$/g,'');
  if(!raw||raw.length>4096||/[\x00-\x1f\x7f]/.test(raw))return null;
  if(/^https?:\/\//i.test(raw)){
    try{const url=new URL(raw);return !url.username&&!url.password?{href:url.href}:null;}catch{return null;}
  }
  if(!/^[a-z]:[\\/]/i.test(raw)&&/^[a-z][\w+.-]*:/i.test(raw))return null;
  if(raw.startsWith('//')||raw.startsWith('\\\\')||raw.startsWith('#')||raw.includes('?'))return null;
  try{raw=decodeURIComponent(raw);}catch{return null;}
  raw=raw.replace(/#L?\d+(?:[-:]L?\d+)?$/i,'').replace(/:\d+(?::\d+)?$/,'');
  if(/[\x00-\x1f\x7f]/.test(raw)||(!/[/\\]/.test(raw)&&!/[.]\w{1,12}$/.test(raw)))return null;
  return {path:raw};
}
function category(reference:{path?:string;href?:string},mime?:string):OutputCategory{
  const filename=reference.path||(reference.href?new URL(reference.href).pathname:'');
  if(/^image\/(png|jpeg|gif|webp)$/.test(mime||'')||imageExtensions.test(filename))return 'images';
  if(codeExtensions.test(filename))return 'code';
  if(mime?.startsWith('text/')||mime==='application/pdf'||documentExtensions.test(filename)||reference.path)return 'documents';
  return 'links';
}
function name(reference:{path?:string;href?:string}){
  if(reference.path)return reference.path.split(/[\\/]/).pop()||reference.path;
  const url=new URL(reference.href!),value=url.pathname.split('/').pop()||url.hostname;
  try{return decodeURIComponent(value);}catch{return value;}
}

/** Read-only index of the loaded transcript. It never fetches URLs or searches the PC filesystem. */
export function extractChatOutputs(messages:ChatMessage[]):ChatOutput[]{
  const output:ChatOutput[]=[],seen=new Set<string>();let visited=0;
  const tools=new Map<string,Block>();
  for(const message of messages)for(const block of message.blocks)if(block.type==='tool_use'&&block.id)tools.set(block.id,block);
  for(const message of [...messages].reverse()){
    const baseSource:OutputSource=message.role==='user'?'sources':'results';
    if(message.role==='system')continue;
    const add=(value:Omit<ChatOutput,'id'|'messageId'>,location:string)=>{
      if(output.length>=OUTPUT_LIMIT)return;
      const key=[value.source,value.category,value.path||value.href||`${message.id}:${location}`].join('|');
      if(seen.has(key))return;seen.add(key);output.push({...value,id:`${message.id}:${location}`,messageId:message.id});
    };
    const link=(url:string,title:string|undefined,source:OutputSource,location:string,mime?:string,forceImage=false)=>{
      const ref=outputReference(url);if(ref)add({...ref,source,category:forceImage?'images':category(ref,mime),title:title?.trim()||name(ref)},location);
    };
    const markdown=(text:string,source:OutputSource,location:string)=>{
      let sequence=0;
      const prose=text.slice(0,2_000_000).replace(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm,(_match,fence:string,info:string,code:string)=>{
        const language=info.trim().split(/\s/)[0].slice(0,40);add({source,category:'code',title:language?`${language} code`:'Code',language,text:code.replace(/\n$/,'')},`${location}-code-${sequence++}`);return '';
      });
      const occupied:Array<[number,number]>=[];
      const pattern=/!?\[([^\]\n]{0,500})\]\([ \t]*(<[^>\n]{1,4096}>|[^\s()]{1,4096}(?:\([^\s()]{0,2048}\)[^\s()]{0,2048})?)(?:[ \t]+["'][^\n]{0,500}?["'])?[ \t]*\)/g;
      for(const match of prose.matchAll(pattern)){occupied.push([match.index!,match.index!+match[0].length]);link(match[2],match[1],source,`${location}-link-${sequence++}`,undefined,match[0].startsWith('!'));}
      const references=new Map<string,string>();
      for(const match of prose.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(<[^>\n]+>|\S+)/gm))references.set(match[1].toLowerCase(),match[2]);
      for(const match of prose.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)){const target=references.get((match[2]||match[1]).toLowerCase());if(target)link(target,match[1],source,`${location}-ref-${sequence++}`,undefined,match[0].startsWith('!'));}
      for(const match of prose.matchAll(/https?:\/\/[^\s<>"`]+/g)){
        if(occupied.some(([start,end])=>match.index!>=start&&match.index!<end))continue;
        link(match[0].replace(/[.,;!?)\]]+$/,''),undefined,source,`${location}-url-${sequence++}`);
      }
    };
    const walk=(raw:unknown,source:OutputSource,location:string,depth=0)=>{
      if(depth>6||++visited>15000||output.length>=OUTPUT_LIMIT)return;
      const block=record(raw);if(!block)return;const type=string(block.type),payload=record(block.source);
      if(type==='text'){markdown(string(block.text)||'',source,location);return;}
      if(type==='image'||type==='document'){
        const title=string(block.title)||string(block.name)||(type==='image'?'Image':'Document');
        const url=string(payload?.url);if(url){link(url,title,source,location,string(payload?.media_type)||string(block.mimeType));return;}
        add({source,category:type==='image'?'images':'documents',title,block:block as Block},location);return;
      }
      if(type==='resource_link'){
        const uri=string(block.uri)||string(block.url);if(uri)link(uri,string(block.title)||string(block.name),source,location,string(block.mimeType));return;
      }
      if(type==='resource'){
        const resource=record(block.resource);if(!resource)return;
        const text=string(resource.text),mime=string(resource.mimeType);
        if(text!==undefined){add({source,category:mime==='text/markdown'?'documents':mime?.startsWith('text/')?'code':'documents',title:string(block.name)||string(resource.uri)||'Document',text,language:mime==='text/markdown'?'markdown':undefined},location);return;}
        if(string(resource.uri))link(String(resource.uri),string(block.name),source,location,mime);return;
      }
      if(type==='tool_result'){
        const content=block.content,call=tools.get(string(block.tool_use_id)||''),input=record(call?.input);
        add({source:'results',category:'tools',title:call?.name||(block.is_error?'Tool error':'Tool result'),block:block as Block},location);
        if(!block.is_error&&call&&['Write','Edit','MultiEdit'].includes(call.name||'')){
          const file=string(input?.file_path),ref=file?outputReference(file):null;
          if(ref){
            const text=call.name==='Write'?string(input?.content):call.name==='Edit'&&typeof input?.old_string==='string'&&typeof input?.new_string==='string'?`@@ Edited region @@\n${input.old_string.split('\n').map(line=>'-'+line).join('\n')}\n${input.new_string.split('\n').map(line=>'+'+line).join('\n')}`:undefined;
            add({...ref,source:'results',category:category(ref),title:name(ref),text,language:call.name==='Edit'?'diff':/\.(md|markdown)$/i.test(file!)?'markdown':undefined},`${location}-file`);
          }
        }
        if(Array.isArray(content))content.forEach((item,index)=>walk(item,'results',`${location}-${index}`,depth+1));
        else if(typeof content==='string')markdown(content,'results',`${location}-result`);return;
      }
      if(type==='tool_use'||type==='fileChange'){
        const input=record(block.input)||block,changes=Array.isArray(input.changes)?input.changes:[];
        for(const [index,rawChange] of changes.entries()){
          const change=record(rawChange),path=string(change?.path);if(!path)continue;const ref=outputReference(path);if(!ref)continue;
          add({...ref,source:'results',category:'code',title:name(ref),text:string(change?.diff),language:'diff'},`${location}-change-${index}`);
        }
        return;
      }
      if(type==='codexContent'||type==='codexItem'||type==='codexInput')walk(block.content,source,`${location}-content`,depth+1);
    };
    for(let index=message.blocks.length-1;index>=0;index--)walk(message.blocks[index],baseSource,String(index));
  }
  return output;
}
