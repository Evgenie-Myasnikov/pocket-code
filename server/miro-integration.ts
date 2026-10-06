import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from './security.js';
import type { JiraStore } from './jira-vault.js';
const secret = z.string().trim().min(1).max(8192).refine(value => !/[\s\x00-\x1f]/.test(value));
const identifier = z.string().regex(/^[A-Za-z0-9_=-]{1,100}$/);
const saved = z.object({
  clientId: z.string().max(200).optional(),
  clientSecret: secret.optional(),
  accessToken: secret.optional(),
  refreshToken: secret.optional(),
  expiresAt: z.number().optional(),
  scopes: z.array(z.string()).optional(),
  projects: z.array(z.object({
    root: z.string(),
    boardId: identifier,
    enabled: z.boolean(),
    allowWrite: z.boolean()
  })).max(100).default([])
});
type Saved = z.infer<typeof saved>;
export const miroUpdate = z.object({
  root: z.string().min(1).max(4096),
  itemId: identifier,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.string().max(10000),
  title: z.string().max(300).optional()
}).strict();
export type MiroItem = {
  id: string;
  type: string;
  content: string;
  title?: string;
  modifiedAt?: string;
  revision: string;
  editable: boolean;
};
const routes: Record<string, string> = {
  sticky_note: 'sticky_notes',
  text: 'texts',
  card: 'cards'
};
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const digest = (item: unknown) => createHash('sha256').update(JSON.stringify(stable(item))).digest('hex');
const plainHtml = (text: string) => '<p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r?\n/g, '<br>') + '</p>';
function itemResult(value: any): MiroItem {
  const id = identifier.parse(value?.id),
    type = typeof value.type === 'string' ? value.type : 'unknown',
    data = value.data || {};
  return {
    id,
    type,
    content: String(data.content ?? data.description ?? '').slice(0, 30000),
    ...(typeof data.title === 'string' ? {
      title: data.title.slice(0, 1000)
    } : {}),
    ...(typeof value.modifiedAt === 'string' ? {
      modifiedAt: value.modifiedAt
    } : {}),
    revision: digest({
      type,
      data,
      modifiedAt: value.modifiedAt
    }),
    editable: Object.hasOwn(routes, type)
  };
}
export class MiroIntegration {
  private data: Saved = {
    projects: []
  };
  private loaded?: Promise<void>;
  private writes = Promise.resolve();
  private refreshing?: Promise<string>;
  private generation = 0;
  private pending?: {
    state: string;
    redirectUri: string;
    expiresAt: number;
    generation: number;
  };
  private itemWrites = new Map<string, Promise<unknown>>();
  constructor(private store: JiraStore, private fetcher: typeof fetch = fetch, private now = Date.now) {}
  private async load() {
    await (this.loaded ??= this.store.load().then(value => {
      this.data = saved.parse(value);
    }));
  }
  private async change(action: (data: Saved) => void) {
    await this.load();
    const next = this.writes.then(async () => {
      const value = structuredClone(this.data);
      action(value);
      const validated = saved.parse(value);
      await this.store.save(validated);
      this.data = validated;
    });
    this.writes = next.catch(() => {});
    await next;
  }
  async status(root?: string, boardId?: string) {
    await this.load();
    const grant = this.data.projects.find(p => p.root === root && p.boardId === boardId);
    return {
      configured: !!(this.data.clientId && this.data.clientSecret),
      authenticated: !!this.data.accessToken,
      enabled: !!grant?.enabled,
      allowWrite: !!grant?.enabled && !!grant.allowWrite,
      signInPending: !!this.pending && this.pending.expiresAt > this.now(),
      ...(this.data.expiresAt ? {
        expiresAt: this.data.expiresAt
      } : {})
    };
  }
  async configure(clientId: string, clientSecret: string) {
    clientId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,200}$/).parse(clientId);
    clientSecret = secret.parse(clientSecret);
    this.generation++;
    this.pending = undefined;
    await this.change(data => {
      data.clientId = clientId;
      data.clientSecret = clientSecret;
      delete data.accessToken;
      delete data.refreshToken;
      delete data.expiresAt;
      data.projects = [];
    });
  }
  async start(redirectUri: string) {
    await this.load();
    if (!this.data.clientId || !this.data.clientSecret) throw new HttpError(409, 'Configure the Miro app on this PC first.');
    const url = new URL(redirectUri);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/miro/oauth/callback' || url.search || url.hash) throw new HttpError(400, 'Invalid Miro callback.');
    const state = randomBytes(32).toString('base64url');
    this.pending = {
      state,
      redirectUri,
      expiresAt: this.now() + 600000,
      generation: this.generation
    };
    const target = new URL('https://miro.com/oauth/authorize');
    target.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.data.clientId,
      redirect_uri: redirectUri,
      state
    }).toString();
    return {
      url: target.href,
      redirectUri
    };
  }
  async callback(state: string, code?: string, error?: string) {
    const pending = this.pending;
    if (!pending || pending.state !== state || pending.expiresAt <= this.now() || pending.generation !== this.generation) throw new HttpError(400, 'Miro sign-in expired or does not match this PC. Start again.');
    this.pending = undefined;
    if (error || !code) throw new HttpError(400, 'Miro sign-in was not approved.');
    const tokens = await this.exchange({
      grant_type: 'authorization_code',
      code: secret.parse(code),
      redirect_uri: pending.redirectUri
    });
    await this.keepTokens(tokens, pending.generation, true);
  }
  async setToken(token: string, boardId: string) {
    token = secret.parse(token);
    const generation = this.generation;
    await this.api(`/v2/boards/${encodeURIComponent(identifier.parse(boardId))}`, token);
    if (generation !== this.generation) throw new HttpError(409, 'Miro settings changed. Try again.');
    this.generation++;
    this.pending = undefined;
    await this.change(data => {
      data.accessToken = token;
      delete data.refreshToken;
      delete data.expiresAt;
      delete data.scopes;
      data.projects = [];
    });
  }
  async access(root: string, boardId: string, enabled: boolean, allowWrite: boolean) {
    await this.load();
    const generation = this.generation;
    identifier.parse(boardId);
    if (enabled) {
      if (!this.data.accessToken) throw new HttpError(409, 'Sign in to Miro first.');
      await this.api(`/v2/boards/${encodeURIComponent(boardId)}`, await this.token());
    }
    await this.change(data => {
      if (generation !== this.generation) throw new HttpError(409, 'Miro settings changed. Try again.');
      data.projects = data.projects.filter(p => p.root !== root);
      if (enabled) data.projects.push({
        root,
        boardId,
        enabled,
        allowWrite
      });
    });
  }
  async disconnect() {
    this.generation++;
    this.pending = undefined;
    await this.change(data => {
      delete data.accessToken;
      delete data.refreshToken;
      delete data.expiresAt;
      delete data.scopes;
      data.projects = [];
    });
  }
  private async grant(root: string, boardId: string, write = false) {
    await this.load();
    const entry = this.data.projects.find(p => p.root === root && p.boardId === boardId && p.enabled);
    if (!entry || write && !entry.allowWrite) throw new HttpError(403, write ? 'Enable AI editing for this Miro board on the PC.' : 'Enable AI access for this Miro board on the PC.');
    return this.token();
  }
  async items(root: string, boardId: string, cursor?: string) {
    const token = await this.grant(root, boardId),
      params = new URLSearchParams({
        limit: '50'
      });
    if (cursor) params.set('cursor', z.string().max(2048).parse(cursor));
    const reply = await this.api(`/v2/boards/${encodeURIComponent(identifier.parse(boardId))}/items?${params}`, token);
    if (!Array.isArray(reply.data) || reply.data.length > 50) throw new HttpError(502, 'Miro returned an invalid item page.');
    return {
      items: reply.data.map(itemResult),
      ...(typeof reply.cursor === 'string' && reply.cursor.length <= 2048 ? {
        cursor: reply.cursor
      } : {})
    };
  }
  async update(root: string, boardId: string, value: z.infer<typeof miroUpdate>) {
    // Miro has no conditional PATCH revision parameter. This detects stale reads
    // and serializes this host's edits, but cannot lock out external Miro editors.
    const input = miroUpdate.parse(value),
      key = boardId + ':' + input.itemId,
      previous = this.itemWrites.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const generation = this.generation,
        token = await this.grant(root, boardId, true),
        base = `/v2/boards/${encodeURIComponent(identifier.parse(boardId))}`,
        current = await this.api(base + '/items/' + encodeURIComponent(input.itemId), token),
        before = itemResult(current);
      if (before.revision !== input.revision) throw new HttpError(409, 'This Miro item changed. Read it again before updating.');
      if (!Object.hasOwn(routes, before.type)) throw new HttpError(400, 'Only sticky notes, text and cards can be updated.');
      if (generation !== this.generation) throw new HttpError(409, 'Miro settings changed. Read the item again.');
      await this.grant(root, boardId, true);
      const data = before.type === 'card' ? {
        description: plainHtml(input.content),
        ...(input.title !== undefined ? {
          title: input.title
        } : {})
      } : {
        content: plainHtml(input.content)
      };
      return itemResult(await this.api(base + '/' + routes[before.type] + '/' + encodeURIComponent(input.itemId), token, {
        method: 'PATCH',
        body: JSON.stringify({
          data
        })
      }));
    });
    this.itemWrites.set(key, next);
    try {
      return await next;
    } finally {
      if (this.itemWrites.get(key) === next) this.itemWrites.delete(key);
    }
  }
  private async token() {
    await this.load();
    if (!this.data.accessToken) throw new HttpError(401, 'Sign in to Miro on the PC.');
    if (!this.data.expiresAt || this.data.expiresAt > this.now() + 60000) return this.data.accessToken;
    if (!this.data.refreshToken || !this.data.clientId || !this.data.clientSecret) throw new HttpError(401, 'Miro sign-in expired. Sign in again on the PC.');
    return this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = undefined;
    });
  }
  private async refresh() {
    const generation = this.generation,
      tokens = await this.exchange({
        grant_type: 'refresh_token',
        refresh_token: this.data.refreshToken!
      });
    await this.keepTokens(tokens, generation);
    return this.data.accessToken!;
  }
  private async exchange(values: Record<string, string>) {
    await this.load();
    return this.api('/v1/oauth/token', undefined, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        ...values,
        client_id: this.data.clientId!,
        client_secret: this.data.clientSecret!
      }).toString()
    });
  }
  private async keepTokens(value: any, generation: number, clearGrants = false) {
    const token = secret.parse(value.access_token),
      refresh = value.refresh_token ? secret.parse(value.refresh_token) : undefined,
      seconds = value.expires_in === undefined ? undefined : z.number().positive().max(31536000).parse(value.expires_in);
    if (generation !== this.generation) throw new HttpError(409, 'Miro settings changed during sign-in. Start again.');
    await this.change(data => {
      if (generation !== this.generation) throw new HttpError(409, 'Miro sign-in was cancelled.');
      data.accessToken = token;
      data.refreshToken = refresh;
      data.expiresAt = seconds ? this.now() + seconds * 1000 : undefined;
      data.scopes = typeof value.scope === 'string' ? value.scope.split(' ') : undefined;
      if (clearGrants) data.projects = [];
    });
  }
  private async api(route: string, token?: string, init: RequestInit = {}) {
    try {
      const response = await this.fetcher('https://api.miro.com' + route, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(token ? {
            Authorization: 'Bearer ' + token
          } : {}),
          'Content-Type': 'application/json',
          ...init.headers
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) {
        await response.body?.cancel();
        const code = response.status;
        throw new HttpError(code === 401 ? 401 : code === 403 ? 403 : code === 404 ? 404 : code === 429 ? 429 : 502, code === 401 ? 'Miro sign-in expired. Sign in again on the PC.' : code === 403 ? 'Miro denied access. Check board permissions and app scopes.' : code === 404 ? 'The linked Miro board or item is unavailable.' : code === 429 ? 'Miro rate limit reached. Wait before retrying.' : 'Miro request failed. Refresh the board before retrying an edit.');
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error('No response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw Error('Response too large');
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'Miro could not be reached. Refresh the board before retrying an edit.');
    }
  }
}
