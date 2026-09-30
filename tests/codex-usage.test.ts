import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCodexUsage } from '../server/codex-usage.js';

test('Codex limits prefer all named buckets and omit account/private fields', () => {
  const result = normalizeCodexUsage({
    accountId: 'private-account', accessToken: 'private-token', ordinaryUsageAllowed: false,
    rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex: { limitName: 'Codex', primary: { usedPercent: 23, windowDurationMins: 300, resetsAt: 1800000000 }, secondary: { usedPercent: 75, windowDurationMins: 10080, resetsAt: 1800500000 }, credits: { balance: 'private-balance' } },
      model: { limitName: 'Model quota', primary: { usedPercent: 40, windowDurationMins: 60, resetsAt: null } },
    },
  }, 1234);
  assert.equal(result.checkedAt, 1234); assert.equal(result.ordinaryUsageAllowed, false);
  assert.deepEqual(result.buckets.map(bucket => bucket.name), ['Codex', 'Model quota']);
  assert.deepEqual(result.buckets[0].windows.map(window => window.remainingPercent), [77, 25]);
  assert.equal(result.buckets[0].windows[0].windowDurationMins, 300);
  assert.equal(result.buckets[0].windows[1].resetsAt, 1800500000);
  assert.equal(result.buckets[1].windows[1].remainingPercent, null);
  assert.ok(!JSON.stringify(result).includes('private-'));
});

test('Codex limits retain unavailable data instead of implying unused capacity', () => {
  const result = normalizeCodexUsage({ rateLimits: { primary: { windowDurationMins: 300, resetsAt: null }, secondary: { usedPercent: null, windowDurationMins: null } } });
  assert.deepEqual(result.buckets[0].windows.map(window => window.remainingPercent), [null, null]);
  assert.equal(result.buckets[0].windows[0].resetsAt, null);
  assert.equal(result.ordinaryUsageAllowed, null);
  for (const value of [null, {}, { rateLimits: {} }, { rateLimitsByLimitId: [] }]) assert.deepEqual(normalizeCodexUsage(value).buckets, []);
});

test('Codex limits use legacy view when multi-bucket data is unavailable', () => {
  for (const rateLimitsByLimitId of [undefined, null, {}, { bad: null }]) {
    const result = normalizeCodexUsage({ rateLimitsByLimitId, rateLimits: { primary: { usedPercent: 0 } } });
    assert.equal(result.buckets[0].windows[0].remainingPercent, 100);
    assert.equal(result.buckets[0].windows[0].windowDurationMins, null);
    assert.equal(result.buckets[0].windows[1].remainingPercent, null);
  }
});

test('Codex limits clamp percentages and reject malformed numbers and labels', () => {
  const result = normalizeCodexUsage({ ordinaryUsageAllowed: 'true', rateLimitsByLimitId: {
    'private@example.com': { limitName: 'private@example.com', primary: { usedPercent: -10, resetsAt: -1, windowDurationMins: 0 }, secondary: { usedPercent: 125, resetsAt: Infinity, windowDurationMins: '300' } },
    good: { primary: { usedPercent: NaN }, secondary: { usedPercent: '0' } },
  } });
  assert.equal(result.buckets[0].name, 'Codex');
  assert.deepEqual(result.buckets[0].windows.map(window => window.remainingPercent), [100, 0]);
  assert.deepEqual(result.buckets[0].windows.map(window => window.resetsAt), [null, null]);
  assert.deepEqual(result.buckets[0].windows.map(window => window.windowDurationMins), [null, null]);
  assert.deepEqual(result.buckets[1].windows.map(window => window.remainingPercent), [null, null]);
  assert.equal(result.ordinaryUsageAllowed, null);
});
