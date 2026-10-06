import {openChatList,newChat} from './chat-navigation';
import { test, expect, type Page, type Route } from '@playwright/test';

const connection = { url: 'http://127.0.0.1:4319', token: 'test-only-'.repeat(5) };
const roots = ['C:\\Workspace\\usage-test'];
const snapshot = (name = 'Codex', remaining = 73) => ({ checkedAt: Date.now(), ordinaryUsageAllowed: null, buckets: [{ id: 'quota', name, windows: [
  { id: 'primary', usedPercent: 100 - remaining, remainingPercent: remaining, windowDurationMins: 300, resetsAt: 1800000000 },
  { id: 'secondary', usedPercent: 61, remainingPercent: 39, windowDurationMins: 10080, resetsAt: null },
] }] });
async function setup(page: Page, usage: (route: Route, provider: string) => Promise<unknown>) {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(connection => { sessionStorage.setItem('connection', JSON.stringify(connection)); localStorage.setItem('pocket-code-workspace', 'codex'); }, connection);
  await page.route('**/api/**', async route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    if (endpoint.endsWith('/usage')) { await usage(route, endpoint.split('/')[1]); return; }
    if (endpoint === '/health') return route.fulfill({ json: { name: 'Usage test PC', roots, protocol: 1, version: '0.11.0' } });
    if (endpoint === '/providers') return route.fulfill({ json: ['claude', 'codex'].map(id => ({ id, name: id, available: true, authenticated: true, models: [] })) });
    if (endpoint === '/projects') return route.fulfill({ json: roots });
    if (endpoint === '/sessions' || endpoint === '/jobs') return route.fulfill({ json: [] });
    if (endpoint === '/updates/latest') return route.fulfill({ json: { enabled: false } });
    if (endpoint === '/jira/status') return route.fulfill({ json: { connected: false, sites: [] } });
    return route.fulfill({ status: 404, json: { error: 'Synthetic endpoint not configured' } });
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Usage limits', exact: true }).click();
}

test('usage shows remaining allowance, actual windows, reset time and English/Russian labels on narrow screens', async ({ page }) => {
  await setup(page, route => route.fulfill({ json: snapshot() }));
  const card = page.getByRole('region', { name: 'Codex usage limits', exact: true });
  await expect(card.getByText('5 hours', { exact: true })).toBeVisible();
  await expect(card.getByText('1 week', { exact: true })).toBeVisible();
  await expect(card.getByText('73% remaining', { exact: true })).toBeVisible();
  await expect(card.getByText('39% remaining', { exact: true })).toBeVisible();
  await expect(card.getByText('Reset time unavailable', { exact: true })).toBeVisible();
  await expect(card.getByRole('progressbar').first()).toHaveAttribute('value', '73');
  await page.evaluate(() => localStorage.setItem('pocket-code-language-v1', 'ru'));
  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Лимиты использования', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Лимиты Codex', exact: true }).getByText('Осталось 73%', { exact: true })).toBeVisible();
  const bounds = await page.locator('.codex-usage').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
});

test('failed refresh preserves dated data and missing values do not become full allowance', async ({ page }) => {
  let response = 'success';
  await setup(page, route => response === 'success' ? route.fulfill({ json: snapshot() }) : response === 'error' ? route.fulfill({ status: 503, json: { error: 'private-server-error' } }) : route.fulfill({ json: { checkedAt: Date.now(), ordinaryUsageAllowed: null, buckets: [{ id: 'missing', name: 'Codex', windows: [{ id: 'primary', usedPercent: null, remainingPercent: null, windowDurationMins: null, resetsAt: null }] }] } }));
  const card = page.locator('.codex-usage');
  await expect(card.getByText('73% remaining')).toBeVisible();
  response = 'error';
  await card.getByRole('button', { name: 'Refresh limits' }).click();
  await expect(card.getByText(/Could not refresh limits/)).toBeVisible();
  await expect(card.getByText('73% remaining')).toBeVisible();
  await expect(card.getByText(/Checked:/)).toBeVisible();
  await expect(page.getByText('private-server-error')).toHaveCount(0);
  response = 'missing';
  await card.getByRole('button', { name: 'Refresh limits' }).click();
  await expect(card.getByText('No data', { exact: true })).toBeVisible();
  await expect(card.getByText('Primary window', { exact: true })).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(0);
});

test('switching workspace rejects late usage replies and loads Claude limits', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await setup(page, async (route, provider) => { if (provider === 'codex') await pending; await route.fulfill({ json: snapshot(provider === 'codex' ? 'Old Codex bucket' : 'Claude', provider === 'codex' ? 2 : 81) }); });
  await expect(page.locator('.codex-usage').getByText('Loading limits…')).toBeVisible();
  await page.locator('.workspace-picker-settings select').selectOption('claude');
  await page.locator('.mobile-nav').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Usage limits', exact: true }).click();
  const card = page.getByRole('region', { name: 'Claude usage limits', exact: true });
  await expect(card.getByText('81% remaining')).toBeVisible();
  release();
  await expect(card.getByText('Old Codex bucket')).toHaveCount(0);
  await expect(card.getByText('81% remaining')).toBeVisible();
});

test('usage is requested only while settings are mounted and empty data stays unavailable', async ({ page }) => {
  let reads = 0;
  await page.clock.install();
  await setup(page, route => { reads++; return route.fulfill({ json: { checkedAt: Date.now(), ordinaryUsageAllowed: null, buckets: [] } }); });
  await expect(page.locator('.codex-usage').getByText('Codex did not report usage limits for this account.')).toBeVisible();
  const mountedReads = reads;
  await page.clock.fastForward(60_000);
  await expect.poll(() => reads).toBeGreaterThan(mountedReads);
  await page.locator('.mobile-nav').getByRole('button', { name: 'Chats', exact: true }).click();
  const previous = reads;
  await page.clock.fastForward(120_000);
  expect(reads).toBe(previous);
  await expect(page.locator('.codex-usage')).toHaveCount(0);
});
