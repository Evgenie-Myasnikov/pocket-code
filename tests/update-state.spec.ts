import { test, expect } from '@playwright/test';

test('a newer release invalidates a previously downloaded APK and install is bound to its checksum', async ({ page }) => {
  let release = { version: '99.0.1', versionCode: 99001, sha256: 'a'.repeat(64), size: 100, apk: 'Pocket-Code-99.0.1.apk', releaseId: 101, tag: 'v99.0.1' };
  await page.addInitScript(() => {
    localStorage.setItem('pocket-code-auto-updates-v1', 'false');
    const state = window as any; state.nativeCalls = []; state.failDownload = false;
    state.CapacitorCustomPlatform = { name: 'android' };
    state.Capacitor = {
      PluginHeaders: [
        { name: 'AppUpdate', methods: ['info', 'download', 'install', 'allowInstall'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'ConnectionVault', methods: ['load', 'save', 'clear'].map(name => ({ name, rtype: 'promise' })) },
        { name: 'CapacitorHttp', methods: [{ name: 'request', rtype: 'promise' }] },
      ],
      nativePromise: async (plugin: string, method: string, options: any) => {
        if (plugin === 'CapacitorHttp') {
          const response = await fetch(options.url, { method: options.method, headers: options.headers, body: options.data === undefined ? undefined : JSON.stringify(options.data) });
          return { status: response.status, data: response.status === 204 ? null : await response.json() };
        }
        if (plugin === 'AppUpdate') {
          state.nativeCalls.push({ method, options });
          if (method === 'info') return { version: '99.0.0', versionCode: 99000 };
          if (method === 'download' && state.failDownload) throw new Error('Synthetic download failure');
          if (method === 'install') return { needsPermission: true };
        }
        return {};
      },
    };
  });
  await page.route('**/api/updates/latest', route => route.fulfill({ json: { enabled: true, update: release } }));
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');
  await page.getByLabel('Connection key').fill('test-only-'.repeat(5));
  await page.getByRole('button', { name: 'Connect computer', exact: true }).click();
  await page.locator('.mobile-nav').getByRole('button', { name: 'Settings', exact: true }).click();await page.getByRole('button',{name:'Updates',exact:true}).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await page.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install update', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).nativeCalls.filter((call: any) => call.method === 'install').at(-1).options)).toEqual({ versionCode: 99001, sha256: 'a'.repeat(64) });

  release = { ...release, version: '99.0.2', versionCode: 99002, sha256: 'b'.repeat(64), apk: 'Pocket-Code-99.0.2.apk', releaseId: 102, tag: 'v99.0.2' };
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install update', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download update', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).failDownload = true; });
  await page.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(page.getByText('Synthetic download failure')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Install update', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).nativeCalls.filter((call: any) => call.method === 'install').length)).toBe(1);
  await page.evaluate(() => { (window as any).failDownload = false; });
  await page.getByRole('button', { name: 'Download update', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Install update', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).nativeCalls.filter((call: any) => call.method === 'install').at(-1).options)).toEqual({ versionCode: 99002, sha256: 'b'.repeat(64) });
});
