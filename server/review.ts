import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat,lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {allowedPath,HttpError,within} from './security.js';
const execute=promisify(execFile);
export type ReviewFile={path:string;added:number;removed:number;binary:boolean;untracked:boolean};
export async function review(roots:string[],input:string,mode:'working'|'staged'|'branch',base?:string,file?:string) {
  const cwd=await allowedPath(roots,input,true);
  let root=cwd;
  while(true){try{await stat(path.join(root,'.git'));break;}catch{const parent=path.dirname(root);if(parent===root)throw new HttpError(400,'This project is not a Git repository.');root=parent;}}
  const filterOverrides:string[]=[];
  // Reading a worktree diff otherwise runs configured clean/process filters.
  const safeArgs=['--no-optional-locks','-c',`safe.directory=${root}`,'-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.quotePath=false'];
  let filterKeys='';
  try { filterKeys=(await execute('git',[...safeArgs,'-C',root,'config','--null','--name-only','--get-regexp','^filter\\.'],{windowsHide:true,timeout:15000,maxBuffer:100_000})).stdout; }
  catch(error:any) { if(error.code!==1)throw new HttpError(400,'Could not inspect Git filters safely.'); }
  const filters=new Set(filterKeys.split('\0').filter(Boolean).map(key=>key.slice(0,key.lastIndexOf('.'))));
  if(filters.size>200)throw new HttpError(400,'Too many Git filters to inspect this comparison safely.');
  for(const name of filters)filterOverrides.push('-c',`${name}.clean=`,'-c',`${name}.process=`,'-c',`${name}.required=false`);
  const git=async(args:string[],maxBuffer=3_000_000)=>{
    try{return (await execute('git',[...safeArgs,...filterOverrides,'-C',root,...args],{windowsHide:true,timeout:15000,maxBuffer})).stdout;}
    catch{throw new HttpError(400,'Could not read this Git comparison. Check the branch or reduce the diff size.');}
  };
  const scope=path.relative(root,cwd).replaceAll('\\','/')||'.';
  const branches=(await git(['for-each-ref','--format=%(refname:short)','refs/heads','refs/remotes'])).trim().split('\n').filter(Boolean).slice(0,500);
  let current='HEAD';try{current=(await git(['symbolic-ref','--short','HEAD'])).trim();}catch{}
  let hasHead=true;try{await git(['rev-parse','--verify','HEAD']);}catch{hasHead=false;}
  const comparison=base||branches.find(b=>b==='origin/main')||branches.find(b=>b==='origin/master')||branches.find(b=>b==='main'&&b!==current)||branches.find(b=>b==='master'&&b!==current)||'HEAD';
  if(mode==='branch' && comparison!=='HEAD' && !branches.includes(comparison))throw new HttpError(400,'Select an existing base branch.');
  const range=mode==='staged'?['--cached']:mode==='branch'?[`${comparison}...HEAD`]:hasHead?['HEAD']:['--cached'];
  const flags=['--no-ext-diff','--no-textconv','--no-renames'];
  const stats=await git(['diff',...flags,'--numstat','-z',...range,'--',scope]);
  const files:ReviewFile[]=stats.split('\0').filter(Boolean).map(row=>{const [add,remove,...name]=row.split('\t');return {path:name.join('\t'),added:Number(add)||0,removed:Number(remove)||0,binary:add==='-',untracked:false};}).filter(item=>within(cwd,path.resolve(root,item.path)));
  if(mode==='working'){
    const newFiles=(await git(['ls-files','--others','--exclude-standard','-z','--',scope])).split('\0').filter(Boolean);
    for(const name of newFiles)if(within(cwd,path.resolve(root,name)))files.push({path:name,added:0,removed:0,binary:false,untracked:true});
  }
  if(files.length>1000)throw new HttpError(400,'Too many changed files. Narrow the project folder.');
  const result={files,current,base:comparison,branches,mode,scope,patch:'',binary:false};
  if(file===undefined)return result;
  const selected=files.find(item=>item.path===file);if(!selected)throw new HttpError(404,'This file is not in the current comparison.');
  if(selected.untracked){
    const location=path.resolve(root,file),info=await lstat(location);
    if(!info.isFile()||info.isSymbolicLink()||info.size>1_000_000)return {...result,binary:true};
    await allowedPath(roots,location);
    const buffer=await readFile(location);if(buffer.includes(0))return {...result,binary:true};
    const lines=buffer.toString('utf8').split('\n');if(lines.at(-1)==='')lines.pop();selected.added=lines.length;
    return {...result,patch:`@@ -0,0 +1,${lines.length} @@\n`+lines.map(line=>'+'+line).join('\n')};
  }
  return {...result,binary:selected.binary,patch:await git(['diff',...flags,'--unified=3',...range,'--',file])};
}

export async function reviewAvailability(roots:string[],input:string):Promise<{available:boolean;mode:'working'|'branch'}> {
  // Validate first: an unavailable comparison must not turn an out-of-scope path into success.
  const cwd=await allowedPath(roots,input,true);
  try {
    const working=await review(roots,cwd,'working');
    if(working.files.length)return {available:true,mode:'working'};
    if(working.base!=='HEAD' && (await review(roots,cwd,'branch')).files.length)return {available:true,mode:'branch'};
  } catch { /* Non-repositories and unavailable Git comparisons have no actionable Review panel. */ }
  return {available:false,mode:'working'};
}
