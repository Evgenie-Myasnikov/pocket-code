import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {HttpError} from './security.js';

export type PrPreview={ready:boolean;reason?:string;base:string;head:string;headSha:string;files:string[];commits:number;existing?:{url:string;number:number}};
export type PrCommandRunner=(command:string,args:string[],options:{cwd:string;timeout:number})=>Promise<{stdout:string;stderr?:string}>;
type PrInput={title:string;body:string;base:string;head:string;headSha:string};
type Repository={cwd:string;repo:string;pushUrl:string;git:(args:string[])=>Promise<string>;preview:PrPreview};
const execute=promisify(execFile);
const defaultRun:PrCommandRunner=async(command,args,options)=>{
  const result=await execute(command,args,{...options,windowsHide:true,maxBuffer:2_000_000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GH_PROMPT_DISABLED:'1'}});
  return {stdout:result.stdout};
};
const empty=():PrPreview=>({ready:false,base:'',head:'',headSha:'',files:[],commits:0});
const commitHelp='Ask the agent to commit task changes on a separate branch, then refresh.';
class PrSafetyError extends Error {}
function requireSafe(condition:unknown,message:string):asserts condition {if(!condition)throw new PrSafetyError(message);}
function safeMessage(error:unknown,fallback:string) {return error instanceof PrSafetyError?error.message:fallback;}
function canonical(value:string) {const resolved=path.resolve(value);return process.platform==='win32'?resolved.toLowerCase():resolved;}
function githubRepository(remote:string):string {
  const match=/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(remote);
  requireSafe(match&&!match[1].endsWith('/.')&&!match[1].endsWith('/..'),'Origin must point directly to a GitHub repository without embedded credentials.');
  return match[1];
}
function pullRequest(value:unknown,repo:string):{url:string;number:number}|undefined {
  if(!value||typeof value!=='object')return;
  const candidate=value as {url?:unknown;number?:unknown};
  if(typeof candidate.url!=='string'||typeof candidate.number!=='number'||!Number.isSafeInteger(candidate.number)||candidate.number<1)return;
  return candidate.url.toLowerCase()===`https://github.com/${repo}/pull/${candidate.number}`.toLowerCase()?{url:candidate.url,number:candidate.number}:undefined;
}

export class JiraPullRequests {
  private run:PrCommandRunner;
  constructor(options:{run?:PrCommandRunner}={}) {this.run=options.run||defaultRun;}
  private async gh(cwd:string,args:string[]) {return (await this.run('gh',args,{cwd,timeout:30_000})).stdout;}
  private async existing(cwd:string,repo:string,base:string,head:string) {
    const result=JSON.parse(await this.gh(cwd,['pr','list','--repo',`github.com/${repo}`,'--head',head,'--base',base,'--state','open','--json','url,number,headRepository,headRepositoryOwner,headRefName,baseRefName','--limit','2']));
    requireSafe(Array.isArray(result)&&result.length<=1,'More than one matching pull request was found. Resolve this on GitHub, then refresh.');
    if(!result.length)return;
    const pr=pullRequest(result[0],repo);
    const headRepo=`${result[0].headRepositoryOwner?.login}/${result[0].headRepository?.name}`;
    requireSafe(pr&&headRepo.toLowerCase()===repo.toLowerCase()&&result[0].headRefName===head&&result[0].baseRefName===base,'Could not verify the existing pull request on GitHub.');
    return pr;
  }
  private async context(inputCwd:string,key:string) {
    requireSafe(/^[A-Z][A-Z0-9_]*-\d+$/i.test(key),'Select a valid Jira task before preparing a pull request.');
    const cwd=await realpath(inputCwd);
    const safeArgs=['--no-optional-locks','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.quotePath=false','-c','remote.origin.mirror=false','-c','push.followTags=false','-c','push.pushOption='];
    const git=async(args:string[])=>(await this.run('git',[...safeArgs,...args],{cwd,timeout:30_000})).stdout;
    const root=await realpath((await git(['rev-parse','--show-toplevel'])).trim());
    requireSafe(canonical(root)===canonical(cwd),'Select the exact Git repository root. A parent repository cannot be published from this project folder.');
    return {cwd,git,safeArgs};
  }
  private async origin(git:Repository['git']) {
    const origins=(await git(['remote','get-url','--all','origin'])).trim().split(/\r?\n/);
    const pushOrigins=(await git(['remote','get-url','--push','--all','origin'])).trim().split(/\r?\n/);
    requireSafe(origins.length===1&&pushOrigins.length===1,'Origin must have exactly one fetch URL and one push URL.');
    const repo=githubRepository(origins[0]);
    requireSafe(repo.toLowerCase()===githubRepository(pushOrigins[0]).toLowerCase(),'Origin fetch and push URLs must point to the same GitHub repository.');
    return {repo,pushUrl:pushOrigins[0]};
  }
  private async inspect(inputCwd:string,key:string):Promise<Repository> {
    const {cwd,git,safeArgs}=await this.context(inputCwd,key),preview=empty();
    // Checking cleanliness must not execute configured clean/process filters.
    let filterKeys='';
    try {filterKeys=await git(['config','--null','--name-only','--get-regexp','^filter\\.']);}
    catch(error:any) {if(error.code!==1)throw error;}
    const filterNames=new Set(filterKeys.split('\0').filter(name=>/^filter\..+\.(clean|process|required)$/.test(name)).map(name=>name.slice(0,name.lastIndexOf('.'))));
    requireSafe(filterNames.size<=200,'Too many Git filters to inspect this repository safely.');
    for(const name of filterNames)safeArgs.push('-c',`${name}.clean=`,'-c',`${name}.process=`,'-c',`${name}.required=false`);
    requireSafe(!(await git(['status','--porcelain=v1','-z','--untracked-files=normal'])),commitHelp);
    try {preview.head=(await git(['symbolic-ref','--quiet','--short','HEAD'])).trim();}
    catch {throw new PrSafetyError('This checkout is detached. Ask the agent to create a separate task branch, then refresh.');}
    requireSafe(preview.head&&!preview.head.startsWith('-')&&!preview.head.startsWith('refs/'),'Choose a named task branch, then refresh.');
    await git(['check-ref-format','--branch',preview.head]);
    preview.headSha=(await git(['rev-parse','--verify','HEAD^{commit}'])).trim();
    requireSafe(/^[a-f0-9]{40,64}$/i.test(preview.headSha),'Commit the task changes before preparing a pull request.');
    const {repo,pushUrl}=await this.origin(git);
    const metadata=JSON.parse(await this.gh(cwd,['repo','view',`github.com/${repo}`,'--json','defaultBranchRef']));
    preview.base=metadata?.defaultBranchRef?.name;
    requireSafe(typeof preview.base==='string'&&!!preview.base&&!preview.base.startsWith('-')&&!preview.base.startsWith('refs/'),'Could not determine the GitHub default branch.');
    await git(['check-ref-format','--branch',preview.base]);
    requireSafe(preview.head!==preview.base,'The default branch cannot be sent for review. '+commitHelp);
    const baseRef=`refs/remotes/origin/${preview.base}`;
    try {await git(['rev-parse','--verify',`${baseRef}^{commit}`]);}
    catch {throw new PrSafetyError('Fetch origin in your Git client, then refresh this task to compare against the default branch.');}
    const files=await git(['diff','--no-ext-diff','--no-textconv','--no-renames','--name-only','-z',`${baseRef}...${preview.headSha}`,'--']);
    preview.files=files.split('\0').filter(Boolean);
    preview.commits=Number((await git(['rev-list','--count',`${baseRef}..${preview.headSha}`])).trim());
    requireSafe(preview.files.length>0&&Number.isSafeInteger(preview.commits)&&preview.commits>0,'There are no committed task changes to send for review. '+commitHelp);
    requireSafe(preview.files.length<=2000,'This branch changes too many files to preview safely. Split the work into smaller branches.');
    preview.existing=await this.existing(cwd,repo,preview.base,preview.head);
    preview.ready=true;
    return {cwd,repo,pushUrl,git,preview};
  }
  async preview(cwd:string,key:string):Promise<PrPreview> {
    try {return (await this.inspect(cwd,key)).preview;}
    catch(error) {return {...empty(),reason:safeMessage(error,'Could not prepare the pull request. Check GitHub sign-in and repository access on the PC.')};}
  }
  async reconcile(cwd:string,key:string,base:string,head:string):Promise<{url:string;number:number}|undefined> {
    try {
      const context=await this.context(cwd,key),{repo}=await this.origin(context.git);
      for(const ref of [base,head]) {
        requireSafe(typeof ref==='string'&&!!ref&&!ref.startsWith('-')&&!ref.startsWith('refs/')&&!/[\r\n\0]/.test(ref),'The saved pull request branch could not be verified.');
        await context.git(['check-ref-format','--branch',ref]);
      }
      requireSafe(base!==head,'The saved pull request branch could not be verified.');
      return await this.existing(context.cwd,repo,base,head);
    }catch(error) {throw new HttpError(409,safeMessage(error,'Could not verify whether the pull request was created. Check GitHub sign-in and repository access on the PC, then refresh.'));}
  }
  async create(cwd:string,key:string,input:PrInput):Promise<{url:string;number:number}> {
    let temporary:string|undefined;
    try {
      requireSafe(typeof input.title==='string'&&!!input.title.trim()&&input.title.length<=256&&!/[\r\n\0]/.test(input.title),'Provide a short pull request title.');
      requireSafe(typeof input.body==='string'&&input.body.length<=200_000&&!input.body.includes('\0'),'The pull request description is too large or contains unsupported characters.');
      const repository=await this.inspect(cwd,key),approved=repository.preview;
      requireSafe(approved.base===input.base&&approved.head===input.head&&approved.headSha===input.headSha,'The branch or commits changed after the preview. Refresh and review the updated changes before publishing.');
      // Pin the approved SHA: a concurrent local commit cannot expand this publication.
      await repository.git(['push','--no-verify','--no-follow-tags','--recurse-submodules=no',repository.pushUrl,`${approved.headSha}:refs/heads/${approved.head}`]);
      if(approved.existing)return approved.existing;
      temporary=await mkdtemp(path.join(os.tmpdir(),'pocket-jira-pr-'));
      const bodyFile=path.join(temporary,'body.md');await writeFile(bodyFile,input.body,{encoding:'utf8',mode:0o600});
      try {
        const output=(await this.gh(repository.cwd,['pr','create','--repo',`github.com/${repository.repo}`,'--base',approved.base,'--head',approved.head,'--title',input.title.trim(),'--body-file',bodyFile])).trim();
        const number=Number(/\/pull\/(\d+)$/.exec(output)?.[1]);
        const created=pullRequest({url:output,number},repository.repo);
        if(created)return created;
      }catch{/* Creation may have succeeded even when the response was lost. */}
      let recovered;
      try {recovered=await this.existing(repository.cwd,repository.repo,approved.base,approved.head);}catch{/* Report the completed push without leaking command output. */}
      requireSafe(recovered,'The branch was pushed, but the pull request could not be confirmed. Refresh before trying again.');
      return recovered;
    }catch(error) {throw new HttpError(409,safeMessage(error,'Could not publish the pull request. Check GitHub sign-in and repository access on the PC, then refresh.'));}
    finally {if(temporary&&canonical(path.dirname(temporary))===canonical(os.tmpdir())&&path.basename(temporary).startsWith('pocket-jira-pr-'))await rm(temporary,{recursive:true,force:true}).catch(()=>{});}
  }
}
