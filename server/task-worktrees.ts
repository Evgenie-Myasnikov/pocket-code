import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,realpath,lstat,readFile,readlink} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {allowedPath,HttpError,within} from './security.js';
import {isolatedGitEnvironment} from './git-environment.js';

const execute=promisify(execFile);
const runIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type TaskWorktree={runId:string;projectPath:string;repositoryRoot:string;cwd:string;branch:string;baseCommit:string};
export type TaskSnapshot={baseCommit:string;headCommit:string;branch:string;fingerprint:string};
const key=(value:string)=>process.platform==='win32'?value.toLowerCase():value;
const same=(left:string,right:string)=>key(path.resolve(left))===key(path.resolve(right));
async function git(cwd:string,args:string[],overrides:string[]=[],maxBuffer=4_000_000){
  return (await execute('git',['--no-optional-locks','--literal-pathspecs','-c',`safe.directory=${cwd}`,'-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null',...overrides,'-C',cwd,...args],{env:isolatedGitEnvironment(),windowsHide:true,timeout:30_000,maxBuffer})).stdout;
}
async function filterOverrides(cwd:string){
  let keys='';
  try{keys=await git(cwd,['config','--null','--name-only','--get-regexp','^filter\\.']);}
  catch(error:any){if(error.code!==1)throw new HttpError(400,'Could not inspect Git filters safely.');}
  const names=new Set(keys.split('\0').filter(Boolean).map(value=>value.slice(0,value.lastIndexOf('.'))));
  if(names.size>200)throw new HttpError(400,'Too many Git filters for an isolated task.');
  return [...names].flatMap(name=>['-c',`${name}.clean=`,'-c',`${name}.smudge=`,'-c',`${name}.process=`,'-c',`${name}.required=false`]);
}
async function exists(location:string){try{await lstat(location);return true;}catch(error:any){if(error.code==='ENOENT')return false;throw error;}}

/** Isolates source edits. This is not a security sandbox for commands run by an agent. */
export class TaskWorktrees{
  private pending=new Map<string,Promise<TaskWorktree>>();
  constructor(private directory:string,private roots:string[]){}
  private async home(){
    await mkdir(this.directory,{recursive:true,mode:0o700});
    const result=await realpath(this.directory);
    if(!same(result,this.directory))throw new HttpError(400,'Task storage must not be a redirected directory.');
    return result;
  }
  private location(home:string,repositoryRoot:string,id:string){
    if(!runIdPattern.test(id))throw new HttpError(400,'Invalid task run identifier.');
    return path.join(home,createHash('sha256').update(key(repositoryRoot)).digest('hex').slice(0,20),id);
  }
  create(runId:string,input:string):Promise<TaskWorktree>{
    if(!runIdPattern.test(runId))return Promise.reject(new HttpError(400,'Invalid task run identifier.'));
    const pending=this.pending.get(runId);if(pending)return pending;
    const request=this.createIsolated(runId,input).finally(()=>this.pending.delete(runId));
    this.pending.set(runId,request);return request;
  }
  private async createIsolated(runId:string,input:string):Promise<TaskWorktree>{
    const projectPath=await allowedPath(this.roots,input,true);
    let repositoryRoot:string,baseCommit:string;
    try{
      repositoryRoot=await realpath((await git(projectPath,['rev-parse','--show-toplevel'])).trim());
      // Do not widen a shared subfolder to otherwise unshared siblings.
      await allowedPath(this.roots,repositoryRoot,true);
      baseCommit=(await git(repositoryRoot,['rev-parse','--verify','HEAD^{commit}'])).trim();
      if(!/^[0-9a-f]{40,64}$/i.test(baseCommit))throw new Error('Invalid commit');
    }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'An isolated task requires a Git repository with a committed HEAD.');}
    const home=await this.home();
    if(within(repositoryRoot,home)||within(home,repositoryRoot))throw new HttpError(400,'Task storage must be outside the source repository.');
    const cwd=this.location(home,repositoryRoot,runId),branch=`pocket-code/task-${runId}`;
    await mkdir(path.dirname(cwd),{recursive:true,mode:0o700});
    if(!same(await realpath(path.dirname(cwd)),path.dirname(cwd)))throw new HttpError(400,'Task storage was redirected.');
    if(await exists(cwd))throw new HttpError(409,'This task directory already exists. It has been preserved; choose a new run.');
    try{await git(repositoryRoot,['show-ref','--verify','--quiet',`refs/heads/${branch}`]);throw new HttpError(409,'This task branch already exists. It has been preserved; choose a new run.');}
    catch(error:any){if(error instanceof HttpError)throw error;if(error.code!==1)throw new HttpError(400,'Could not inspect the task branch.');}
    try{await git(repositoryRoot,['worktree','add','-b',branch,'--',cwd,baseCommit],await filterOverrides(repositoryRoot));}
    catch{throw new HttpError(409,'Could not create the isolated worktree. Existing files and branches have been preserved.');}
    const worktree={runId,projectPath,repositoryRoot,cwd,branch,baseCommit};
    await this.verify(worktree);return worktree;
  }
  /** Validate a persisted worktree before adding this one path to an operation's allowed roots. */
  async verify(worktree:TaskWorktree){
    const source=await allowedPath(this.roots,worktree.repositoryRoot,true);
    const home=await this.home(),expected=this.location(home,source,worktree.runId);
    if(!same(expected,worktree.cwd)||!within(home,expected)||worktree.branch!==`pocket-code/task-${worktree.runId}`)throw new HttpError(403,'This path is not an owned task worktree.');
    try{
      const cwd=await realpath(worktree.cwd);
      if(!same(cwd,expected)||!same(await realpath(path.dirname(cwd)),path.dirname(expected)))throw new Error('Redirected path');
      const [top,common,sourceCommon,branch]=await Promise.all([
        git(cwd,['rev-parse','--show-toplevel']),git(cwd,['rev-parse','--path-format=absolute','--git-common-dir']),
        git(source,['rev-parse','--path-format=absolute','--git-common-dir']),git(cwd,['symbolic-ref','--short','HEAD']),
      ]);
      if(!same(top.trim(),cwd)||!same(await realpath(common.trim()),await realpath(sourceCommon.trim()))||branch.trim()!==worktree.branch)throw new Error('Replaced worktree');
      return cwd;
    }catch{throw new HttpError(409,'The task worktree is missing, redirected or on another branch. Restore it before continuing.');}
  }
  async snapshot(worktree:TaskWorktree):Promise<TaskSnapshot>{
    const cwd=await this.verify(worktree),overrides=await filterOverrides(cwd);
    try{
      const [head,working,staged,untracked]=await Promise.all([
        git(cwd,['rev-parse','--verify','HEAD^{commit}']),
        git(cwd,['diff','--binary','--full-index','--no-ext-diff','--no-textconv','HEAD','--'],overrides,32_000_000),
        git(cwd,['diff','--cached','--binary','--full-index','--no-ext-diff','--no-textconv','--'],overrides,32_000_000),
        git(cwd,['ls-files','--others','--exclude-standard','-z'],overrides),
      ]);
      const hash=createHash('sha256');
      for(const text of [head,working,staged])hash.update(String(Buffer.byteLength(text))).update(':').update(text);
      const names=untracked.split('\0').filter(Boolean).sort();
      if(names.length>1000)throw new Error('Too many untracked files');
      let bytes=0;
      for(const name of names){
        const location=path.resolve(cwd,name);if(!within(cwd,location))throw new Error('Invalid path');
        const info=await lstat(location);hash.update('\0').update(name).update('\0').update(String(info.mode));
        if(info.isSymbolicLink()){hash.update(await readlink(location));continue;}
        if(!info.isFile()||!within(cwd,await realpath(location))||(bytes+=info.size)>32_000_000)throw new Error('Unsupported verification snapshot');
        hash.update(await readFile(location));
      }
      return {baseCommit:worktree.baseCommit,headCommit:head.trim(),branch:worktree.branch,fingerprint:hash.digest('hex')};
    }catch{throw new HttpError(400,'Could not fingerprint the task changes. Reduce very large or unsupported untracked files before verification.');}
  }
  async fingerprint(worktree:TaskWorktree){return (await this.snapshot(worktree)).fingerprint;}
}
