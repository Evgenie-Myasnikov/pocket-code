import {builtInBoardRulePath} from './project-rules.js';
import {boardInstructions} from './board-instructions.js';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {open, opendir, realpath, lstat} from 'node:fs/promises';
import type {Dirent} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {HttpError, within} from './security.js';

export type RuleProvider='claude'|'codex'|'copilot';
/** loaded: read automatically; shadowed: a higher-priority file replaces it; on-demand: read only when scoped/linked; not-read: this provider ignores it. */
export type RuleReader={provider:RuleProvider;status:'loaded'|'shadowed'|'on-demand'|'not-read';reason?:'claude-md'|'override'|'linked'|'paths'|'apply-to'};
export type ProjectDocument = {path:string; name:string; kind:'rules'|'changelog'; source:string; appliesTo:'all'|'claude'|'codex'|'copilot'; bytes:number; builtIn?:boolean; readers?:RuleReader[]; scope?:string; lines?:number};
const maxDocuments=150, maxEntries=2000, maxBytes=1024*1024;
const rootRules = new Set(['agents.md','agents.override.md','claude.md','claude.local.md','rules.md']);
const changelogNames=new Set(['changelog.md','changes.md','history.md']);
const providers:RuleProvider[]=['claude','codex','copilot'];
const run=promisify(execFile);
const builtInDocument=():ProjectDocument=>({path:builtInBoardRulePath,name:'Board maintenance',kind:'rules',source:'Pocket Code',appliesTo:'all',bytes:Buffer.byteLength(boardInstructions),builtIn:true,readers:providers.map(provider=>({provider,status:'loaded'}))});
export const documentVersion=(content:string)=>createHash('sha1').update(content).digest('hex').slice(0,16);

/** Rules lists Git projects with authored rules first; projects that only have the built-in rule follow, marked as such. Files lists every Git project. */
export async function documentProjects(folders:string[],kind:'rules'|'changelog'|'files') {
  const result:{root:string;name:string;documents:ProjectDocument[];builtInOnly?:boolean}[]=[];
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<folders.length){const root=folders[cursor++];try{
      const git=await run('git',['-C',root,'rev-parse','--is-inside-work-tree'],{timeout:3000,windowsHide:true,maxBuffer:4096});
      if(git.stdout.trim()!=='true')continue;
      if(kind==='files'){result.push({root,name:path.basename(root),documents:[]});continue;}
      const documents=(await projectDocuments(root)).documents.filter(item=>item.kind===kind&&!item.builtIn);
      if(documents.length)result.push({root,name:path.basename(root),documents});
      else if(kind==='rules')result.push({root,name:path.basename(root),documents:[],builtInOnly:true});
    }catch{/* Inaccessible and non-Git folders are not document projects. */}}
  }));
  return result.sort((a,b)=>Number(Boolean(a.builtInOnly))-Number(Boolean(b.builtInOnly))||a.name.localeCompare(b.name)||a.root.localeCompare(b.root));
}

/** Scope from rule frontmatter: Claude `paths`, Copilot `applyTo`, Cursor-style `globs`. */
async function frontmatterScope(file:string) {
  const handle=await open(file,'r');
  try{const buffer=Buffer.alloc(4096);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);const text=buffer.subarray(0,bytesRead).toString('utf8').replace(/^\uFEFF/,'');
    const block=/^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];if(!block)return undefined;
    const match=/^(paths|applyTo|globs)[ \t]*:[ \t]*(.*)$/m.exec(block);if(!match)return undefined;
    const inline=match[2].trim().replace(/^\[|\]$/g,'').replace(/["']/g,'').trim();
    if(inline)return inline.slice(0,160);
    const list=block.slice(match.index+match[0].length).split(/\r?\n/).map(line=>/^\s*-\s*(.+)$/.exec(line)?.[1]?.replace(/["']/g,'').trim()).filter(Boolean);
    return list.length?list.join(', ').slice(0,160):undefined;
  }finally{await handle.close();}
}
async function lineCount(file:string,bytes:number) {
  if(bytes>maxBytes)return undefined;
  const handle=await open(file,'r');
  try{const buffer=Buffer.alloc(bytes);const {bytesRead}=await handle.read(buffer,0,bytes,0);let lines=bytesRead?1:0;for(let i=0;i<bytesRead;i++)if(buffer[i]===10&&i<bytesRead-1)lines++;return lines;}finally{await handle.close();}
}

/** Which provider reads a file, following each provider's documented discovery (root files, scoped rules, overrides). */
function resolveReaders(doc:ProjectDocument,present:Set<string>):RuleReader[] {
  const lower=doc.path.toLowerCase(),scoped=Boolean(doc.scope);
  const read=(claude:RuleReader['status'],codex:RuleReader['status'],copilot:RuleReader['status'],reason?:RuleReader['reason']):RuleReader[]=>[['claude',claude],['codex',codex],['copilot',copilot]].map(([provider,status])=>({provider:provider as RuleProvider,status:status as RuleReader['status'],...(status==='shadowed'||status==='on-demand'?{reason}:{})}));
  if(lower==='agents.md'){
    const claude:RuleReader=present.has('claude.md')?{provider:'claude',status:'shadowed',reason:'claude-md'}:{provider:'claude',status:'loaded'};
    const codex:RuleReader=present.has('agents.override.md')?{provider:'codex',status:'shadowed',reason:'override'}:{provider:'codex',status:'loaded'};
    return [claude,codex,{provider:'copilot',status:'loaded'}];
  }
  if(lower==='agents.override.md')return read('not-read','loaded','not-read');
  if(lower==='claude.md')return read('loaded','not-read','loaded');
  if(lower==='claude.local.md'||lower==='.claude/claude.md')return read('loaded','not-read','not-read');
  if(lower.startsWith('.claude/rules/'))return scoped?read('on-demand','not-read','not-read','paths'):read('loaded','not-read','not-read');
  if(lower==='.github/copilot-instructions.md')return read('not-read','not-read','loaded');
  if(lower.startsWith('.github/instructions/'))return read('not-read','not-read',scoped?'on-demand':'loaded','apply-to');
  // RULES.md, rules/, .agents/rules and .codex/rules Markdown are not discovered automatically; an agent reads them when another rule links to them.
  return read('on-demand','on-demand','on-demand','linked');
}
const appliesTo=(readers:RuleReader[]):ProjectDocument['appliesTo']=>{const active=readers.filter(item=>item.status==='loaded'||item.status==='on-demand'&&item.reason!=='linked').map(item=>item.provider);return active.length===1?active[0]:'all';};

/** Discovery stays within the selected project and never traverses dependency trees. */
export async function projectDocuments(project:string) {
  const documents:ProjectDocument[]=[builtInDocument()]; let visited=0,truncated=false;
  async function entries(relative:string) {
    if(visited>=maxEntries){truncated=true;return [];}
    const folder=path.join(project,relative);
    try {
      if((await lstat(folder)).isSymbolicLink()||!within(project,await realpath(folder)))return [];
      const found:Dirent[]=[];
      for await(const entry of await opendir(folder)) {
        if(visited>=maxEntries){truncated=true;break;}
        ++visited;found.push(entry);
      }
      return found.sort((a,b)=>a.name.localeCompare(b.name));
    } catch(error:any) {if(['ENOENT','ENOTDIR'].includes(error.code))return [];throw error;}
  }
  async function add(relative:string,kind:ProjectDocument['kind']) {
    if(documents.length>=maxDocuments){truncated=true;return;}
    const file=path.join(project,relative);
    try {
      const info=await lstat(file);
      if(!info.isFile()||info.isSymbolicLink()||!within(project,await realpath(file)))return;
      const normalized=relative.split(path.sep).join('/'),lower=normalized.toLowerCase();
      const scope=kind==='rules'&&/^\.(claude\/rules|github\/instructions)\//.test(lower)?await frontmatterScope(file).catch(()=>undefined):undefined;
      const lines=kind==='rules'&&/^(\.claude\/)?(claude|agents)(\.override|\.local)?\.md$/.test(lower)?await lineCount(file,info.size).catch(()=>undefined):undefined;
      documents.push({path:normalized,name:path.basename(relative),kind,source:path.dirname(relative)==='.'?'Project root':path.dirname(relative).split(path.sep).join('/'),appliesTo:'all',bytes:info.size,...(scope?{scope}:{}),...(lines!==undefined?{lines}:{})});
    } catch(error:any) {if(error.code!=='ENOENT')throw error;}
  }
  async function rules(relative:string,depth=0,pattern=/\.md$/i) {
    for(const entry of await entries(relative)) {
      if(documents.length>=maxDocuments){truncated=true;break;}
      if(entry.isSymbolicLink()||['node_modules','.git'].includes(entry.name.toLowerCase()))continue;
      const child=path.join(relative,entry.name);
      if(entry.isDirectory()){if(depth<5)await rules(child,depth+1,pattern);else truncated=true;}
      else if(entry.isFile()&&pattern.test(entry.name))await add(child,'rules');
    }
  }
  for(const entry of await entries('')) {
    if(entry.isSymbolicLink())continue;
    const lower=entry.name.toLowerCase();
    if(entry.isFile()&&rootRules.has(lower))await add(entry.name,'rules');
    else if(entry.isFile()&&changelogNames.has(lower))await add(entry.name,'changelog');
    else if(entry.isDirectory()&&lower==='.claude'){for(const item of await entries(entry.name))if(item.isFile()&&!item.isSymbolicLink()&&item.name.toLowerCase()==='claude.md')await add(path.join(entry.name,item.name),'rules');await rules(path.join(entry.name,'rules'));}
    else if(entry.isDirectory()&&(lower==='.codex'||lower==='.agents'))await rules(path.join(entry.name,'rules'));
    else if(entry.isDirectory()&&lower==='.github'){
      for(const item of await entries(entry.name))if(item.isFile()&&!item.isSymbolicLink()&&item.name.toLowerCase()==='copilot-instructions.md')await add(path.join(entry.name,item.name),'rules');
      await rules(path.join(entry.name,'instructions'),0,/\.instructions\.md$/i);
    }
    else if(entry.isDirectory()&&lower==='rules')await rules(entry.name);
    else if(entry.isDirectory()&&lower==='docs')for(const doc of await entries(entry.name)) {
      if(doc.isFile()&&!doc.isSymbolicLink()&&changelogNames.has(doc.name.toLowerCase()))await add(path.join(entry.name,doc.name),'changelog');
    }
  }
  const present=new Set(documents.map(doc=>doc.path.toLowerCase()));
  for(const doc of documents)if(doc.kind==='rules'&&!doc.builtIn){doc.readers=resolveReaders(doc,present);doc.appliesTo=appliesTo(doc.readers);}
  documents.sort((a,b)=>a.kind.localeCompare(b.kind)||a.path.localeCompare(b.path));
  return {project,documents,truncated};
}

/** `known` is the version the client already shows; an unchanged document answers without its content. */
export type ProjectDocumentContent=ProjectDocument&{version:string;content?:string;unchanged?:true};
export async function readProjectDocument(project:string,relative:string,known?:string):Promise<ProjectDocumentContent> {
  if(relative===builtInBoardRulePath){const version=documentVersion(boardInstructions);return known===version?{...builtInDocument(),version,unchanged:true as const}:{...builtInDocument(),version,content:boardInstructions};}
  if(relative.includes('\\')||relative.split('/').some(part=>!part||part==='.'||part==='..')||path.isAbsolute(relative))throw new HttpError(400,'Invalid project document path');
  const doc=(await projectDocuments(project)).documents.find(item=>item.path===relative);
  if(!doc)throw new HttpError(404,'Project document not found');
  const file=await realpath(path.join(project,relative));
  if(!within(project,file))throw new HttpError(403,'Document is outside the selected project');
  const handle=await open(file,'r');
  try {
    const info=await handle.stat();
    if(!info.isFile())throw new HttpError(400,'Select a Markdown file');
    if(info.size>maxBytes)throw new HttpError(413,'Project documents can be viewed up to 1 MB');
    // Bound allocation/read even when another process grows the document during this request.
    const buffer=Buffer.alloc(maxBytes+1);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
    if(bytesRead>maxBytes)throw new HttpError(413,'Project documents can be viewed up to 1 MB');
    const bytes=buffer.subarray(0,bytesRead);
    if(bytes.includes(0))throw new HttpError(415,'This file is not a UTF-8 Markdown document');
    let content:string;
    try {content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);} catch {throw new HttpError(415,'This file is not a UTF-8 Markdown document');}
    content=content.replace(/^\uFEFF/,'');const version=documentVersion(content);
    return known===version?{...doc,bytes:bytesRead,version,unchanged:true as const}:{...doc,bytes:bytesRead,version,content};
  } finally {await handle.close();}
}
