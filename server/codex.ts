import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { allowedPath, HttpError } from './security.js';
import type { Approval, ChatMessage, JobView, SubagentView } from './types.js';
import { codexAgents, validAgentId } from './subagents.js';
import { codexMessage, isCodexMessage } from './codex-content.js';
import { discoverCodex, StdioCodexRpc, CodexRequestError, type CodexRpc, type RpcEnvelope } from './codex-rpc.js';
import packageJson from '../package.json';
import {Followups,type FollowupInput} from './followups.js';
import { codexPermissions, verifyCodexPermissions, type CodexAccess } from './codex-access.js';
import { normalizeCodexUsage } from './codex-usage.js';
import { codexModels } from './codex-models.js';
import { coalesceReads } from './read-coalescer.js';

type StartInput = { id: string; cwd: string; sessionId?: string; text: string; model?: string; reasoningEffort?: string; mode: 'default' | 'plan'; codexAccess?: CodexAccess; maxBudgetUsd: number; displayText?: string; baseMessageCount?: number; attachmentPaths?: string[]; jira?: JobView['jira'] };
type Pending = { finish: (allow: boolean, answers?: Record<string, string>) => void };
type CodexJob = JobView & { pending: Map<string, Pending>; turnId?: string; acceptingEvents: boolean; cancelled: boolean; eventQueue: Promise<void>; followups?:Followups };
export type CodexSession = { sessionId: string; summary: string; cwd: string; lastModified: number; gitBranch?: string; source: 'codex'; provider: 'codex'; readOnly?: boolean };
export type CodexServiceOptions = { rpcFactory?: () => CodexRpc | Promise<CodexRpc>; approvalTimeoutMs?: number; attachmentRoots?: string[]; allProjectHistory?:boolean };

export class CodexService {
  async usage() { return normalizeCodexUsage(await (await this.connect()).request('account/rateLimits/read', {})); }
  private rpc?: CodexRpc;
  private ready?: Promise<CodexRpc>;
  private jobs = new Map<string, CodexJob>();
  private closed = false;
  private sessionReads = coalesceReads<string, CodexSession[]>(0, 1);
  private itemReads = coalesceReads<string, { metadata: any; items: any[] }>(0, 8);
  private messageReads = coalesceReads<string, ChatMessage[]>(0, 8);
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
      const models = codexModels(result.data);
      return { available, authenticated, models, ...(!authenticated ? { error: 'Sign in to Codex on this PC, then reconnect.' } : {}) };
    } catch (error) { return { available, authenticated: false, models: [], error: error instanceof Error ? error.message : 'Codex is unavailable.' }; }
  }
  private async readThread(id: string, includeTurns = false, historyOnly = false) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(400, 'Invalid Codex conversation.');
    const rpc = await this.connect(), result = await rpc.request('thread/read', { threadId: id, includeTurns });
    if (!result?.thread?.cwd) throw new HttpError(404, 'Codex conversation not found.');
    if(!(historyOnly&&this.options.allProjectHistory))await allowedPath(this.roots, result.thread.cwd, true);
    return result.thread;
  }
  async sessions(): Promise<CodexSession[]> {
    return this.sessionReads('sessions', () => this.loadSessions());
  }
  private async loadSessions(): Promise<CodexSession[]> {
    const rpc = await this.connect(), sessions: CodexSession[] = [], seen = new Set<string>();
    let cursor: string | null = null;
    // A bounded scan prevents an unbounded import on PCs with very large archives.
    for (let page = 0; page < 20; page++) {
      const result = await rpc.request('thread/list', { cursor, limit: 100, archived: false, sortKey: 'updated_at', sourceKinds: ['cli', 'vscode', 'appServer', 'exec'], modelProviders: [] });
      for (const thread of result.data || []) {
        try {
          if(typeof thread.cwd!=='string'||!thread.cwd)continue;
          let cwd=thread.cwd,readOnly=false;
          try{cwd=await allowedPath(this.roots,thread.cwd,true);}catch{if(!this.options.allProjectHistory)continue;readOnly=true;}
          if (typeof thread.id !== 'string' || seen.has(thread.id)) continue;
          seen.add(thread.id);
          sessions.push({ sessionId: thread.id, summary: String(thread.name || thread.preview || 'Codex chat').slice(0, 500), cwd,
            lastModified: Number(thread.updatedAt || thread.createdAt || 0) * 1000, gitBranch: thread.gitInfo?.branch, source: 'codex', provider: 'codex',...(readOnly?{readOnly:true}:{}) });
        } catch { /* Other projects must not become visible through this bridge. */ }
      }
      if (!result.nextCursor || result.nextCursor === cursor) break;
      cursor = result.nextCursor;
    }
    return sessions.sort((a, b) => b.lastModified - a.lastModified);
  }
  private async threadItems(id: string) {
    return this.itemReads(id, () => this.loadThreadItems(id));
  }
  private async loadThreadItems(id: string) {
    const metadata = await this.readThread(id,false,true), rpc = await this.connect();
    let items: any[] = [], serializedSize = 2;
    if (metadata.historyMode === 'paginated') {
      let cursor: string | null = null;
      for (let page = 0; page < 100; page++) {
        const result = await rpc.request('thread/items/list', { threadId: id, cursor, limit: 100, sortDirection: 'asc' });
        for (const entry of result.data || []) {
          // Account for each item once; serializing the growing array each page
          // made large conversation reads quadratic in their history length.
          serializedSize += (JSON.stringify(entry.item) ?? 'null').length + (items.length ? 1 : 0);
          if (serializedSize > 16_000_000) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.');
          items.push(entry.item);
        }
        if (!result.nextCursor) break;
        if (result.nextCursor === cursor || page === 99) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.');
        cursor = result.nextCursor;
      }
    } else {
      const thread = await this.readThread(id, true,true);
      items = (thread.turns || []).flatMap((turn: any) => turn.items || []);
    }
    if (metadata.historyMode !== 'paginated' && JSON.stringify(items).length > 16_000_000) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.');
    return { metadata, items };
  }
  async messages(id: string): Promise<ChatMessage[]> {
    return this.messageReads(id, () => this.loadMessages(id));
  }
  private async *historyItems(id: string) {
    const metadata = await this.readThread(id, false, true);
    if (metadata.historyMode !== 'paginated') {
      const thread = await this.readThread(id, true, true);
      for (const turn of thread.turns || []) for (const item of turn.items || []) yield item;
      return;
    }
    const rpc = await this.connect(), seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const result = await rpc.request('thread/items/list', { threadId: id, cursor, limit: 100, sortDirection: 'asc' });
      for (const entry of result.data || []) yield entry.item;
      cursor = result.nextCursor || null;
      if (cursor && seen.has(cursor)) throw new HttpError(502, 'Codex history pagination did not advance.');
      if (cursor) seen.add(cursor);
    } while (cursor);
  }
  async messageCount(id: string): Promise<number> {
    // Counting must not decode images or enforce a whole-conversation display limit.
    let count = 0;
    for await (const item of this.historyItems(id)) if (isCodexMessage(item)) count++;
    return count;
  }
  async messagePage(id: string, options: { offset?: number; window?: number; end?: number; fromStart?: boolean }) {
    const tail = options.window !== undefined && !options.fromStart;
    const limit = options.window ?? 100, offset = options.offset ?? 0;
    const end = options.end ?? Infinity, budget = 12_000_000;
    const selected: { item: any; index: number; bytes: number }[] = [];
    let total = 0, bytes = 0, more = false;
    for await (const item of this.historyItems(id)) {
      if (!isCodexMessage(item)) continue;
      const index = total++;
      if (index >= end) { more = true; break; }
      if (!tail && index < offset) continue;
      const size = Buffer.byteLength(JSON.stringify(item));
      if (!tail && selected.length && (selected.length >= limit || bytes + size > budget)) { more = true; break; }
      selected.push({ item, index, bytes: size }); bytes += size;
      if (tail) while (selected.length > 1 && (selected.length > limit || bytes > budget)) bytes -= selected.shift()!.bytes;
    }
    const messages: ChatMessage[] = [];
    let start = selected[0]?.index ?? Math.min(offset, total), stop = start, displayBytes = 0;
    // Tail windows keep the newest messages when local image decoding expands the payload.
    for (const entry of tail ? [...selected].reverse() : selected) {
      const message = await codexMessage(entry.item, [...this.roots, ...(this.options.attachmentRoots || [])]);
      if (!message) continue;
      const size = Buffer.byteLength(JSON.stringify(message));
      if (messages.length && displayBytes + size > budget) { more = true; break; }
      if (size > 16_000_000) throw new HttpError(413, 'A single Codex message is too large to display on the phone.');
      displayBytes += size;
      if (tail) { messages.unshift(message); start = entry.index; stop = selected[selected.length - 1].index + 1; }
      else { messages.push(message); stop = entry.index + 1; }
    }
    return { messages, previous: start || null, next: !tail && stop < end && (more || stop < total) ? stop : null };
  }
  private async loadMessages(id: string): Promise<ChatMessage[]> {
    const { items } = await this.threadItems(id);
    const messages: ChatMessage[] = []; let size = 0;
    for (const item of items) {
      const message = await codexMessage(item, [...this.roots, ...(this.options.attachmentRoots || [])]);
      if (message) { size += JSON.stringify(message).length; if (size > 16_000_000) throw new HttpError(413, 'This Codex conversation is too large to load on the phone.'); messages.push(message); }
    }
    return messages;
  }
  private async childThread(parent: string, child: string, items: any[]) {
    if (!validAgentId(child) || child === parent) throw new HttpError(404, 'Agent does not belong to this conversation.');
    // A send/wait receiver can be a peer or ancestor: it is not sufficient proof.
    const spawned = items.some(item => item.type === 'collabAgentToolCall' && item.tool === 'spawnAgent'
      && item.senderThreadId === parent && item.receiverThreadIds?.includes(child));
    const mentioned = spawned || items.some(item => (item.type === 'subAgentActivity' && item.agentThreadId === child)
      || (item.type === 'collabAgentToolCall' && item.receiverThreadIds?.includes(child)));
    if (!mentioned) throw new HttpError(404, 'Agent does not belong to this conversation.');
    const metadata = await this.readThread(child,false,true);
    const source = metadata.source?.subAgent?.thread_spawn;
    if (source ? source.parent_thread_id !== parent : !spawned) throw new HttpError(404, 'Agent does not belong to this conversation.');
    return metadata;
  }
  async subagents(parent: string): Promise<SubagentView[]> {
    const { items } = await this.threadItems(parent), found = new Map<string, SubagentView>();
    for (const item of items) for (const agent of codexAgents(item)) {
      const previous = found.get(agent.id);
      found.set(agent.id, { ...previous, ...agent, prompt: agent.prompt || previous?.prompt, result: agent.result || previous?.result });
    }
    if (found.size > 100) throw new HttpError(413, 'Too many agents to load at once.');
    const agents: SubagentView[] = [];
    for (const agent of found.values()) {
      try {
        const thread = await this.childThread(parent, agent.id, items), source = thread.source?.subAgent?.thread_spawn;
        agent.name = source?.agent_nickname || source?.agent_path || thread.agentNickname || thread.name || agent.name;
        if (thread.status?.type === 'active') agent.status = 'running';
        if (thread.status?.type === 'systemError') agent.status = 'error';
        agents.push(agent);
      } catch (error) {
        // Out-of-scope/deleted child contexts are excluded, transport failures remain visible.
        if (!(error instanceof HttpError && [403, 404].includes(error.status))) throw error;
      }
    }
    return agents;
  }
  async subagentMessages(parent: string, child: string): Promise<ChatMessage[]> {
    const { items } = await this.threadItems(parent);
    await this.childThread(parent, child, items);
    return this.messages(child);
  }
  view(job: CodexJob): JobView {
    const { pending, turnId, acceptingEvents, cancelled, eventQueue, followups, ...view } = job; return view;
  }
  async followup(id:string,input:FollowupInput){
    const job=this.get(id);job.followups??=new Followups();
    await job.followups.run(input,async()=>{
      if(job.status!=='running'||job.cancelled||!job.turnId||!job.acceptingEvents)throw new HttpError(409,'The active turn has ended or is not ready. Your draft is preserved.');
      const turnId=job.turnId,parts:any[]=[{type:'text',text:input.text}];
      for(const attachment of input.attachmentPaths||[]){
        const file=await allowedPath([...this.roots,...(this.options.attachmentRoots||[])],attachment);
        if(/\.(png|jpe?g|gif|webp)$/i.test(file))parts.push({type:'localImage',path:file});
      }
      if(job.status!=='running'||job.cancelled||job.turnId!==turnId)throw new HttpError(409,'The active turn has ended. Your draft is preserved.');
      await (await this.connect()).request('turn/steer',{threadId:job.sessionId,expectedTurnId:turnId,input:parts,clientUserMessageId:input.id});
      job.messages.push({id:input.id,role:'user',blocks:[{type:'text',text:input.displayText||input.text}]});job.revision++;
    });
    return this.view(job);
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
      const permissions = codexPermissions(input.codexAccess, input.mode, cwd);
      const { sandbox, approvalPolicy, approvalsReviewer, sandboxPolicy } = permissions;
      const startParams = { cwd, ...(input.model ? { model: input.model } : {}), sandbox, approvalPolicy, approvalsReviewer };
      if (job.cancelled) return;
      const session = await rpc.request(input.sessionId ? 'thread/resume' : 'thread/start', input.sessionId ? { ...startParams, threadId: input.sessionId, excludeTurns: true } : startParams);
      verifyCodexPermissions(session, permissions);
      job.sessionId = session.thread.id; job.cwd = cwd; job.revision++;
      if (job.cancelled) return;
      if (input.reasoningEffort) {
        const catalog = codexModels((await rpc.request('model/list', { includeHidden: false, limit: 100 })).data);
        const effectiveModel = input.model || session.model;
        const model = catalog.find(candidate => candidate.id === effectiveModel);
        if (!model?.reasoningEfforts.includes(input.reasoningEffort)) throw new HttpError(400, 'This reasoning effort is unavailable for the selected Codex model. Refresh the models and choose another effort.');
      }
      if (job.cancelled) return;
      job.acceptingEvents = true;
      const result = await rpc.request('turn/start', { threadId: job.sessionId, input: turnInput, cwd, approvalPolicy, approvalsReviewer,
        ...(input.model ? { model: input.model } : {}), clientUserMessageId: job.messages[0].id,
        ...(input.reasoningEffort ? { effort: input.reasoningEffort } : {}),
        sandboxPolicy });
      job.turnId = result.turn.id; job.revision++;
      if (job.cancelled) { await this.interrupt(job, rpc); this.finish(job, 'stopped'); }
      else if (result.turn.status && result.turn.status !== 'inProgress') this.completeTurn(job, result.turn);
    } catch (error) {
      if (!job.cancelled && error instanceof CodexRequestError && error.errorCode) job.errorCode = error.errorCode;
      this.finish(job, job.cancelled ? 'stopped' : 'error', error instanceof Error ? error.message : 'Could not start Codex.');
    }
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
          const item = await codexMessage(p.item, [...this.roots, ...(this.options.attachmentRoots || [])], true);
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
