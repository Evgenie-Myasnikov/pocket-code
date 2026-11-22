import {openChatList,newChat,openSection} from './chat-navigation';
import { test, expect, type Page } from '@playwright/test';

const root = 'C:\\Workspace\\typography';
async function openChat(page: Page, provider: 'codex' | 'claude', language: 'en' | 'ru',
  text = 'A readable answer.\n\n| Name | Value |\n| --- | --- |\n| Item | 42 |\n\n```ts\nconst answer = 42;\n```') {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(({ provider, language }) => {
    sessionStorage.setItem('connection', JSON.stringify({ url: 'http://127.0.0.1:4319', token: 'test-only-'.repeat(5) }));
    localStorage.setItem('pocket-code-workspace', provider); localStorage.setItem('pocket-code-language-v1', language);
    localStorage.setItem('pocket-code-appearance-v1', JSON.stringify({ textSize: 8, scale: 100 })); localStorage.setItem('pocket-code-detail-mode-v1', 'detailed');
  }, { provider, language });
  const messages = [{ id: 'typography-message', role: 'assistant', blocks: [
    { type: 'text', text },
    { type: 'tool_use', id: 'command', name: 'Command', input: { command: 'echo example' } },
    { type: 'tool_result', tool_use_id: 'command', content: 'Command completed.' },
    { type: 'tool_use', name: 'File changes', input: { changes: [{ path: 'example.ts', diff: '+ const answer = 42;' }] } },
    { type: 'document', title: 'Notes.md', source: { text: 'Document preview.' } },
    { type: 'thinking', thinking: 'Consider the layout.' },
    { type: 'subagent', agent: { id: 'child', name: 'Layout reviewer', result: 'The layout check finished.', status: 'completed', provider, parentSessionId: 'chat', sessionId: 'child', source: 'history' } },
  ] }];
  await page.route('**/api/**', route => {
    const endpoint = new URL(route.request().url()).pathname.replace('/api', '');
    if (endpoint === '/health') return route.fulfill({ json: { name: 'Typography PC', roots: [root], protocol: 1, version: '0.12.0' } });
    if (endpoint === '/providers') return route.fulfill({ json: ['claude', 'codex'].map(id => ({ id, name: id, available: true, authenticated: true, models: [] })) });
    if (endpoint === '/projects') return route.fulfill({ json: [root] });
    if (endpoint === '/sessions') return route.fulfill({ json: [{ sessionId: 'chat', provider, summary: 'Typography test', cwd: root, lastModified: Date.now() }] });
    if (endpoint.endsWith('/messages')) return route.fulfill({ json: { messages, previous: null, next: null } });
    if (endpoint === '/jobs') return route.fulfill({ json: [] });
    if (endpoint === '/updates/latest') return route.fulfill({ json: { enabled: false } });
    if (endpoint.endsWith('/subagents')) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { error: 'Synthetic endpoint not configured' } });
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await page.getByRole('button', { name: /Typography test/ }).click();
  await expect(page.locator('[data-message-id="typography-message"]')).toBeVisible();
  await page.locator('[data-message-id="typography-message"] details').evaluateAll(details => details.forEach(element => element.setAttribute('open', '')));
}

test('a phone reader can wrap one code example and copy its original indentation', async ({page}) => {
  const source = 'if (ready) {\n  inspect("' + 'example'.repeat(24) + '");\n}';
  await openChat(page, 'claude', 'en', ['```js', source, '```', '', '```js', 'anotherExample();', '```'].join('\n'));
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--chat-font-size', '18px');
    Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{
      writeText: async (text:string) => { (window as any).copiedExample = text; },
    }});
  });
  const blocks = page.locator('[data-message-id="typography-message"] .code-block');
  const first = blocks.first(), pre = first.locator('pre');
  const wrap = first.getByRole('button', {name:'Wrap', exact:true});
  const actions=first.getByRole('button',{name:'Code actions · js'});
  await expect(first).toHaveCSS('border-top-width','1px');
  await expect(pre).toHaveCSS('border-top-width','0px');
  await expect(pre).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(wrap).toHaveCount(0);
  await expect.poll(()=>pre.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeGreaterThan(50);
  await actions.focus();await actions.press('Enter');
  await wrap.focus();await page.keyboard.press('Space');
  await expect(wrap).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>pre.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(blocks.nth(1).locator('pre')).not.toHaveClass(/wrap/);
  await first.getByRole('button',{name:'Copy',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).copiedExample)).toBe(source);
  await wrap.click();
  await wrap.press('Escape');
  await expect(actions).toBeFocused();
  await expect(actions).toHaveAttribute('aria-expanded','false');
  await expect.poll(()=>pre.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeGreaterThan(50);
  await page.setViewportSize({width:1280,height:900});
  await actions.click();
  await blocks.nth(1).getByRole('button',{name:'Code actions · js'}).click();
  await expect(actions).toHaveAttribute('aria-expanded','false');
  await expect(pre).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(pre).toHaveCSS('border-top-width','0px');
});

test('a denied code copy explains manual copying and a retry announces success',async({page})=>{
  await page.addInitScript(()=>{
    let denied=true;
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{
      if(denied){denied=false;throw new DOMException('Synthetic denial','NotAllowedError');}
      (window as any).lastCopiedCode=text;
    }}});
  });
  await openChat(page,'claude','en');
  const code=page.locator('[data-message-id="typography-message"] .code-block').first();
  await code.getByRole('button',{name:'Code actions · ts'}).click();
  const copy=code.getByRole('button',{name:'Copy',exact:true});
  await copy.focus();await copy.press('Enter');
  const status=code.getByRole('status');
  await expect(status).toHaveText('Copy failed. Select the text and copy it manually.');
  await expect(status).toBeInViewport();await expect(copy).toBeFocused();
  expect(await code.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await copy.press('Space');
  await expect(status).toHaveText('Copied');await expect(copy).toBeFocused();
  expect(await page.evaluate(()=>(window as any).lastCopiedCode)).toBe('const answer = 42;');
});

test('long table cells reflow and a multi-column comparison scrolls independently', async ({page}) => {
  const identifier = 'NormalizedConfigurationField'.repeat(4);
  const headings = ['Project', 'Current phase', 'Review owner', 'Change summary', 'Updated', 'Next review'];
  const text = [
    '## Interface review',
    `| A descriptive heading that fits when wrapped | Value |\n| --- | --- |\n| Field | ${identifier} |`,
    'Compare the release milestones.',
    [headings.join(' | '), headings.map(() => '---').join(' | '),
      ['Atlas', 'Review', 'Design', 'Keyboard focus', 'Today', 'Friday'].join(' | ')].join('\n'),
  ].join('\n\n');
  await openChat(page,'claude','en',text);
  await page.evaluate(() => document.documentElement.style.setProperty('--chat-font-size','18px'));
  const message = page.locator('[data-message-id="typography-message"]');
  const tables = message.getByRole('table');
  await expect(tables).toHaveCount(2);
  const width = (await message.boundingBox())!.width;
  const first = tables.first();
  const widestCell = await first.locator('td,th').evaluateAll(cells => Math.max(...cells.map(cell => cell.getBoundingClientRect().width)));
  expect(widestCell).toBeLessThan(width);
  await expect(first.getByRole('cell',{name:identifier})).toBeVisible();
  await expect(first.locator('..')).not.toHaveAttribute('tabindex','0');
  const scrollArea = message.getByRole('group',{name:'Horizontally scrollable table'});
  await expect(scrollArea).toHaveAttribute('tabindex','0');
  expect(await scrollArea.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await scrollArea.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => scrollArea.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await message.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  await expect(message.getByRole('table')).toHaveCount(2);
  await expect(scrollArea).toHaveCount(0);
});

for (const provider of ['claude', 'codex'] as const) for (const language of ['en', 'ru'] as const) {
  test(`${provider} ${language}: chat labels, commands, changes and rich content scale with 8–22px body`, async ({ page }) => {
    await openChat(page, provider, language);
    const transcript = page.locator('.conversation');
    await expect(transcript.locator('details.thinking .reasoning-content')).toBeVisible();
    await expect(transcript.locator('.tool-card.combined .tool-output')).toBeVisible();
    const selectors = [
      '.markdown p', '.tool-card.combined summary', '.tool-card.combined .tool-command',
      '.tool-card.combined .tool-title', '.tool-card.combined .tool-output', '.tool-result-content .copy-action',
      '.tool-card.activity-row:not(.combined)>summary', '.tool-diff', '.markdown .code-block pre code', '.code-options-trigger', '.markdown table',
      '.document-card>strong', '.document-card>pre', '.thinking summary', '.thinking p',
      '.subagent-inline > summary, .subagent-card strong', '.subagent-inline p, .subagent-card small',
    ];
    let baseline: number[] | undefined, navigationFont = 0;
    for (const size of [8, 14, 22]) {
      await page.evaluate(size => document.documentElement.style.setProperty('--chat-font-size', `${size}px`), size);
      const result = await transcript.evaluate((transcript, selectors) => {
        const elements = selectors.map(selector => transcript.querySelector(selector));
        if (elements.some(element => !element)) throw new Error(`Missing typography sample: ${selectors[elements.findIndex(element => !element)]}`);
        const messages = [...transcript.querySelectorAll<HTMLElement>('article.message')];
        return {
          fonts: elements.map(element => parseFloat(getComputedStyle(element!).fontSize)),
          navigationFont: parseFloat(getComputedStyle(document.querySelector('.chat-header-main .mobile-back')!).fontSize),
          taps: messages.flatMap(message => [...message.querySelectorAll('summary,button')].filter(element => !element.closest('.message-actions')).map(element => ({name:element.className || element.textContent, height:element.getBoundingClientRect().height}))),
          widths: messages.map(message => ({id:message.dataset.messageId, width:message.getBoundingClientRect().width, scroll:message.scrollWidth})),
          copyHeight: transcript.querySelector('.message-actions .copy-button')!.getBoundingClientRect().height,
          labels: transcript.querySelectorAll('.message-label,.claude-mark').length,
        };
      }, selectors);
      expect(result.fonts[0]).toBeCloseTo(size, 2);
      if (!baseline) { baseline = result.fonts; navigationFont = result.navigationFont; }
      result.fonts.forEach((font, index) => expect(font / baseline![index], `${selectors[index]} at ${size}px`).toBeCloseTo(size / 8, 2));
      expect(result.navigationFont).toBe(navigationFont);
      result.taps.forEach(tap => expect(tap.height, tap.name || 'transcript control').toBeGreaterThanOrEqual(48));
      result.widths.forEach(message => expect(message.scroll, message.id).toBeLessThanOrEqual(Math.ceil(message.width) + 1));
      expect(result.copyHeight).toBeGreaterThanOrEqual(28);
      expect(result.labels).toBe(0);
    }
    if (provider === 'codex' && language === 'en') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.style.setProperty('--chat-font-size', '14px'); });
      await page.setViewportSize({ width: 844, height: 900 });
      await openSection(page,'Settings');
      await expect(page.locator('.settings-index')).toBeVisible();
      await page.screenshot({ path: 'artifacts/settings-typography-844.png', fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 320, height: 740 });
      await page.screenshot({ path: 'artifacts/settings-typography-320.png', fullPage: true, animations: 'disabled' });
      await openSection(page,'Chats');
      await expect(page.locator('[data-message-id="typography-message"]')).toBeVisible();
      await page.getByRole('button', { name: 'Back to chats', exact: true }).click();
      await expect(page.locator('.sidebar')).toBeVisible();
      await page.screenshot({ path: 'artifacts/home-typography-320.png', fullPage: true, animations: 'disabled' });
    }
  });
}
