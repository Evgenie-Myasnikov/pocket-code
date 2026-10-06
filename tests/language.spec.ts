import {connectByQr,openConnectionSettings} from './qr-connect';
import {openChatList} from './chat-navigation';
import { test, expect } from '@playwright/test';

test('English default and persistent Russian selection on the connection screen', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:5173');
  await openConnectionSettings(page);
  await expect(page.getByRole('button', { name: 'Scan QR code', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({path: 'artifacts/screenshots/connect-english.png', fullPage: true});
  await page.getByRole('button',{name:'All settings',exact:true}).click();await page.getByRole('button',{name:'Appearance & language',exact:true}).click();await page.getByLabel('Language / Язык').selectOption('ru');
  await page.getByRole('button',{name:'Все настройки',exact:true}).click();await page.locator('[data-settings-category="connection"]').click();
  await expect(page.getByRole('button', { name: 'Сканировать QR-код', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await openChatList(page);
  await page.getByRole('button', {name:/Интеграционный тест/}).click();
  await page.getByLabel('Сообщение Claude').fill('My draft — мой текст');
  await page.locator('.mobile-nav').getByRole('button', {name:'Настройки', exact:true}).click();await page.getByRole('button',{name:'Оформление и язык',exact:true}).click();
  await page.getByLabel('Language / Язык').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('.language-picker')).toContainText('Interface language');
  await page.screenshot({path:'artifacts/screenshots/settings-english.png',fullPage:true});
  await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
  await expect(page.getByLabel('Message Claude')).toHaveValue('My draft — мой текст');
});
