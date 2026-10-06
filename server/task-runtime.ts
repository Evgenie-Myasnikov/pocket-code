import path from 'node:path';
import {realpath} from 'node:fs/promises';
import type {Express} from 'express';
import {z} from 'zod';
import {TaskRuns,suggestedTaskChecks,type TaskRun,type TaskProvider} from './task-runs.js';
import {TaskWorktrees} from './task-worktrees.js';
import {projectBoard} from './project-board.js';
import type {createWorkspaceAccess,ProjectBoard} from './boards.js';
import {allowedPath,HttpError} from './security.js';
import {review} from './review.js';
import type {JobView} from './types.js';

const uuid=z.string().uuid(),revision=z.number().int().positive();
const check=z.object({label:z.string().min(1).max(120),executable:z.string().min(1).max(4096),args:z.array(z.string().max(8192)).max(100),timeoutMs:z.number().int().min(100).max(600000).optional()});
type Access=Awaited<ReturnType<typeof createWorkspaceAccess>>;
type Options={directory:string;roots:string[];access:Access;jobs():JobView[];managedRoots(roots:string[]):void};

/** Task orchestration belongs to the connected PC; Git boards contain no runtime state. */
export class TaskRuntime{
  readonly worktrees:TaskWorktrees;readonly runs:TaskRuns;
  private working:string[]=[];private timer?:ReturnType<typeof setInterval>;private scanning=false;private closing=false;
  private scheduled=new Set<string>();
  private attempted=new Map<string,number>();
  constructor(private options:Options){
    this.worktrees=new TaskWorktrees(path.join(options.directory,'worktrees'),options.roots);
    this.runs=new TaskRuns(path.join(options.directory,'runs.json'),this.worktrees);
  }
  roots(){return [...this.working];}
  hasWork(){return this.runs.hasWork()||this.scheduled.size>0;}
  async initialize(){await this.runs.reconcile();await this.refreshRoots();this.timer=setInterval(()=>{void this.synchronize().catch(()=>{});},2000);this.timer.unref();}
  async close(){this.closing=true;clearInterval(this.timer);await this.runs.close();}
  private host(){if(this.options.access.current())throw new HttpError(403,'Connect to the PC to manage its private task runs.');}
  private async refreshRoots(){
    const found:string[]=[];
    for(const run of await this.runs.locations())try{await allowedPath(this.options.roots,run.projectPath,true);found.push(await this.worktrees.verify(run.worktree));}catch{/* Unavailable worktrees never expand file access. */}
    this.working=[...new Set(found)];this.options.managedRoots(this.working);
  }
  async get(id:string){this.host();const run=await this.runs.get(uuid.parse(id));await allowedPath(this.options.roots,run.projectPath,true);return run;}
  private async visibleRuns(filter:Parameters<TaskRuns['list']>[0]={},active=false){
    const visible:TaskRun[]=[];
    for(const run of await(active?this.runs.listActive():this.runs.list(filter)))try{await allowedPath(this.options.roots,run.projectPath,true);visible.push(run);}catch{/* Previously shared/deleted projects never expose private run data. */}
    return visible;
  }
  async board(root:string,id:string):Promise<ProjectBoard&{repositoryRevision?:string}>{
    this.host();root=await allowedPath(this.options.roots,root,true);
    const portable=await projectBoard(root);if(portable?.id===id)return portable;
    const stored=this.options.access.store.getBoard(id);
    if(!stored||await realpath(stored.root)!==root)throw new HttpError(404,'The source board is unavailable.');
    return stored;
  }
  async bindJob(input:{id:string;cwd:string;provider:TaskProvider;sessionId?:string;taskRunId?:string;taskRunRevision?:number}){
    this.host();
    const run=input.taskRunId?await this.get(input.taskRunId):await this.runs.findByWorktree(input.cwd);
    if(!run)return undefined;
    await allowedPath(this.options.roots,run.projectPath,true);
    if(!run.worktree||await this.worktrees.verify(run.worktree)!==input.cwd||run.provider!==input.provider||run.sessionId&&run.sessionId!==input.sessionId)throw new HttpError(409,'The task run belongs to another chat, provider or working copy.');
    if(input.taskRunRevision!==undefined&&run.revision!==input.taskRunRevision)throw new HttpError(409,'The task run changed. Refresh before sending.');
    if(run.jobId===input.id)return run;
    const current=run.jobs.at(-1)?.status!=='running'&&(run.jobId||run.stage!=='working')?await this.runs.resume(run.id,run.revision):run;
    return this.runs.attachJob(current.id,current.revision,{jobId:input.id,sessionId:input.sessionId});
  }
  async synchronize(){
    if(this.scanning||this.closing)return;this.scanning=true;
    try{
      const jobs=new Map(this.options.jobs().map(job=>[job.id,job]));
      for(const saved of await this.visibleRuns({},true)){
        const job=saved.jobId?jobs.get(saved.jobId):undefined;
        const run=job?await this.runs.observeJob(saved.id,job):saved;
        if(run.stage==='checks'&&run.jobs.at(-1)?.status==='done'&&run.verificationPlan?.length&&!run.verification&&!this.scheduled.has(run.id)&&this.attempted.get(run.id)!==run.revision){
          this.attempted.set(run.id,run.revision);
          this.scheduled.add(run.id);
          void this.runs.startVerification(run.id,run.revision,run.verificationPlan).then(started=>started.completion.catch(()=>this.runs.verificationFailure(run.id,started.run.revision))).catch(()=>this.runs.verificationFailure(run.id,run.revision)).catch(()=>{/* Storage failure retains prior evidence and is retried only explicitly. */}).finally(()=>this.scheduled.delete(run.id));
        }
      }
    }finally{this.scanning=false;}
  }
  mount(app:Express){
    app.get('/api/task-runs',async(req,res)=>{
      this.host();await this.synchronize();
      const filter=z.object({boardId:uuid.optional(),noteId:uuid.optional(),provider:z.enum(['claude','codex','copilot']).optional(),sessionId:z.string().max(200).optional(),jobId:uuid.optional(),projectPath:z.string().max(4096).optional()}).parse(req.query);
      if(filter.projectPath)filter.projectPath=await allowedPath(this.options.roots,filter.projectPath,true);
      res.json({runs:await this.visibleRuns(filter)});
    });
    app.post('/api/task-runs',async(req,res)=>{
      this.host();const input=z.object({id:uuid,boardId:uuid,noteId:uuid,root:z.string().min(1).max(4096),noteRevision:z.string().min(1).max(200),provider:z.enum(['claude','codex','copilot']),checks:z.array(check).max(8).optional()}).parse(req.body);
      input.root=await allowedPath(this.options.roots,input.root,true);
      const existing=(await this.visibleRuns()).find(run=>run.id===input.id);
      if(existing){
        if(existing.boardId!==input.boardId||existing.noteId!==input.noteId||existing.projectPath!==input.root||existing.provider!==input.provider||existing.noteRevision!==input.noteRevision)throw new HttpError(409,'This request identifier belongs to another task run.');
        res.json(existing);return;
      }
      const board=await this.board(input.root,input.boardId),note=board.notes.find(note=>note.id===input.noteId);
      if(!note)throw new HttpError(404,'The source note is unavailable.');
      if(String(board.repositoryRevision??board.revision)!==input.noteRevision)throw new HttpError(409,'The board changed. Refresh before starting a task.');
      const run=await this.runs.create({id:input.id,boardId:board.id,noteId:note.id,noteRevision:input.noteRevision,title:note.title,provider:input.provider,projectPath:board.root,verificationPlan:input.checks,noteSnapshot:{title:note.title,description:note.description,branch:note.branch,priority:note.priority||'normal'}});
      await this.refreshRoots();res.json(run);
    });
    app.get('/api/task-runs/:id',async(req,res)=>{await this.get(String(req.params.id));await this.synchronize();res.json(await this.get(String(req.params.id)));});
    app.get('/api/task-runs/:id/board',async(req,res)=>{const run=await this.get(String(req.params.id));res.json({board:await this.board(run.projectPath,run.boardId),noteId:run.noteId});});
    app.get('/api/task-runs/:id/checks',async(req,res)=>{const run=await this.get(String(req.params.id));res.json({checks:await suggestedTaskChecks(run.worktree?await this.worktrees.verify(run.worktree):run.projectPath)});});
    app.get('/api/task-runs/:id/result',async(req,res)=>{const run=await this.get(String(req.params.id));res.json(await this.runs.result(run.id));});
    app.get('/api/task-runs/:id/review',async(req,res)=>{const run=await this.get(String(req.params.id));if(!run.worktree)throw new HttpError(409,'Task working copy is unavailable.');const cwd=await this.worktrees.verify(run.worktree);res.json(await review([cwd],cwd,'task',run.worktree.baseCommit,z.string().max(4096).optional().parse(req.query.file)));});
    app.post('/api/task-runs/:id/checks',async(req,res)=>{const run=await this.get(String(req.params.id)),body=z.object({revision,checks:z.array(check).max(8)}).parse(req.body);res.json(await this.runs.configureChecks(run.id,body.revision,body.checks));});
    app.post('/api/task-runs/:id/check',async(req,res)=>{
      const run=await this.get(String(req.params.id)),body=z.object({revision,checks:z.array(check).min(1).max(8)}).parse(req.body);
      const started=await this.runs.startVerification(run.id,body.revision,body.checks);
      void started.completion.catch(()=>this.runs.verificationFailure(run.id,started.run.revision)).catch(()=>{/* The next explicit request reports unavailable storage. */});
      res.status(202).json(started.run);
    });
    app.post('/api/task-runs/:id/approve',async(req,res)=>{const run=await this.get(String(req.params.id)),body=z.object({revision}).parse(req.body);res.json(await this.runs.approve(run.id,body.revision));});
    app.post('/api/task-runs/:id/resume',async(req,res)=>{const run=await this.get(String(req.params.id)),body=z.object({revision}).parse(req.body);res.json(await this.runs.resume(run.id,body.revision));});
  }
}
