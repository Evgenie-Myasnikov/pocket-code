import { test, expect, type Page } from '@playwright/test';

const root = 'C:\\Workspace\\typography';
async function openChat(page: Page, provider: 'codex' | 'claude', language: 'en' | 'ru') {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(({ provider, language }) => {
    sessionStorage.setItem('connection', JSON.stringify({ url: 'http://127.0.0.1:4319', token: 'test-only-'.repeat(5) }));
    localStorage.setItem('pocket-code-workspace', provider); localStorage.setItem('pocket-code-language-v1', language);
    localStorage.setItem('pocket-code-appearance-v1', JSON.stringify({ textSize: 8, scale: 100 }));
  }, { provider, language });
  const messages = [{ id: 'typography-message', role: 'assistant', blocks: [
    { type: 'text', text: 'A readable answer.\n\n| Name | Value |\n| --- | --- |\n| Item | 42 |\n\n```ts\nconst answer = 42;\n```' },
    { type: 'tool_use', id: 'command', name: 'Command', input: { command: 'echo example' } },
    { type: 'tool_result', tool_use_id: 'command', content: 'Command completed.' },
    { type: 'tool_use', name: 'File changes', input: { changes: [{ path: 'example.ts', diff: '+ const answer = 42;' }] } },
    { type: 'document', title: 'Notes.md', source: { text: 'Document preview.' } },
    { type: 'thinking', thinking: 'Consider the layout.' },
    { type: 'subagent', agent: { id: 'child', name: 'Layout reviewer', status: 'completed', provider, parentSessionId: 'chat', sessionId: 'child', source: 'history' } },
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
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: /Typography test/ }).click();
  await expect(page.locator('[data-message-id="typography-message"]')).toBeVisible();
  await page.locator('[data-message-id="typography-message"] details').evaluateAll(details => details.forEach(element => element.setAttribute('open', '')));
}

for (const provider of ['claude', 'codex'] as const) for (const language of ['en', 'ru'] as const) {
  test(`${provider} ${language}: chat labels, commands, changes and rich content scale with 8–22px body`, async ({ page }) => {
    await openChat(page, provider, language);
    const selectors = [
      '.markdown>p', '.message-label', '.claude-mark', '.tool-card.combined summary', '.tool-card.combined .activity-details>strong',
      '.tool-card.combined summary span', '.tool-card.combined .activity-details>pre', '.tool-result-content .markdown>p',
      '.tool-card:not(.combined)>summary', '.tool-card:not(.combined) .activity-details>pre', '.markdown>pre code', '.markdown table',
      '.document-card>strong', '.document-card>pre', '.thinking summary', '.thinking p', '.subagent-card strong', '.subagent-card small',
    ];
    let baseline: number[] | undefined, navigationFont = 0;
    for (const size of [8, 14, 22]) {
      await page.evaluate(size => document.documentElement.style.setProperty('--chat-font-size', `${size}px`), size);
      const result = await page.locator('[data-message-id="typography-message"]').evaluate((message, selectors) => {
        const elements = selectors.map(selector => message.querySelector(selector));
        if (elements.some(element => !element)) throw new Error(`Missing typography sample: ${selectors[elements.findIndex(element => !element)]}`);
        return {
          fonts: elements.map(element => parseFloat(getComputedStyle(element!).fontSize)),
          navigationFont: parseFloat(getComputedStyle(document.querySelector('.mobile-nav button')!).fontSize),
          taps: [...message.querySelectorAll('summary,button')].map(element => element.getBoundingClientRect().height),
          width: message.getBoundingClientRect().width, scroll: message.scrollWidth,
          overflow:[...message.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>message.getBoundingClientRect().right+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,scroll:e.scrollWidth})),
          labelHeight: message.querySelector('.message-label')!.getBoundingClientRect().height,
        };
      }, selectors);
      expect(result.fonts[0]).toBeCloseTo(size, 2);
      if (!baseline) { baseline = result.fonts; navigationFont = result.navigationFont; }
      result.fonts.forEach((font, index) => expect(font / baseline![index], `${selectors[index]} at ${size}px`).toBeCloseTo(size / 8, 2));
      expect(result.navigationFont).toBe(navigationFont);
      result.taps.forEach(height => expect(height).toBeGreaterThanOrEqual(48));
      expect(result.scroll,JSON.stringify(result.overflow)).toBeLessThanOrEqual(Math.ceil(result.width) + 1);
      expect(result.labelHeight).toBeGreaterThanOrEqual(48);
    }
    if (provider === 'codex' && language === 'en') {
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; document.documentElement.style.setProperty('--chat-font-size', '14px'); });
      await page.setViewportSize({ width: 844, height: 900 });
      await page.locator('.desktop-tabs').getByRole('button', { name: 'Settings', exact: true }).click();
      await expect(page.locator('.settings-index')).toBeVisible();
      await page.screenshot({ path: 'artifacts/settings-typography-844.png', fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 320, height: 740 });
      await page.screenshot({ path: 'artifacts/settings-typography-320.png', fullPage: true, animations: 'disabled' });
      await page.locator('.mobile-nav').getByRole('button', { name: 'Chats', exact: true }).click();
      await expect(page.locator('[data-message-id="typography-message"]')).toBeVisible();
      await page.getByRole('button', { name: 'Back to chats', exact: true }).click();
      await expect(page.locator('.sidebar')).toBeVisible();
      await page.screenshot({ path: 'artifacts/home-typography-320.png', fullPage: true, animations: 'disabled' });
    }
  });
}
