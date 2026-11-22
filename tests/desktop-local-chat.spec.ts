import {expect, test} from '@playwright/test';
import {desktop} from './desktop-fixture';

const localOnly = {phoneAccess: false, activePhoneAccess: false};

test('a local-only desktop resumes history and sends a new chat without pairing', async ({page}) => {
  await desktop(page, localOnly);
  await page.getByRole('button', {name: 'Resume latest chat'}).click();
  await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
  await page.getByRole('button', {name: 'New chat', exact: true}).click();
  await page.getByRole('textbox', {name: 'Message Claude', exact: true}).fill('Synthetic local chat');
  await page.getByRole('button', {name: 'Send message', exact: true}).click();
  await expect.poll(() => page.evaluate(() => (window as any).desktopCalls
    .filter((call: any) => call.action === 'write' && call.endpoint === '/jobs')
    .map((call: any) => call.data.text))).toEqual(['Synthetic local chat']);
  await expect(page.getByText('Working on your request', {exact: true})).toBeVisible();
  const paired = await page.evaluate(() => (window as any).desktopCalls.some((call: any) =>
    call.action.startsWith('pairing') || call.endpoint === '/devices/pair'));
  expect(paired).toBe(false);
});

test('a desktop with a stopped local host can start it directly from chats', async ({page}) => {
  await desktop(page, {...localOnly, online: false, statusCode: 'disconnected'});
  await page.getByRole('button', {name: 'Start local server', exact: true}).click();
  await page.getByRole('button', {name: 'Start a conversation'}).click();
  await expect(page.getByRole('textbox', {name: 'Message Claude', exact: true})).toBeVisible();
  expect(await page.evaluate(() => (window as any).desktopCalls
    .filter((call: any) => ['toggle', 'restart-host', 'pairing-role'].includes(call.action))
    .map((call: any) => call.action))).toEqual(['restart-host']);
});

test('changing optional phone access keeps an open desktop chat available', async ({page}) => {
  await desktop(page, localOnly);
  await page.getByRole('button', {name: 'Resume latest chat'}).click();
  const input = page.getByRole('textbox', {name: 'Message Claude', exact: true});
  await input.fill('Continue on this PC');
  await page.locator('.desktop-rail').getByRole('button', {name: 'Settings', exact: true}).click();
  await page.getByText('Connection and startup', {exact: true}).click();
  await page.getByRole('switch', {name: 'Allow phone access', exact: true}).check();
  await expect(page.getByRole('switch', {name: 'Allow phone access', exact: true})).toBeChecked();
  await page.getByRole('button', {name: /claude · Interface review/}).click();
  await expect(input).toHaveValue('Continue on this PC');
  await expect(page.getByRole('button', {name: 'Send message', exact: true})).toBeEnabled();
  expect(await page.evaluate(() => (window as any).desktopCalls
    .filter((call: any) => call.action === 'toggle' || call.action === 'restart-host' ||
      call.endpoint === '/runtime/stop' || (call.action === 'settings' && call.phoneAccess === true))
    .map((call: any) => call.action))).toEqual(['settings']);
});
