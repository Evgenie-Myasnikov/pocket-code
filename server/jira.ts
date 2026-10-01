import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { HttpError, validToken } from './security.js';
import type { JiraStore } from './jira-vault.js';

const endpoint = 'https://mcp.atlassian.com/v1/mcp';
export type JiraIssue = { key: string; summary: string; description: string; descriptionFormat?: 'markdown' | 'html' | 'text'; status: string; priority: string; url: string; updated: string; statusId?: string; issueType?: string; projectKey?: string; assigneeId?: string };
export type JiraSite = { id: string; name: string; url: string };
export type JiraIssueQuery = { search?: string; type?: string; stage?: string; statusCategory?: string; status?: string; project?: string };
export type JiraTransitionField = { name: string; required: boolean; schema: { type: string; items?: string; system?: string; custom?: string }; allowedValues?: any[]; hasDefaultValue?: boolean };
export type JiraTransition = { id: string; name: string; to: { id?: string; name: string }; fields: Record<string, JiraTransitionField> };
export const jiraIssueFields = ['summary', 'description', 'status', 'priority', 'updated', 'issuetype', 'project', 'assignee'];
export const jiraStageAliases: Record<string, string[]> = {
  backlog: ['Backlog', 'Бэклог', 'Беклог'],
  open: ['Open', 'To Do', 'Открыта', 'Открыто', 'К выполнению'],
  development: ['In Progress', 'In Development', 'В работе', 'В разработке'],
  review: ['Review', 'Code Review', 'На ревью', 'Ревью'],
  pr_review: ['PR Review', 'На ревью PR', 'PR Ревью'],
  waiting_qa: ['Waiting for Check', 'Waiting for QA', 'Ready for QA', 'Ожидает проверки', 'Готова к проверке', 'Ждет проверки', 'Ждёт проверки'],
  qa: ['On Check', 'In QA', 'In Testing', 'На проверке', 'Тестирование'],
  waiting_merge: ['Waiting for Merge', 'Awaiting Merge', 'Ожидает слияния', 'Ожидает влитие'],
  done: ['Done', 'Resolved', 'Готово', 'Решена', 'Выполнено'],
  closed: ['Closed', 'Закрыта', 'Закрыто', 'Закрыто без решения'],
};
function queryText(value: string | undefined, max: number) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new HttpError(400, 'Invalid Jira filter.');
  return value.trim();
}
const jqlString = (value: string) => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
export function jiraIssuesJql(query: JiraIssueQuery = {}) {
  const search = queryText(query.search, 200), type = queryText(query.type, 100), stage = queryText(query.stage, 30);
  const clauses = ['assignee = currentUser()'];
  if (search) clauses.push(/^[A-Z][A-Z0-9_]*-\d+$/i.test(search) ? `key = ${jqlString(search.toUpperCase())}` : `text ~ ${jqlString(search)}`);
  if (type) clauses.push(`issuetype = ${jqlString(type)}`);
  const category = queryText(query.statusCategory, 30), status = queryText(query.status, 100), project = queryText(query.project, 100);
  const categories: Record<string,string> = {new:'To Do',indeterminate:'In Progress',done:'Done'};
  if(category){if(!Object.hasOwn(categories,category))throw new HttpError(400,'Invalid Jira status category.');clauses.push(`statusCategory = ${jqlString(categories[category])}`);}
  if(status)clauses.push(`status = ${jqlString(status)}`);
  if(project)clauses.push(`project = ${jqlString(project)}`);
  if (stage) {
    if (!Object.hasOwn(jiraStageAliases, stage)) throw new HttpError(400, 'Unknown Jira workflow stage.');
    // Jira rejects unknown status names. Aliases from other languages/workflows
    // must be matched against returned statuses, not sent as JQL operands.
  }
  return clauses.join(' AND ') + ' ORDER BY updated DESC';
}
export function jiraMatchesStage(issue: JiraIssue, stage?: string) {
  if (!stage) return true;
  const aliases = Object.hasOwn(jiraStageAliases, stage) ? jiraStageAliases[stage] : undefined;
  if (!aliases) throw new HttpError(400, 'Unknown Jira workflow stage.');
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase().replace(/ё/g, 'е');
  return aliases.some(alias => normalize(alias) === normalize(issue.status));
}
export function jiraTransitions(raw: any): JiraTransition[] {
  const data = raw?.data ?? raw;
  const list = Array.isArray(data) ? data : data?.transitions;
  if (!Array.isArray(list)) throw new HttpError(502, 'Jira returned an unexpected transition list.');
  return list.filter((value: any) => value?.isAvailable !== false).map((value: any) => {
    if (!value || !/^\d+$/.test(String(value.id)) || !value.to || (value.to.id !== undefined && !/^\d+$/.test(String(value.to.id))) || typeof value.name !== 'string' || typeof value.to.name !== 'string') throw new HttpError(502, 'Jira returned an invalid transition.');
    const fields: Record<string, JiraTransitionField> = Object.create(null);
    for (const [key, field] of Object.entries(value.fields || {}) as [string, any][]) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || !field || typeof field !== 'object') continue;
      fields[key] = { name: typeof field.name === 'string' ? field.name : key, required: field.required === true,
        schema: { type: typeof field.schema?.type === 'string' ? field.schema.type : 'unknown',
          ...Object.fromEntries(['items', 'system', 'custom'].filter(k => typeof field.schema?.[k] === 'string').map(k => [k, field.schema[k]])) },
        ...(Array.isArray(field.allowedValues) ? { allowedValues: field.allowedValues } : {}),
        ...(typeof field.hasDefaultValue === 'boolean' ? { hasDefaultValue: field.hasDefaultValue } : {}) };
    }
    // The existing Rovo connector returns destination names/category but omits
    // destination IDs. Preserve that absence; only transition.id is executable.
    return { id: String(value.id), name: value.name, to: { ...(value.to.id !== undefined ? { id: String(value.to.id) } : {}), name: value.to.name }, fields };
  });
}
export function jiraTransitionArgs(site: string, key: string, transitionId: string, fields?: Record<string, unknown>) {
  if (!/^[A-Z][A-Z0-9_]*-\d+$/i.test(key) || !/^\d{1,30}$/.test(transitionId)) throw new HttpError(400, 'Invalid Jira transition.');
  if (fields !== undefined && (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).some(key => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) || JSON.stringify(fields).length > 30000)) throw new HttpError(400, 'Invalid Jira transition fields.');
  return { cloudId: site, issueIdOrKey: key, transitionId, ...(fields && Object.keys(fields).length ? { fields } : {}) };
}
export const jiraTransitionUncertain = 'Jira did not confirm the transition. Its status may already have changed. Refresh the issue and check it before trying again.';
export interface JiraService {
  useExisting?(): Promise<{ connected: boolean; sites: JiraSite[] }>;
  status(): Promise<{ connected: boolean; sites: JiraSite[] }>;
  connect(redirect: string): Promise<{ authorizationUrl: string; state: string }>;
  finish(code: string, state: string, issuer?: string): Promise<void>;
  disconnect(): Promise<void>;
  issues(site: string, cursor?: string, query?: JiraIssueQuery): Promise<{ issues: JiraIssue[]; next: string | null }>;
  issue(site: string, key: string): Promise<JiraIssue>;
  transitions?(site: string, key: string): Promise<JiraTransition[]>;
  transition?(site: string, key: string, id: string, fields?: Record<string, unknown>): Promise<void>;
}
export function jiraText(value: any, depth = 0): string {
  if (depth > 30) return '';
  if (typeof value === 'string') return value.slice(0, 60000);
  if (!value || typeof value !== 'object') return '';
  if (typeof value.text === 'string') return value.text;
  if (value.type === 'hardBreak') return '\n';
  if (value.type === 'mention') return value.attrs?.text || '';
  return (Array.isArray(value.content) ? value.content.map((v: any) => jiraText(v, depth + 1)).join('') + (['paragraph', 'heading', 'listItem'].includes(value.type) ? '\n' : '') : '').slice(0, 60000);
}
export function jiraIssue(raw: any, site: JiraSite): JiraIssue {
  if (!/^[A-Z][A-Z0-9_]*-\d+$/i.test(raw?.key || '')) throw new HttpError(502, 'Jira вернула неверную задачу');
  const f = raw.fields || raw;
  return { key: raw.key, summary: String(f.summary || '').slice(0, 1000), description: jiraText(f.description), descriptionFormat: raw.appliedContentFormat === 'html' ? 'html' : typeof f.description === 'string' ? 'markdown' : 'text', status: String(f.status?.name || (typeof f.status === 'string' ? f.status : '')), priority: String(f.priority?.name || (typeof f.priority === 'string' ? f.priority : '')), updated: String(f.updated || ''), url: `${site.url}/browse/${raw.key}`,
    ...(f.status?.id !== undefined ? { statusId: String(f.status.id) } : {}),
    ...(f.issuetype?.name ? { issueType: String(f.issuetype.name) } : {}),
    ...(f.project?.key ? { projectKey: String(f.project.key) } : {}),
    ...(f.assignee?.accountId ? { assigneeId: String(f.assignee.accountId) } : {}) };
}
export class AtlassianJira implements JiraService, OAuthClientProvider {
  private data: { client?: OAuthClientInformationMixed; tokens?: OAuthTokens; redirect?: string; sites?: JiraSite[] } = {};
  private ready: Promise<void>;
  private pending?: { state: string; expires: number; verifier?: string; url?: string };
  private client?: Client;
  private connected?: Promise<Client>;
  private writes = Promise.resolve();
  constructor(private store: JiraStore) { this.ready = store.load().then(data => { this.data = data; }).catch(() => { this.data = {}; }); }
  async close() { await this.client?.close(); this.client = undefined; this.connected = undefined; }
  private save() { const snapshot = structuredClone(this.data); this.writes = this.writes.catch(() => {}).then(() => this.store.save(snapshot)); return this.writes; }
  get redirectUrl() { return this.data.redirect; }
  get clientMetadata() { return { client_name: 'Pocket Code', redirect_uris: this.data.redirect ? [this.data.redirect] : [], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }; }
  clientInformation() { return this.data.client; }
  async saveClientInformation(value: OAuthClientInformationMixed) { this.data.client = value; await this.save(); }
  tokens() { return this.data.tokens; }
  async saveTokens(value: OAuthTokens) { this.data.tokens = value; await this.save(); }
  state() { if (!this.pending) throw new Error('No pending login'); return this.pending.state; }
  saveCodeVerifier(value: string) { if (this.pending) this.pending.verifier = value; }
  codeVerifier() { if (!this.pending?.verifier) throw new Error('No pending verifier'); return this.pending.verifier; }
  redirectToAuthorization(url: URL) {
    if (url.protocol !== 'https:' || !['mcp.atlassian.com', 'id.atlassian.com', 'auth.atlassian.com'].includes(url.hostname)) throw new Error('Invalid OAuth origin');
    if (this.pending) this.pending.url = url.href;
  }
  async invalidateCredentials(scope: string) {
    if (scope === 'all' || scope === 'tokens') this.data.tokens = undefined;
    if (scope === 'all' || scope === 'client') this.data.client = undefined;
    await this.save();
  }
  async connect(redirect: string) {
    await this.ready;
    const match = redirect.match(/^http:\/\/127\.0\.0\.1:([1-9]\d{3,4})\/jira-callback$/);
    if (!match || Number(match[1]) < 1024 || Number(match[1]) > 65535) throw new HttpError(400, 'Вход нужно начать через Android-приложение');
    if (this.pending && this.pending.expires > Date.now()) throw new HttpError(409, 'Вход уже открыт. Завершите его или нажмите «Отменить вход».');
    await this.client?.close(); this.client = undefined; this.connected = undefined;
    if (redirect !== this.data.redirect) this.data.client = undefined;
    this.data.redirect = redirect; this.data.tokens = undefined; this.data.sites = [];
    this.pending = { state: randomBytes(32).toString('base64url'), expires: Date.now() + 300000 };
    try {
      await auth(this, { serverUrl: endpoint });
      if (!this.pending.url) throw new Error('No OAuth URL');
      return { authorizationUrl: this.pending.url, state: this.pending.state };
    } catch { this.pending = undefined; throw new HttpError(502, 'Atlassian не начал вход. Проверьте интернет на ПК и доступ к Atlassian MCP.'); }
  }
  async finish(code: string, state: string, issuer?: string) {
    if (!this.pending || this.pending.expires < Date.now() || !validToken(state, this.pending.state)) throw new HttpError(400, 'Вход истёк или не совпадает. Нажмите Connect ещё раз.');
    if (issuer && issuer.replace(/\/$/, '') !== 'https://mcp.atlassian.com') throw new HttpError(400, 'Неверный источник входа');
    this.pending.expires = 0; // Consume before exchanging to reject parallel/replayed callbacks.
    try {
      await auth(this, { serverUrl: endpoint, authorizationCode: code });
      const raw = await this.call('getAccessibleAtlassianResources', {});
      const resources = Array.isArray(raw) ? raw : raw.resources || raw.data?.resources || [];
      this.data.sites = resources.filter((r: any) => (r.products?.some((p: any) => p.id === 'jira') || r.scopes?.some((s: string) => s.includes('jira'))) && /^https:\/\/[a-z0-9-]+\.atlassian\.net\/?$/i.test(r.url)).map((r: any) => ({ id: r.id || r.cloudId, name: r.name || new URL(r.url).hostname, url: r.url.replace(/\/$/, '') }));
      await this.save();
    } catch { throw new HttpError(502, 'Не удалось завершить вход Jira. Возможно, администратор ограничил Atlassian MCP. Нажмите Connect и попробуйте снова.'); }
    finally { this.pending = undefined; }
  }
  async status() { await this.ready; return { connected: Boolean(this.data.tokens), sites: this.data.sites || [] }; }
  async disconnect() { await this.ready; this.pending = undefined; await this.client?.close(); this.client = undefined; this.connected = undefined; this.data = {}; await this.save(); }
  private async connection() {
    await this.ready;
    if (!this.data.tokens) throw new HttpError(401, 'Подключите Jira в настройках через Connect');
    if (!this.connected) this.connected = (async () => {
      const client = new Client({ name: 'pocket-code', version: '0.6.0' });
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), { authProvider: this });
      try { await client.connect(transport); this.client = client; return client; }
      catch { await client.close().catch(() => {}); this.connected = undefined; throw new HttpError(401, 'Сессия Jira недоступна. Подключитесь повторно в настройках.'); }
    })();
    return this.connected;
  }
  private async call(name: string, args: Record<string, unknown>, mutation = false): Promise<any> {
    const client = await this.connection();
    try {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 25000 });
      if (result.isError) throw new Error('Jira rejected tool call');
      if (result.structuredContent) return result.structuredContent;
      const text = (result.content as any[])?.filter(c => c.type === 'text').map(c => c.text).join('\n');
      return JSON.parse(text || '{}');
    } catch { throw new HttpError(502, mutation ? jiraTransitionUncertain : 'Jira не вернула задачи. Проверьте права доступа и повторите обновление.'); }
  }
  private site(id: string) { const site = this.data.sites?.find(s => s.id === id); if (!site) throw new HttpError(400, 'Выберите сайт Jira'); return site; }
  async issues(id: string, cursor?: string, query?: JiraIssueQuery) {
    await this.ready; const site = this.site(id);
    const raw = await this.call('searchJiraIssuesUsingJql', { cloudId: id, jql: jiraIssuesJql(query), maxResults: 50, fields: jiraIssueFields, ...(cursor ? { nextPageToken: cursor } : {}) });
    const result = raw.data || raw;
    if (!Array.isArray(result.issues)) throw new HttpError(502, 'Неизвестный формат списка Jira');
    return { issues: result.issues.map((r: any) => jiraIssue(r, site)).filter((issue: JiraIssue) => jiraMatchesStage(issue, query?.stage)), next: result.nextPageToken || null };
  }
  async issue(id: string, key: string) {
    await this.ready; const site = this.site(id);
    const raw = await this.call('getJiraIssue', { cloudId: id, issueIdOrKey: key, fields: jiraIssueFields, view: 'full', responseContentFormat: 'markdown' });
    return jiraIssue(raw.data || raw, site);
  }
  async transitions(id: string, key: string) {
    await this.ready; this.site(id);
    if (!/^[A-Z][A-Z0-9_]*-\d+$/i.test(key)) throw new HttpError(400, 'Invalid Jira issue.');
    return jiraTransitions(await this.call('executeRead', { cloudId: id, name: 'listJiraIssueTransitions', inputs: { issueIdOrKey: key, expand: 'transitions.fields' } }));
  }
  async transition(id: string, key: string, transitionId: string, fields?: Record<string, unknown>) {
    await this.ready; this.site(id);
    const raw = await this.call('transitionJiraIssue', jiraTransitionArgs(id, key, transitionId, fields), true);
    if (raw?.isError || raw?.success === false || raw?.data?.success === false || raw?.error || raw?.data?.error) throw new HttpError(502, jiraTransitionUncertain);
  }
}
