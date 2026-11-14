import type {BoardMcpConfiguration} from './board-mcp-runtime.js';
import { userInputBlocks } from './user-input-blocks.js';
import { randomUUID } from 'node:crypto';
import { query, type PermissionResult, type PermissionUpdate } from '@anthropic-ai/claude-agent-sdk';
import { HttpError } from './security.js';
import { normalize, type Approval, type ApprovalDecision, type ChatMessage, type JobView } from './types.js';
import { updateClaudeAgents, updateClaudeAgentResults } from './subagents.js';
import {Followups,type FollowupInput} from './followups.js';
import {PromptStream} from './prompt-stream.js';
import {projectBoardInstructions} from './project-rules.js';

type Run = typeof query;
type Job = JobView & { controller: AbortController; pending: Map<string, (result: PermissionResult) => void>; inputs:PromptStream; waiting:FollowupInput[]; followups:Followups; acceptingInput:boolean; query?:ReturnType<Run>; approvalTimeoutMs:number; stopRequested?:boolean };
/** The model reads this in English whatever the interface language; the person's comment follows it. */
export const deniedMessage=(comment?:string)=>'The user denied this action.'+(comment?.trim()?' The user said: '+comment.trim():'');
const queueView=(job:Job)=>{job.pendingInputIds=job.waiting.map(message=>message.id);job.queued=job.waiting.map(message=>({id:message.id,text:message.displayText??message.text,attachments:message.attachmentPaths?.length||0}));};
/** SDK system events with no message body: retries, slash-command output and compaction are shown as system rows. */
function claudeNotice(job: Job, event: any): ChatMessage | undefined {
  if (event?.type !== 'system' || event.parent_tool_use_id) return;
  const row = (id: string, text: string): ChatMessage => ({ id, role: 'system', blocks: [{ type: 'text', text }] });
  if (event.subtype === 'local_command_output' && typeof event.content === 'string' && event.content.trim()) return row(event.uuid || randomUUID(), event.content);
  if (event.subtype === 'api_retry') {
    const status = typeof event.error_status === 'number' ? ` (${event.error_status})` : '', delay = Math.max(1, Math.round((Number(event.retry_delay_ms) || 0) / 1000));
    return row('claude-wait:' + job.id, `API Claude не ответил${status}. Повтор ${event.attempt} из ${event.max_retries} через ${delay} с.`);
  }
  if (event.subtype === 'status' && event.status === 'compacting') return row('claude-wait:' + job.id, 'Claude сжимает контекст…');
  if (event.subtype === 'status' && event.compact_result === 'failed') return row(event.uuid || randomUUID(), 'Не удалось сжать контекст' + (typeof event.compact_error === 'string' && event.compact_error ? ': ' + event.compact_error : '.'));
  if (event.subtype === 'compact_boundary') {
    job.messages = job.messages.filter(m => !m.id.startsWith('claude-wait:'));
    const meta = event.compact_metadata || {}, after = typeof meta.post_tokens === 'number' ? ` → ${meta.post_tokens}` : '';
    return row(event.uuid || randomUUID(), `Контекст сжат${meta.trigger === 'auto' ? ' автоматически' : ''}: ${meta.pre_tokens ?? '?'}${after} токенов.`);
  }
}
export class Jobs {
  private boardMcp:BoardMcpConfiguration=()=>({});
  setBoardMcpConfiguration(config:BoardMcpConfiguration){this.boardMcp=config;}
  private jobs = new Map<string, Job>();
  private sessionListeners: ((job: { sessionId: string; account?: string }) => void)[] = [];
  /** Called once a task learns its session ID, so a custom provider account is recorded before any list request. */
  onSession(listener: (job: { sessionId: string; account?: string }) => void) { this.sessionListeners.push(listener); }
  private announceSession(job: Job) { if (!job.sessionId) return; for (const listener of this.sessionListeners) { try { listener({ sessionId: job.sessionId, ...(job.account ? { account: job.account } : {}) }); } catch { /* A listener never breaks the task. */ } } }
  constructor(private run: Run = query) {}
  view(job: Job): JobView {
    const { controller, pending, inputs, waiting, followups, acceptingInput, query, approvalTimeoutMs, stopRequested, ...view } = job;
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
      // Queued until the agent takes it at the end of the turn; only then does it join the transcript.
      job.waiting.push(input);queueView(job);job.revision++;
    });
    return this.view(job);
  }
  /** Withdraw a follow-up the agent has not received yet, also after Stop. */
  cancelFollowup(id:string,inputId:string){
    const job=this.get(id),index=job.waiting.findIndex(message=>message.id===inputId);
    if(index<0)throw new HttpError(409,'This message was already delivered to the agent.');
    job.waiting.splice(index,1);queueView(job);job.revision++;return this.view(job);
  }
  /** Change how the running turn asks for permission; Claude applies it immediately. */
  async setMode(id:string,mode:'default'|'acceptEdits'|'plan'){
    const job=this.get(id);
    if(job.status!=='running'||!job.query)throw new HttpError(409,'The run has ended. The mode applies to the next message.');
    await job.query.setPermissionMode(mode);job.permissionMode=mode;job.revision++;return this.view(job);
  }
  start(input: { id: string; cwd: string; sessionId?: string; text: string; model?: string; mode: 'default' | 'plan'; claudeEffort?:'low'|'medium'|'high'|'xhigh'|'max'; claudeAccess?:'default'|'acceptEdits'|'bypassPermissions'; maxBudgetUsd: number; approvalTimeoutMs?: number; displayText?: string; attachmentPaths?: string[]; baseMessageCount?: number; jira?: JobView['jira']; env?: NodeJS.ProcessEnv; account?: string }) {
    const existing = this.jobs.get(input.id);
    if (existing) return this.view(existing);
    for (const [id, j] of this.jobs) if (j.status !== 'running' && Date.now() - j.startedAt > 86400000) this.jobs.delete(id);
    if (this.jobs.size >= 100) this.trimCompleted();
    if ([...this.jobs.values()].some(j => j.status === 'running' && input.sessionId && j.sessionId === input.sessionId))
      throw new HttpError(409, 'This Claude chat is already running. Send a follow-up to its active turn.');
    if ([...this.jobs.values()].filter(j => j.status === 'running').length >= 3 || this.jobs.size >= 100)
      throw new HttpError(429, 'Лимит задач сервера. Завершите текущие задачи; старые записи хранятся 24 часа.');
    const job: Job = { provider: 'claude', ...(input.account ? { account: input.account } : {}), id: input.id, cwd: input.cwd, sessionId: input.sessionId, status: 'running',
      messages: [{ id: randomUUID(), role: 'user', blocks: userInputBlocks(input) }],
      partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: input.baseMessageCount || 0, jira: input.jira,
      controller: new AbortController(), pending: new Map(),inputs:new PromptStream(),waiting:[],followups:new Followups(),acceptingInput:true,approvalTimeoutMs:input.approvalTimeoutMs??0,
      permissionMode: input.mode==='plan'?'plan':input.claudeAccess||'default' };
    job.inputs.push(job.messages[0].id,input.text,input.sessionId);
    job.controller.signal.addEventListener('abort',()=>{job.acceptingInput=false;job.inputs.close();},{once:true});
    this.jobs.set(job.id, job);
    void this.execute(job, input);
    return this.view(job);
  }
  async execute(job: Job, input: Parameters<Jobs['start']>[0]) {
    let stream: ReturnType<Run> | undefined;
    let historySize = JSON.stringify(job.messages).length;
    let historyCount = job.messages.length;
    try {
      const mcpServers=this.boardMcp(input.cwd);
      stream = this.run({ prompt: job.inputs, options: {
        cwd: input.cwd, resume: input.sessionId, model: input.model && input.model !== 'default' ? input.model : undefined, effort:input.claudeEffort,
        permissionMode: input.mode==='plan'?'plan':input.claudeAccess||'default',
        allowDangerouslySkipPermissions: input.mode!=='plan'&&input.claudeAccess==='bypassPermissions', maxBudgetUsd: input.maxBudgetUsd,
        abortController: job.controller, includePartialMessages: true,
        settingSources: ['user', 'project', 'local'],...(Object.keys(mcpServers).length?{mcpServers}:{}),
        systemPrompt: { type: 'preset', preset: 'claude_code', append: await projectBoardInstructions(input.cwd) },
        ...(process.env.CLAUDE_EXECUTABLE ? { pathToClaudeCodeExecutable: process.env.CLAUDE_EXECUTABLE } : {}),
        ...(input.env ? { env: input.env } : {}),
        canUseTool: async (tool, toolInput, options) => this.ask(job, tool, toolInput, options.signal, options.suggestions),
      } });
      job.query = stream;
      for await (const event of stream) {
        // Token deltas change only the partial text; everything else may change the transcript a poll must resend.
        if (event.type !== 'stream_event') { updateClaudeAgents(job.messages, event); job.messagesRevision = (job.messagesRevision || 0) + 1; }
        // Forwarded child messages have their own session/deltas/results. They must
        // neither replace the parent identity nor be appended to its transcript.
        if ('parent_tool_use_id' in event && event.parent_tool_use_id) { job.revision++; continue; }
        if ('session_id' in event && event.session_id && job.sessionId !== event.session_id) { job.sessionId = event.session_id; this.announceSession(job); }
        updateClaudeAgentResults(job.messages, event);
        const notice = claudeNotice(job, event);
        if (notice) { const index = job.messages.findIndex(m => m.id === notice.id); if (index < 0) job.messages.push(notice); else job.messages[index] = notice; }
        const msg = normalize(event);
        // The initial prompt is already visible; tool-result user events are kept.
        if (msg && !(msg.role === 'user' && msg.blocks.every(b => b.type === 'text'))) {
          const index = job.messages.findIndex(m => m.id === msg.id);
          if (index < 0) job.messages.push(msg); else job.messages[index] = msg;
          for (const block of msg.blocks) if (block.type === 'subagent' && block.agent) block.agent.status = 'running';
          if (msg.role === 'assistant') { job.partial = ''; job.messages = job.messages.filter(m => !m.id.startsWith('claude-wait:')); }
        }
        if (event.type === 'stream_event' && event.event.type === 'content_block_delta' && event.event.delta.type === 'text_delta')
          job.partial += event.event.delta.text;
        if (event.type === 'result') {
          job.cost = event.total_cost_usd;
          if (job.stopRequested) job.status = 'stopped';
          else if (event.is_error) {
            job.status = 'error';
            // API failures (login, limits, overload, prompt too long) arrive as `success` with is_error and the reason in `result`.
            job.error = ('errors' in event && event.errors.length ? event.errors.join('\n') : 'result' in event ? event.result : '') || 'Claude завершил задачу с ошибкой';
          }
          const next=!event.is_error&&!job.stopRequested&&!job.controller.signal.aborted?job.waiting.shift():undefined;
          if(next){queueView(job);job.messages.push({id:next.id,role:'user',blocks:userInputBlocks(next)});job.inputs.push(next.id,next.text,job.sessionId);}
          else{job.acceptingInput=false;job.inputs.close();}
        }
        job.revision++;
        // Token deltas only change partial text. Avoid serializing the entire
        // retained transcript on every token in a long conversation.
        if (event.type !== 'stream_event' || historyCount !== job.messages.length) {
          historySize = JSON.stringify(job.messages).length;
          historyCount = job.messages.length;
        }
        // The display limit must not stop a working agent: the live view drops its oldest messages instead.
        // Claude keeps the whole session on the PC and the chat reloads it from there after the turn.
        while (historySize + job.partial.length > 4_000_000 && job.messages.length > 1) {
          historySize -= JSON.stringify(job.messages.shift()).length;
          historyCount = job.messages.length; job.messagesRevision = (job.messagesRevision || 0) + 1;
        }
      }
      job.messages = job.messages.filter(m => !m.id.startsWith('claude-wait:'));
      if (job.status === 'running') job.status = job.controller.signal.aborted || job.stopRequested ? 'stopped' : 'done';
    } catch (error) {
      // After an interrupt the CLI may exit with an error code; that is still the Stop the person asked for.
      job.status = job.controller.signal.aborted || job.stopRequested ? 'stopped' : 'error';
      if (job.status === 'error') job.error = error instanceof Error ? error.message : 'Не удалось запустить Claude';
      job.controller.abort();
    } finally {
      job.acceptingInput=false;job.inputs.close();
      job.query=undefined;
      try {stream?.close?.();} catch { /* Preserve the original job outcome. */ }
      // A missing completion event is not proof that a historical agent is active.
      for (const block of job.messages.flatMap(m => m.blocks)) if (block.agent?.status === 'running') block.agent.status = job.status === 'stopped' ? 'stopped' : 'unknown';
      for (const resolve of [...job.pending.values()]) resolve({ behavior: 'deny', message: 'Задача завершена' });
      job.messagesRevision = (job.messagesRevision || 0) + 1; job.revision++;
    }
  }
  ask(job: Job, tool: string, input: Record<string, unknown>, signal: AbortSignal, suggestions?: unknown[]): Promise<PermissionResult> {
    if (signal.aborted || job.controller.signal.aborted || job.stopRequested) return Promise.resolve({ behavior: 'deny', message: 'Задача остановлена' });
    return new Promise(resolve => {
      const timeout = job.approvalTimeoutMs;
      const approval: Approval = { id: randomUUID(), tool, input, expiresAt: timeout > 0 ? Date.now() + timeout : 0, ...(Array.isArray(suggestions) && suggestions.length ? { suggestions } : {}) };
      const finish = (result: PermissionResult) => {
        clearTimeout(timer); signal.removeEventListener('abort', abort); job.controller.signal.removeEventListener('abort', abort);
        job.pending.delete(approval.id); job.approvals = job.approvals.filter(a => a.id !== approval.id); job.revision++;
        resolve(result);
      };
      const abort = () => finish({ behavior: 'deny', message: 'Запрос отменён' });
      // Off by default: a person away from the phone must not lose the run. When set, the transcript says the request expired.
      const timer = timeout > 0 ? setTimeout(() => { (job.expiredApprovals ??= []).push({ tool, at: Date.now() }); finish({ behavior: 'deny', message: 'The request timed out before the user answered. ' + deniedMessage() }); }, timeout) : undefined;
      signal.addEventListener('abort', abort, { once: true }); job.controller.signal.addEventListener('abort', abort, { once: true });
      job.pending.set(approval.id, finish); job.approvals.push(approval); job.revision++;
    });
  }
  approve(jobId: string, id: string, allow: boolean, answers?: Record<string, string>, decision: Omit<ApprovalDecision, 'allow' | 'answers'> = {}) {
    const job = this.get(jobId), approval = job.approvals.find(a => a.id === id), resolve = job.pending.get(id);
    if (!approval || !resolve) throw new HttpError(409, 'Этот запрос уже закрыт');
    const updatedInput = approval.tool === 'AskUserQuestion' ? { ...approval.input, answers: answers || {} } : approval.input;
    // "Allow such actions" returns exactly the rules the SDK suggested; an approved plan may also choose how it runs.
    const updatedPermissions = [...(decision.remember && approval.suggestions ? approval.suggestions : []), ...(approval.tool === 'ExitPlanMode' && decision.mode ? [{ type: 'setMode', mode: decision.mode, destination: 'session' }] : [])] as PermissionUpdate[];
    if (allow && approval.tool === 'ExitPlanMode') job.permissionMode = decision.mode || 'default';
    resolve(allow ? { behavior: 'allow', updatedInput, ...(updatedPermissions.length ? { updatedPermissions } : {}) } : { behavior: 'deny', message: deniedMessage(decision.message) });
  }
  /**
   * Stop interrupts the turn the way Esc does in Claude Code: the CLI ends its tools (and their shells) and records
   * the turn. Killing the process is the fallback when it does not finish in time or cannot be interrupted.
   */
  stop(id: string, graceMs = 5000) {
    const job = this.get(id); job.revision++;
    if (job.status !== 'running') return;
    const query = job.query;
    if (job.stopRequested || !query?.interrupt) { job.controller.abort(); return; }
    job.stopRequested = true; job.acceptingInput = false;
    for (const resolve of [...job.pending.values()]) resolve({ behavior: 'deny', message: 'Задача остановлена' });
    const kill = () => { if (job.status === 'running') job.controller.abort(); };
    const timer = setTimeout(kill, graceMs); timer.unref?.();
    query.interrupt().catch(() => { clearTimeout(timer); kill(); });
  }
  close() { for (const j of this.jobs.values()) if (j.status === 'running') j.controller.abort(); }
}
