import {connectByQr,openConnectionSettings} from './qr-connect';
import {openChatList} from './chat-navigation';
import { test, expect } from '@playwright/test';

test('English default and persistent Russian selection on the connection screen', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('http://127.0.0.1:5173');
  // Before pairing the first screen is the onboarding checklist with its own EN/RU switch.
  await expect(page.locator('.connect-steps li')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Choose a QR image', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({path: 'artifacts/screenshots/connect-english.png', fullPage: true});
  await page.getByRole('group',{name:'Interface language'}).getByRole('button',{name:'RU',exact:true}).click();
  await expect(page.getByRole('button', { name: 'Выбрать изображение с QR', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await openChatList(page);
  await page.getByRole('button', {name:/Интеграционный тест/}).click();
  await page.getByLabel('Сообщение Claude').fill('My draft — мой текст');
  await page.getByRole('button',{name:/^(Navigation menu|Меню разделов)$/}).filter({visible:true}).click();await page.locator('.mobile-nav').getByRole('button', {name:'Настройки', exact:true}).click();await page.getByRole('button',{name:'Оформление и язык',exact:true}).click();
  await page.getByLabel('Language / Язык').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('.language-picker')).toContainText('Interface language');
  await page.screenshot({path:'artifacts/screenshots/settings-english.png',fullPage:true});
  await page.getByRole('button',{name:/^(Navigation menu|Меню разделов)$/}).filter({visible:true}).click();await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
  await expect(page.getByLabel('Message Claude')).toHaveValue('My draft — мой текст');
});

test('a Russian device starts in Russian until a language is chosen', async ({ browser }) => {
  const context=await browser.newContext({locale:'ru-RU',viewport:{width:390,height:844}}),page=await context.newPage();
  try{await page.goto('http://127.0.0.1:5173');await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.getByText('Отсканируйте QR-код с экрана ПК.',{exact:true})).toBeVisible();
  await page.getByRole('group',{name:'Язык интерфейса'}).getByRole('button',{name:'EN',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');}finally{await context.close();}
});
