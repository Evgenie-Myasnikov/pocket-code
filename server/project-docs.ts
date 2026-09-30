import path from 'node:path';
import {open, opendir, realpath, lstat} from 'node:fs/promises';
import type {Dirent} from 'node:fs';
import {HttpError, within} from './security.js';

export type ProjectDocument = {path:string; name:string; kind:'rules'|'changelog'; source:string; appliesTo:'all'|'claude'|'codex'; bytes:number};
const maxDocuments=150, maxEntries=2000, maxBytes=1024*1024;
const ruleRoots = new Map<string,ProjectDocument['appliesTo']>([['.claude','claude'],['.codex','codex'],['.agents','all']]);
const rootRules = new Map<string,ProjectDocument['appliesTo']>([['agents.md','codex'],['agents.override.md','codex'],['claude.md','claude'],['claude.local.md','claude'],['rules.md','all']]);
const changelogNames=new Set(['changelog.md','changes.md','history.md']);

/** Discovery stays within the selected project and never traverses dependency trees. */
export async function projectDocuments(project:string) {
  const documents:ProjectDocument[]=[]; let visited=0,truncated=false;
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
  async function add(relative:string,kind:ProjectDocument['kind'],appliesTo:ProjectDocument['appliesTo']) {
    if(documents.length>=maxDocuments){truncated=true;return;}
    const file=path.join(project,relative);
    try {
      const info=await lstat(file);
      if(!info.isFile()||info.isSymbolicLink()||!within(project,await realpath(file)))return;
      documents.push({path:relative.split(path.sep).join('/'),name:path.basename(relative),kind,source:path.dirname(relative)==='.'?'Project root':path.dirname(relative).split(path.sep).join('/'),appliesTo,bytes:info.size});
    } catch(error:any) {if(error.code!=='ENOENT')throw error;}
  }
  async function rules(relative:string,appliesTo:ProjectDocument['appliesTo'],depth=0) {
    for(const entry of await entries(relative)) {
      if(documents.length>=maxDocuments){truncated=true;break;}
      if(entry.isSymbolicLink()||['node_modules','.git'].includes(entry.name.toLowerCase()))continue;
      const child=path.join(relative,entry.name);
      if(entry.isDirectory()){if(depth<5)await rules(child,appliesTo,depth+1);else truncated=true;}
      else if(entry.isFile()&&/\.md$/i.test(entry.name))await add(child,'rules',appliesTo);
    }
  }
  for(const entry of await entries('')) {
    if(entry.isSymbolicLink())continue;
    const lower=entry.name.toLowerCase();
    if(entry.isFile()&&rootRules.has(lower))await add(entry.name,'rules',rootRules.get(lower)!);
    else if(entry.isFile()&&changelogNames.has(lower))await add(entry.name,'changelog','all');
    else if(entry.isDirectory()&&ruleRoots.has(lower))await rules(path.join(entry.name,'rules'),ruleRoots.get(lower)!);
    else if(entry.isDirectory()&&lower==='rules')await rules(entry.name,'all');
    else if(entry.isDirectory()&&lower==='docs')for(const doc of await entries(entry.name)) {
      if(doc.isFile()&&!doc.isSymbolicLink()&&changelogNames.has(doc.name.toLowerCase()))await add(path.join(entry.name,doc.name),'changelog','all');
    }
  }
  documents.sort((a,b)=>a.kind.localeCompare(b.kind)||a.path.localeCompare(b.path));
  return {project,documents,truncated};
}

export async function readProjectDocument(project:string,relative:string) {
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
    return {...doc,bytes:bytesRead,content:content.replace(/^\uFEFF/,'')};
  } finally {await handle.close();}
}
