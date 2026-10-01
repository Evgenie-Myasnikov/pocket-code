import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat,lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {allowedPath,HttpError,within} from './security.js';
const execute=promisify(execFile);
export type ReviewFile={path:string;added:number;removed:number;binary:boolean;untracked:boolean};
const flags=['--no-ext-diff','--no-textconv','--no-renames'];
async function gitContext(roots:string[],input:string) {
  const cwd=await allowedPath(roots,input,true);
  let root=cwd;
  while(true){try{await stat(path.join(root,'.git'));break;}catch{const parent=path.dirname(root);if(parent===root)throw new HttpError(400,'This project is not a Git repository.');root=parent;}}
  const filterOverrides:string[]=[];
  // Reading a worktree diff otherwise runs configured clean/process filters.
  const safeArgs=['--no-optional-locks','--literal-pathspecs','-c',`safe.directory=${root}`,'-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.quotePath=false'];
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
  const changed=async(range:string[])=>{
    try { await execute('git',[...safeArgs,...filterOverrides,'-C',root,'diff',...flags,'--quiet',...range,'--',scope],{windowsHide:true,timeout:15000,maxBuffer:100_000});return false; }
    catch(error:any) { if(error.code===1)return true;throw new HttpError(400,'Could not read this Git comparison. Check the branch or reduce the diff size.'); }
  };
  const scope=path.relative(root,cwd).replaceAll('\\','/')||'.';
  return {git,changed,scope,cwd,root};
}
async function comparisonMetadata(git:Awaited<ReturnType<typeof gitContext>>['git'],base?:string) {
  const [references,current]=await Promise.all([
    git(['for-each-ref','--format=%(refname:short)','refs/heads','refs/remotes']),
    git(['symbolic-ref','--short','HEAD']).then(value=>value.trim(),()=>'HEAD'),
  ]);
  const branches=references.trim().split('\n').filter(Boolean).slice(0,500);
  const comparison=base||branches.find(b=>b==='origin/main')||branches.find(b=>b==='origin/master')||branches.find(b=>b==='main'&&b!==current)||branches.find(b=>b==='master'&&b!==current)||'HEAD';
  return {branches,current,comparison};
}
export async function review(roots:string[],input:string,mode:'working'|'staged'|'branch',base?:string,file?:string) {
  const {git,scope,cwd,root}=await gitContext(roots,input);
  const [{branches,current,comparison},hasHead]=await Promise.all([
    comparisonMetadata(git,base),git(['rev-parse','--verify','HEAD']).then(()=>true,()=>false),
  ]);
  if(mode==='branch' && comparison!=='HEAD' && !branches.includes(comparison))throw new HttpError(400,'Select an existing base branch.');
  const range=mode==='staged'?['--cached']:mode==='branch'?[`${comparison}...HEAD`]:hasHead?['HEAD']:['--cached'];
  const [stats,untracked]=await Promise.all([
    git(['diff',...flags,'--numstat','-z',...range,'--',scope]),
    mode==='working'?git(['ls-files','--others','--exclude-standard','-z','--',scope]):Promise.resolve(''),
  ]);
  const files:ReviewFile[]=stats.split('\0').filter(Boolean).map(row=>{const [add,remove,...name]=row.split('\t');return {path:name.join('\t'),added:Number(add)||0,removed:Number(remove)||0,binary:add==='-',untracked:false};}).filter(item=>within(cwd,path.resolve(root,item.path)));
  if(mode==='working'){
    const newFiles=untracked.split('\0').filter(Boolean);
    for(const name of newFiles)if(within(cwd,path.resolve(root,name)))files.push({path:name,added:0,removed:0,binary:false,untracked:true});
  }
  if(files.length>1000)throw new HttpError(400,'Too many changed files. Narrow the project folder.');
  // A chat may start in a subfolder or a linked worktree. Report the resolved
  // context without widening the comparison to sibling projects in its repo.
  const result={files,current,base:comparison,branches,mode,scope,repositoryRoot:root,projectPath:cwd,patch:'',binary:false};
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
    const {git,changed,scope}=await gitContext(roots,cwd);
    // Availability needs only existence, never line counts or a full patch.
    // Inspect filters once and reuse the same safe Git context for both modes.
    const [untracked,working]=await Promise.all([
      git(['ls-files','--others','--exclude-standard','-z','--',scope]),
      git(['rev-parse','--verify','HEAD']).then(()=>true,()=>false).then(hasHead=>changed(hasHead?['HEAD']:['--cached'])),
    ]);
    if(untracked || working)return {available:true,mode:'working'};
    const {comparison}=await comparisonMetadata(git);
    if(comparison!=='HEAD' && await changed([`${comparison}...HEAD`]))return {available:true,mode:'branch'};
  } catch { /* Non-repositories and unavailable Git comparisons have no actionable Review panel. */ }
  return {available:false,mode:'working'};
}
