import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { allowedPath, HttpError } from './security.js';
import type { Approval, ChatMessage, JobView } from './types.js';
import { codexMessage } from './codex-content.js';
import { discoverCodex, StdioCodexRpc, type CodexRpc, type RpcEnvelope } from './codex-rpc.js';
import packageJson from '../package.json';

type StartInput = { id: string; cwd: string; sessionId?: string; text: string; model?: string; mode: 'default' | 'plan'; maxBudgetUsd: number; displayText?: string; baseMessageCount?: number; attachmentPaths?: string[]; jira?: JobView['jira'] };
type Pending = { finish: (allow: boolean, answers?: Record<string, string>) => void };
type CodexJob = JobView & { pending: Map<string, Pending>; turnId?: string; acceptingEvents: boolean; cancelled: boolean; eventQueue: Promise<void> };
export type CodexSession = { sessionId: string; summary: string; cwd: string; lastModified: number; gitBranch?: string; source: 'codex'; provider: 'codex'; readOnly?: boolean };
export type CodexServiceOptions = { rpcFactory?: () => CodexRpc | Promise<CodexRpc>; approvalTimeoutMs?: number; attachmentRoots?: string[] };

export class CodexService {
  private rpc?: CodexRpc;
  private ready?: Promise<CodexRpc>;
  private jobs = new Map<string, CodexJob>();
  private closed = false;
  constructor(private roots: string[], private options: CodexServiceOptions = {}) {}
  private connect(): Promise<CodexRpc> {
    if (this.closed) return Promise.reject(new Error('Codex service is closed.'));
    if (this.ready) return this.ready;
    const ready = (async () => {
      const rpc = this.options.rpcFactory ? await this.options.rpcFactory() : new StdioCodexRpc(await discoverCodex());
      if (this.closed) { rpc.close(); throw new Error('Codex service is closed.'); }
      this.rpc = rpc;
      rpc.on('notification', (message: RpcEnvelope) => { if (this.rpc === rpc) this.notification(message); });
      rpc.on('request', (message: RpcEnvelope) => { if (this.rpc === rpc) this.serverRequest(rpc, message); });
      rpc.on('disconnect', () => {
        if (this.rpc !== rpc) return;
        this.ready = undefined; this.rpc = undefined;
        for (const job of this.jobs.values()) if (job.status === 'running') this.finish(job, job.cancelled ? 'stopped' : 'error', 'Codex disconnected. Reopen the saved chat to continue.');
      });
      try {
        await rpc.request('initialize', { clientInfo: { name: 'pocket_code', title: 'Pocket Code', version: packageJson.version }, capabilities: { experimentalApi: true } });
        if (this.closed) { rpc.close(); throw new Error('Codex service is closed.'); }
        rpc.notify('initialized'); return rpc;
      } catch (error) { rpc.close(); throw error; }
    })();
    // Discovery can fail before a transport exists; allow a later installation to retry.
    this.ready = ready;
    ready.catch(() => { if (this.ready === ready) this.ready = undefined; });
    return ready;
  }
  async status() {
    let available = false;
    try {
      const rpc = await this.connect(); available = true;
      const account = await rpc.request('account/read', { refreshToken: false });
      const authenticated = Boolean(account.account) || account.requiresOpenaiAuth === false;
      const result = await rpc.request('model/list', { includeHidden: false, limit: 100 });
      const models = (result.data || []).filter((m: any) => !m.hidden && typeof m.model === 'string').map((m: any) => ({ id: m.model, name: m.displayName || m.model }));
      return { available, authenticated, models, ...(!authenticated ? { error: 'Sign in to Codex on this PC, then reconnect.' } : {}) };
    } catch (error) { return { available, authenticated: false, models: [], error: error instanceof Error ? error.message : 'Codex is unavailable.' }; }
  }
  private async readThread(id: string, includeTurns = false) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(400, 'Invalid Codex conversation.');
    const rpc = await this.connect(), result = await rpc.request('thread/read', { threadId: id, includeTurns });
    if (!result?.thread?.cwd) throw new HttpError(404, 'Codex conversation not found.');
    await allowedPath(this.roots, result.thread.cwd, true);
    return result.thread;
  }
  async sessions(): Promise<CodexSession[]> {
    const rpc = await this.connect(), sessions: CodexSession[] = [], seen = new Set<string>();
    let cursor: string | null = null;
    // A bounded scan prevents an unbounded import on PCs with very large archives.
    for (let page = 0; page < 20; page++) {
      const result = await rpc.request('thread/list', { cursor, limit: 100, archived: false, sortKey: 'updated_at', sourceKinds: ['cli', 'vscode', 'appServer', 'exec'], modelProviders: [] });
      for (const thread of result.data || []) {
        try {
          const cwd = await allowedPath(this.roots, thread.cwd, true);
          if (typeof thread.id !== 'string' || seen.has(thread.id)) continue;
          seen.add(thread.id);
          sessions.push({ sessionId: thread.id, summary: String(thread.name || thread.preview || 'Codex chat').slice(0, 500), cwd,
            lastModified: Number(thread.updatedAt || thread.createdAt || 0) * 1000, gitBranch: thread.gitInfo?.branch, source: 'codex', provider: 'codex' });
        } catch { /* Other projects must not become visible through this bridge. */ }
      }
      if (!result.nextCursor || result.nextCursor === cursor) break;
      cursor = result.nextCursor;
    }
    return sessions.sort((a, b) => b.lastModified - a.lastModified);
  }
  async messages(id: string): Promise<ChatMessage[]> {
    const metadata = await this.readThread(id), rpc = await this.connect();
    let items: any[] = [];
    if (metadata.historyMode === 'paginated') {
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const result = await rpc.request('thread/items/list', { threadId: id, cursor, limit: 100, sortDirection: 'asc' });
        items.push(...(result.data || []).map((entry: any) => entry.item));
        if (!result.nextCursor) break;
        if (result.nextCursor === cursor || page === 99) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.');
        cursor = result.nextCursor;
      }
    } else {
      const thread = await this.readThread(id, true);
      items = (thread.turns || []).flatMap((turn: any) => turn.items || []);
    }
    const messages: ChatMessage[] = []; let size = 0;
    for (const item of items) {
      const message = await codexMessage(item, [...this.roots, ...(this.options.attachmentRoots || [])]);
      if (message) { size += JSON.stringify(message).length; if (size > 16_000_000) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.'); messages.push(message); }
    }
    return messages;
  }
  view(job: CodexJob): JobView {
    const { pending, turnId, acceptingEvents, cancelled, eventQueue, ...view } = job; return view;
  }
  list() { return [...this.jobs.values()].map(job => ({ ...this.view(job), messages: [], partial: '' })); }
  get(id: string) { const job = this.jobs.get(id); if (!job) throw new HttpError(404, 'Codex job not found. Reopen the saved chat.'); return job; }
  trimCompleted() {
    for (const job of [...this.jobs.values()].filter(j => j.status !== 'running').sort((a, b) => a.startedAt - b.startedAt)) {
      if (this.jobs.size < 90) break; this.jobs.delete(job.id);
    }
  }
  start(input: StartInput): JobView {
    const existing = this.jobs.get(input.id); if (existing) return this.view(existing);
    for (const [id, job] of this.jobs) if (job.status !== 'running' && Date.now() - job.startedAt > 86400000) this.jobs.delete(id);
    if (this.jobs.size >= 100) this.trimCompleted();
    if ([...this.jobs.values()].some(job => job.status === 'running' && (path.resolve(job.cwd).toLowerCase() === path.resolve(input.cwd).toLowerCase() || (input.sessionId && job.sessionId === input.sessionId))))
      throw new HttpError(409, 'Codex is already working in this project. Wait or stop that task first.');
    if ([...this.jobs.values()].filter(job => job.status === 'running').length >= 3 || this.jobs.size >= 100) throw new HttpError(429, 'Too many Codex jobs. Finish an existing task first.');
    const job: CodexJob = { id: input.id, cwd: input.cwd, sessionId: input.sessionId, provider: 'codex', status: 'running',
      messages: [{ id: randomUUID(), role: 'user', blocks: [{ type: 'text', text: input.displayText || input.text }] }],
      partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: input.baseMessageCount || 0, jira: input.jira,
      pending: new Map(), acceptingEvents: false, cancelled: false, eventQueue: Promise.resolve() };
    this.jobs.set(job.id, job); void this.execute(job, input); return this.view(job);
  }
  private async execute(job: CodexJob, input: StartInput) {
    try {
      const cwd = await allowedPath(this.roots, input.cwd, true), rpc = await this.connect();
      if (job.cancelled) return;
      const turnInput: any[] = [{ type: 'text', text: input.text }];
      for (const attachment of input.attachmentPaths || []) {
        const file = await allowedPath([...this.roots, ...(this.options.attachmentRoots || [])], attachment);
        if (/\.(png|jpe?g|gif|webp)$/i.test(file)) turnInput.push({ type: 'localImage', path: file });
        else turnInput.push({ type: 'text', text: `Attached file on this PC: ${file}` });
      }
      if (input.sessionId) {
        const original = await this.readThread(input.sessionId);
        if (path.resolve(original.cwd).toLowerCase() !== cwd.toLowerCase()) throw new HttpError(409, 'Select the original project before continuing this Codex chat.');
        if (original.status?.type === 'active') throw new HttpError(409, 'This Codex chat is already active on the PC.');
      }
      const { config } = await rpc.request('config/read', { cwd, includeLayers: false });
      const readOnly = input.mode === 'plan' || config?.sandbox_mode === 'read-only';
      const sandbox = readOnly ? 'read-only' : 'workspace-write';
      // Never inherit an unrestricted sandbox. Preserve stricter existing approval policies.
      const policy = config?.approval_policy;
      const approvalPolicy = policy === 'untrusted' || policy === 'never' || (policy && typeof policy === 'object') ? policy : 'on-request';
      const startParams = { cwd, ...(input.model ? { model: input.model } : {}), sandbox, approvalPolicy, approvalsReviewer: 'user' };
      if (job.cancelled) return;
      const session = await rpc.request(input.sessionId ? 'thread/resume' : 'thread/start', input.sessionId ? { ...startParams, threadId: input.sessionId, excludeTurns: true } : startParams);
      job.sessionId = session.thread.id; job.cwd = cwd; job.revision++;
      if (job.cancelled) return;
      if (job.cancelled) return;
      job.acceptingEvents = true;
      const result = await rpc.request('turn/start', { threadId: job.sessionId, input: turnInput, cwd, approvalPolicy, approvalsReviewer: 'user',
        ...(input.model ? { model: input.model } : {}), clientUserMessageId: job.messages[0].id,
        sandboxPolicy: readOnly ? { type: 'readOnly', networkAccess: false } : { type: 'workspaceWrite', writableRoots: [cwd], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true } });
      job.turnId = result.turn.id; job.revision++;
      if (job.cancelled) { await this.interrupt(job, rpc); this.finish(job, 'stopped'); }
      else if (result.turn.status && result.turn.status !== 'inProgress') this.completeTurn(job, result.turn);
    } catch (error) { this.finish(job, job.cancelled ? 'stopped' : 'error', error instanceof Error ? error.message : 'Could not start Codex.'); }
  }
  private notification(message: RpcEnvelope) {
    const p = message.params;
    if (!p || !p.threadId) return;
    const job = [...this.jobs.values()].find(j => j.status === 'running' && j.acceptingEvents && j.sessionId === p.threadId && (!j.turnId || !p.turnId || j.turnId === p.turnId));
    if (!job) return;
    job.eventQueue = job.eventQueue.then(async () => {
      if (job.status !== 'running') return;
      switch (message.method) {
        case 'turn/started': job.turnId = p.turn.id; break;
        case 'item/agentMessage/delta': job.partial += p.delta || ''; break;
        case 'item/started': case 'item/completed': {
          if (p.item?.type === 'userMessage') break; // Initial user input already appears immediately.
          const item = await codexMessage(p.item, [...this.roots, ...(this.options.attachmentRoots || [])]);
          if (item) { const index = job.messages.findIndex(m => m.id === item.id); if (index < 0) job.messages.push(item); else job.messages[index] = item; }
          if (p.item?.type === 'agentMessage') job.partial = '';
          break;
        }
        case 'turn/completed': this.completeTurn(job, p.turn); break;
        case 'error': if (!p.willRetry) this.finish(job, 'error', p.error?.message || 'Codex could not complete this turn.'); break;
      }
      job.revision++;
      if (JSON.stringify(job.messages).length + job.partial.length > 16_000_000) {
        void this.interrupt(job, this.rpc); this.finish(job, 'error', 'Display limit reached. Full history remains on the PC.');
      }
    }).catch(() => { void this.interrupt(job, this.rpc); this.finish(job, 'error', 'Could not read a Codex response.'); });
  }
  private completeTurn(job: CodexJob, turn: any) {
    this.finish(job, job.cancelled || turn.status === 'interrupted' ? 'stopped' : turn.status === 'failed' ? 'error' : 'done', turn.error?.message);
  }
  private finish(job: CodexJob, status: JobView['status'], error?: string) {
    job.status = status; job.acceptingEvents = false;
    if (status === 'error') job.error = error || 'Codex stopped with an error.';
    for (const pending of [...job.pending.values()]) pending.finish(false);
    job.revision++;
  }
  private serverRequest(rpc: CodexRpc, request: RpcEnvelope) {
    if (request.id === undefined) return;
    const id = request.id, p = request.params || {};
    const job = [...this.jobs.values()].find(j => j.status === 'running' && j.acceptingEvents && !j.cancelled && j.sessionId === p.threadId && (!j.turnId || !p.turnId || j.turnId === p.turnId));
    const approvalRequest = request.method === 'item/commandExecution/requestApproval' || request.method === 'item/fileChange/requestApproval';
    const questionRequest = request.method === 'item/tool/requestUserInput';
    if (!job || (!approvalRequest && !questionRequest)) { rpc.reject(id, 'This client does not support this request. No permission was granted.'); return; }
    const questions = Array.isArray(p.questions) ? p.questions : [];
    if (questionRequest && (!questions.length || questions.some((q: any) => q.isSecret))) { rpc.respond(id, { answers: {} }); return; }
    const approval: Approval = { id: randomUUID(), tool: questionRequest ? 'AskUserQuestion' : request.method === 'item/commandExecution/requestApproval' ? 'Codex command' : 'Codex file changes',
      input: questionRequest ? { questions: questions.map((q: any) => ({ question: q.question, options: q.options || [] })) } : {
        command: p.command, cwd: p.cwd, reason: p.reason, grantRoot: p.grantRoot,
        changes: (job.messages.find(m => m.id === p.itemId)?.blocks.find(b => b.type === 'tool_use')?.input as any)?.changes,
        permissions: p.additionalPermissions, network: p.networkApprovalContext, availableDecisions: p.availableDecisions },
      expiresAt: Date.now() + (this.options.approvalTimeoutMs ?? 600000) };
    let settled = false;
    const finish = (allow: boolean, answers?: Record<string, string>) => {
      if (settled) return; settled = true; clearTimeout(timer);
      job.pending.delete(approval.id); job.approvals = job.approvals.filter(a => a.id !== approval.id); job.revision++;
      if (questionRequest) {
        const mapped: Record<string, { answers: string[] }> = {};
        if (allow) for (const q of questions) { const answer = answers?.[q.question]?.trim(); if (answer) mapped[q.id] = { answers: [answer] }; }
        rpc.respond(id, { answers: mapped });
      } else {
        // Only one action is approved: no session-wide or persistent permission amendment.
        const permitted = !Array.isArray(p.availableDecisions) || p.availableDecisions.includes('accept');
        rpc.respond(id, { decision: allow && permitted ? 'accept' : 'decline' });
      }
    };
    const timer = setTimeout(() => finish(false), this.options.approvalTimeoutMs ?? 600000); timer.unref();
    job.pending.set(approval.id, { finish }); job.approvals.push(approval); job.revision++;
  }
  approve(jobId: string, id: string, allow: boolean, answers?: Record<string, string>) {
    const pending = this.get(jobId).pending.get(id); if (!pending) throw new HttpError(409, 'This approval request has already closed.'); pending.finish(allow, answers);
  }
  private async interrupt(job: CodexJob, rpc?: CodexRpc) {
    if (!rpc || !job.sessionId || !job.turnId) return;
    try { await rpc.request('turn/interrupt', { threadId: job.sessionId, turnId: job.turnId }); }
    catch {
      // An unconfirmed interruption must not leave a turn running behind a "stopped" UI.
      rpc.close();
      if (job.cancelled) job.error = 'Could not confirm cancellation. The Codex connection was closed.';
    }
  }
  stop(id: string) {
    const job = this.get(id); if (job.status !== 'running') return;
    job.cancelled = true;
    for (const pending of [...job.pending.values()]) pending.finish(false);
    job.revision++;
    if (job.turnId) void this.interrupt(job, this.rpc).finally(() => this.finish(job, 'stopped'));
    else if (!job.acceptingEvents) this.finish(job, 'stopped');
    // A turn/start request in flight is interrupted as soon as its ID arrives.
  }
  close() {
    this.closed = true;
    for (const job of this.jobs.values()) if (job.status === 'running') { job.cancelled = true; this.finish(job, 'stopped'); }
    this.rpc?.close();
  }
}
