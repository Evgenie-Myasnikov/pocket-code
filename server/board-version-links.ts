import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {z} from 'zod';

export const versionBranches=z.record(z.string().min(1).max(300),z.string().min(1).max(300)).refine(v=>Object.keys(v).length<=40).optional();
const exec=promisify(execFile);
export async function linkBoardVersions(root:string,versions:string[],saved:Record<string,string>={}){
 const links:Record<string,string>={};
 const options={cwd:root,windowsHide:true,timeout:10000,maxBuffer:1024*1024};
 try{
  const {stdout:top}=await exec('git',['rev-parse','--show-toplevel'],options);
  if(path.resolve(top.trim()).toLowerCase()!==path.resolve(root).toLowerCase())return links;
  const {stdout}=await exec('git',['for-each-ref','--format=%(refname)','refs/heads','refs/remotes'],options);
  const branches=new Set(stdout.trim().split(/\r?\n/).filter(n=>n&&!n.endsWith('/HEAD')).map(n=>n.replace(/^refs\/heads\//,'').replace(/^refs\/remotes\/[^/]+\//,'')));
  let changelog='';for(const file of ['CHANGELOG.md','changelog.md'])try{changelog=await readFile(path.join(root,file),'utf8');break;}catch(e:any){if(e.code!=='ENOENT')throw e;}
  const entries=changelog.split(/(?=^## )/m);
  for(const version of versions){
   const entry=entries.find(e=>{const heading=e.split(/\r?\n/)[0];return heading.match(/^## \[?([^\]\s(]+)/)?.[1]===version||heading.match(/\((\d+\.\d+\.\d+)\)/)?.[1]===version;});
   const recorded=entry?.match(/\bbranch \[([^\]]+)\]\(https?:\/\/[^\s)]+\/tree\/[^\s)]+\)/i)?.[1];
   let candidate=saved[version]||recorded||(branches.has(version)?version:undefined);
   if(!candidate&&/^\d+\.\d+\.\d+$/.test(version)){
    const suffix=new RegExp('(?:^|[-/])v?'+version.replaceAll('.','\\.')+'$');
    const matches=[...branches].filter(b=>suffix.test(b));
    if(matches.length===1){
     const ref=stdout.split(/\r?\n/).find(r=>r==='refs/heads/'+matches[0]||r.replace(/^refs\/remotes\/[^/]+\//,'')===matches[0]);
     try{await exec('git',['merge-base','--is-ancestor','refs/tags/v'+version,ref!],options);candidate=matches[0];}catch{/* A name alone is not release evidence. */}
    }
   }
   if(candidate&&branches.has(candidate))links[version]=candidate;
  }
 }catch{/* Unavailable Git never turns a planned label into a branch. */}
 return links;
}
