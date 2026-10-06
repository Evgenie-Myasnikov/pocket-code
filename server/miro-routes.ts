import type { Express, Response } from 'express';
import { z } from 'zod';
import { MiroIntegration, miroUpdate } from './miro-integration.js';
import type { createWorkspaceAccess } from './boards.js';
import { allowedPath, HttpError } from './security.js';
import { miroLink } from '../src/miro-link.js';
export function mountMiro(app: Express, {
  integration,
  roots,
  access
}: {
  integration: MiroIntegration;
  roots: string[];
  access: Awaited<ReturnType<typeof createWorkspaceAccess>>;
}) {
  const host = (res: Response) => {
    if (access.current() || !res.locals.deviceAdmin) throw new HttpError(403, 'Manage Miro AI access on the host PC.');
  };
  async function linked(value: unknown) {
    const root = await allowedPath(roots, z.string().min(1).parse(value), true),
      ctx = access.current();
    if (ctx && !ctx.ws.roots.includes(root)) throw new HttpError(403, 'Project access denied.');
    const entry = access.store.snapshot().miroBoards.find(b => b.root === root);
    if (!entry) throw new HttpError(404, 'Connect a Miro board to this project first.');
    return {
      root,
      boardId: miroLink(entry.url).boardId
    };
  }
  app.get('/api/miro/status', async (req, res) => {
    let scope: Awaited<ReturnType<typeof linked>> | undefined;
    if (req.query.root) {
      try {
        scope = await linked(req.query.root);
      } catch (e) {
        if (!(e instanceof HttpError) || e.status !== 404) throw e;
      }
    }
    res.json({
      ...(await integration.status(scope?.root, scope?.boardId)),
      canManage: !access.current() && !!res.locals.deviceAdmin,
      linked: !!scope,
      redirectUri: `http://127.0.0.1:${req.socket.localPort}/miro/oauth/callback`
    });
  });
  app.post('/api/miro/config', async (req, res) => {
    host(res);
    const body = z.object({
      clientId: z.string(),
      clientSecret: z.string()
    }).strict().parse(req.body);
    await integration.configure(body.clientId, body.clientSecret);
    res.json({
      ok: true
    });
  });
  app.post('/api/miro/oauth/start', async (req, res) => {
    host(res);
    res.json(await integration.start(`http://127.0.0.1:${req.socket.localPort}/miro/oauth/callback`));
  });
  app.get('/miro/oauth/callback', async (req, res) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'none'; frame-ancestors 'none'"
    });
    try {
      if (!['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(req.socket.remoteAddress || '') || req.hostname !== '127.0.0.1' || req.headers.forwarded || req.headers['x-forwarded-for'] || req.headers['cf-connecting-ip']) throw new HttpError(403, 'Open Miro sign-in on the host PC.');
      await integration.callback(z.string().max(100).parse(req.query.state), z.string().max(8192).optional().parse(req.query.code), z.string().max(200).optional().parse(req.query.error));
      res.type('text').send('Miro is connected. Return to Pocket Code and enable access for the selected project.');
    } catch {
      res.status(400).type('text').send('Miro sign-in did not complete. Return to Pocket Code and start sign-in again.');
    }
  });
  app.post('/api/miro/token', async (req, res) => {
    host(res);
    const body = z.object({
        root: z.string(),
        token: z.string()
      }).strict().parse(req.body),
      scope = await linked(body.root);
    await integration.setToken(body.token, scope.boardId);
    res.json({
      ok: true
    });
  });
  app.post('/api/miro/access', async (req, res) => {
    host(res);
    const body = z.object({
        root: z.string(),
        enabled: z.boolean(),
        allowWrite: z.boolean().default(false)
      }).strict().parse(req.body),
      scope = await linked(body.root);
    await integration.access(scope.root, scope.boardId, body.enabled, body.allowWrite);
    res.json(await integration.status(scope.root, scope.boardId));
  });
  app.post('/api/miro/disconnect', async (_req, res) => {
    host(res);
    await integration.disconnect();
    res.json({
      ok: true
    });
  });
  app.get('/api/miro/items', async (req, res) => {
    host(res);
    const scope = await linked(req.query.root);
    res.json(await integration.items(scope.root, scope.boardId, z.string().max(2048).optional().parse(req.query.cursor)));
  });
  app.post('/api/miro/items/update', async (req, res) => {
    host(res);
    const body = miroUpdate.parse(req.body),
      scope = await linked(body.root);
    res.json(await integration.update(scope.root, scope.boardId, body));
  });
}
