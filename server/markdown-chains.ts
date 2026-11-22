import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildChainStepPrompt, chainCompletionMarker, type MarkdownChainDetail, type MarkdownChainStep, type MarkdownChainSummary} from '../src/markdown-chain.js';
import type {CodexAccess} from './codex-access.js';
import {HttpError} from './security.js';
import type {JobView} from './types.js';
import {activityItem} from './activity.js';

export type ChainScope = Pick<MarkdownChainDetail, 'cwd' | 'provider' | 'account'>;
type Task = Pick<MarkdownChainStep, 'title' | 'body' | 'source'>;
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
export type ChainInput = ChainScope & LaunchSettings & {id: string; name: string; context: string; tasks: Task[]};
type RecordV1 = { stacked?:boolean; trees?:Record<number,TaskWorktree>;version: 1; created: number; fingerprint: string; settings: LaunchSettings; chain: MarkdownChainDetail};
type DeletedRecord = {version: 1; deletedScope: string};
import type {TaskWorktree,TaskWorktrees} from './task-worktrees.js';
type Options = {
  worktrees?:TaskWorktrees;
  registerTree?(cwd:string):void;
  file: string;
  accountName?(id: string): Promise<string | undefined>;
  start(input: ChainInput, jobId: string, prompt: string, verifiedCwd?:string): Promise<JobView> | JobView;
  view(jobId: string): Promise<JobView | undefined> | JobView | undefined;
  stop(jobId: string): Promise<void> | void;
  intervalMs?: number;
};
const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const activeStep = (step: MarkdownChainStep) => step.status === 'running' || step.status === 'waiting';
const sameScope = (chain: ChainScope, scope: ChainScope) =>
  chain.provider === scope.provider && chain.cwd === scope.cwd && chain.account === scope.account;
const scopeHash = ({cwd, provider, account}: ChainScope) =>
  createHash('sha256').update(JSON.stringify([cwd, provider, account])).digest('hex');
const outputLimit = 12000;
function captureOutput(chain: MarkdownChainDetail, step: MarkdownChainStep, job: JobView) {
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
  return {id: chain.id, name: chain.name, status: chain.status,
    stepsDone: chain.steps.filter(step => step.status === 'done').length, stepCount: chain.steps.length};
}

export class MarkdownChains {
  private records = new Map<string, RecordV1>();
  private deleted = new Map<string, string>();
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
    await writeFile(file + '.tmp', JSON.stringify(record), {mode: 0o600});
    await rename(file + '.tmp', file);
  }
  private async save(record: RecordV1) {
    await this.writeRecord(record.chain.id, record);
    this.records.set(record.chain.id.toLowerCase(), record);
  }
  init() {
    return this.restored ??= this.restore();
  }
  private async restore() {
    let names: string[];
    try { names = await readdir(this.options.file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      names = [];
    }
    for (const name of names.filter(name => name.endsWith('.json') && uuid.test(name.slice(0, -5)))) {
      const record: RecordV1 | DeletedRecord = JSON.parse(await readFile(path.join(this.options.file, name), 'utf8'));
      if ('deletedScope' in record && record.version === 1 && /^[a-f\d]{64}$/.test(record.deletedScope)) {
        this.deleted.set(name.slice(0, -5).toLowerCase(), record.deletedScope);
        continue;
      }
      if (!('chain' in record)) throw new Error('Cannot restore Markdown chain record.');
      if (record.version !== 1 || record.chain?.id + '.json' !== name || !Array.isArray(record.chain.steps))
        throw new Error('Cannot restore Markdown chain record.');
      // A durable launch intent might already have reached the provider. Never
      // replay it after restart, even if its session ID had not arrived yet.
      for(const tree of Object.values(record.trees??{})){
        try{const cwd=await this.options.worktrees?.verify(tree);if(cwd)this.options.registerTree?.(cwd);}catch{/* Missing trees never grant access. */}
      }
      const hadLinks = record.chain.steps.some(s => s.jobId);
      for (const step of record.chain.steps) delete step.jobId;
      if (record.chain.status === 'running' && record.chain.steps.some(s => s.retryAt !== undefined)) {
        await this.save(record);
        this.schedule();
      } else if (record.chain.status === 'running') {
        const step = record.chain.steps.find(activeStep) || record.chain.steps.find(s => s.status === 'pending');
        if (step) {
          step.status = 'failed'; step.error = 'Host restarted. Check the chat before repeating this task.';
        }
        record.chain.status = 'failed';
        await this.save(record);
      } else {
        // Saved sessions remain navigable. Previous live job IDs cannot be
        // used to open transcripts on the new process.
        if (hadLinks) await this.save(record);
        else this.records.set(record.chain.id.toLowerCase(), record);
      }
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

  private async detail(record: RecordV1) {
    const chain = structuredClone(record.chain);
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
      const key = input.id.toLowerCase();
      if (this.deleted.has(key)) throw new HttpError(409, 'Chain identifier already used.');
      const {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes} = input;
      const settings = {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes};
      const chain: MarkdownChainDetail = {
        id: input.id, cwd: input.cwd, provider: input.provider, account: input.account, name: input.name,
        context: input.context, status: 'running',
        steps: input.tasks.map(({title, source, body}) => ({title, source, body, status: 'pending'}))
      };
      const fingerprint = createHash('sha256').update(JSON.stringify([settings, chain])).digest('hex');
      const previous = this.records.get(key);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'Chain identifier already used.');
        return this.detail(previous);
      }
      const record: RecordV1 = {version: 1, created: Date.now(), fingerprint, settings, chain};
      record.stacked = await this.options.worktrees?.hasRepository(input.cwd);
      if (chain.account) chain.accountName = await this.options.accountName?.(chain.account);
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
    for (const {chain} of this.records.values()) {
      if (chain.provider!==scope.provider || chain.account!==scope.account) continue;
      const stepIndex = chain.steps.findIndex(step =>
        (match.sessionId && step.sessionId === match.sessionId) || (match.jobId && step.jobId === match.jobId));
      if (stepIndex >= 0 && (chain.cwd===scope.cwd || chain.steps[stepIndex].worktreeCwd===scope.cwd)) return [{...summary(chain), stepIndex}];
    }
    return [];
  }
  private record(id: string, scope: ChainScope) {
    const record = this.records.get(id.toLowerCase());
    if (!record || !sameScope(record.chain, scope)) throw new HttpError(404, 'Task chain not found.');
    return record;
  }
  async audit(id:string,scope:ChainScope){
    await this.init();
    const record=this.record(id,scope),steps=record.chain.steps;
    const tree=record.trees?.[steps.length-1],base=steps[0]?.baseCommit,head=steps.at(-1)?.headCommit;
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
  async remove(id: string, scope: ChainScope) {
    await this.init();
    return this.action(async () => {
      const deletedScope = scopeHash(scope);
      const key = id.toLowerCase();
      if (this.deleted.get(key) === deletedScope) return {ok: true};
      const {chain} = this.record(id, scope);
      if (chain.status === 'running') throw new HttpError(409, 'Stop the running chain before deleting it.');
      // A delayed create retry must not resurrect a removed chain and run it again.
      await this.writeRecord(chain.id, {version: 1, deletedScope});
      this.deleted.set(key, deletedScope);
      this.records.delete(key);
      return {ok: true};
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
      return;
    }
    if (job.status === 'done') {
      const last = job.messages.filter(m => m.role === 'assistant').at(-1);
      const reply = last?.blocks.filter(b => b.type === 'text').map(b => b.text).join('\n').trimEnd() || '';
      const marker = chainCompletionMarker(chain.id, chain.steps.indexOf(step));
      if (reply.split(/\r?\n/).at(-1)?.trim() === marker) {
        step.status = 'done';
        const summary = reply.slice(0, reply.lastIndexOf(marker)).trim();
        step.handoff = summary.length > 6000 ? '…\n' + summary.slice(-5998) : summary;
        if (chain.steps.every(s => s.status === 'done')) chain.status = 'done';
        return;
      }
      step.retryCount = (step.retryCount ?? 0) + 1;
      step.retryReport = step.output || step.retryReport;
      step.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(step.retryCount, 6));
      step.status = 'pending';
      return;
    } else if (job.error) step.error = job.error;
    step.status = job.status === 'stopped' ? 'stopped' : 'failed';
    chain.status = step.status;
  }
  private async verifyStep(record:RecordV1,index:number) {
    const step=record.chain.steps[index],tree=record.trees?.[index];
    if(step.status!=='done'||!tree)return;
    const head=await this.options.worktrees!.completedHead(tree);
    if(head){step.headCommit=head;return;}
    delete step.handoff;
    step.status='pending';
    record.chain.status='running';
    step.retryCount=(step.retryCount??0)+1;
    step.retryReport='Commit the outstanding intended changes in the assigned worktree before completing this step.';
    step.retryAt=Date.now()+2000;
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
    }
    if (step.jobId) {
      const job = await this.options.view(step.jobId);
      if (!job) {
        delete step.jobId;
        step.status = 'failed'; step.error = 'The host lost the job. Check the chat before repeating this task.';
        chain.status = 'failed';
      } else this.observe(chain, step, job);
      await this.verifyStep(record,index);
      const old = saved.chain.steps[index];
      if (step.status !== old.status || step.sessionId !== old.sessionId) await this.save(record);
      return;
    }
    const jobId = randomUUID();
    step.jobId = jobId; step.status = 'running';
    await this.save(record);
    record = structuredClone(record); chain = record.chain;
    const current = chain.steps[index];
    try {
      const {id, name, context, cwd, provider, account} = chain;
      const input = {id, name, context, cwd, provider, account, ...record.settings,
        tasks: chain.steps.map(({title, source, body}) => ({title, source, body}))};
      if(record.stacked){
        const trees=record.trees??={};
        const manager=this.options.worktrees!;
        const tree=trees[index]??=await manager.create(jobId,cwd,chain.steps[index-1]?.headCommit);
        current.branch=tree.branch;
        current.baseCommit=tree.baseCommit;
        current.worktreeCwd=await manager.verify(tree);
        this.options.registerTree?.(current.worktreeCwd);
        await this.save(structuredClone(record));
      }
      const job = await this.options.start(input, jobId, buildChainStepPrompt(chain, index),record.trees?.[index]?.cwd);
      this.observe(chain, current, job);
    } catch (error) {
      const started = await this.options.view(jobId);
      if (started) this.observe(chain, current, started);
      else {
        delete current.jobId;
        current.status = 'failed';
        current.error = error instanceof HttpError ? error.message : 'Could not start the step. Check the provider connection.';
        chain.status = 'failed';
      }
    }
    await this.verifyStep(record,index);
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
