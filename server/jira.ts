import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { HttpError, validToken } from './security.js';
import type { JiraStore } from './jira-vault.js';

const endpoint = 'https://mcp.atlassian.com/v1/mcp';
export type JiraIssue = { key: string; summary: string; description: string; status: string; priority: string; url: string; updated: string };
export type JiraSite = { id: string; name: string; url: string };
export interface JiraService {
  useExisting?(): Promise<{ connected: boolean; sites: JiraSite[] }>;
  status(): Promise<{ connected: boolean; sites: JiraSite[] }>;
  connect(redirect: string): Promise<{ authorizationUrl: string; state: string }>;
  finish(code: string, state: string, issuer?: string): Promise<void>;
  disconnect(): Promise<void>;
  issues(site: string, cursor?: string): Promise<{ issues: JiraIssue[]; next: string | null }>;
  issue(site: string, key: string): Promise<JiraIssue>;
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
  return { key: raw.key, summary: String(f.summary || '').slice(0, 1000), description: jiraText(f.description), status: String(f.status?.name || ''), priority: String(f.priority?.name || ''), updated: String(f.updated || ''), url: `${site.url}/browse/${raw.key}` };
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
  private async call(name: string, args: Record<string, unknown>): Promise<any> {
    const client = await this.connection();
    try {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 25000 });
      if (result.isError) throw new Error('Jira rejected tool call');
      if (result.structuredContent) return result.structuredContent;
      const text = (result.content as any[])?.filter(c => c.type === 'text').map(c => c.text).join('\n');
      return JSON.parse(text || '{}');
    } catch { throw new HttpError(502, 'Jira не вернула задачи. Проверьте права доступа и повторите обновление.'); }
  }
  private site(id: string) { const site = this.data.sites?.find(s => s.id === id); if (!site) throw new HttpError(400, 'Выберите сайт Jira'); return site; }
  async issues(id: string, cursor?: string) {
    await this.ready; const site = this.site(id);
    const raw = await this.call('searchJiraIssuesUsingJql', { cloudId: id, jql: 'assignee = currentUser() ORDER BY updated DESC', maxResults: 50, fields: ['summary', 'description', 'status', 'priority', 'updated'], ...(cursor ? { nextPageToken: cursor } : {}) });
    const result = raw.data || raw;
    if (!Array.isArray(result.issues)) throw new HttpError(502, 'Неизвестный формат списка Jira');
    return { issues: result.issues.map((r: any) => jiraIssue(r, site)), next: result.nextPageToken || null };
  }
  async issue(id: string, key: string) {
    await this.ready; const site = this.site(id);
    const raw = await this.call('getJiraIssue', { cloudId: id, issueIdOrKey: key, fields: ['summary', 'description', 'status', 'priority', 'updated'] });
    return jiraIssue(raw.data || raw, site);
  }
}
