import { test, expect } from '@playwright/test';

test('English default and persistent Russian selection on the connection screen', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button', { name: 'Scan QR code', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({path: 'artifacts/screenshots/connect-english.png', fullPage: true});
  await page.getByLabel('Language / Язык').selectOption('ru');
  await expect(page.getByRole('button', { name: 'Сканировать QR-код', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Language / Язык')).toHaveValue('ru');
  await page.getByLabel('Адрес компьютера').fill('http://127.0.0.1:4319');
  await page.getByLabel('Ключ подключения').fill('test-only-'.repeat(5));
  await page.getByRole('button', {name:'Подключить компьютер'}).click();
  await page.getByRole('button', {name:/Интеграционный тест/}).click();
  await page.getByLabel('Сообщение Claude').fill('My draft — мой текст');
  await page.locator('.mobile-nav').getByRole('button', {name:'Настройки', exact:true}).click();
  await page.getByLabel('Language / Язык').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('.language-picker')).toContainText('Interface language');
  await page.screenshot({path:'artifacts/screenshots/settings-english.png',fullPage:true});
  await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
  await expect(page.getByLabel('Message Claude')).toHaveValue('My draft — мой текст');
});
