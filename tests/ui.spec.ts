import { test, expect } from '@playwright/test';
import { renderPairingPage } from '../server/pairing';

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
  await page.getByLabel('Адрес компьютера').fill('http://127.0.0.1:4319');
  await page.getByLabel('Ключ подключения').fill('test-only-'.repeat(5));
  await page.getByRole('button', { name: 'Подключить компьютер' }).click();
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
  await page.getByLabel('Тема', { exact: true }).selectOption('light');
  await page.getByRole('button', { name: 'Океан', exact: false }).click();
  await page.getByLabel('Размер текста чата', { exact: true }).focus(); await page.keyboard.press('End');
  await page.getByLabel('Масштаб интерфейса', { exact: true }).focus(); await page.keyboard.press('End');
  await page.getByLabel('Компактные отступы').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.settings-panel').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/screenshots/appearance-mobile.png', fullPage: true });
  await page.reload();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByLabel('Тема', { exact: true })).toHaveValue('light');
  await expect(page.getByRole('button', { name: /Океан/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Размер текста чата', { exact: true })).toHaveValue('22');
  await expect(page.getByLabel('Масштаб интерфейса', { exact: true })).toHaveValue('120');
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
  await page.getByLabel('Адрес компьютера').fill('http://127.0.0.1:4319');
  await page.getByLabel('Ключ подключения').fill('test-only-'.repeat(5));
  await page.getByRole('button', { name: 'Подключить компьютер' }).click();
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

test('mobile connection screen and clearly labeled demo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Большие идеи. Маленький экран.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Подключить компьютер' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/connect-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Посмотреть интерфейс без подключения' }).click();
  await page.getByRole('button', { name: /Новый взгляд на главную страницу/ }).click();
  await expect(page.getByText('Демо · пример интерфейса, без подключения к Claude')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить сообщение', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Сообщение Claude')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/screenshots/chat-mobile.png', fullPage: true });
  await page.locator('.mobile-nav').getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByText('Отключить и забыть ключ')).toBeVisible();
});

test('desktop demo has readable chat and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Посмотреть интерфейс без подключения' }).click();
  await expect(page.getByRole('button', { name: /Живой терминал/ })).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/chat-desktop.png', fullPage: true });
});

test('generated PC QR connects phone UI from an image without typing credentials', async ({ page }) => {
  const html = await renderPairingPage([{ url: 'http://127.0.0.1:4319', label: 'Test PC', vpn: false }], 'test-only-'.repeat(5));
  const encoded = html.match(/src="data:image\/png;base64,([^"]+)"/)![1];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button', { name: 'Сканировать QR-код', exact: true })).toBeVisible();
  await page.getByLabel('Изображение QR-кода').setInputFiles({ name: 'connection.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  await expect(page.getByText('Тестовый ПК', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Интеграционный тест/ })).toBeVisible();
});

test('mobile connects, uploads, restores approval after reload and controls a real PTY', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Адрес компьютера').fill('http://127.0.0.1:4319');
  await page.getByLabel('Ключ подключения').fill('test-only-'.repeat(5));
  await page.getByRole('button', { name: 'Подключить компьютер' }).click();
  await page.getByRole('button', { name: /Интеграционный тест/ }).click();
  await expect(page.getByText('Синтетическая история для проверки')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'example.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment') });
  await expect(page.getByText('example.txt', { exact: true })).toBeVisible();
  await page.getByLabel('Сообщение Claude').fill('Проверь вложенный файл');
  await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
  await page.getByRole('button', { name: 'На ПК завершено — продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Разрешить Write?' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Интеграционный тест/ }).click();
  await expect(page.getByRole('heading', { name: 'Разрешить Write?' })).toBeVisible();
  await page.getByRole('button', { name: 'Разрешить', exact: true }).click();
  await expect(page.getByText('Тестовое действие подтверждено.')).toBeVisible();
  await page.getByRole('button', { name: 'Терминал', exact: true }).click();
  await page.getByRole('button', { name: 'Запустить Claude на ПК' }).click();
  await expect(page.locator('.xterm-screen')).toBeVisible();
  await page.getByLabel('Текст для живого терминала').fill('hello-from-android');
  await page.getByRole('button', { name: 'Отправить', exact: true }).click();
  const headers = { Authorization: 'Bearer ' + 'test-only-'.repeat(5) };
  const list = await (await request.get('http://127.0.0.1:4319/api/terminals', { headers })).json();
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:4319/api/terminals/${list[0].id}/output`, { headers })).json()).data).toContain('hello-from-android');
  await expect(page.locator('.xterm-accessibility-tree')).toContainText('hello-from-android');
  await page.screenshot({ path: 'artifacts/screenshots/terminal-mobile-test.png', fullPage: true });
  await page.getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByText(/Процесс завершён · код/)).toBeVisible();
});

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('pocket-code-language-v1', 'ru')); });
