import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {buildChainStepPrompt, chainCompletionMarker, type MarkdownChainDetail, type MarkdownChainStep, type MarkdownChainSummary} from '../src/markdown-chain.js';
import type {CodexAccess} from './codex-access.js';
import {HttpError} from './security.js';
import type {JobView} from './types.js';

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
type RecordV1 = {version: 1; created: number; fingerprint: string; settings: LaunchSettings; chain: MarkdownChainDetail};
type Options = {
  file: string;
  start(input: ChainInput, jobId: string, prompt: string): Promise<JobView> | JobView;
  view(jobId: string): Promise<JobView | undefined> | JobView | undefined;
  stop(jobId: string): Promise<void> | void;
  intervalMs?: number;
};
const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const activeStep = (step: MarkdownChainStep) => step.status === 'running' || step.status === 'waiting';
const sameScope = (chain: ChainScope, scope: ChainScope) =>
  chain.provider === scope.provider && chain.cwd === scope.cwd && chain.account === scope.account;
function summary(chain: MarkdownChainDetail): MarkdownChainSummary {
  return {id: chain.id, name: chain.name, status: chain.status,
    stepsDone: chain.steps.filter(step => step.status === 'done').length, stepCount: chain.steps.length};
}

export class MarkdownChains {
  private records = new Map<string, RecordV1>();
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
  private async save(record: RecordV1) {
    const file = path.join(this.options.file, record.chain.id + '.json');
    await mkdir(this.options.file, {recursive: true, mode: 0o700});
    await writeFile(file + '.tmp', JSON.stringify(record), {mode: 0o600});
    await rename(file + '.tmp', file);
    this.records.set(record.chain.id, record);
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
      const record: RecordV1 = JSON.parse(await readFile(path.join(this.options.file, name), 'utf8'));
      if (record.version !== 1 || record.chain?.id + '.json' !== name || !Array.isArray(record.chain.steps))
        throw new Error('Cannot restore Markdown chain record.');
      // A durable launch intent might already have reached the provider. Never
      // replay it after restart, even if its session ID had not arrived yet.
      const hadLinks = record.chain.steps.some(s => s.jobId);
      for (const step of record.chain.steps) delete step.jobId;
      if (record.chain.status === 'running') {
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
        else this.records.set(record.chain.id, record);
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

  async create(input: ChainInput) {
    await this.init();
    return this.action(async () => {
      if (this.closed) throw new HttpError(503, 'Host is shutting down.');
      if (!uuid.test(input.id) || !input.tasks.length) throw new HttpError(400, 'Invalid task chain.');
      const {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes} = input;
      const settings = {model, mode, reasoningEffort, claudeEffort, claudeAccess, codexAccess, maxBudgetUsd, approvalTimeoutMinutes};
      const chain: MarkdownChainDetail = {
        id: input.id, cwd: input.cwd, provider: input.provider, account: input.account, name: input.name,
        context: input.context, status: 'running',
        steps: input.tasks.map(({title, source, body}) => ({title, source, body, status: 'pending'}))
      };
      const fingerprint = createHash('sha256').update(JSON.stringify([settings, chain])).digest('hex');
      const previous = this.records.get(input.id);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new HttpError(409, 'Chain identifier already used.');
        return structuredClone(previous.chain);
      }
      const record: RecordV1 = {version: 1, created: Date.now(), fingerprint, settings, chain};
      await this.save(record);
      this.schedule();
      return structuredClone(record.chain);
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
      if (!sameScope(chain, scope)) continue;
      const stepIndex = chain.steps.findIndex(step =>
        (match.sessionId && step.sessionId === match.sessionId) || (match.jobId && step.jobId === match.jobId));
      if (stepIndex >= 0) return [{...summary(chain), stepIndex}];
    }
    return [];
  }
  private record(id: string, scope: ChainScope) {
    const record = this.records.get(id);
    if (!record || !sameScope(record.chain, scope)) throw new HttpError(404, 'Task chain not found.');
    return record;
  }
  async get(id: string, scope: ChainScope) {
    await this.init();
    return structuredClone(this.record(id, scope).chain);
  }
  async stop(id: string, scope: ChainScope) {
    await this.init();
    return this.action(async () => {
      const record = structuredClone(this.record(id, scope));
      if (record.chain.status !== 'running') return record.chain;
      const step = record.chain.steps.find(activeStep);
      if (step?.jobId) {
        const job = await this.options.view(step.jobId);
        if (job) {
          this.observe(record.chain, step, job);
          if (job.status === 'running') await this.options.stop(step.jobId);
        } else delete step.jobId;
      }
      if (step && activeStep(step)) step.status = 'stopped';
      if (record.chain.status === 'running') record.chain.status = 'stopped';
      await this.save(record);
      return structuredClone(record.chain);
    });
  }
  private observe(chain: MarkdownChainDetail, step: MarkdownChainStep, job: JobView) {
    if (job.sessionId) step.sessionId = job.sessionId;
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
      step.error = 'The chat ended without confirming that the step was completed.';
    } else if (job.error) step.error = job.error;
    step.status = job.status === 'stopped' ? 'stopped' : 'failed';
    chain.status = step.status;
  }
  private async advance(saved: RecordV1) {
    let record = structuredClone(saved);
    let chain = record.chain;
    const index = chain.steps.findIndex(s => activeStep(s) || s.status === 'pending');
    const step = chain.steps[index];
    if (!step) return;
    if (step.jobId) {
      const job = await this.options.view(step.jobId);
      if (!job) {
        delete step.jobId;
        step.status = 'failed'; step.error = 'The host lost the job. Check the chat before repeating this task.';
        chain.status = 'failed';
      } else this.observe(chain, step, job);
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
      const job = await this.options.start(input, jobId, buildChainStepPrompt(chain, index));
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
