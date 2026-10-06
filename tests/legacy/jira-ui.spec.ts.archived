import {connectByQr} from './qr-connect';
import { test, expect } from '@playwright/test';

test('Jira Connect lives in Settings; Jobs selects all pages and sends a batch with the chosen folder', async ({ page }) => {
  let connected = false, sent: any = null, queue: any = { paused: true, items: [] };
  const issues = [1, 2, 3].map(n => ({ key: `TEST-${n}`, summary: `Task ${n}`, description: `Requirement ${n}`, status: n === 3 ? 'Done' : 'Open', priority: 'Medium', url: `https://example.atlassian.net/browse/TEST-${n}`, updated: '' }));
  await page.route('**/api/jira/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/status')) return route.fulfill({ json: { connected, sites: connected ? [{ id: 'test-site', name: 'Example Jira', url: 'https://example.atlassian.net' }] : [] } });
    if (url.pathname.endsWith('/issues')) return route.fulfill({ json: { issues: url.searchParams.has('cursor') ? [issues[2]] : issues.slice(0, 2), next: url.searchParams.has('cursor') ? null : 'page2' } });
    if (url.pathname.endsWith('/queue/control')) { queue.paused = route.request().postDataJSON().action === 'pause'; return route.fulfill({ json: queue }); }
    if (url.pathname.endsWith('/queue')) {
      if (route.request().method() === 'POST') { sent = route.request().postDataJSON(); queue = { paused: false, items: sent.keys.map((key: string) => ({ id: key, key, status: 'queued' })) }; }
      return route.fulfill({ json: queue });
    }
    return route.fulfill({ status: 400, json: { error: 'Unexpected test request' } });
  });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await page.locator('.mobile-nav').getByRole('button', { name: 'Задачи', exact: true }).click();
  await page.getByRole('button', { name: 'Открыть настройки Jira' }).click();
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  await expect(page.locator('.mobile-nav').getByText('Jira', { exact: true })).toHaveCount(0);
  connected = true;
  await page.locator('.mobile-nav').getByRole('button', { name: 'Задачи', exact: true }).click();
  await expect(page.getByText('Task 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать задачи', exact: true }).click();
  await page.getByLabel('Выбрать TEST-1', { exact: true }).check();
  await expect(page.getByText('Выбрано: 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выбрать все найденные' }).click();
  await expect(page.getByLabel('Выбрать TEST-3', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const folder = await page.getByLabel('Папка проекта для Claude', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Запустить выбранные (3)' }).click();
  await expect.poll(() => sent?.keys.length).toBe(3); expect(sent.cwd).toBe(folder); expect(sent.batchId).toBeTruthy();
  await expect(page.locator('.jira-queue > summary')).toBeVisible();
  await page.getByRole('button', { name: 'Пауза очереди' }).click();
  await expect(page.locator('.jira-queue > summary')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.jobs-panel').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/screenshots/jobs-mobile.png', fullPage: true });
});

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('pocket-code-language-v1', 'ru')); });
