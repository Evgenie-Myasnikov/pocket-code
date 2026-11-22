import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {openChatList, openSection} from './chat-navigation';
import {desktop, desktopSection} from './desktop-fixture';

const presets = [
  {name: 'Graphite', id: 'graphite', mode: 'dark'},
  {name: 'Slate', id: 'slate', mode: 'dark'},
  {name: 'Ink', id: 'ink', mode: 'light'},
] as const;

const title = 'Interface review';
const cwd = 'C:\\Demo\\Atlas';
const messages = [
  {id: 'request', role: 'user', blocks: [{type: 'text', text: 'Add currency formatting to the catalog.'}]},
  {id: 'result', role: 'assistant', blocks: [{type: 'text', text: [
    'Prices now display in the selected currency, including in the exported catalog.',
    '```ts', "const currency = new Intl.NumberFormat('en', {", "  style: 'currency',", "  currency: 'USD',", '});', '```',
    'The catalog and export tests both passed.',
  ].join('\n')}]},
];

async function phone(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('connection', JSON.stringify({url: 'http://127.0.0.1:4319', token: 'synthetic-theme-fixture'}));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/health') return route.fulfill({json: {name: 'Demo', roots: [cwd], protocol: 1, version: '0.28.54'}});
    if (path === '/api/providers') return route.fulfill({json: [{id: 'claude', name: 'Claude', available: true}]});
    if (path === '/api/sessions') return route.fulfill({json: [{sessionId: 'alpha', summary: title, cwd, lastModified: 2}]});
    if (path.endsWith('/messages')) return route.fulfill({json: {messages, previous: null, next: null}});
    if (path === '/api/review/availability') return route.fulfill({json: {available: true, mode: 'working'}});
    if (path === '/api/updates/latest') return route.fulfill({json: {enabled: false}});
    if (['/api/jobs','/api/custom-providers','/api/projects'].includes(path)) return route.fulfill({json: []});
    return route.fulfill({status: 404, json: {error: 'Synthetic endpoint'}});
  });
  await page.goto(test.info().project.use.baseURL || 'http://127.0.0.1:5173');
}

async function openAppearance(page: Page, mobile: boolean) {
  if (mobile) await openSection(page, 'Settings');
  else await desktopSection(page, 'Settings');
  await page.locator('[data-settings-category="appearance"]').click();
}

async function expectPalette(page: Page, preset: {id: string; mode: string}) {
  await expect(page.locator('html')).toHaveAttribute('data-palette', preset.id);
  await expect(page.locator('html')).toHaveAttribute('data-theme', preset.mode);
  await expect.poll(() => page.evaluate(() => {
    const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.fillStyle = background;
    probe.fillRect(0, 0, 1, 1);
    const hex = Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3), n => n.toString(16).padStart(2, '0')).join('');
    return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content === '#' + hex;
  })).toBe(true);
}

test('a saved palette survives an upgrade and switching presets preserves reading preferences', async ({page}) => {
  const storageKey = 'pocket-code-appearance-v1';
  await page.addInitScript(key => {
    localStorage.setItem('pocket-code-language-v1', 'en');
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({palette: 'ocean', theme: 'system', chatAlign: 'left', textSize: 16}));
    }
  }, storageKey);
  await page.emulateMedia({colorScheme: 'dark'});
  await desktop(page);
  await expectPalette(page, {id: 'ocean', mode: 'dark'});
  await page.emulateMedia({colorScheme: 'light'});
  await expectPalette(page, {id: 'ocean', mode: 'light'});
  await openAppearance(page, false);
  await page.getByRole('button', {name: 'Slate', exact: true}).click();
  await expectPalette(page, presets[1]);
  await page.locator('input[name="appearance-theme"][value="light"]').check();
  await page.reload();
  await expectPalette(page, {id: 'slate', mode: 'light'});
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey))
    .toMatchObject({palette: 'slate', theme: 'light', chatAlign: 'left', textSize: 16});
});

for (const [device, width, height] of [['desktop', 1280, 800], ['phone', 390, 844], ['compact', 320, 640]] as const) {
  const mobile = device !== 'desktop';
  test.describe(device, () => {
    test.use({viewport: {width, height}, hasTouch: mobile, isMobile: mobile});
    for (const preset of presets) {
      test(`${preset.name} applies from settings and survives reopening the chat`, async ({page}) => {
        await page.addInitScript(messages => {
          localStorage.setItem('pocket-code-language-v1', 'en');
          (window as Window & {branchMessages?: unknown}).branchMessages = messages;
        }, messages);
        if (mobile) await phone(page);
        else await desktop(page);
        await expectPalette(page, presets[0]);
        await openAppearance(page, mobile);
        const picker = page.locator('.theme-presets');
        await expect(picker.getByRole('button')).toHaveCount(3);
        const option = picker.getByRole('button', {name: preset.name, exact: true});
        await option.click();
        await expect(option).toHaveAttribute('aria-pressed', 'true');
        await expectPalette(page, preset);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await page.reload();
        await expectPalette(page, preset);
        if (mobile) {
          await openChatList(page);
          await page.getByRole('button', {name: new RegExp(title)}).first().click();
        } else {
          await page.locator('.desktop-sessions button[data-chat-id="alpha"]').click();
        }
        await expect(page.getByText('The catalog and export tests both passed.')).toBeVisible();
        const code = page.locator('.conversation-inner .reader-code');
        await expect(code).toHaveCount(1);
        await expect(code.locator('pre')).toHaveCSS('border-top-width', '0px');
        await expect(code.locator('pre')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await expect(page.locator('.composer textarea')).toBeVisible();
        await expect(page.locator('.composer-actions .send-button')).toBeVisible();
        const controls = page.locator('.composer-tools button:visible,.composer-tools select:visible');
        expect(await controls.count()).toBeGreaterThanOrEqual(4);
        const clipped = await controls.evaluateAll(items => items.filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.left < -0.5 || rect.right > innerWidth + 0.5 || rect.top < -0.5 || rect.bottom > innerHeight + 0.5;
        }).map(el => el.getAttribute('aria-label') || el.className));
        expect(clipped).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (process.env.POCKET_THEME_PREVIEWS && device !== 'compact') {
          await page.evaluate(() => document.fonts.ready.then(() => true));
          await page.screenshot({path: join(process.env.POCKET_THEME_PREVIEWS, `${device}-${preset.id}.png`), animations: 'disabled'});
        }
      });
    }
  });
}
