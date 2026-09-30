import test from 'node:test';
import assert from 'node:assert/strict';
import type { query } from '@anthropic-ai/claude-agent-sdk';
import { ClaudeUsageReader, normalizeClaudeUsage } from '../server/claude-usage.js';

const usage = { rate_limits_available: true, rate_limits: {
  five_hour: { utilization: 20, resets_at: '2026-10-01T02:00:00Z' },
  seven_day: { utilization: 61, resets_at: '2026-10-07T12:00:00Z' },
} };

test('Claude maps five-hour, weekly and model quotas without session or account data', () => {
  const result = normalizeClaudeUsage({ ...usage, accountId: 'private-user', session: { secret: 'private-session' }, behaviors: { secret: 'private-transcripts' }, rate_limits: {
    ...usage.rate_limits, seven_day_opus: { utilization: 50, resets_at: null },
    seven_day_oauth_apps: { utilization: null, resets_at: 'invalid-date' },
    model_scoped: [{ display_name: 'Fable', utilization: 25, resets_at: null }, { display_name: 'person@example.com', utilization: 10, resets_at: null }],
    extra_usage: { used_credits: 'private-credits' },
  } }, 1234);
  assert.equal(result.checkedAt, 1234);
  assert.deepEqual(result.buckets[0].windows.map(window => window.remainingPercent), [80, 39]);
  assert.deepEqual(result.buckets[0].windows.map(window => window.windowDurationMins), [300, 10080]);
  assert.equal(result.buckets[0].windows[0].resetsAt, Date.parse('2026-10-01T02:00:00Z') / 1000);
  assert.equal(result.buckets.find(bucket => bucket.name === 'Opus')?.windows[0].remainingPercent, 50);
  assert.equal(result.buckets.find(bucket => bucket.name === 'OAuth-приложения')?.windows[0].remainingPercent, null);
  assert.equal(result.buckets.find(bucket => bucket.name === 'OAuth-приложения')?.windows[0].resetsAt, null);
  assert.equal(result.buckets.find(bucket => bucket.name === 'Fable')?.windows[0].remainingPercent, 75);
  assert.ok(!JSON.stringify(result).includes('private-'));
  assert.ok(!JSON.stringify(result).includes('person@example.com'));
});

test('Claude unavailable or missing limits never imply zero usage', () => {
  for (const value of [null, {}, { rate_limits_available: false, rate_limits: usage.rate_limits }, { rate_limits_available: true, rate_limits: null }]) assert.deepEqual(normalizeClaudeUsage(value).buckets, []);
  const result = normalizeClaudeUsage({ rate_limits_available: true, rate_limits: { five_hour: { utilization: null } } });
  assert.deepEqual(result.buckets[0].windows.map(window => window.remainingPercent), [null, null]);
});

test('Claude usage is control-only, skips transcript scans, shares reads and cleans up', async () => {
  let calls = 0, closed = 0, options: any, promptStep: Promise<IteratorResult<unknown>> | undefined;
  let finish!: (value: unknown) => void;
  const answer = new Promise(resolve => { finish = resolve; });
  const run = ((input: Parameters<typeof query>[0]) => {
    calls++; options = input.options;
    assert.notEqual(typeof input.prompt, 'string');
    promptStep = (input.prompt as AsyncIterable<unknown>)[Symbol.asyncIterator]().next();
    return { usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: (args: unknown) => { assert.deepEqual(args, { skipBehaviors: true }); return answer; }, close: () => { closed++; } };
  }) as unknown as typeof query;
  const reader = new ClaudeUsageReader(run);
  const first = reader.read(), second = reader.read();
  assert.equal(first, second); assert.equal(calls, 1);
  assert.equal(options.persistSession, false); assert.deepEqual(options.tools, []); assert.deepEqual(options.mcpServers, {});
  assert.equal(options.strictMcpConfig, true); assert.deepEqual(options.settingSources, []); assert.equal(options.permissionMode, 'plan');
  finish(usage);
  assert.equal((await first).buckets[0].windows[0].remainingPercent, 80);
  assert.deepEqual(await promptStep, { done: true, value: undefined });
  assert.equal(options.abortController.signal.aborted, true); assert.equal(closed, 1);
  await reader.read(); assert.equal(calls, 1);
});

test('Claude usage timeout aborts the control process and permits retry', async () => {
  let calls = 0, closed = 0;
  const signals: AbortSignal[] = [];
  const run = ((input: Parameters<typeof query>[0]) => {
    calls++; signals.push(input.options!.abortController!.signal);
    return { usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: () => calls === 1 ? new Promise(() => {}) : Promise.resolve(usage), close: () => { closed++; } };
  }) as unknown as typeof query;
  const reader = new ClaudeUsageReader(run, 10);
  await assert.rejects(reader.read(), (error: any) => error.status === 503);
  assert.equal(closed, 1); assert.equal(signals[0].aborted, true);
  assert.equal((await reader.read()).buckets.length, 1); assert.equal(closed, 2);
});

test('Claude usage unsupported APIs return a safe failure and close the process', async () => {
  let closed = false;
  const run = (() => ({ close: () => { closed = true; } })) as unknown as typeof query;
  await assert.rejects(new ClaudeUsageReader(run).read(), (error: any) => error.status === 503 && !error.message.includes('Usage API'));
  assert.equal(closed, true);
});
