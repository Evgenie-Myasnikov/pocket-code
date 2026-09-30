import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkFailure } from '../src/connection-errors.js';
import { request } from '../src/api.js';
import { tunnelAddress } from '../server/tunnel.js';

test('VPN and LAN errors explain remote access without promising an unimplemented retry', () => {
  const vpn = networkFailure('http://100.80.1.2:4318', new Error('timeout'));
  assert.match(vpn, /не обязательно принадлежит Tailscale/);
  assert.match(vpn, /Internet.cmd/); assert.doesNotMatch(vpn, /автоматически/);
  assert.match(networkFailure('http://192.168.1.20:4318', null), /только в домашней сети/);
  assert.match(networkFailure('https://example.com', new Error('CertPath invalid')), /сертификат/);
});

test('Cloudflare URL extraction rejects lookalike domains', () => {
  assert.equal(tunnelAddress('INF | https://new-example.trycloudflare.com |'), 'https://new-example.trycloudflare.com');
  assert.equal(tunnelAddress('https://new-example.trycloudflare.com.evil.test'), null);
  assert.equal(tunnelAddress('https://evil.test/'), null);
});

test('HTML errors from a tunnel retain their HTTP status', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
    await assert.rejects(request({ url: 'https://example.com', token: 'synthetic-only' }, '/health'), /HTTP 502/);
    globalThis.fetch = async () => new Response('<html>Other service</html>', { status: 200 });
    await assert.rejects(request({ url: 'https://example.com', token: 'synthetic-only' }, '/health'), /другой сервис/);
  } finally { globalThis.fetch = original; }
});

import { setLanguage } from '../src/i18n.js';
setLanguage('ru');
