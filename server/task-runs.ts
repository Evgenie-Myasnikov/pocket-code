import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {z} from 'zod';
import {HttpError} from './security.js';
import {TaskWorktrees,type TaskWorktree,type TaskSnapshot} from './task-worktrees.js';
import {TaskCheckRunner,validateChecks,type TaskCheck,type TaskCheckEvidence} from './task-checks.js';
export {suggestedTaskChecks,type TaskCheck,type TaskCheckEvidence} from './task-checks.js';

export type TaskStage='questions'|'working'|'checks'|'review'|'approved'|'failed';
export type TaskProvider='claude'|'codex'|'copilot';
export type TaskNoteSnapshot={title:string;description:string;branch:string;priority:'critical'|'high'|'normal'|'low'};
type ObservedJob={id:string;status:'running'|'done'|'error'|'stopped';sessionId?:string;approvals?:unknown[];error?:string};
export type TaskRun={
  id:string;boardId:string;noteId:string;noteRevision:string;title:string;provider:TaskProvider;projectPath:string;ownerId?:string;
  noteSnapshot?:TaskNoteSnapshot;
  stage:TaskStage;revision:number;createdAt:number;updatedAt:number;worktree?:TaskWorktree;jobId?:string;sessionId?:string;
  jobs:{jobId:string;sessionId?:string;status:ObservedJob['status'];startedAt:number;endedAt?:number}[];
  verification?:{status:'running'|'passed'|'failed'|'interrupted';snapshot:TaskSnapshot;startedAt:number;finishedAt?:number;evidence:TaskCheckEvidence[];error?:string};
  verificationPlan?:TaskCheck[];
  approval?:{at:number;revision:number;fingerprint:string};error?:string;interrupted?:boolean;
};
export type CreateTaskRun={id?:string;boardId:string;noteId:string;noteRevision:string;title:string;provider:TaskProvider;projectPath:string;ownerId?:string;verificationPlan?:TaskCheck[];noteSnapshot?:TaskNoteSnapshot};
type Filter=Partial<Pick<TaskRun,'boardId'|'noteId'|'provider'|'projectPath'|'ownerId'|'jobId'|'sessionId'>>;
const createSchema=z.object({id:z.uuid().optional(),boardId:z.string().min(1).max(200),noteId:z.string().min(1).max(200),noteRevision:z.string().min(1).max(200),title:z.string().min(1).max(300),provider:z.enum(['claude','codex','copilot']),projectPath:z.string().min(1).max(4096),ownerId:z.string().min(1).max(200).optional(),noteSnapshot:z.object({title:z.string().min(1).max(300),description:z.string().max(20000),branch:z.string().max(300),priority:z.enum(['critical','high','normal','low'])}).optional()});
const storedString=z.string().max(4096),timestamp=z.number().int().nonnegative();
const checkSchema=z.object({label:z.string().min(1).max(120),executable:storedString,args:z.array(z.string().max(8192)).max(100),timeoutMs:z.number().int().min(100).max(600_000).optional()});
const snapshotSchema=z.object({baseCommit:z.string().regex(/^[0-9a-f]{40,64}$/i),headCommit:z.string().regex(/^[0-9a-f]{40,64}$/i),branch:storedString,fingerprint:z.string().regex(/^[0-9a-f]{64}$/i)});
const runSchema=createSchema.extend({
  id:z.uuid(),stage:z.enum(['questions','working','checks','review','approved','failed']),revision:z.number().int().positive(),createdAt:timestamp,updatedAt:timestamp,
  worktree:z.object({runId:z.uuid(),projectPath:storedString,repositoryRoot:storedString,cwd:storedString,branch:storedString,baseCommit:z.string().regex(/^[0-9a-f]{40,64}$/i)}).optional(),
  jobId:z.string().min(1).max(200).optional(),sessionId:z.string().min(1).max(500).optional(),
  jobs:z.array(z.object({jobId:z.string().min(1).max(200),sessionId:z.string().min(1).max(500).optional(),status:z.enum(['running','done','error','stopped']),startedAt:timestamp,endedAt:timestamp.optional()})).max(1000),
  verificationPlan:z.array(checkSchema).max(12).optional(),
  verification:z.object({status:z.enum(['running','passed','failed','interrupted']),snapshot:snapshotSchema,startedAt:timestamp,finishedAt:timestamp.optional(),error:storedString.optional(),evidence:z.array(checkSchema.omit({timeoutMs:true}).extend({startedAt:timestamp,finishedAt:timestamp,exitCode:z.number().int().nullable(),passed:z.boolean(),timedOut:z.boolean(),interrupted:z.boolean().optional(),output:z.string().max(16_384),truncated:z.boolean()})).max(12)}).optional(),
  approval:z.object({at:timestamp,revision:z.number().int().positive(),fingerprint:z.string().regex(/^[0-9a-f]{64}$/i)}).optional(),error:storedString.optional(),interrupted:z.boolean().optional(),
});
const copy=<T>(value:T):T=>structuredClone(value);

/** Private host state. Never serializes task conversations/assignments into portable boards. */
export class TaskRuns{
  private runs:TaskRun[]=[];private ready:Promise<void>;private chain:Promise<unknown>=Promise.resolve();
  private verifying=new Set<string>();private runner=new TaskCheckRunner();private closed=false;
  private completions=new Set<Promise<TaskRun>>();
  constructor(private file:string,private worktrees:TaskWorktrees){
    this.ready=readFile(file,'utf8').then(raw=>{
      const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.runs)||data.runs.length>10_000)throw new Error('Invalid private task-run storage.');
      const ids=new Set<string>();
      this.runs=data.runs.map((value:unknown)=>{
        const parsed=runSchema.safeParse(value);if(!parsed.success||ids.has(parsed.data.id))throw new Error('Invalid private task-run storage.');
        const run=parsed.data;ids.add(run.id);
        if(run.worktree&&run.worktree.runId!==run.id||run.verification?.status==='passed'&&(!run.verification.evidence.length||run.verification.evidence.some(check=>!check.passed||check.exitCode!==0||check.timedOut||check.interrupted)))throw new Error('Invalid private task-run evidence.');
        if(run.stage==='approved'&&(!run.approval||run.verification?.status!=='passed'||run.approval.fingerprint!==run.verification.snapshot.fingerprint))throw new Error('Invalid private task-run approval.');
        return run;
      });
    }).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
  private serial<T>(action:()=>Promise<T>):Promise<T>{const next=this.chain.then(()=>this.ready).then(action);this.chain=next.catch(()=>{});return next;}
  private async save(next:TaskRun[]){
    await mkdir(path.dirname(this.file),{recursive:true,mode:0o700});
    const temporary=`${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary,JSON.stringify({version:1,runs:next}),{mode:0o600,flag:'wx'});await rename(temporary,this.file);this.runs=next;
  }
  private find(id:string){const run=this.runs.find(run=>run.id===id);if(!run)throw new HttpError(404,'Task run not found.');return run;}
  private current(id:string,revision:number){const run=this.find(id);if(run.revision!==revision)throw new HttpError(409,'The task run changed. Refresh before continuing.');return run;}
  private async update(run:TaskRun,changes:Partial<TaskRun>){
    const next:TaskRun=JSON.parse(JSON.stringify({...copy(run),...changes,revision:run.revision+1,updatedAt:Date.now()}));
    await this.save(this.runs.map(value=>value.id===run.id?next:value));return copy(next);
  }
  private editable(run:TaskRun){if(this.verifying.has(run.id))throw new HttpError(409,'Verification is still running.');if(!run.worktree)throw new HttpError(409,'This task has no usable worktree. Create a new run; existing files are preserved.');}
  hasWork(){return this.verifying.size>0||this.runner.busy;}
  async close(){
    this.closed=true;
    // Settle any in-flight reservation first, then stop owned commands and persist their final state.
    await this.chain;await this.runner.close();await Promise.allSettled([...this.completions]);await this.chain;
  }
  async list(filter:Filter={}){await this.ready;return copy(this.runs.filter(run=>Object.entries(filter).every(([name,value])=>value===undefined||run[name as keyof TaskRun]===value)).sort((a,b)=>b.updatedAt-a.updatedAt));}
  async listActive(){
    await this.ready;
    return copy(this.runs.filter(run=>run.jobs.at(-1)?.status==='running'||run.stage==='checks'&&run.verificationPlan?.length&&!run.verification));
  }
  async locations(){await this.ready;return this.runs.flatMap(run=>run.worktree?[{id:run.id,projectPath:run.projectPath,worktree:copy(run.worktree)}]:[]);}
  async findByWorktree(cwd:string){await this.ready;const run=this.runs.find(value=>value.worktree?.cwd===cwd);return run?copy(run):undefined;}
  async get(id:string){await this.ready;return copy(this.find(id));}
  create(input:CreateTaskRun){return this.serial(async()=>{
    if(this.closed)throw new HttpError(503,'The host is shutting down.');
    const parsed=createSchema.safeParse(input);if(!parsed.success)throw new HttpError(400,'Invalid task run request.');
    const verificationPlan=input.verificationPlan===undefined?undefined:input.verificationPlan.length?validateChecks(input.verificationPlan):[];
    const data=parsed.data,id=data.id??randomUUID(),existing=this.runs.find(run=>run.id===id);
    if(existing){
      for(const field of ['boardId','noteId','noteRevision','title','provider','projectPath','ownerId'] as const)if(existing[field]!==data[field])throw new HttpError(409,'This request identifier belongs to another task run.');
      if(JSON.stringify(existing.noteSnapshot)!==JSON.stringify(data.noteSnapshot))throw new HttpError(409,'This request identifier belongs to another task snapshot.');
      return copy(existing);
    }
    if(this.runs.length>=10_000)throw new HttpError(409,'Task history is full.');
    const now=Date.now(),run:TaskRun={...data,id,stage:'questions',revision:1,createdAt:now,updatedAt:now,jobs:[],...(verificationPlan?{verificationPlan}:{}),error:'Preparing an isolated worktree.'};
    // Persist intent first. A crash must not silently relaunch work or reuse an orphaned directory.
    await this.save([...this.runs,run]);
    try{
      const worktree=await this.worktrees.create(id,data.projectPath);
      return await this.update(run,{worktree,stage:'working',error:undefined});
    }catch(error){
      await this.update(run,{stage:'failed',error:error instanceof HttpError?error.message:'Could not prepare the isolated worktree.'});throw error;
    }
  });}
  attachJob(id:string,revision:number,job:{jobId:string;sessionId?:string}){return this.serial(async()=>{
    if(this.closed)throw new HttpError(503,'The host is shutting down.');
    const run=this.current(id,revision);this.editable(run);
    if(!job.jobId||job.jobId.length>200||job.sessionId!==undefined&&(!job.sessionId||job.sessionId.length>500))throw new HttpError(400,'Invalid task job link.');
    if(run.jobId===job.jobId)return copy(run);
    if(this.runs.some(other=>other.id!==run.id&&other.jobs.some(previous=>previous.jobId===job.jobId)))throw new HttpError(409,'This job is already linked to another task.');
    if(run.jobs.length>=1000)throw new HttpError(409,'This task has reached its attempt limit. Create a new run.');
    if(run.jobs.some(previous=>previous.jobId===job.jobId))throw new HttpError(409,'This job already belongs to an earlier task attempt.');
    if(run.stage!=='working'||run.jobs.at(-1)?.status==='running')throw new HttpError(409,'Resume the task before starting another attempt.');
    await this.worktrees.verify(run.worktree!);
    return this.update(run,{jobId:job.jobId,sessionId:job.sessionId??run.sessionId,stage:'working',error:undefined,interrupted:undefined,approval:undefined,verification:undefined,jobs:[...run.jobs,{...job,status:'running',startedAt:Date.now()}]});
  });}
  observeJob(id:string,job:ObservedJob){return this.serial(async()=>{
    const run=this.find(id);if(run.jobId!==job.id)return copy(run);
    const previous=run.jobs.at(-1);if(!previous||previous.status!=='running')return copy(run);
    const sessionId=job.sessionId??run.sessionId;
    const stage:TaskStage=job.status==='running'?(job.approvals?.length?'questions':'working'):job.status==='done'?'checks':job.status==='error'?'failed':'questions';
    if(previous.status===job.status&&previous.sessionId===sessionId&&stage===run.stage)return copy(run);
    const linked={...previous,sessionId,status:job.status,...(job.status==='running'?{}:{endedAt:Date.now()})};
    return this.update(run,{sessionId,stage,error:job.status==='error'?'The agent stopped with an error. Open its chat for details.':job.status==='stopped'?'The agent was stopped. Resume explicitly when ready.':undefined,jobs:[...run.jobs.slice(0,-1),linked]});
  });}
  resume(id:string,revision:number){return this.serial(async()=>{
    const run=this.current(id,revision);this.editable(run);
    if(run.jobs.at(-1)?.status==='running')throw new HttpError(409,'The linked agent is still running.');
    await this.worktrees.verify(run.worktree!);
    return this.update(run,{stage:'working',jobId:undefined,verification:undefined,approval:undefined,error:undefined,interrupted:undefined});
  });}
  configureChecks(id:string,revision:number,checks:TaskCheck[]){
    const plan=checks.length?validateChecks(checks):[];
    return this.serial(async()=>{
      const run=this.current(id,revision);this.editable(run);
      if(run.stage==='approved')throw new HttpError(409,'Resume the approved task before changing its checks.');
      return this.update(run,{verificationPlan:plan,verification:undefined,approval:undefined,...(run.stage==='review'?{stage:'checks' as const}:{})});
    });
  }
  /** Startup only. Never restarts an agent/check or assumes an interrupted run completed. */
  reconcile(getJob?:(id:string)=>ObservedJob|undefined|Promise<ObservedJob|undefined>){return this.serial(async()=>{
    const next=copy(this.runs);let changed=false;
    for(const run of next){
      if(this.verifying.has(run.id))continue;
      let error:string|undefined;
      if(!run.worktree)error='Worktree preparation was interrupted or failed. Create a new run; existing files are preserved.';
      else try{await this.worktrees.verify(run.worktree);}catch{error='The isolated worktree is unavailable. Restore it before continuing.';}
      if(run.verification?.status==='running'){run.verification.status='interrupted';run.verification.finishedAt=Date.now();error='Verification was interrupted by a host restart. Run the checks again.';}
      if(run.jobs.at(-1)?.status==='running'){
        const job=getJob&&run.jobId?await getJob(run.jobId):undefined;
        if(job){
          const last=run.jobs.at(-1)!;last.status=job.status;last.sessionId=job.sessionId??last.sessionId;run.sessionId=last.sessionId;
          run.stage=job.status==='running'?(job.approvals?.length?'questions':'working'):job.status==='done'?'checks':job.status==='error'?'failed':'questions';
          if(job.status!=='running')last.endedAt=Date.now();
          changed=true;
        }else{
          run.jobs.at(-1)!.status='stopped';run.jobs.at(-1)!.endedAt=Date.now();
          error='The host restarted while the agent was working. Inspect the chat and resume explicitly.';
        }
      }
      if(error){run.stage='questions';run.error=error;run.interrupted=true;run.approval=undefined;}
      if(error||JSON.stringify(run)!==JSON.stringify(this.find(run.id))){run.revision++;run.updatedAt=Date.now();changed=true;}
    }
    if(changed)await this.save(next);return copy(next);
  });}
  async result(id:string){
    const run=await this.get(id);if(!run.worktree)throw new HttpError(409,'This task has no usable worktree.');
    const snapshot=await this.worktrees.snapshot(run.worktree);
    return {run,snapshot,verificationCurrent:run.verification?.status==='passed'&&run.verification.snapshot.fingerprint===snapshot.fingerprint,approvalCurrent:run.stage==='approved'&&run.approval?.fingerprint===snapshot.fingerprint};
  }
  async startVerification(id:string,revision:number,input:TaskCheck[]){
    const checks=validateChecks(input);
    const initial=await this.serial(async()=>{
      if(this.closed)throw new HttpError(503,'The host is shutting down.');
      const run=this.current(id,revision);this.editable(run);
      if(run.jobs.at(-1)?.status==='running'||run.stage==='working'||run.stage==='approved')throw new HttpError(409,'Finish the agent attempt before verifying its result.');
      let snapshot:TaskSnapshot;
      try{snapshot=await this.worktrees.snapshot(run.worktree!);}
      catch(error){await this.update(run,{stage:'failed',error:'Could not prepare verification. Restore the working copy and retry.'});throw error;}
      const next=await this.update(run,{stage:'checks',error:undefined,approval:undefined,verification:{status:'running',snapshot,startedAt:Date.now(),evidence:[]}});
      this.verifying.add(id);return next;
    });
    const completion=this.executeVerification(initial,checks).finally(()=>this.completions.delete(completion));
    this.completions.add(completion);return {run:initial,completion};
  }
  async verify(id:string,revision:number,input:TaskCheck[]){return (await this.startVerification(id,revision,input)).completion;}
  async verificationFailure(id:string,revision:number){return this.serial(async()=>{
    const run=this.find(id);if(run.revision!==revision)return copy(run);
    return this.update(run,{stage:'failed',error:'Verification could not finish. Inspect the working copy and retry.',...(run.verification?{verification:{...run.verification,status:'failed',finishedAt:Date.now(),error:'Verification could not finish.'}}:{})});
  });}
  private async executeVerification(initial:TaskRun,checks:TaskCheck[]){
    const id=initial.id;
    const evidence:TaskCheckEvidence[]=[];let failure:string|undefined;
    try{
      for(const check of checks){if(this.closed){failure='Verification was interrupted by host shutdown.';break;}evidence.push(await this.runner.run(check,initial.worktree!.cwd));}
      const after=await this.worktrees.snapshot(initial.worktree!);
      if(after.fingerprint!==initial.verification!.snapshot.fingerprint)failure='Source files changed during verification. Run the checks again on the new result.';
      if(evidence.some(check=>!check.passed))failure??='One or more verification commands failed.';
    }catch{failure='Verification could not inspect the current worktree. Restore it and retry.';}
    return this.serial(async()=>{
      const run=this.current(id,initial.revision),passed=!failure&&evidence.length===checks.length&&evidence.every(check=>check.passed);
      return this.update(run,{stage:passed?'review':'failed',error:failure,verification:{...initial.verification!,status:passed?'passed':this.closed?'interrupted':'failed',finishedAt:Date.now(),evidence,error:failure}});
    }).finally(()=>this.verifying.delete(id));
  }
  approve(id:string,revision:number){return this.serial(async()=>{
    const run=this.current(id,revision);this.editable(run);
    if(run.stage!=='review'||run.verification?.status!=='passed'||!run.verification.evidence.length||run.verification.evidence.some(check=>!check.passed))throw new HttpError(409,'Passing executable checks and a reviewable result are required before approval.');
    const fingerprint=await this.worktrees.fingerprint(run.worktree!);
    if(fingerprint!==run.verification.snapshot.fingerprint){await this.update(run,{stage:'checks',error:'The result changed after verification. Run the checks again.',approval:undefined});throw new HttpError(409,'The result changed after verification. Run the checks again.');}
    return this.update(run,{stage:'approved',error:undefined,approval:{at:Date.now(),revision:run.revision,fingerprint}});
  });}
}
