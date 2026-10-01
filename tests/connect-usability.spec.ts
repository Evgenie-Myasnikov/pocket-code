import {connectByQr} from './qr-connect';
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

test('saved connection retries without exposing address or key fields', async ({page})=>{
  await delayedConnection(page);
  await expect(page.getByLabel('Computer address')).toHaveCount(0);
  await expect(page.getByLabel('Connection key')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reconnect',exact:true})).toHaveCount(0);
  await page.evaluate(connection=>(window as any).releaseSavedConnection(connection),saved);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.connect-brand .version')).toHaveText('ANDROID / '+pkg.version);
  await page.getByRole('button',{name:'Reconnect',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).connectionRequests.length)).toBe(2);
  expect(await page.evaluate(()=>(window as any).connectionRequests.every((request:any)=>request.headers.Authorization==='Bearer '+('saved-test-key-'.repeat(4))))).toBe(true);
  await expect(page.locator('input:not([type=file])')).toHaveCount(0);
});

for(const language of ['en','ru'])test('QR-only entry is usable on a narrow phone in '+language,async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(language=>localStorage.setItem('pocket-code-language-v1',language),language);
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.connect-page input:not([type=file])')).toHaveCount(0);
  await expect(page.locator('.qr-divider')).toHaveCount(0);
  await expect(page.locator('.qr-connect button')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(language==='en')await page.screenshot({path:'artifacts/screenshots/connect-qr-only.png',fullPage:true});
  await connectByQr(page);await expect(page.locator('.connect-page')).toHaveCount(0);
});

test('invalid QR image keeps scanning available, then a valid QR connects',async({page})=>{
  await page.goto('http://127.0.0.1:5173');
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'Scan QR code',exact:true})).toBeEnabled();
  await connectByQr(page);await expect(page.locator('.connect-page')).toHaveCount(0);
});

test('failed QR connection can retry without rescanning or entering credentials',async({page})=>{
  let calls=0;await page.route('**/api/health',route=>{calls++;return route.fulfill({status:503,json:{error:'Synthetic offline host'}});});
  await page.goto('http://127.0.0.1:5173');await connectByQr(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'Reconnect',exact:true}).click();
  await expect.poll(()=>calls).toBe(2);
  await expect(page.locator('.connect-page input:not([type=file])')).toHaveCount(0);
});
