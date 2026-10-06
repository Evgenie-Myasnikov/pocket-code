// Synthetic integration server. Never loads a user's Claude history or calls a model.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as pty from 'node-pty';
import { createApp } from '../server/app.js';
import { Jobs } from '../server/jobs.js';
import { Terminals } from '../server/terminals.js';
const root = path.resolve('.local/integration-project'); await mkdir(root, { recursive: true });
const sessionId = 'e91de51c-70e1-4373-a7b9-21a294c6ab00';
const run: any = ({ options }: any) => (async function* () {
  yield { type: 'system', session_id: sessionId };
  const decision = await options.canUseTool('Write', { file_path: 'example.txt', content: 'Integration test' }, { signal: options.abortController.signal });
  yield { type: 'assistant', uuid: 'fake-assistant', message: { content: [{ type: 'text', text: decision.behavior === 'allow' ? 'Тестовое действие подтверждено.' : 'Действие отклонено.' }] } };
  yield { type: 'result', is_error: false, total_cost_usd: 0 };
})();
const sdk: any = {
  listSessions: async () => [{ sessionId, summary: 'Интеграционный тест', cwd: root, lastModified: Date.now() }],
  getSessionMessages: async () => [{ type: 'user', uuid: 'first', message: { content: 'Синтетическая история для проверки' } }],
};
const spawn: typeof pty.spawn = (_exe, _args, options) => pty.spawn(process.execPath, ['-e', 'process.stdout.write("POCKET INTEGRATION TERMINAL\\r\\n");process.stdin.setEncoding("utf8");process.stdin.on("data",s=>process.stdout.write("RECEIVED:"+s));'], options);
const { app, jobs, terminals, closeTaskServices } = await createApp({ desktopSessionIndexes: [], roots: [root], token: 'test-only-'.repeat(5), hostName: 'Тестовый ПК', uploads: path.resolve('.local/integration-uploads') }, new Jobs(run), sdk, new Terminals(spawn));
app.get('/ready', (_req, res) => res.send('ready'));
const server = app.listen(4319, '127.0.0.1');
function close() { jobs.close(); terminals.close(); server.close(); void closeTaskServices().finally(()=>process.exit()); setTimeout(() => process.exit(), 1000).unref(); }
process.on('SIGTERM', close); process.on('SIGINT', close);
