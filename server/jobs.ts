import { randomUUID } from 'node:crypto';
import { query, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { HttpError } from './security.js';
import { normalize, type Approval, type JobView } from './types.js';
import { updateClaudeAgents, updateClaudeAgentResults } from './subagents.js';
import {Followups,type FollowupInput} from './followups.js';
import {PromptStream} from './prompt-stream.js';

type Run = typeof query;
type Job = JobView & { controller: AbortController; pending: Map<string, (result: PermissionResult) => void>; inputs:PromptStream; queued:FollowupInput[]; followups:Followups; acceptingInput:boolean };
export class Jobs {
  private jobs = new Map<string, Job>();
  constructor(private run: Run = query) {}
  view(job: Job): JobView {
    const { controller, pending, inputs, queued, followups, acceptingInput, ...view } = job;
    return view;
  }
  list() { return [...this.jobs.values()].map(j => ({ ...this.view(j), messages: [], partial: '' })); }
  trimCompleted() {
    for (const job of [...this.jobs.values()].filter(j => j.status !== 'running').sort((a, b) => a.startedAt - b.startedAt)) {
      if (this.jobs.size < 90) break;
      this.jobs.delete(job.id); // Completed conversations remain in Claude's on-disk history.
    }
  }
  get(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new HttpError(404, 'Задача не найдена. Откройте сохранённый чат заново.');
    return job;
  }
  async followup(id:string,input:FollowupInput){
    const job=this.get(id);
    await job.followups.run(input,async()=>{
      if(job.status!=='running'||job.controller.signal.aborted||!job.acceptingInput)throw new HttpError(409,'The active turn has ended. Your draft is preserved.');
      job.queued.push(input);job.pendingInputIds=job.queued.map(message=>message.id);
      job.messages.push({id:input.id,role:'user',blocks:[{type:'text',text:input.displayText||input.text}]});job.revision++;
    });
    return this.view(job);
  }
  start(input: { id: string; cwd: string; sessionId?: string; text: string; model?: string; mode: 'default' | 'plan'; maxBudgetUsd: number; displayText?: string; baseMessageCount?: number; jira?: JobView['jira'] }) {
    const existing = this.jobs.get(input.id);
    if (existing) return this.view(existing);
    for (const [id, j] of this.jobs) if (j.status !== 'running' && Date.now() - j.startedAt > 86400000) this.jobs.delete(id);
    if (this.jobs.size >= 100) this.trimCompleted();
    if ([...this.jobs.values()].some(j => j.status === 'running' && (j.cwd === input.cwd || (input.sessionId && j.sessionId === input.sessionId))))
      throw new HttpError(409, 'В этом проекте уже работает Claude. Дождитесь ответа или остановите задачу.');
    if ([...this.jobs.values()].filter(j => j.status === 'running').length >= 3 || this.jobs.size >= 100)
      throw new HttpError(429, 'Лимит задач сервера. Завершите текущие задачи; старые записи хранятся 24 часа.');
    const job: Job = { provider: 'claude', id: input.id, cwd: input.cwd, sessionId: input.sessionId, status: 'running',
      messages: [{ id: randomUUID(), role: 'user', blocks: [{ type: 'text', text: input.displayText || input.text }] }],
      partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: input.baseMessageCount || 0, jira: input.jira,
      controller: new AbortController(), pending: new Map(),inputs:new PromptStream(),queued:[],followups:new Followups(),acceptingInput:true };
    job.inputs.push(job.messages[0].id,input.text,input.sessionId);
    job.controller.signal.addEventListener('abort',()=>{job.acceptingInput=false;job.inputs.close();},{once:true});
    this.jobs.set(job.id, job);
    void this.execute(job, input);
    return this.view(job);
  }
  async execute(job: Job, input: Parameters<Jobs['start']>[0]) {
    try {
      const stream = this.run({ prompt: job.inputs, options: {
        cwd: input.cwd, resume: input.sessionId, model: input.model || undefined,
        permissionMode: input.mode, maxBudgetUsd: input.maxBudgetUsd,
        abortController: job.controller, includePartialMessages: true,
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        ...(process.env.CLAUDE_EXECUTABLE ? { pathToClaudeCodeExecutable: process.env.CLAUDE_EXECUTABLE } : {}),
        canUseTool: async (tool, toolInput, options) => this.ask(job, tool, toolInput, options.signal),
      } });
      for await (const event of stream) {
        updateClaudeAgents(job.messages, event);
        // Forwarded child messages have their own session/deltas/results. They must
        // neither replace the parent identity nor be appended to its transcript.
        if ('parent_tool_use_id' in event && event.parent_tool_use_id) { job.revision++; continue; }
        if ('session_id' in event && event.session_id) job.sessionId = event.session_id;
        updateClaudeAgentResults(job.messages, event);
        const msg = normalize(event);
        // The initial prompt is already visible; tool-result user events are kept.
        if (msg && !(msg.role === 'user' && msg.blocks.every(b => b.type === 'text'))) {
          const index = job.messages.findIndex(m => m.id === msg.id);
          if (index < 0) job.messages.push(msg); else job.messages[index] = msg;
          for (const block of msg.blocks) if (block.type === 'subagent' && block.agent) block.agent.status = 'running';
          if (msg.role === 'assistant') job.partial = '';
        }
        if (event.type === 'stream_event' && event.event.type === 'content_block_delta' && event.event.delta.type === 'text_delta')
          job.partial += event.event.delta.text;
        if (event.type === 'result') {
          job.cost = event.total_cost_usd;
          if (event.is_error) {
            job.status = 'error';
            job.error = 'errors' in event ? event.errors.join('\n') : 'Claude завершил задачу с ошибкой';
          }
          const next=!event.is_error&&!job.controller.signal.aborted?job.queued.shift():undefined;
          if(next){job.pendingInputIds=job.queued.map(message=>message.id);job.inputs.push(next.id,next.text,job.sessionId);}
          else{job.acceptingInput=false;job.inputs.close();}
        }
        job.revision++;
        if (JSON.stringify(job.messages).length + job.partial.length > 4_000_000)
          throw new Error('Достигнут лимит отображения задачи. История сохранена Claude на ПК.');
      }
      if (job.status === 'running') job.status = job.controller.signal.aborted ? 'stopped' : 'done';
    } catch (error) {
      job.status = job.controller.signal.aborted ? 'stopped' : 'error';
      if (job.status === 'error') job.error = error instanceof Error ? error.message : 'Не удалось запустить Claude';
      job.controller.abort();
    } finally {
      job.acceptingInput=false;job.inputs.close();
      // A missing completion event is not proof that a historical agent is active.
      for (const block of job.messages.flatMap(m => m.blocks)) if (block.agent?.status === 'running') block.agent.status = job.status === 'stopped' ? 'stopped' : 'unknown';
      for (const resolve of [...job.pending.values()]) resolve({ behavior: 'deny', message: 'Задача завершена' });
      job.revision++;
    }
  }
  ask(job: Job, tool: string, input: Record<string, unknown>, signal: AbortSignal): Promise<PermissionResult> {
    if (signal.aborted || job.controller.signal.aborted) return Promise.resolve({ behavior: 'deny', message: 'Задача остановлена' });
    return new Promise(resolve => {
      const approval: Approval = { id: randomUUID(), tool, input, expiresAt: Date.now() + 600000 };
      const finish = (result: PermissionResult) => {
        clearTimeout(timer); signal.removeEventListener('abort', abort); job.controller.signal.removeEventListener('abort', abort);
        job.pending.delete(approval.id); job.approvals = job.approvals.filter(a => a.id !== approval.id); job.revision++;
        resolve(result);
      };
      const abort = () => finish({ behavior: 'deny', message: 'Запрос отменён' });
      const timer = setTimeout(() => finish({ behavior: 'deny', message: 'Время подтверждения истекло' }), 600000);
      signal.addEventListener('abort', abort, { once: true }); job.controller.signal.addEventListener('abort', abort, { once: true });
      job.pending.set(approval.id, finish); job.approvals.push(approval); job.revision++;
    });
  }
  approve(jobId: string, id: string, allow: boolean, answers?: Record<string, string>) {
    const job = this.get(jobId), approval = job.approvals.find(a => a.id === id), resolve = job.pending.get(id);
    if (!approval || !resolve) throw new HttpError(409, 'Этот запрос уже закрыт');
    const updatedInput = approval.tool === 'AskUserQuestion' ? { ...approval.input, answers: answers || {} } : approval.input;
    resolve(allow ? { behavior: 'allow', updatedInput } : { behavior: 'deny', message: 'Пользователь отклонил действие с телефона' });
  }
  stop(id: string) { const job = this.get(id); job.controller.abort(); job.revision++; }
  close() { for (const j of this.jobs.values()) if (j.status === 'running') j.controller.abort(); }
}
