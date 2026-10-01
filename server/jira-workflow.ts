import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './security.js';
import type { JiraIssue, JiraService, JiraTransition } from './jira.js';
import type { JobView } from './types.js';
import { JiraPullRequests } from './jira-pr.js';
import type { CodexAccess } from './codex-access.js';
import { workflowActions, workflowStage, validateTransitionFields, type JiraRole } from './jira-workflow-actions.js';

export type WorkflowLink = { provider: 'claude' | 'codex' | 'copilot'; cwd: string; role: JiraRole; jobId?: string; sessionId?: string; pr?: { url: string; number: number } };
export type WorkflowInput = { id: string; site: string; key: string; provider: 'claude' | 'codex' | 'copilot'; role: JiraRole; action: string; cwd: string; mode: 'default' | 'plan'; codexAccess?: CodexAccess; maxBudgetUsd: number; transitionId?: string; fields?: Record<string, unknown>; pullRequest?: { title: string; body: string; base: string; head: string; headSha: string } };
type Operation = { id: string; signature: string; action: string; source: string; cwd: string; role: JiraRole; transition?: JiraTransition; phase: 'prepared' | 'pr_pending' | 'pr_done' | 'transition_pending' | 'transition_done' | 'job_pending' | 'done'; jobId?: string; previousSession?: string; aliases?: string[]; pullRequest?: WorkflowInput['pullRequest'] };
type RecordEntry = { site: string; key: string; provider: 'claude' | 'codex' | 'copilot'; link?: WorkflowLink; links?: Partial<Record<JiraRole, WorkflowLink>>; pr?: WorkflowLink['pr']; prCwd?: string; operation?: Operation; completed: string[]; abandoned?: string[] };
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const sameFolder = (a: string, b: string) => process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);
const atDestination = (issue: JiraIssue, transition: JiraTransition) => issue.statusId && transition.to.id ? issue.statusId === transition.to.id : issue.status.normalize('NFKC').trim().toLowerCase() === transition.to.name.normalize('NFKC').trim().toLowerCase();
type Dependencies = {
  jira: JiraService;
  jiraForProvider?(provider:'claude'|'codex'|'copilot'):JiraService;
  validate(input: WorkflowInput): Promise<string>;
  start(input: WorkflowInput, issue: JiraIssue, sessionId?: string): Promise<JobView>;
  job(id: string): JobView | undefined;
  pullRequests?: Pick<JiraPullRequests, 'preview' | 'create'> & Partial<Pick<JiraPullRequests, 'reconcile'>>;
};
export class JiraWorkflow {
  isBusy() { return this.locks.size > 0; }
  private records: Record<string, RecordEntry> = Object.create(null);
  private ready: Promise<void>;
  private writes = Promise.resolve();
  private locks = new Set<string>();
  private pullRequests: Pick<JiraPullRequests, 'preview' | 'create'> & Partial<Pick<JiraPullRequests, 'reconcile'>>;
  constructor(private file: string, private deps: Dependencies) {
    this.pullRequests = deps.pullRequests || new JiraPullRequests();
    this.ready = this.restore();
    // A rejected restore must remain fail-closed without an unhandled rejection.
    void this.ready.catch(() => {});
  }
  private async restore() {
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8'));
      if (data.version !== 1 || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('Invalid workflow store');
      this.records = Object.assign(Object.create(null), data.records);
      for (const record of Object.values(this.records)) {
        if (record.link) {
          record.links ||= {};
          record.links[record.link.role] ||= record.link;
          record.pr ||= record.link.pr;
          if (record.pr) record.prCwd ||= record.link.cwd;
        }
      }
    } catch (error: any) { if (error.code !== 'ENOENT') throw new HttpError(409, 'Cannot read saved Jira workflow. Check the workflow file on the PC before continuing.'); }
  }
  private save() {
    const json = JSON.stringify({ version: 1, records: this.records });
    this.writes = this.writes.catch(() => {}).then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file + '.tmp', json, { mode: 0o600 }); await rename(this.file + '.tmp', this.file);
    });
    return this.writes;
  }
  private jira(provider:'claude'|'codex'|'copilot'){return this.deps.jiraForProvider?.(provider)||this.deps.jira;}
  private recordKey(site: string, key: string, provider: string) { return JSON.stringify([site, key.toUpperCase(), provider]); }
  private issueKey(site: string, key: string) { return JSON.stringify([site, key.toUpperCase()]); }
  private issueRecords(site: string, key: string) { return Object.values(this.records).filter(record => record.site === site && record.key.toUpperCase() === key.toUpperCase()); }
  private roleLink(record: RecordEntry | undefined, role: JiraRole) { return record?.links?.[role] || (record?.link?.role === role ? record.link : undefined); }
  private setLink(record: RecordEntry, link: WorkflowLink) { record.links ||= {}; record.links[link.role] = link; record.link = link; }
  private setPr(site: string, key: string, pr: NonNullable<WorkflowLink['pr']>, cwd: string) {
    for (const entry of this.issueRecords(site, key)) { entry.pr = pr; entry.prCwd = cwd; }
  }
  private hasActiveJob(record: RecordEntry) {
    const ids = new Set([...Object.values(record.links || {}).map(link => link?.jobId), record.link?.jobId, record.operation?.jobId].filter(Boolean) as string[]);
    return [...ids].some(id => this.deps.job(id)?.status === 'running');
  }
  private async syncLink(record?: RecordEntry) {
    if (!record) return;
    let changed = false;
    for (const link of new Set([record.link, ...Object.values(record.links || {})])) {
      if (!link?.jobId) continue;
      const job = this.deps.job(link.jobId);
      if (job?.sessionId && job.sessionId !== link.sessionId) { link.sessionId = job.sessionId; changed = true; }
    }
    if (changed) await this.save();
  }
  async sync() { await this.ready; for (const entry of Object.values(this.records)) await this.syncLink(entry); await this.writes; }
  async view(site: string, key: string, provider: 'claude' | 'codex' | 'copilot', role: JiraRole) {
    await this.ready;
    const record = this.records[this.recordKey(site, key, provider)]; await this.syncLink(record);
    const issue = await this.jira(provider).issue(site, key);
    const transitions = this.jira(provider).transitions ? await this.jira(provider).transitions!(site, key) : [];
    const related = this.issueRecords(site, key), prRecord = related.find(entry => entry.pr || entry.link?.pr);
    const pr = prRecord?.pr || prRecord?.link?.pr, selected = this.roleLink(record, role);
    const link = selected ? { ...selected, ...(pr ? { pr } : {}) } : pr ? { provider, role, cwd: prRecord?.prCwd || prRecord?.link?.cwd || '', pr } : undefined;
    const pendingRecord = related.find(entry => entry.operation && entry.operation.phase !== 'done'), operation = pendingRecord?.operation;
    const pending = operation ? { id: operation.id, action: operation.action, phase: operation.phase, provider: pendingRecord!.provider,
      message: operation.phase === 'prepared' ? 'This action was prepared but has not changed Jira or GitHub. You can clear it and choose another action.' : 'This action is incomplete. Check Jira, pull requests and existing chats before clearing it. Existing changes will not be undone.' } : undefined;
    return { issue, stage: workflowStage(issue.status), role, actions: this.jira(provider).transition ? workflowActions(issue, role, transitions) : [], link, ...(pending ? { pending } : {}) };
  }
  async recover(site: string, key: string, provider: 'claude' | 'codex' | 'copilot', operationId: string): Promise<void> {
    await this.ready;
    const lock = this.issueKey(site, key);
    if (this.locks.has(lock)) throw new HttpError(409, 'An action is already running for this task. Wait and refresh.');
    this.locks.add(lock);
    try {
      const record = this.records[this.recordKey(site, key, provider)], operation = record?.operation;
      if (!record || !operation || operation.id !== operationId || operation.phase === 'done') throw new HttpError(409, 'The pending action changed. Refresh the task.');
      const related = this.issueRecords(site, key);
      if (related.some(entry => this.hasActiveJob(entry))) throw new HttpError(409, 'The agent is still working on this task. Wait for it to finish or stop it.');
      await this.jira(provider).issue(site, key);
      for (const entry of related) await this.syncLink(entry);
      if (operation.phase === 'pr_pending') {
        if (!operation.cwd || !operation.pullRequest) throw new HttpError(409, 'The original pull request details are unavailable. Check the saved workflow on the PC before clearing this action.');
        if (this.pullRequests.reconcile) {
          const found = await this.pullRequests.reconcile(operation.cwd, key, operation.pullRequest.base, operation.pullRequest.head);
          if (found) this.setPr(site, key, found, operation.cwd);
        } else {
        let preview;
        try { preview = await this.pullRequests.preview(operation.cwd, key); }
        catch { throw new HttpError(409, 'Could not check the pending pull request. Restore the original project branch and try again.'); }
        if ((!preview.ready && !preview.existing) || preview.head !== operation.pullRequest.head || preview.base !== operation.pullRequest.base || preview.headSha !== operation.pullRequest.headSha)
          throw new HttpError(409, 'Could not verify the original pull request. Restore the original project branch and commit, then try again.');
        if (preview.existing) this.setPr(site, key, preview.existing, operation.cwd);
        }
      }
      // Recovery acknowledges remote state; it never replays or rolls back writes.
      record.abandoned = [...new Set([...(record.abandoned || []), operation.id, ...(operation.aliases || [])])];
      record.operation = undefined;
      try { await this.save(); }
      catch (error) { record.operation = operation; throw error; }
    } finally { this.locks.delete(lock); }
  }
  preview(cwd: string, key: string) { return this.pullRequests.preview(cwd, key); }
  async batch(input: Omit<WorkflowInput, 'action'>) {
    const view = await this.view(input.site, input.key, input.provider, input.role);
    const action = view.actions.find(item => item.kind === 'start');
    if (!action) throw new HttpError(409, 'This task has no start action for the selected role and current status. Open its details.');
    if (action.transitions.length > 1) throw new HttpError(409, 'Choose the Jira transition in task details before starting this task.');
    const transition = action.transitions[0]; if (transition) validateTransitionFields(transition);
    return this.act({ ...input, action: action.id, transitionId: transition?.id });
  }
  async act(input: WorkflowInput): Promise<{ job?: JobView; view: Awaited<ReturnType<JiraWorkflow['view']>> }> {
    await this.ready;
    const key = this.recordKey(input.site, input.key, input.provider), lock = this.issueKey(input.site, input.key);
    if (this.locks.has(lock)) throw new HttpError(409, 'An action is already running for this task. Wait and refresh.');
    this.locks.add(lock);
    try {
      const ownsId = (entry: RecordEntry) => entry.operation?.id === input.id || entry.operation?.aliases?.includes(input.id) || entry.completed.includes(input.id) || entry.abandoned?.includes(input.id);
      const owner = Object.entries(this.records).find(([, entry]) => ownsId(entry));
      if (owner && owner[0] !== key || !owner && this.deps.job(input.id)) throw new HttpError(409, 'This action identifier already belongs to another chat or task. Choose a new action.');
      const cwd = await this.deps.validate(input); input = { ...input, cwd };
      const record = this.records[key] ||= { site: input.site, key: input.key, provider: input.provider, completed: [] };
      if (this.issueRecords(input.site, input.key).some(entry => entry.abandoned?.includes(input.id))) throw new HttpError(409, 'This action was cleared and cannot be replayed. Refresh the task and choose a new action.');
      if (this.issueRecords(input.site, input.key).some(entry => entry !== record && entry.operation && entry.operation.phase !== 'done')) throw new HttpError(409, 'This task has an incomplete action in another workspace. Check and clear that action before continuing.');
      await this.syncLink(record);
      const signature = createHash('sha256').update(JSON.stringify(canonical({ ...input, id: undefined }))).digest('hex');
      let operation = record.operation;
      if (record.completed.includes(input.id) || operation?.id === input.id && operation.phase === 'done') {
        if (operation?.id === input.id && operation.signature !== signature) throw new HttpError(409, 'This action identifier was already used with different values.');
        return { job: operation?.id === input.id && operation.jobId ? this.deps.job(operation.jobId) : undefined, view: await this.view(input.site, input.key, input.provider, input.role) };
      }
      if (operation && operation.phase !== 'done') {
        if (operation.signature !== signature) throw new HttpError(409, 'A previous action is incomplete. Retry that action with the same values before starting another one.');
        if (input.id !== operation.id && !operation.aliases?.includes(input.id)) { operation.aliases = [...(operation.aliases || []), input.id]; await this.save(); }
        input.id = operation.id;
      } else {
        const current = await this.view(input.site, input.key, input.provider, input.role);
        const action = current.actions.find(a => a.id === input.action);
        if (!action) throw new HttpError(409, 'This action is no longer available. Refresh the task to see its current status.');
        if (this.issueRecords(input.site, input.key).some(entry => this.hasActiveJob(entry))) throw new HttpError(409, 'The agent is still working on this task. Wait for it to finish or stop it.');
        const transition = action.transitions.length ? action.transitions.find(t => t.id === input.transitionId) : undefined;
        if (action.transitions.length && !transition) throw new HttpError(400, 'Choose an available Jira transition.');
        if (transition) validateTransitionFields(transition, input.fields);
        if (action.kind === 'pr' && !input.pullRequest) throw new HttpError(400, 'Review the pull request preview before sending this task for review.');
        const previous = this.roleLink(record, input.role);
        operation = { id: input.id, signature, action: input.action, source: current.issue.statusId || current.issue.status, cwd, role: input.role,
          transition, phase: 'prepared', pullRequest: input.pullRequest,
          previousSession: previous?.cwd && sameFolder(previous.cwd, cwd) && input.action === 'continue_development' ? previous.sessionId : undefined };
        record.operation = operation; await this.save();
      }
      let issue = await this.jira(input.provider).issue(input.site, input.key);
      const currentStatus = () => issue.statusId || issue.status;
      if (operation.phase === 'prepared' || operation.phase === 'pr_pending') {
        if (currentStatus() !== operation.source) throw new HttpError(409, 'The Jira status changed while this action was being prepared. Check Jira before retrying.');
        if (operation.action === 'submit_review') {
          // Persist before any push/PR mutation. The helper finds an existing PR on retry.
          operation.phase = 'pr_pending'; await this.save();
          const pr = await this.pullRequests.create(cwd, input.key, input.pullRequest!);
          this.setPr(input.site, input.key, pr, cwd);
          operation.phase = 'pr_done'; await this.save();
        }
      }
      if (['prepared', 'pr_done', 'transition_pending'].includes(operation.phase)) {
        issue = await this.jira(input.provider).issue(input.site, input.key);
        const transition = operation.transition;
        if (transition) {
          if (!atDestination(issue, transition)) {
            if (currentStatus() !== operation.source) throw new HttpError(409, 'The Jira status changed. Check the task before retrying this action.');
            const available = await this.jira(input.provider).transitions!(input.site, input.key);
            const fresh = available.find(t => t.id === transition.id && t.to.name === transition.to.name && (!t.to.id || !transition.to.id || t.to.id === transition.to.id));
            if (!fresh) throw new HttpError(409, 'This Jira transition is no longer available.');
            validateTransitionFields(fresh, input.fields);
            operation.phase = 'transition_pending'; await this.save();
            try { await this.jira(input.provider).transition!(input.site, input.key, fresh.id, input.fields); }
            catch {
              // Never issue another write here: reconcile the remote result first.
              issue = await this.jira(input.provider).issue(input.site, input.key);
              if (!atDestination(issue, fresh)) throw new HttpError(409, 'Jira did not confirm the status change. Check the task in Jira, then retry the same action. Any created pull request is saved.');
            }
            issue = await this.jira(input.provider).issue(input.site, input.key);
            if (!atDestination(issue, fresh)) throw new HttpError(409, 'Jira has not reached the selected status. Refresh the task and check its workflow before continuing.');
          }
        }
        operation.phase = 'transition_done'; await this.save();
      }
      let job: JobView | undefined;
      if (['start_development', 'continue_development', 'start_review', 'start_qa'].includes(operation.action)) {
        if (operation.phase === 'job_pending') {
          job = this.deps.job(operation.jobId!);
          if (!job) throw new HttpError(409, 'The PC restarted during chat creation. Check existing chats before starting this task again; it will not be launched twice automatically.');
        } else if (operation.phase === 'transition_done') {
          issue = await this.jira(input.provider).issue(input.site, input.key);
          if (!(operation.transition ? atDestination(issue, operation.transition) : (issue.statusId || issue.status) === operation.source)) throw new HttpError(409, 'The Jira status changed before chat creation. Check and clear the pending action before starting another one.');
          operation.phase = 'job_pending'; operation.jobId = operation.id;
          await this.save();
          try { job = await this.deps.start(input, issue, operation.previousSession); }
          catch (error) { operation.phase = 'transition_done'; await this.save(); throw error; }
          this.setLink(record, { provider: input.provider, role: input.role, cwd, jobId: operation.id, sessionId: job.sessionId || operation.previousSession });
        }
      }
      if (job && operation.phase === 'job_pending') this.setLink(record, { provider: input.provider, role: input.role, cwd, jobId: job.id, sessionId: job.sessionId || operation.previousSession });
      operation.phase = 'done'; record.completed = [...new Set([...record.completed, operation.id, ...(operation.aliases || [])])].slice(-200); await this.save();
      return { job, view: await this.view(input.site, input.key, input.provider, input.role) };
    } finally { this.locks.delete(lock); }
  }
}
