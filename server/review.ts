import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {stat,lstat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {allowedPath,HttpError,within} from './security.js';
import {isolatedGitEnvironment} from './git-environment.js';
const execute=promisify(execFile);
/** status: added/deleted/modified come from Git; untracked files are new and not yet in Git. linesUnknown: an untracked file beyond the counting budget. */
export type ReviewFile={path:string;added:number;removed:number;binary:boolean;untracked:boolean;status?:'added'|'deleted'|'modified'|'untracked';generated?:boolean;linesUnknown?:boolean;fingerprint?:string};
export type ReviewOptions={whitespace?:boolean;context?:number};
const flags=['--no-ext-diff','--no-textconv','--no-renames'];
const hash=(value:string)=>createHash('sha1').update(value).digest('hex').slice(0,16);
// Lock files, minified bundles and source maps are noise in a review; .gitattributes linguist-generated adds project-specific ones.
const generatedName=/(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|composer\.lock|Gemfile\.lock|poetry\.lock|Pipfile\.lock|go\.sum|packages\.lock\.json)$|\.min\.(?:js|css|mjs)$|\.js\.map$|\.css\.map$/i;
async function gitContext(roots:string[],input:string) {
  const cwd=await allowedPath(roots,input,true);
  let root=cwd;
  while(true){try{await stat(path.join(root,'.git'));break;}catch{const parent=path.dirname(root);if(parent===root)throw new HttpError(400,'This project is not a Git repository.');root=parent;}}
  const filterOverrides:string[]=[];
  const env=isolatedGitEnvironment();
  // Reading a worktree diff otherwise runs configured clean/process filters.
  const safeArgs=['--no-optional-locks','--literal-pathspecs','-c',`safe.directory=${root}`,'-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.quotePath=false'];
  let filterKeys='';
  // Filters are read on every request: a cached list could miss a filter configured since, and then run it.
  try { filterKeys=(await execute('git',[...safeArgs,'-C',root,'config','--null','--name-only','--get-regexp','^filter\\.'],{env,windowsHide:true,timeout:15000,maxBuffer:100_000})).stdout; }
  catch(error:any) { if(error.code!==1)throw new HttpError(400,'Could not inspect Git filters safely.'); }
  const filters=new Set(filterKeys.split('\0').filter(Boolean).map(key=>key.slice(0,key.lastIndexOf('.'))));
  if(filters.size>200)throw new HttpError(400,'Too many Git filters to inspect this comparison safely.');
  for(const name of filters)filterOverrides.push('-c',`${name}.clean=`,'-c',`${name}.process=`,'-c',`${name}.required=false`);
  const git=async(args:string[],maxBuffer=3_000_000)=>{
    try{return (await execute('git',[...safeArgs,...filterOverrides,'-C',root,...args],{env,windowsHide:true,timeout:15000,maxBuffer})).stdout;}
    catch{throw new HttpError(400,'Could not read this Git comparison. Check the branch or reduce the diff size.');}
  };
  /** Feeds NUL-separated paths on stdin, so a long file list never hits the Windows command-line limit. */
  const gitInput=(args:string[],input:string)=>new Promise<string>(resolve=>{
    const child=execFile('git',[...safeArgs,...filterOverrides,'-C',root,...args],{env,windowsHide:true,timeout:15000,maxBuffer:3_000_000},(error,stdout)=>resolve(error?'':String(stdout)));
    child.stdin?.on('error',()=>{});child.stdin?.end(input);
  });
  const changed=async(range:string[])=>{
    try { await execute('git',[...safeArgs,...filterOverrides,'-C',root,'diff',...flags,'--quiet',...range,'--',scope],{env,windowsHide:true,timeout:15000,maxBuffer:100_000});return false; }
    catch(error:any) { if(error.code===1)return true;throw new HttpError(400,'Could not read this Git comparison. Check the branch or reduce the diff size.'); }
  };
  const scope=path.relative(root,cwd).replaceAll('\\','/')||'.';
  return {git,gitInput,changed,scope,cwd,root};
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
/** Size and modification time identify a working-tree file version without reading it. */
async function fileStamp(location:string){try{const info=await lstat(location);return `${info.size}:${info.mtimeMs}`;}catch{return 'missing';}}
/** Line counts for new, untracked text files, within a budget so a large untracked folder stays cheap. */
async function untrackedLines(location:string,budget:{files:number;bytes:number}){
  try{
    const info=await lstat(location);
    if(!info.isFile()||info.isSymbolicLink()||info.size>1_000_000)return {binary:true,added:0};
    if(info.size>256_000||budget.files<=0||budget.bytes<info.size)return {binary:false,added:0,linesUnknown:true};
    budget.files--;budget.bytes-=info.size;
    const buffer=await readFile(location);if(buffer.includes(0))return {binary:true,added:0};
    const text=buffer.toString('utf8');return {binary:false,added:text?text.split('\n').length-(text.endsWith('\n')?1:0):0};
  }catch{return {binary:false,added:0,linesUnknown:true};}
}
export async function review(roots:string[],input:string,mode:'working'|'staged'|'branch'|'task',base?:string,file?:string,options:ReviewOptions={}) {
  const {git,gitInput,scope,cwd,root}=await gitContext(roots,input);
  const single=file!==undefined;
  if(base?.startsWith('-'))throw new HttpError(400,'Select an existing base branch.');
  if(single&&!within(cwd,path.resolve(root,file)))throw new HttpError(404,'This file is not in the current comparison.');
  // A single file never needs the branch list; only a branch comparison needs the references to choose its base.
  const [{branches,current,comparison},head]=await Promise.all([
    single&&!(mode==='branch'&&!base)?git(['symbolic-ref','--short','HEAD']).then(value=>value.trim(),()=>'HEAD').then(current=>({branches:[] as string[],current,comparison:base||'HEAD'})):comparisonMetadata(git,base),
    git(['rev-parse','--verify','HEAD']).then(value=>value.trim(),()=>''),
  ]);
  const hasHead=!!head;
  if(mode==='branch' && comparison!=='HEAD' && !single && !branches.includes(comparison))throw new HttpError(400,'Select an existing base branch.');
  if(mode==='branch' && single && comparison!=='HEAD' && !(await git(['rev-parse','--verify','--quiet',comparison+'^{commit}']).then(()=>true,()=>false)))throw new HttpError(400,'Select an existing base branch.');
  if(mode==='task'&&(!base||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(base)||(await git(['rev-parse','--verify',base+'^{commit}'])).trim()!==base))throw new HttpError(400,'The task baseline commit is unavailable.');
  const range=mode==='task'?[base!]:mode==='staged'?['--cached']:mode==='branch'?[`${comparison}...HEAD`]:hasHead?['HEAD']:['--cached'];
  const whitespace=options.whitespace?['--ignore-all-space']:[];
  const pathspec=single?file:scope,worktree=mode==='working'||mode==='task';
  const [stats,raw,untracked]=await Promise.all([
    git(['diff',...flags,...whitespace,'--numstat','-z',...range,'--',pathspec]),
    git(['diff',...flags,'--raw','-z',...range,'--',pathspec]),
    worktree?git(['ls-files','--others','--exclude-standard','-z','--',pathspec]):Promise.resolve(''),
  ]);
  // --raw -z: ":old-mode new-mode old-blob new-blob STATUS\0path\0"; the blobs identify index and commit versions.
  const rawParts=raw.split('\0'),rawRows=new Map<string,string>();
  for(let i=0;i+1<rawParts.length;i+=2)if(rawParts[i].startsWith(':'))rawRows.set(rawParts[i+1],rawParts[i]);
  const statusOf=(name:string):ReviewFile['status']=>{const letter=rawRows.get(name)?.trim().split(/\s+/).at(-1)?.[0];return letter==='A'?'added':letter==='D'?'deleted':'modified';};
  const files:ReviewFile[]=stats.split('\0').filter(Boolean).map(row=>{const [add,remove,...name]=row.split('\t');const file=name.join('\t');return {path:file,added:Number(add)||0,removed:Number(remove)||0,binary:add==='-',untracked:false,status:statusOf(file),fingerprint:row+'|'+(rawRows.get(file)||'')};}).filter(item=>within(cwd,path.resolve(root,item.path)));
  // With whitespace ignored, numstat still lists files, so status-only changes stay visible.
  for(const [name,row] of rawRows)if(!files.some(item=>item.path===name)&&within(cwd,path.resolve(root,name)))files.push({path:name,added:0,removed:0,binary:false,untracked:false,status:statusOf(name),fingerprint:row});
  if(worktree){
    const budget={files:200,bytes:2_000_000};
    for(const name of untracked.split('\0').filter(Boolean))if(within(cwd,path.resolve(root,name))){
      const counted=single?{binary:false,added:0}:await untrackedLines(path.resolve(root,name),budget);
      files.push({path:name,added:counted.added,removed:0,binary:counted.binary,untracked:true,status:'untracked',...('linesUnknown' in counted&&counted.linesUnknown?{linesUnknown:true}:{}),fingerprint:'untracked'});
    }
  }
  if(files.length>1000)throw new HttpError(400,'Too many changed files. Narrow the project folder.');
  // Working-tree versions have no blob id in --raw; their size and time say whether the agent wrote the file again.
  await Promise.all(files.map(async item=>{item.fingerprint=hash((item.fingerprint||'')+(worktree?'|'+await fileStamp(path.resolve(root,item.path)):'')+'|'+(options.whitespace?'w':''));if(generatedName.test(item.path))item.generated=true;}));
  if(!single&&files.length&&files.some(item=>!item.generated)){
    const output=await gitInput(['check-attr','-z','--stdin','linguist-generated'],files.map(item=>item.path).join('\0')+'\0');
    const parts=output.split('\0');for(let i=0;i+2<parts.length;i+=3)if(parts[i+2]==='set'||parts[i+2]==='true'){const match=files.find(item=>item.path===parts[i]);if(match)match.generated=true;}
  }
  // A cheap identity of the whole comparison: the client re-downloads patches only when this or a file's own fingerprint changes.
  const fingerprint=hash([mode,comparison,head,options.whitespace?'w':'',...files.map(item=>item.path+'\t'+item.fingerprint+'\t'+item.added+'\t'+item.removed)].join('\n'));
  // A chat may start in a subfolder or a linked worktree. Report the resolved
  // context without widening the comparison to sibling projects in its repo.
  const result={files,current,base:comparison,branches,mode,scope,repositoryRoot:root,projectPath:cwd,patch:'',binary:false,fingerprint};
  if(!single)return result;
  const selected=files.find(item=>item.path===file);if(!selected)throw new HttpError(404,'This file is not in the current comparison.');
  if(selected.untracked){
    const location=path.resolve(root,file),info=await lstat(location);
    if(!info.isFile()||info.isSymbolicLink()||info.size>1_000_000)return {...result,binary:true};
    await allowedPath(roots,location);
    const buffer=await readFile(location);if(buffer.includes(0))return {...result,binary:true};
    const lines=buffer.toString('utf8').split('\n');if(lines.at(-1)==='')lines.pop();selected.added=lines.length;
    return {...result,patch:`@@ -0,0 +1,${lines.length} @@\n`+lines.map(line=>'+'+line).join('\n')};
  }
  const context=Math.max(0,Math.min(100_000,Math.round(options.context??3)));
  return {...result,binary:selected.binary,patch:await git(['diff',...flags,...whitespace,`--unified=${context}`,...range,'--',file])};
}

export type ReviewAvailability={available:boolean;mode:'working'|'branch';added?:number;removed?:number;files?:number};
/** "1 file changed, 2 insertions(+), 1 deletion(-)" */
function shortStat(text:string){const number=(pattern:RegExp)=>Number(text.match(pattern)?.[1]||0);return {files:number(/(\d+) files? changed/),added:number(/(\d+) insertions?\(\+\)/),removed:number(/(\d+) deletions?\(-\)/)};}
export async function reviewAvailability(roots:string[],input:string):Promise<ReviewAvailability> {
  // Validate first: an unavailable comparison must not turn an out-of-scope path into success.
  const cwd=await allowedPath(roots,input,true);
  try {
    const {git,changed,scope}=await gitContext(roots,cwd);
    // Availability first needs only existence; the size for the Review button is read only when there is something to show.
    // Inspect filters once and reuse the same safe Git context for both modes.
    const [untracked,working]=await Promise.all([
      git(['ls-files','--others','--exclude-standard','-z','--',scope]),
      git(['rev-parse','--verify','HEAD']).then(()=>true,()=>false).then(async hasHead=>({hasHead,changed:await changed(hasHead?['HEAD']:['--cached'])})),
    ]);
    if(untracked || working.changed){
      const newFiles=untracked.split('\0').filter(Boolean).length;
      const size=working.changed?shortStat(await git(['diff',...flags,'--shortstat',...(working.hasHead?['HEAD']:['--cached']),'--',scope]).catch(()=>'')):{files:0,added:0,removed:0};
      return {available:true,mode:'working',added:size.added,removed:size.removed,files:size.files+newFiles};
    }
    const {comparison}=await comparisonMetadata(git);
    if(comparison!=='HEAD' && await changed([`${comparison}...HEAD`])){
      const size=shortStat(await git(['diff',...flags,'--shortstat',`${comparison}...HEAD`,'--',scope]).catch(()=>''));
      return {available:true,mode:'branch',...size};
    }
  } catch { /* Non-repositories and unavailable Git comparisons have no actionable Review panel. */ }
  return {available:false,mode:'working'};
}
