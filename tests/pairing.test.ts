import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePairingCode } from '../src/pairing.js';
import { pairingAddresses, renderPairingPage } from '../server/pairing.js';
const token = 'synthetic-pairing-key-'.repeat(3);
const code = (url = 'http://100.64.10.1:4318') => JSON.stringify({ type: 'pocket-code', version: 1, url, token });

test('pairing only accepts our versioned QR format and safe transport', () => {
  assert.deepEqual(parsePairingCode(code()), { url: 'http://100.64.10.1:4318', token });
  assert.equal(parsePairingCode(code('https://bridge.example.com/')).url, 'https://bridge.example.com');
  assert.throws(() => parsePairingCode('https://example.com'), /не QR-код/);
  assert.deepEqual(parsePairingCode(JSON.stringify({ type: 'pocket-code', version: 2, url: 'http://100.64.10.1:4318', token })), { url: 'http://100.64.10.1:4318', token, pairing: true });
  assert.throws(() => parsePairingCode(JSON.stringify({ type: 'pocket-code', version: 3, url: 'http://127.0.0.1', token })), /Неверный/);
  assert.throws(() => parsePairingCode(code('http://public.example.com')), /HTTPS/);
  assert.throws(() => parsePairingCode(code('javascript:alert(1)')));
  assert.throws(() => parsePairingCode(code().replace(token, 'short')));
  assert.throws(() => parsePairingCode(' '.repeat(5000)));
});

test('QR address selection respects bind address and prefers VPN', () => {
  const address = (ip: string, internal = false) => ({ address: ip, internal, family: 'IPv4', netmask: '', mac: '', cidr: null }) as any;
  const interfaces = { WiFi: [address('192.168.1.5')], Tailscale: [address('100.90.1.2')], AmneziaVPN: [address('100.80.1.2')], WireGuard: [address('10.5.0.2')], 'vEthernet (WSL)': [address('172.17.0.1')], Loopback: [address('127.0.0.1', true)], Public: [address('8.8.8.8')], LinkLocal: [address('169.254.5.1')] };
  const all = pairingAddresses('0.0.0.0', 4318, interfaces);
  assert.equal(all.length, 2); assert.equal(all[0].url, 'http://100.90.1.2:4318');
  assert.deepEqual(pairingAddresses('127.0.0.1', 4318, interfaces), []);
  assert.equal(pairingAddresses('192.168.1.5', 5000, interfaces)[0].url, 'http://192.168.1.5:5000');
});

test('an unrelated VPN in the CGNAT range is not advertised as Tailscale', () => {
  const a: any = { address: '100.80.1.2', internal: false, family: 'IPv4' };
  assert.deepEqual(pairingAddresses('0.0.0.0', 4318, { AmneziaVPN: [a], Unknown: [a] }), []);
});

test('internet pairing explicitly describes HTTPS without a phone VPN', async () => {
  const html = await renderPairingPage([{ url: 'https://example-bridge.trycloudflare.com', label: 'Через интернет · HTTPS', vpn: false, internet: true }], token);
  assert.match(html, /VPN на телефоне не нужен/); assert.match(html, /адрес изменится/);
});

test('pairing page embeds local QR images, escapes labels and has no remote dependencies', async () => {
  const html = await renderPairingPage([{ url: 'http://192.168.1.5:4318', label: '<script>bad()</script>', vpn: false }], token);
  assert.match(html, /data:image\/png;base64,/);
  assert.ok(!html.includes(token)); assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/); assert.match(html, /Content-Security-Policy/);
  const empty = await renderPairingPage([], token); assert.match(empty, /Нет доступного сетевого адреса/);
});

test('PC Jira setup uses a separate local-only key in a fragment, not the phone connection token',async()=>{
 const html=await renderPairingPage([],token,4399,'pc-setup-test-key');
 assert.match(html,/http:\/\/127\.0\.0\.1:4399\/setup\/jira#pc-setup-test-key/);
 assert.equal(html.includes(token),false);
});

import { setLanguage } from '../src/i18n.js';
setLanguage('ru');
