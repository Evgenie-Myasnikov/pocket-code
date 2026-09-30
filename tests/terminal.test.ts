import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as pty from 'node-pty';
import { Terminals } from '../server/terminals.js';

const until = async (condition: () => boolean, timeout = 10000) => {
  const start = Date.now();
  while (!condition()) { if (Date.now() - start > timeout) throw new Error('Terminal timed out'); await new Promise(r => setTimeout(r, 50)); }
};
test('real PTY streams, reconnects, deduplicates input and terminates', async () => {
  const spawn: typeof pty.spawn = (_exe, _args, options) => pty.spawn(process.execPath, ['-e', 'process.stdout.write("TERMINAL_READY\\r\\n");process.stdin.setEncoding("utf8");process.stdin.on("data",s=>process.stdout.write("RECEIVED:"+s));'], options);
  const terminals = new Terminals(spawn), id = randomUUID();
  try {
    const first = terminals.start({ id, cwd: process.cwd() });
    terminals.start({ id, cwd: process.cwd() }); assert.equal(terminals.list().length, 1);
    assert.throws(() => terminals.start({ id: randomUUID(), cwd: process.cwd() }), /уже есть/);
    await until(() => terminals.output(id, -1).data.includes('TERMINAL_READY'));
    const snapshot = terminals.output(id, -1); assert.equal(snapshot.reset, true); assert.equal(first.cols, 80);
    assert.equal(terminals.output(id, snapshot.cursor).data, '');
    const requestId = randomUUID(); terminals.input(id, requestId, 'hello\r'); terminals.input(id, requestId, 'hello\r');
    await until(() => terminals.output(id, snapshot.cursor).data.includes('RECEIVED:'));
    assert.equal(terminals.output(id, -1).data.match(/RECEIVED:/g)?.length, 1);
    assert.equal(terminals.output(id, snapshot.cursor).reset, false);
    assert.equal(terminals.output(id, 999999).reset, true);
    terminals.stop(id); await until(() => terminals.get(id).status === 'exited');
    assert.throws(() => terminals.input(id, randomUUID(), 'hello'), /завершён/);
  } finally { terminals.close(); }
});
