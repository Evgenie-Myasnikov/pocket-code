import {connectByQr,openConnectionSettings} from './qr-connect';
import {openChatList} from './chat-navigation';
import {randomUUID} from 'node:crypto';

import { test, expect } from '@playwright/test';

import { renderPairingPage } from '../server/pairing';

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','ru'));});

test('jump to actual beginning and persist appearance on a narrow phone', async ({ page }) => {
  const id = 'd916abbe-dab3-4e21-a92e-eaa7741610dc';
  const messages = Array.from({ length: 150 }, (_, i) => ({ id: `row-${i}`, role: 'assistant', blocks: [{ type: 'text', text: `History message ${i}. Example conversation with several lines of text.` }] }));
  await page.route('**/api/sessions?*', route => route.fulfill({ json: [{ sessionId: id, summary: 'Long history', cwd: 'C:\\Test', lastModified: 1 }] }));
  await page.route(`**/api/sessions/${id}/messages?*`, route => {
    const url = new URL(route.request().url()), size = Number(url.searchParams.get('window') || 100), head = url.searchParams.get('from') === 'start';
    return route.fulfill({ json: { messages: head ? messages.slice(0, size) : messages.slice(-size), previous: head ? null : Math.max(0, messages.length - size) || null, next: head && size < messages.length ? size : null } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button', { name: /Long history/ }).click();
  await expect(page.getByText('History message 149.', { exact: false })).toBeVisible();
  await page.getByLabel('Сообщение Claude').fill('Keep this draft');
  await page.locator('.conversation').evaluate(el => { el.scrollTop -= 350; el.dispatchEvent(new Event('scroll')); });
  await page.getByRole('button', { name: 'В начало чата', exact: true }).click();
  await expect(page.getByText('History message 0.', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Сообщение Claude')).toHaveValue('Keep this draft');
  await page.waitForTimeout(3300);
  await expect(page.getByText('History message 0.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /К новым сообщениям/ }).click();
  await expect(page.getByText('History message 149.', { exact: false })).toBeVisible();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button',{name:'Оформление и язык',exact:true}).click();await page.getByLabel('Тема', { exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Мята', exact: false }).click();
  await page.getByLabel('Размер текста чата', { exact: true }).focus(); await page.keyboard.press('End');
  await page.getByLabel('Масштаб интерфейса', { exact: true }).focus(); await page.keyboard.press('End');
  await page.getByLabel('Компактные отступы').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.settings-content').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/screenshots/appearance-mobile.png', fullPage: true });
  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button',{name:'Оформление и язык',exact:true}).click();await expect(page.getByLabel('Тема', { exact: true })).toHaveValue('light');
  await expect(page.getByRole('button', { name: /Мята/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Размер текста чата', { exact: true })).toHaveValue('22');
  await expect(page.getByLabel('Масштаб интерфейса', { exact: true })).toHaveValue('130');
  await expect(page.getByLabel('Компактные отступы')).toBeChecked();
  await page.getByRole('button', { name: 'Сбросить оформление' }).click();
  await expect(page.getByLabel('Тема', { exact: true })).toHaveValue('dark');
  await expect(page.getByLabel('Размер текста чата', { exact: true })).toHaveValue('14');
});

test('open history syncs Desktop updates without erasing the draft and marks outside projects read-only', async ({ page }) => {
  let revision = 0;
  const id = 'f12dd715-d9b1-460a-8087-3c3052faed24';
  await page.route('**/api/sessions?*', route => route.fulfill({ json: [{ sessionId: id, summary: 'Desktop sync test', cwd: 'C:\\DesktopProject', source: 'desktop', readOnly: false, lastModified: 1 }] }));
  await page.route(`**/api/sessions/${id}/messages?*`, route => route.fulfill({ json: { messages: [{ id: 'initial', role: 'user', blocks: [{ type: 'text', text: 'Original history' }] }, ...(revision ? [{ id: 'new', role: 'assistant', blocks: [{ type: 'text', text: 'Added on desktop' }] }] : [])], previous: null } }));
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button', { name: /Desktop sync test/ }).click();
  await expect(page.getByText('Original history')).toBeVisible();
  await page.getByLabel('Сообщение Claude').fill('My unfinished draft');
  revision = 1;
  await expect(page.getByText('Added on desktop')).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel('Сообщение Claude')).toHaveValue('My unfinished draft');
  await expect(page.getByText('Added on desktop')).toHaveCount(1);
  await page.route('**/api/sessions?*', route => route.fulfill({ json: [{ sessionId: id, summary: 'Desktop sync test', cwd: 'C:\\DesktopProject', source: 'desktop', readOnly: true, lastModified: 2 }] }));
  await expect(page.getByText(/Только просмотр. Чтобы продолжить чат/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Отправить сообщение', exact: true })).toBeDisabled();
});

test('generated PC QR connects phone UI from an image without typing credentials', async ({ page }) => {
  const html = await renderPairingPage([{ url: 'http://127.0.0.1:4319', label: 'Test PC', vpn: false }], 'test-only-'.repeat(5));
  const encoded = html.match(/src="data:image\/png;base64,([^"]+)"/)![1];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await openConnectionSettings(page);await expect(page.getByRole('button', { name: 'Сканировать QR-код', exact: true })).toBeVisible();
  await page.getByLabel('Изображение QR-кода').setInputFiles({ name: 'connection.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await openChatList(page);await expect(page.getByRole('button', { name: /Интеграционный тест/ })).toBeVisible();
  await page.locator('.mobile-nav').getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Подключение к ПК',exact:true}).click();await expect(page.getByRole('button',{name:'Повторить подключение',exact:true})).toBeVisible();expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('connection')||'{}').url)).toBe('http://127.0.0.1:4319');
});

test('mobile connects, uploads, restores approval after reload and controls a real PTY', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button', { name: /Интеграционный тест/ }).click();
  await expect(page.getByText('Синтетическая история для проверки')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'example.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment') });
  await expect(page.getByText('example.txt', { exact: true })).toBeVisible();
  await page.getByLabel('Сообщение Claude').fill('Проверь вложенный файл');
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
  await page.getByRole('button', { name: 'На ПК завершено — продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Разрешить Write?' })).toBeVisible();
  await page.reload();
  await openChatList(page);
  await page.getByRole('button', { name: /Интеграционный тест/ }).click();
  await expect(page.getByRole('heading', { name: 'Разрешить Write?' })).toBeVisible();
  await page.getByRole('button', { name: 'Разрешить', exact: true }).click();
  await expect(page.getByText('Тестовое действие подтверждено.')).toBeVisible();
  // The terminal screen is retired; retain its real PTY lifecycle check through the supported host API.
  await expect(page.getByRole('button',{name:'Терминал',exact:true})).toHaveCount(0);
  const headers={Authorization:'Bearer '+'test-only-'.repeat(5)},base='http://127.0.0.1:4319/api';
  const health=await(await request.get(base+'/health',{headers})).json(),terminalId=randomUUID();
  const created=await request.post(base+'/terminals',{headers,data:{id:terminalId,cwd:health.roots[0]}});expect(created.ok()).toBe(true);
  try{const input=await request.post(base+'/terminals/'+terminalId+'/input',{headers,data:{id:randomUUID(),data:'hello-from-android\r'}});expect(input.ok()).toBe(true);
   await expect.poll(async()=> (await(await request.get(base+'/terminals/'+terminalId+'/output',{headers})).json()).data).toContain('hello-from-android');
  }finally{await request.post(base+'/terminals/'+terminalId+'/stop',{headers});}
  await expect.poll(async()=> (await(await request.get(base+'/terminals/'+terminalId+'/output',{headers})).json()).status).toBe('exited');
});
