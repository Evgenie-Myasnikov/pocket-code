import {z} from 'zod';
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
export type ReviewOptions={whitespace?:boolean;context?:number;paths?:string[];offset?:number};
const queryPath=z.string().min(1).max(4096);
export const reviewQuery=z.object({
  file:queryPath.optional(),
  path:z.union([queryPath,z.array(queryPath).min(1).max(100)]).transform(value=>typeof value==='string'?[value]:value).optional(),
  offset:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  whitespace:z.enum(['0','1']).optional(),context:z.coerce.number().int().min(0).max(100000).optional(),
});
const pageSize=1000;
function pathBatches(paths:string[]){
  const batches:string[][]=[];
  let size=0;
  for(const name of paths){
    if(!batches.length||size+name.length>12_000){batches.push([]);size=0;}
    batches[batches.length-1].push(name);size+=name.length+3;
  }
  return batches;
}
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
/** Count new text files within the page's shared byte and file budget. */
async function untrackedLines(location:string,info:Awaited<ReturnType<typeof lstat>>|undefined,budget:{files:number;bytes:number}){
  if(!info)return {added:0,binary:false,linesUnknown:true};
  if(!info.isFile()||info.isSymbolicLink()||info.size>1_000_000)return {added:0,binary:true};
  if(info.size>256_000||budget.files<=0||budget.bytes<Number(info.size))return {added:0,binary:false,linesUnknown:true};
  budget.files--;budget.bytes-=Number(info.size);
  try{
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
  const selectedPaths=options.paths?.map(name=>{
    const location=path.resolve(cwd,name);
    if(!name||name.includes('\0')||path.isAbsolute(name)||/^(?:[A-Za-z]:|[\\/])/.test(name)||!within(cwd,location)||location===cwd){
      throw new HttpError(400,'Select files inside the current project.');
    }
    return path.relative(root,location).split(path.sep).join('/');
  });
  const requested=selectedPaths?new Set(selectedPaths):undefined;
  if(requested&&!requested.size)throw new HttpError(400,'Select at least one file.');
  if(single&&requested&&!requested.has(file))throw new HttpError(404,'This file is not in the current comparison.');
  const pathspecs=single?[file]:requested?[...requested]:[scope],worktree=mode==='working'||mode==='task';
  const rawRows=new Map<string,string>(),untrackedNames=new Set<string>();
  const permitted=(name:string)=>within(cwd,path.resolve(root,name))&&(!requested||requested.has(name));
  for(const batch of pathBatches(pathspecs)){
    const [raw,untracked]=await Promise.all([
      git(['diff',...flags,'--raw','-z',...range,'--',...batch]),
      worktree?git(['ls-files','--others','--exclude-standard','-z','--',...batch]):Promise.resolve(''),
    ]);
    const parts=raw.split('\0');
    for(let i=0;i+1<parts.length;i+=2)if(parts[i].startsWith(':')&&permitted(parts[i+1]))rawRows.set(parts[i+1],parts[i]);
    for(const name of untracked.split('\0'))if(name&&permitted(name))untrackedNames.add(name);
  }
  const names=[...rawRows.keys(),...untrackedNames],totalFiles=names.length;
  const offset=single?0:options.offset??0;
  const page=names.slice(offset,offset+pageSize),stats=new Map<string,string>();
  for(const batch of pathBatches(page.filter(name=>rawRows.has(name)))){
    const output=await git(['diff',...flags,...whitespace,'--numstat','-z',...range,'--',...batch]);
    for(const row of output.split('\0'))if(row){const name=row.slice(row.indexOf('\t',row.indexOf('\t')+1)+1);stats.set(name,row);}
  }
  const files:ReviewFile[]=[],budget={files:200,bytes:2_000_000};
  for(let start=0;start<page.length;start+=24){
    const slice=page.slice(start,start+24);
    const infos=await Promise.all(slice.map(name=>worktree?lstat(path.resolve(root,name)).catch(()=>undefined):undefined));
    files.push(...await Promise.all(slice.map(async(name,index):Promise<ReviewFile>=>{
      const row=stats.get(name)||'',raw=rawRows.get(name)||'',untracked=untrackedNames.has(name),info=infos[index];
      const [add,remove]=row.split('\t'),letter=raw.trim().split(/\s+/).at(-1)?.[0];
      const counts=untracked&&!single?await untrackedLines(path.resolve(root,name),info,budget):{added:Number(add)||0,binary:add==='-'};
      const stamp=worktree?'|'+(info?info.size+':'+info.mtimeMs:'missing'):'';
      return {path:name,untracked,removed:Number(remove)||0,...counts,status:untracked?'untracked':letter==='A'?'added':letter==='D'?'deleted':'modified',
        fingerprint:hash((untracked?'untracked':row+'|'+raw)+stamp+'|'+(options.whitespace?'w':'')),...(generatedName.test(name)?{generated:true}:{})};
    })));
  }
  if(!single&&files.some(item=>!item.generated)){
    const byName=new Map(files.map(item=>[item.path,item]));
    const output=await gitInput(['check-attr','-z','--stdin','linguist-generated'],page.join('\0')+'\0');
    const parts=output.split('\0');for(let i=0;i+2<parts.length;i+=3)if(parts[i+2]==='set'||parts[i+2]==='true'){const match=byName.get(parts[i]);if(match)match.generated=true;}
  }
  // A cheap identity of the whole comparison: the client re-downloads patches only when this or a file's own fingerprint changes.
  const fingerprint=hash([mode,comparison,head,options.whitespace?'w':'',...files.map(item=>item.path+'\t'+item.fingerprint+'\t'+item.added+'\t'+item.removed)].join('\n'));
  // A chat may start in a subfolder or a linked worktree. Report the resolved
  // context without widening the comparison to sibling projects in its repo.
  const result={files,totalFiles,current,base:comparison,branches,mode,scope,repositoryRoot:root,projectPath:cwd,patch:'',binary:false,fingerprint};
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
