import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, stat} from 'node:fs/promises';
import {writeDurable} from './durable-file.js';
import {replaceFile} from './fs-retry.js';
import path from 'node:path';
import {buildChainStepPrompt, chainCompletionMarker, readLoopDecision, CHAIN_LOOP_MAX_LAPS, CHAIN_LOOP_RETRIES, type ChainExecutor, type ChainSourceInput, type MarkdownChainDetail, type MarkdownChainStep, type MarkdownChainSummary} from '../src/markdown-chain.js';
import type {CodexAccess} from './codex-access.js';
import {allowedPath,HttpError} from './security.js';
import type {JobView} from './types.js';
import type {ChainDeleteChat,ChainDeletePreview} from '../src/markdown-chain.js';
import {activityItem} from './activity.js';

export type ChainScope = Pick<MarkdownChainDetail, 'cwd' | 'provider' | 'account'>;
type Task = Pick<MarkdownChainStep, 'title' | 'body' | 'source' | 'executor'>;
type LaunchSettings = {
  model?: string;
  mode?: 'default' | 'plan';
  reasoningEffort?: string;
  claudeEffort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  claudeAccess?: 'default' | 'acceptEdits' | 'bypassPermissions';
  codexAccess?: CodexAccess;
  maxBudgetUsd?: number;
  approvalTimeoutMinutes?: number;
};
export type ChainInput = ChainScope & LaunchSettings & {id: string; name: string; context: string; tasks: Task[]; parallelSubtasks?:boolean; sourceFiles?:ChainSourceInput[]; loop?:{maxLaps:number;until?:string;stopIdle?:boolean}};
export function stepLaunchSettings(scope: ChainScope, settings: LaunchSettings, executor?: ChainExecutor) {
  if (!executor) return {provider:scope.provider, account:scope.account, ...settings};
  const sameAccount=executor.provider===scope.provider && executor.account===scope.account;
  const model=executor.model ?? (sameAccount ? settings.model : undefined);
  const sameModel=sameAccount && model===settings.model;
  return {
    provider:executor.provider, account:executor.account, model,
    approvalTimeoutMinutes:settings.approvalTimeoutMinutes, maxBudgetUsd:settings.maxBudgetUsd, mode:settings.mode,
    reasoningEffort:sameModel && executor.provider==='codex' ? settings.reasoningEffort : undefined,
    claudeEffort:sameModel && executor.provider==='claude' ? settings.claudeEffort : undefined,
    claudeAccess:sameAccount && executor.provider==='claude' ? settings.claudeAccess : undefined,
    codexAccess:executor.provider==='codex' ? (sameAccount ? settings.codexAccess : 'ask' as const) : undefined,
  };
}
type Attempt=Omit<ChainDeleteChat,'sessionId'>&{step:number;jobId?:string;sessionId?:string;cwd:string};
export type ChainChatTarget=ChainDeleteChat&{cwd:string};
type RemovalResult=ChainDeletePreview&{ok:boolean};
type Intent={chats:ChainDeleteChat[];eraseOriginals:boolean};
type RecordV1 = { attempts?:Attempt[]; deleting?:Intent; sourceUploads?:{name:string;text:string}[]; stacked?:boolean; trees?:Record<number,TaskWorktree>; pastTrees?:TaskWorktree[];version: 1; created: number; fingerprint: string; settings: LaunchSettings; chain: MarkdownChainDetail};
type DeletedRecord = {version: 1; deletedScope: string;result?:RemovalResult;intentHash?:string;audit?:{tree:TaskWorktree;base:string;head:string}};
const chatKey=(s:ChainDeleteChat)=>JSON.stringify([s.provider,s.account||'',s.sessionId]);
const intentHash=(intent:Intent)=>createHash('sha256').update(JSON.stringify([intent.eraseOriginals,intent.chats.map(chatKey).sort()])).digest('hex');
function updateAttempt(record:RecordV1,index:number){
  const step=record.chain.steps[index],owner=step.executor??record.chain;
  if(!step.jobId&&!step.sessionId)return;
  const attempts=record.attempts??=[];
  let seen=attempts.find(a=>a.step===index&&(step.jobId?a.jobId===step.jobId:a.sessionId===step.sessionId));
  if(!seen){seen={step:index,provider:owner.provider,account:owner.account,cwd:record.chain.cwd,jobId:step.jobId};attempts.push(seen);}
  seen.cwd=step.launchCwd||step.worktreeCwd||record.chain.cwd;
  if(step.sessionId)seen.sessionId=step.sessionId;
}
import type {TaskWorktree,TaskWorktrees} from './task-worktrees.js';
type Options = {
  worktrees?:TaskWorktrees;
  registerTree?(cwd:string):void;
  prepareSources?(id:string,files:ReadonlyArray<{name:string;text?:string}>):Promise<Record<string,string>>;
  file: string;
  accountName?(id: string): Promise<string | undefined>;
  manageChats?(targets:ChainChatTarget[],confirmed:ChainDeleteChat[]|undefined,eraseOriginals:boolean):Promise<ChainDeletePreview>;
  eraseChainFiles?(chainId:string,jobIds:string[]):Promise<void>;
  /** `sessionId` continues the step's own chat (a step paused for a local model swap). */
  start(input: ChainInput, jobId: string, prompt: string, verifiedCwd?:string, sourcePaths?:string[], sessionId?:string): Promise<JobView> | JobView;
  view(jobId: string): Promise<JobView | undefined> | JobView | undefined;
  stop(jobId: string): Promise<void> | void;
  intervalMs?: number;
};
/** The turn that continues a chain step paused for a local model swap, in the step's own session. */
export const CHAIN_SWAP_CONTINUATION = 'The local model was swapped for a scheduled run and interrupted this step. It is back now: continue the same step from where you stopped and finish it as its instructions say, including the completion line.';
const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const activeStep = (step: MarkdownChainStep) => step.status === 'running' || step.status === 'waiting';
const settledStep = (step: MarkdownChainStep) => step.status === 'done' || step.status === 'failed' || step.status === 'stopped';
/** In a loop, one unavailable step is a handoff, not a reason to strand the remaining steps. */
function continueLoopAfterStepFailure(chain: MarkdownChainDetail, step: MarkdownChainStep) {
  if (!chain.loop) { chain.status = step.status === 'stopped' ? 'stopped' : 'failed'; return; }
  const report = [
    `Previous step "${step.title}" ended ${step.status} before confirming completion.`,
    step.error ? `Reason: ${step.error}` : '',
    step.output ? `Last output:\n${step.output}` : '',
  ].filter(Boolean).join('\n\n');
  step.handoff = report.slice(-6000);
  chain.status = chain.steps.every(settledStep) ? 'done' : 'running';
}
const sameScope = (chain: ChainScope, scope: ChainScope) =>
  chain.provider === scope.provider && chain.cwd === scope.cwd && chain.account === scope.account;
const scopeHash = ({cwd, provider, account}: ChainScope) =>
  createHash('sha256').update(JSON.stringify([cwd, provider, account])).digest('hex');
const outputLimit = 12000;
async function sourceFileAt(folder:string,relative:string) {
  const file=await allowedPath([folder],path.join(folder,...relative.split('/')));
  if(!(await stat(file)).isFile())throw new HttpError(400,'A selected source must be a file.');
}
function captureOutput(chain: MarkdownChainDetail, step: MarkdownChainStep, job: JobView) {
  const children = new Map((step.subtasks ?? []).map(child => [child.id, child]));
  for (const message of job.messages) for (const block of message.blocks) {
    const agent = block.agent;
    if (agent) children.set(agent.id, {id:agent.id, name:agent.name.slice(0, 160), status:agent.status});
  }
  if (children.size) step.subtasks = [...children.values()];
  // Providers may still retain an outstanding delta when a job terminates.
  // A committed final answer is the source of the completed step's result.
  let text = job.status === 'done' ? '' : job.partial;
  for (let i = job.messages.length - 1; !text && i >= 0; --i) {
    const message = job.messages[i];
    if (message.role === 'assistant')
      text = message.blocks.filter(b => b.type === 'text').map(b => b.text || '').join('\n').trimEnd();
  }
  if (!text) text = job.partial;
  const marker = chainCompletionMarker(chain.id, chain.steps.indexOf(step));
  if (text.trimEnd().split(/\r?\n/).at(-1)?.trim() === marker) {
    text = text.slice(0, text.lastIndexOf(marker)).trimEnd();
    if (chain.loop) text = readLoopDecision(text, chain.id).text;
    delete step.output;
    delete step.outputTruncated;
  }
  if (text) {
    step.output = text.slice(-outputLimit);
    if (text.length > outputLimit) step.outputTruncated = true;
    else delete step.outputTruncated;
  }
}
function livePhase(job: JobView): MarkdownChainStep['phase'] {
  if (job.status !== 'running') return;
  if (job.approvals.length) return job.approvals.some(a => a.tool === 'AskUserQuestion') ? 'question' : 'approval';
  if (job.partial) return 'responding';
  const action = activityItem(job).action;
  if (action !== 'responding') return action;
}
function summary(chain: MarkdownChainDetail): MarkdownChainSummary {
  const {loop} = chain;
  return {id: chain.id, name: chain.name, status: chain.status,
    ...(loop ? {loop: {lap: loop.lap, maxLaps: loop.maxLaps, ...(loop.ended ? {ended: loop.ended} : {})}} : {}),
    stepsDone: chain.steps.filter(step => step.status === 'done').length, stepCount: chain.steps.length};
}

export class MarkdownChains {
  private records = new Map<string, RecordV1>();
  private deleted = new Map<string, DeletedRecord>();
  private restored?: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  constructor(private options: Options) {}

  private action<T>(fn: () => Promise<T>): Promise<T> {
    const operation = this.tail.then(fn);
    this.tail = operation.catch(() => {});
    return operation;
  }
  private async writeRecord(id: string, record: RecordV1 | DeletedRecord) {
    const file = path.join(this.options.file, id + '.json');
    await mkdir(this.options.file, {recursive: true, mode: 0o700});
    await writeDurable(file, JSON.stringify(record));
  }
  private async save(record: RecordV1) {
    record.chain.steps.forEach((_,index)=>updateAttempt(record,index));
    await this.writeRecord(record.chain.id, record);
    this.records.set(record.chain.id.toLowerCase(), record);
  }
  /** A failed restore is tried again by the next request instead of failing every chat list until the host restarts. */
  init() {
    return this.restored ??= this.restore().catch(error => { this.restored = undefined; throw error; });
  }
  private async restore() {
    let names: string[];
    try { names = await readdir(this.options.file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      names = [];
    }
    for (const name of names.filter(name => name.endsWith('.json') && uuid.test(name.slice(0, -5)))) {
      const file = path.join(this.options.file, name);
      let record: RecordV1 | DeletedRecord;
      try {
        record = JSON.parse(await readFile(file, 'utf8'));
        if (!record || typeof record !== 'object') throw new SyntaxError('Cannot restore Markdown chain record.');
        const removed = 'deletedScope' in record && record.version === 1 && /^[a-f\d]{64}$/.test(record.deletedScope);
        if (!removed && (!('chain' in record) || record.version !== 1 || record.chain?.id + '.json' !== name || !Array.isArray(record.chain.steps)))
          throw new SyntaxError('Cannot restore Markdown chain record.');
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        // One damaged record (an interrupted write) must not switch every chat list off: it is kept aside and the other tasks load.
        await replaceFile(file, file + '.corrupt-' + Date.now()).catch(() => {});
        console.error(new Date().toISOString(), 'A damaged task record was set aside; the other tasks stay available.');
        continue;
      }
      if ('deletedScope' in record) {
        this.deleted.set(name.slice(0, -5).toLowerCase(), record);
        continue;
      }
      // A durable launch intent might already have reached the provider. Never
      // replay it after restart, even if its session ID had not arrived yet.
      for(const tree of [...Object.values(record.trees??{}),...(record.pastTrees??[])]){
        try{const cwd=await this.options.worktrees?.verify(tree);if(cwd)this.options.registerTree?.(cwd);}catch{/* Missing trees never grant access. */}
      }
      const hadLinks = record.chain.steps.some(s => s.jobId);
      record.chain.steps.forEach((_,index)=>updateAttempt(record,index));
      for (const step of record.chain.steps) delete step.jobId;
      if (record.chain.status === 'running' && record.chain.steps.some(s => s.retryAt !== undefined)) {
        await this.save(record);
        this.schedule();
      } else if (record.chain.status === 'running') {
        const step = record.chain.steps.find(activeStep) || record.chain.steps.find(s => s.status === 'pending');
        if (step) {
          delete step.paused; delete step.resumeJobId;
          step.status = 'failed'; step.error = 'Host restarted. Check the chat before repeating this task.';
          continueLoopAfterStepFailure(record.chain, step);
        }
        if (record.chain.loop && step) this.nextLap(record);
        else record.chain.status = 'failed';
        await this.save(record);
        if (record.chain.status === 'running') this.schedule();
      } else {
        // Saved sessions remain navigable. Previous live job IDs cannot be
        // used to open transcripts on the new process.
        if (hadLinks) await this.save(record);
        else this.records.set(record.chain.id.toLowerCase(), record);
      }
    }
    for(const record of [...this.records.values()])if(record.deleting){
      try{await this.finishRemoval(structuredClone(record),record.deleting);}catch{/* A later scoped request can retry the durable confirmed selection. */}
    }
  }
  private schedule() {
    if (this.closed || this.timer || !this.hasWork()) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.tick().catch(() => {}).finally(() => this.schedule());
    }, this.options.intervalMs ?? 1000);
    this.timer.unref();
  }
  hasWork() { return [...this.records.values()].some(r => r.chain.status === 'running'); }
  // A provider may announce its session between two scheduler observations.
  chatMembership(runs: ReadonlyArray<Pick<JobView,'id'|'sessionId'|'provider'|'account'>>) {
    const sessions=new Set<string>(), jobs=new Set<string>();
    const key=(provider:string,account:string|undefined,id:string)=>JSON.stringify([provider,account||'',id]);
    for(const record of this.records.values())for(const attempt of record.attempts??[]){
      if(attempt.jobId)jobs.add(key(attempt.provider,attempt.account,attempt.jobId));
      if(attempt.sessionId)sessions.add(key(attempt.provider,attempt.account,attempt.sessionId));
    }
    for(const run of runs){
      const provider=run.provider||'claude';
      if(run.sessionId&&jobs.has(key(provider,run.account,run.id)))sessions.add(key(provider,run.account,run.sessionId));
    }
    return (provider:string,chat:{sessionId?:string;id?:string;account?:string})=>
      Boolean(chat.sessionId&&sessions.has(key(provider,chat.account,chat.sessionId))||chat.id&&jobs.has(key(provider,chat.account,chat.id)));
  }
  observingJobs(){
    const ids=new Set<string>();
    for(const {chain} of this.records.values())if(chain.status==='running'){
      for(const step of chain.steps)if(step.jobId&&activeStep(step))ids.add(step.jobId);
    }
    return ids;
  }

  private async detail(record: RecordV1) {
    const chain = structuredClone(record.chain);
    const counts=new Map<number,number>();
    for(const attempt of record.attempts??[]){
      const step=chain.steps[attempt.step];
      if(!step)continue;
      const number=(counts.get(attempt.step)??0)+1;
      counts.set(attempt.step,number);
      if(!attempt.sessionId||attempt.sessionId===step.sessionId||attempt.jobId&&attempt.jobId===step.jobId)continue;
      const {provider,account,cwd,sessionId}=attempt;
      (step.previousChats??=[]).push({provider,account,cwd,sessionId,attempt:number});
    }
    if (record.settings?.model) chain.model = record.settings.model;
    if (chain.account && !chain.accountName) {
      const name = await this.options.accountName?.(chain.account);
      if (name) chain.accountName = name;
    }
    return chain;
  }

  async create(input: ChainInput) {
    await this.init();
    return this.action(async () => {
      if (this.closed) throw new HttpError(503, 'Host is shutting down.');
      if (!uuid.test(input.id) || !input.tasks.length) throw new HttpError(400, 'Invalid task chain.');
      const laps = input.loop?.maxLaps;
      if (laps !== undefined && (!Number.isInteger(laps) || laps < 2 || laps > CHAIN_LOOP_MAX_LAPS))
        throw new HttpError(400, 'A looped chain needs a lap limit from 2 to ' + CHAIN_LOOP_MAX_LAPS + '.');
      const key = input.id.toLowerCase();
      if (this.deleted.has(key)) throw new HttpError(409, 'Chain identifier already used.');
      const {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes} = input;
      const settings = {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes};
      const sources=input.sourceFiles??[];
      const labels=new Set<string>();
      let uploadBytes=0;
      for(const file of sources){
        if(labels.has(file.name))throw new HttpError(400,'Selected source file names must be unique.');
        labels.add(file.name);
        if(file.projectPath!==undefined && (file.text!==undefined ||
          /[\\:\x00-\x1f]/.test(file.projectPath) || file.projectPath.split('/').some(p=>!p||p==='.'||p==='..')))
          throw new HttpError(400,'Invalid project-relative source file path.');
        if(file.text!==undefined)uploadBytes+=Buffer.byteLength(file.text);
      }
      if(uploadBytes>1024*1024)throw new HttpError(413,'Uploaded source text exceeds 1 MiB.');
      const sourceUploads=sources.flatMap(file=>file.text===undefined?[]:[{name:file.name,text:file.text}]);
      const chain: MarkdownChainDetail = {
        id: input.id, cwd: input.cwd, provider: input.provider, account: input.account, name: input.name,
        context: input.context, status: 'running',
        ...(input.parallelSubtasks!==undefined?{parallelSubtasks:input.parallelSubtasks}:{}),
        ...(input.loop?{loop:{maxLaps:input.loop.maxLaps,...(input.loop.until?.trim()?{until:input.loop.until.trim()}:{}),...(input.loop.stopIdle?{stopIdle:true}:{}),lap:1}}:{}),
        ...(sources.length?{sourceFiles:sources.map(({name,projectPath})=>({name,projectPath}))}:{}),
        steps: input.tasks.map(({title, source, body, executor}) => ({title, source, body, executor:executor && {...executor}, status: 'pending'}))
      };
      const fingerprint = createHash('sha256').update(JSON.stringify([settings, chain,...(sourceUploads.length?[sourceUploads]:[])])).digest('hex');
      const previous = this.records.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'Chain identifier already used.');
        return this.detail(previous);
      }
      const record: RecordV1 = {version: 1, created: Date.now(), fingerprint, settings, chain};
      for(const file of sources)if(file.projectPath)await sourceFileAt(chain.cwd,file.projectPath);
      if(sourceUploads.length)record.sourceUploads=sourceUploads;
      record.stacked = await this.options.worktrees?.hasRepository(input.cwd);
      if (chain.account) chain.accountName = await this.options.accountName?.(chain.account);
      const accounts=new Map<string,string|undefined>();
      if(chain.account)accounts.set(chain.account,chain.accountName);
      for(const step of chain.steps){
        if(!step.executor)continue;
        const {account,model}=stepLaunchSettings(chain,settings,step.executor);
        if(model)step.executor.model=model;
        if(account){
          if(!accounts.has(account))accounts.set(account,await this.options.accountName?.(account));
          step.executorAccountName=accounts.get(account);
        }
      }
      await this.save(record);
      this.schedule();
      return this.detail(record);
    });
  }
  async list(scope: ChainScope): Promise<MarkdownChainSummary[]> {
    await this.init();
    return [...this.records.values()].filter(r => sameScope(r.chain, scope))
      .sort((a, b) => b.created - a.created).map(({chain}) => summary(chain));
  }
  async findStep(scope: ChainScope, match: {sessionId?: string; jobId?: string}) {
    await this.init();
    for (const {chain,attempts} of this.records.values()) {
      let stepIndex = chain.steps.findIndex(step => {
        const owner=step.executor??chain;
        return owner.provider===scope.provider && owner.account===scope.account &&
          (chain.cwd===scope.cwd || step.launchCwd===scope.cwd || step.worktreeCwd===scope.cwd) &&
          ((match.sessionId && step.sessionId===match.sessionId) || (match.jobId && step.jobId===match.jobId));
      });
      if(stepIndex<0&&match.sessionId){
        const attempt=attempts?.find(a=>a.provider===scope.provider&&a.account===scope.account&&(a.cwd===scope.cwd||chain.cwd===scope.cwd)&&a.sessionId===match.sessionId);
        if(attempt)stepIndex=attempt.step;
      }
      if(stepIndex>=0){
        const owner={cwd:chain.cwd,provider:chain.provider,account:chain.account};
        return [{...summary(chain),stepIndex,...(!sameScope(chain,scope)?{owner}:{})}];
      }
    }
    return [];
  }
  async notificationTarget(provider:ChainScope['provider'],cwd:string,match:{sessionId?:string;jobId?:string}){
    await this.init();
    let target:{id:string;owner:ChainScope}|null=null;
    for(const {chain,attempts} of this.records.values()){
      const found=attempts?.some(attempt=>attempt.provider===provider&&(attempt.cwd===cwd||chain.cwd===cwd)&&
        (match.jobId&&match.jobId===attempt.jobId||match.sessionId&&match.sessionId===attempt.sessionId));
      if(!found)continue;
      if(target)return null;
      target={id:chain.id,owner:{cwd:chain.cwd,provider:chain.provider,account:chain.account}};
    }
    return target;
  }
  private record(id: string, scope: ChainScope) {
    const record = this.records.get(id.toLowerCase());
    if (!record || !sameScope(record.chain, scope)) throw new HttpError(404, 'Task chain not found.');
    return record;
  }
  async audit(id:string,scope:ChainScope){
    await this.init();
    const removed=this.deleted.get(id.toLowerCase());
    if(removed?.deletedScope===scopeHash(scope)&&removed.audit&&this.options.worktrees){
      const {tree,base,head}=removed.audit;return {diff:await this.options.worktrees.diff(tree,base,head)};
    }
    const record=this.record(id,scope),steps=record.chain.steps;
    const tree=record.trees?.[steps.length-1],base=record.chain.loop?.baseCommit??steps[0]?.baseCommit,head=steps.at(-1)?.headCommit;
    if(record.chain.status!=='done'||!tree||!base||!head||!this.options.worktrees)throw new HttpError(409,'No completed branch chain to review.');
    return {diff:await this.options.worktrees.diff(tree,base,head)};
  }
  async get(id: string, scope: ChainScope) {
    await this.init();
    const chain = await this.detail(this.record(id, scope));
    const step = chain.steps.find(activeStep);
    if (step?.jobId) {
      const job = await this.options.view(step.jobId);
      if (job) {
        captureOutput(chain, step, job);
        step.phase = livePhase(job);
      }
    }
    // Earlier records kept only the confirmed handoff after completion.
    for (const s of chain.steps) if (!s.output && s.handoff) {
      s.output = s.handoff;
      if (s.handoff.length === 6000 && s.handoff.startsWith('…\n')) s.outputTruncated = true;
    }
    return chain;
  }
  private terminal(id:string,scope:ChainScope){
    const record=this.record(id,scope);
    if(record.chain.status==='running')throw new HttpError(409,'Stop the running chain before deleting it.');
    return record;
  }
  private async affected(record:RecordV1){
    const attempts=structuredClone(record.attempts||[]);
    const targets=new Map<string,ChainChatTarget>(),shared=new Set<string>();
    for(const other of this.records.values())if(other.chain.id!==record.chain.id){
      for(const attempt of other.attempts||[])if(attempt.sessionId)shared.add(attempt.provider+':'+attempt.sessionId);
    }
    let unknownCount=0;
    for(const attempt of attempts){
      if(!attempt.sessionId&&attempt.jobId){
        const job=await this.options.view(attempt.jobId);
        if(job?.id===attempt.jobId&&(job.provider||'claude')===attempt.provider&&job.account===attempt.account&&job.cwd===attempt.cwd)attempt.sessionId=job.sessionId;
      }
      if(!attempt.sessionId){unknownCount++;continue;}
      const {provider,account,sessionId,cwd}=attempt;
      const chat={provider,...(account?{account}:{}),sessionId,cwd};
      targets.set(chatKey(chat),chat);
    }
    record.chain.steps.forEach((step,index)=>{
      const count=attempts.filter(a=>a.step===index).length;
      const minimum=(step.retryCount||0)+(step.status==='done'||step.status==='failed'&&count>0?1:0);
      unknownCount+=Math.max(0,minimum-count);
    });
    return {targets:[...targets.values()],unknownCount,shared};
  }
  private async inspectRemoval(record:RecordV1,confirmed:ChainDeleteChat[]|undefined,eraseOriginals:boolean){
    if(!this.options.manageChats)throw new HttpError(503,'Chat deletion is unavailable.');
    const {targets,unknownCount,shared}=await this.affected(record);
    const keys=new Set(targets.map(chatKey));
    if(confirmed?.some(chat=>!keys.has(chatKey(chat))))throw new HttpError(409,'The confirmed chats do not belong to this chain.');
    const permitted=targets.filter(s=>!shared.has(s.provider+':'+s.sessionId));
    const allowedKeys=new Set(permitted.map(chatKey));
    const result=await this.options.manageChats(permitted,confirmed?.filter(s=>allowedKeys.has(chatKey(s))),eraseOriginals);
    result.unavailable.push(...targets.filter(s=>!allowedKeys.has(chatKey(s))).map(({cwd,...chat})=>chat));
    if(unknownCount)result.unknownCount=unknownCount;
    return result;
  }
  async previewRemoval(id:string,scope:ChainScope,eraseOriginals:boolean){
    await this.init();
    return this.action(()=>this.inspectRemoval(this.terminal(id,scope),undefined,eraseOriginals));
  }
  private async finishRemoval(record:RecordV1,intent?:Intent){
    let result:RemovalResult|undefined;
    if(intent){
      const report=await this.inspectRemoval(record,intent.chats,intent.eraseOriginals);
      const remaining=await this.inspectRemoval(record,undefined,intent.eraseOriginals);
      const blocked=!!(remaining.chats.length||remaining.running.length||remaining.unavailable.length||remaining.failed?.length||remaining.unsupported?.length||remaining.unknownCount);
      for(const field of ['running','unavailable','failed','unsupported'] as const){
        const items=report[field]??=[],known=new Set(items.map(chatKey));
        items.push(...(remaining[field]||[]).filter(chat=>!known.has(chatKey(chat))));
      }
      result={...report,ok:!blocked&&!report.failed?.length};
      if(!result.ok){
        delete record.deleting;await this.save(record);return result;
      }
      if(intent.eraseOriginals)await this.options.eraseChainFiles?.(record.chain.id,[...new Set((record.attempts||[]).flatMap(a=>a.jobId?[a.jobId]:[]))]);
    }
    const {chain}=record,key=chain.id.toLowerCase(),last=chain.steps.length-1;
    const tree=record.trees?.[last],base=chain.loop?.baseCommit??chain.steps[0]?.baseCommit,head=chain.steps[last]?.headCommit;
    const tombstone:DeletedRecord={version:1,deletedScope:scopeHash(chain),...(result&&intent?{result,intentHash:intentHash(intent)}:{}),
      ...(chain.status==='done'&&tree&&base&&head?{audit:{tree,base,head}}:{})};
    await this.writeRecord(chain.id,tombstone);
    this.deleted.set(key,tombstone);this.records.delete(key);
    return result||{ok:true};
  }
  async remove(id:string,scope:ChainScope,intent?:Intent){
    await this.init();
    return this.action(async()=>{
      const old=this.deleted.get(id.toLowerCase());
      if(old?.deletedScope===scopeHash(scope)){
        if(!intent)return {ok:true};
        if(old.intentHash!==intentHash(intent)||!old.result)throw new HttpError(409,'This chain was already deleted with a different selection.');
        return old.result;
      }
      const record=structuredClone(this.terminal(id,scope));
      if(intent){
        const {targets}=await this.affected(record),keys=new Set(targets.map(chatKey));
        if(intent.chats.some(chat=>!keys.has(chatKey(chat))))throw new HttpError(409,'The confirmed chats do not belong to this chain.');
        record.deleting=intent;await this.save(record);
      }
      return this.finishRemoval(record,intent);
    });
  }
  async stop(id: string, scope: ChainScope) {
    await this.init();
    return this.action(async () => {
      const record = structuredClone(this.record(id, scope));
      if (record.chain.status !== 'running') return this.detail(record);
      const step = record.chain.steps.find(activeStep);
      if (step?.jobId) {
        const job = await this.options.view(step.jobId);
        if (job) {
          this.observe(record.chain, step, job);
          await this.verifyStep(record,record.chain.steps.indexOf(step));
          if (job.status === 'running') await this.options.stop(step.jobId);
        } else delete step.jobId;
      }
      const retry = record.chain.steps.find(s => s.retryAt !== undefined);
      if (retry) { delete retry.retryAt; retry.status = 'stopped'; }
      const paused = record.chain.steps.find(s => s.paused && !s.jobId && s.status === 'pending');
      if (paused) { delete paused.paused; delete paused.resumeJobId; paused.status = 'stopped'; }
      if (step && activeStep(step)) step.status = 'stopped';
      if (record.chain.status === 'running') record.chain.status = 'stopped';
      await this.save(record);
      return this.detail(record);
    });
  }
  private observe(chain: MarkdownChainDetail, step: MarkdownChainStep, job: JobView) {
    if (job.sessionId) step.sessionId = job.sessionId;
    captureOutput(chain, step, job);
    if (job.status === 'running') {
      step.status = job.approvals.length ? 'waiting' : 'running';
      // A continuation waiting for the local model to come back still shows the step as paused.
      if (job.heldFor) step.paused = job.heldFor; else delete step.paused;
      return;
    }
    // Paused, not stopped: the chain goes on and the step continues in its session once the model is back.
    if (job.status === 'stopped' && job.pausedFor) {
      step.status = 'pending'; step.paused = job.pausedFor;
      if (job.resumedBy) step.resumeJobId = job.resumedBy;
      return;
    }
    delete step.paused;
    if (job.status === 'done') {
      const last = job.messages.filter(m => m.role === 'assistant').at(-1);
      const reply = last?.blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trimEnd() || '';
      const marker = chainCompletionMarker(chain.id, chain.steps.indexOf(step));
      if (reply.split(/\r?\n/).at(-1)?.trim() === marker) {
        step.status = 'done';
        let summary = reply.slice(0, reply.lastIndexOf(marker)).trim();
        if (chain.loop) {
          const decision = readLoopDecision(summary, chain.id);
          summary = decision.text.trim();
          if (decision.finished && step === chain.steps.at(-1)) chain.loop.ended = 'condition';
        }
        step.handoff = summary.length > 6000 ? '…\n' + summary.slice(-5998) : summary;
        if (chain.steps.every(s => s.status === 'done')) chain.status = 'done';
        return;
      }
      step.retryCount = (step.retryCount ?? 0) + 1;
      step.retryReport = step.output || step.retryReport;
      // A loop must not spin on a step that never confirms its result.
      if (chain.loop && step.retryCount > CHAIN_LOOP_RETRIES) {
        step.status = 'failed'; step.error = 'The step did not confirm completion after ' + CHAIN_LOOP_RETRIES + ' retries. Continuing with the next step.';
        continueLoopAfterStepFailure(chain, step);
        return;
      }
      step.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(step.retryCount, 6));
      step.status = 'pending';
      return;
    } else if (job.error) step.error = job.error;
    step.status = job.status === 'stopped' ? 'stopped' : 'failed';
    continueLoopAfterStepFailure(chain, step);
  }
  private async verifyStep(record:RecordV1,index:number) {
    const step=record.chain.steps[index],tree=record.trees?.[index];
    if(step.status!=='done'||!tree)return;
    const head=await this.options.worktrees!.completedHead(tree);
    if(head){step.headCommit=head;return;}
    delete step.handoff;
    delete record.chain.loop?.ended;
    step.status='pending';
    record.chain.status='running';
    step.retryCount=(step.retryCount??0)+1;
    step.retryReport='Commit the outstanding intended changes in the assigned worktree before completing this step.';
    step.retryAt=Date.now()+2000;
  }
  /** Ends a finished lap: the loop stops by its condition, its lap limit or an idle lap; otherwise every step is queued again. */
  private nextLap(record:RecordV1) {
    const {chain}=record,loop=chain.loop;
    if(!loop||chain.status!=='done')return;
    const first=chain.steps[0],last=chain.steps.at(-1)!;
    loop.baseCommit??=first.baseCommit;
    if(loop.ended)return;
    if(loop.lap>=loop.maxLaps){loop.ended='limit';return;}
    if(loop.stopIdle&&last.headCommit&&last.headCommit===first.baseCommit){loop.ended='idle';return;}
    if(last.handoff)loop.carry=last.handoff;else delete loop.carry;
    if(last.headCommit)loop.headCommit=last.headCommit;
    loop.lap++;
    if(record.trees){(record.pastTrees??=[]).push(...Object.values(record.trees));delete record.trees;}
    chain.steps=chain.steps.map(({title,body,source,executor,executorAccountName})=>({title,body,source,
      ...(executor?{executor}:{}),...(executorAccountName?{executorAccountName}:{}),status:'pending' as const}));
    chain.status='running';
  }
  private async advance(saved: RecordV1) {
    let record = structuredClone(saved);
    let chain = record.chain;
    const index = chain.steps.findIndex(s => activeStep(s) || s.status === 'pending');
    const step = chain.steps[index];
    if (!step) return;
    if (step.retryAt !== undefined) {
      if (step.retryAt > Date.now()) return;
      delete step.retryAt;
      delete step.jobId;
      delete step.sessionId;
      delete step.output;
      delete step.outputTruncated;
      delete step.subtasks;
    }
    if (step.jobId) {
      const job = await this.options.view(step.jobId);
      if (!job) {
        delete step.jobId;
        step.status = 'failed'; step.error = 'The host lost the job. Check the chat before repeating this task.';
        continueLoopAfterStepFailure(chain, step);
      } else this.observe(chain, step, job);
      await this.verifyStep(record,index);
      const old = saved.chain.steps[index];
      const childrenChanged = JSON.stringify(step.subtasks) !== JSON.stringify(old.subtasks);
      const changed = childrenChanged || step.status !== old.status || step.sessionId !== old.sessionId;
      // The attempt of the finished lap is recorded before its steps are queued again.
      if (changed) record.chain.steps.forEach((_,i)=>updateAttempt(record,i));
      // A paused step lets go of its stopped job; the next tick starts its continuation.
      if (step.paused && step.status === 'pending') delete step.jobId;
      this.nextLap(record);
      if (changed) await this.save(record);
      return;
    }
    const resume = step.paused && step.sessionId ? step.sessionId : undefined;
    const jobId = resume && step.resumeJobId || randomUUID();
    delete step.resumeJobId;
    if (!resume) delete step.paused;
    step.jobId = jobId; step.status = 'running';
    await this.save(record);
    record = structuredClone(record); chain = record.chain;
    const current = chain.steps[index];
    try {
      const {id, name, context, cwd} = chain;
      const uploads=new Map(record.sourceUploads?.map(file=>[file.name,file.text]));
      const input = {id, name, context, cwd, ...stepLaunchSettings(chain,record.settings,current.executor),
        sourceFiles:chain.sourceFiles?.map(file=>({...file,text:uploads.get(file.name)})),
        tasks: chain.steps.map(({title, source, body}) => ({title, source, body}))};
      current.launchCwd=cwd;
      if(record.stacked){
        const trees=record.trees??={};
        const manager=this.options.worktrees!;
        const tree=trees[index]??=await manager.create(jobId,cwd,chain.steps[index-1]?.headCommit??(index===0?chain.loop?.headCommit:undefined));
        current.branch=tree.branch;
        current.baseCommit=tree.baseCommit;
        current.launchCwd=await manager.projectDirectory(tree);
        if(chain.sourceFiles){
          current.worktreeSources=[];
          for(const file of chain.sourceFiles){
            if(!file.projectPath)continue;
            try{await sourceFileAt(current.launchCwd,file.projectPath);current.worktreeSources.push(file.projectPath);}
            catch(error){if(!(error instanceof HttpError) || ![403,404,400].includes(error.status))throw error;}
          }
        }
        current.worktreeCwd=tree.cwd;
        this.options.registerTree?.(current.worktreeCwd);
      }
      if(input.sourceFiles?.length && this.options.prepareSources && !resume){
        const paths=await this.options.prepareSources(id,input.sourceFiles);
        if(Object.keys(paths).length)current.uploadPaths=paths;
      }
      await this.save(structuredClone(record));
      const job = resume
        ? await this.options.start(input, jobId, CHAIN_SWAP_CONTINUATION, current.launchCwd, [], resume)
        : await this.options.start(input, jobId, buildChainStepPrompt(chain, index),current.launchCwd,Object.values(current.uploadPaths??{}));
      this.observe(chain, current, job);
    } catch (error) {
      const started = await this.options.view(jobId);
      if (started) this.observe(chain, current, started);
      else {
        delete current.jobId;
        current.status = 'failed';
        current.error = error instanceof HttpError ? error.message : 'Could not start the step. Check the provider connection.';
        continueLoopAfterStepFailure(chain, current);
      }
    }
    await this.verifyStep(record,index);
    record.chain.steps.forEach((_,i)=>updateAttempt(record,i));
    this.nextLap(record);
    await this.save(record);
  }
  async tick() {
    await this.init();
    return this.action(async () => {
      if (this.closed) return;
      const errors: unknown[] = [];
      for (const record of this.records.values()) {
        if (record.chain.status === 'running') {
          try { await this.advance(record); } catch (error) { errors.push(error); }
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Could not update a task chain.');
    });
  }
  async close() {
    this.closed = true; clearTimeout(this.timer);
    await this.tail;
  }
}
