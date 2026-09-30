import { test, expect } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };

const saved = { url: 'https://saved-pc.example', token: 'saved-test-key-'.repeat(4) };
async function delayedConnection(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const state = window as any;
    state.CapacitorCustomPlatform = { name: 'android' };
    state.connectionRequests = [];
    state.Capacitor = {
      PluginHeaders: [
        { name: 'ConnectionVault', methods: ['load', 'save', 'clear'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'CapacitorHttp', methods: [{ name: 'request', rtype: 'promise' }] },
      ],
      nativePromise: async (plugin: string, method: string, options: any) => {
        if (plugin === 'ConnectionVault' && method === 'load') return new Promise(resolve => {
          state.releaseSavedConnection = (connection: object) => resolve({ value: JSON.stringify(connection) });
        });
        if (plugin === 'CapacitorHttp') {
          state.connectionRequests.push(options);
          return { status: 503, data: { error: 'Synthetic offline PC' } };
        }
        return {};
      },
    };
  });
  await page.goto('http://127.0.0.1:5173');
  await expect.poll(() => page.evaluate(() => typeof (window as any).releaseSavedConnection)).toBe('function');
}

test('saved address and key appear after asynchronous loading and remain available after a failed connection', async ({ page }) => {
  await delayedConnection(page);
  await expect(page.getByLabel('Computer address')).toHaveValue('');
  await page.evaluate(connection => (window as any).releaseSavedConnection(connection), saved);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Computer address')).toHaveValue(saved.url);
  await expect(page.getByLabel('Connection key')).toHaveValue(saved.token);
  await expect(page.locator('.connect-brand .version')).toHaveText(`ANDROID / ${pkg.version}`);
  await expect(page.getByText('CLAUDE AND CODEX ON YOUR PC', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connect computer', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).connectionRequests.length)).toBe(2);
  await expect(page.getByLabel('Connection key')).toHaveValue(saved.token);
});

test('late saved credentials fill only fields the user has not edited', async ({ page }) => {
  await delayedConnection(page);
  const typedUrl = 'https://new-pc.example';
  await page.getByLabel('Computer address').fill(typedUrl);
  await page.evaluate(connection => (window as any).releaseSavedConnection(connection), saved);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Computer address')).toHaveValue(typedUrl);
  await expect(page.getByLabel('Connection key')).toHaveValue(saved.token);
});

test('late saved credentials never replace a key the user has edited or deliberately cleared', async ({ page }) => {
  await delayedConnection(page);
  await page.getByLabel('Connection key').fill('typed-test-key-'.repeat(4));
  await page.getByLabel('Connection key').fill('');
  await page.evaluate(connection => (window as any).releaseSavedConnection(connection), saved);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Computer address')).toHaveValue(saved.url);
  await expect(page.getByLabel('Connection key')).toHaveValue('');
});
