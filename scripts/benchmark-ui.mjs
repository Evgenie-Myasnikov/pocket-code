// Synthetic production-build benchmark. No host, account, model or project data is read.
// npm run build && node scripts/benchmark-ui.mjs --dist dist --out .local/perf-after.json
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2), arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const dist = path.resolve(arg('--dist', 'dist')), output = path.resolve(arg('--out', '.local/performance.json'));
const iterations = Number(arg('--runs', '3')), port = Number(arg('--port', '5184'));
const diffOnly = args.includes('--diff-only');
const cycles = Number(arg('--cycles', '3'));
const project = 'C:\\Synthetic\\performance-project', messageCount = 500, changedLineCount = 20000;
const messages = Array.from({ length: messageCount }, (_, index) => ({
  id: `perf-message-${index}`, role: index % 3 === 0 ? 'user' : 'assistant',
  blocks: index % 3 === 2 ? [
    { type: 'tool_use', id: `tool-${index}`, name: 'Bash', input: { command: `npm run synthetic-check --case ${index}` } },
    { type: 'tool_result', tool_use_id: `tool-${index}`, content: Array.from({ length: 24 }, (_, line) => `Check ${line}: passed with synthetic output`).join('\n') },
  ] : [{ type: 'text', text: `## Synthetic message ${index}\n\nA reproducible conversation with **formatted text**, a [documentation link](https://example.com), and inline \`code\`.\n\n- Check the first layout state\n- Preserve the current draft\n- Keep navigation responsive\n\n| State | Result |\n| --- | --- |\n| Ready | Pass |\n| Active | Pass |\n\n\`\`\`ts\nconst example${index} = { value: ${index}, enabled: true };\nconsole.log(example${index});\n\`\`\`\n` }],
}));
const patch = `@@ -1,${changedLineCount / 2} +1,${changedLineCount / 2} @@\n` + Array.from({ length: changedLineCount / 2 }, (_, index) => `-const oldValue${index} = ${index};\n+const newValue${index} = ${index + 1};`).join('\n') + '\n';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost'), requested = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
    if (requested !== dist && !requested.startsWith(dist + path.sep)) { res.writeHead(403).end(); return; }
    let file = requested;
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(dist, 'index.html'); }
    const body = await readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
let browser;
const results = [];
await mkdir(path.dirname(output), { recursive: true });
const checkpoints = [];
const checkpoint = async (iteration, phase, data) => {
  checkpoints.push({ iteration, phase, data });
  await writeFile(output.replace(/\.json$/, '.progress.json'), JSON.stringify(checkpoints, null, 2) + '\n');
};
try {
  browser = await chromium.launch({ executablePath: process.env.POCKET_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (let iteration = 1; iteration <= iterations; iteration++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let job = null, pollCount = 0, reviewRequests = 0;
    await page.addInitScript(() => {
      sessionStorage.setItem('connection', JSON.stringify({ url: 'http://127.0.0.1:4319', token: 'synthetic-performance-only' }));
      localStorage.setItem('pocket-code-workspace', 'claude'); localStorage.setItem('pocket-code-language-v1', 'en');
      localStorage.setItem('pocket-code-appearance-v1', JSON.stringify({ scale: 100, textSize: 14 }));
      window.__perfLongTasks = []; new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__perfLongTasks.push({ startTime: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask', buffered: true });
    });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), endpoint = url.pathname.replace('/api', ''); let json;
      if (endpoint === '/health') json = { name: 'Synthetic performance PC', roots: [project], protocol: 1, version: '0.19.1' };
      else if (endpoint === '/providers') json = [{ id: 'claude', name: 'Claude', available: true, authenticated: true, models: [] }];
      else if (endpoint === '/projects') json = [project];
      else if (endpoint === '/sessions') json = [{ sessionId: 'perf-chat', provider: 'claude', summary: 'Synthetic performance conversation', cwd: project, lastModified: 123456789 }];
      else if (endpoint === '/sessions/perf-chat/messages') json = { messages, previous: null, next: null };
      else if (endpoint === '/jobs' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        job = { id: body.id, provider: 'claude', sessionId: 'perf-chat', cwd: project, status: 'running', messages: [{ id: 'perf-followup', role: 'user', blocks: [{ type: 'text', text: body.text }] }], partial: '', approvals: [], startedAt: Date.now(), revision: 0, baseMessageCount: messageCount };
        json = job;
      }
      else if (endpoint === '/jobs') json = job ? [job] : [];
      else if (endpoint.startsWith('/jobs/') && job) {
        pollCount++; job = { ...job, revision: pollCount, partial: `Streaming synthetic answer ${pollCount}\n\n` + Array.from({ length: pollCount * 8 }, (_, i) => `- Completed synthetic check ${i}`).join('\n') }; json = job;
      }
      else if (endpoint === '/updates/latest') json = { enabled: false };
      else if (endpoint === '/review/availability') json = { available: true, mode: 'working' };
      else if (endpoint === '/review') { reviewRequests++; json = { repositoryRoot: project, projectPath: project, current: 'perf-fixture', base: 'main', branches: ['main'], files: [{ path: 'src/synthetic-large.ts', added: changedLineCount / 2, removed: changedLineCount / 2 }], patch: url.searchParams.has('file') ? patch : '', binary: false }; }
      else if (endpoint === '/task-notifications') json = { items: [], unread: 0 };
      else if (endpoint === '/project-docs') json = { project, documents: [], truncated: false };
      else return route.fulfill({ status: 404, json: { error: 'Synthetic endpoint unavailable' } });
      return route.fulfill({ json });
    });
    const mark = () => page.evaluate(() => performance.now());
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stats = async (since) => page.evaluate(since => {
      const tasks = window.__perfLongTasks.filter(task => task.startTime >= since);
      return { elapsedMs: performance.now() - since, longTasks: tasks.length, longTaskTotalMs: tasks.reduce((sum, task) => sum + task.duration, 0), longestTaskMs: Math.max(0, ...tasks.map(task => task.duration)), domElements: document.querySelectorAll('*').length };
    }, since);
    const memory = async () => { await cdp.send('HeapProfiler.collectGarbage'); const { metrics } = await cdp.send('Performance.getMetrics'); return { ...Object.fromEntries(metrics.filter(metric => ['JSHeapUsedSize', 'JSHeapTotalSize', 'LayoutCount', 'RecalcStyleCount'].includes(metric.name)).map(metric => [metric.name, metric.value])), ...await cdp.send('Memory.getDOMCounters') }; };
    const scroll = async (selector) => page.locator(selector).evaluate(element => new Promise(resolve => {
      const gaps = []; const started = performance.now(); let previous = started, frame = 0;
      const tick = now => { gaps.push(now - previous); previous = now; const progress = Math.min(1, (now - started) / 2000); element.scrollTop = (element.scrollHeight - element.clientHeight) * progress; element.dispatchEvent(new Event('scroll')); if (++frame < 120 && progress < 1) requestAnimationFrame(tick); else { gaps.sort((a, b) => a - b); resolve({ p50FrameMs: gaps[Math.floor(gaps.length * .5)], p95FrameMs: gaps[Math.floor(gaps.length * .95)], maxFrameMs: Math.max(...gaps), frames: gaps.length, scrollHeight: element.scrollHeight, requestedDurationMs: 2000 }); } };
      requestAnimationFrame(tick);
    }));
    await page.goto(`http://127.0.0.1:${port}`); await page.getByRole('button', { name: /Synthetic performance conversation/ }).waitFor();
    let start = await mark(); await page.getByRole('button', { name: /Synthetic performance conversation/ }).click(); await page.locator('.conversation .message').first().waitFor(); await settle();
    const chatOpen = { ...await stats(start), messagesMounted: await page.locator('.conversation .message').count(), ...await memory() };
    console.log(`Run ${iteration}: chat opened (${Math.round(chatOpen.elapsedMs)} ms)`);
    await checkpoint(iteration, 'chatOpen', chatOpen);
    let typing = null, chatScroll = null, streaming = null;
    if (!diffOnly) {
    const composer = page.getByLabel('Message Claude'); await composer.click(); start = await mark(); await composer.pressSequentially('Test 123', { delay: 20 }); await settle(); typing = { ...await stats(start), characters: 8 };
    console.log(`Run ${iteration}: typed (${Math.round(typing.elapsedMs)} ms)`);
    await checkpoint(iteration, 'typing', typing);
    start = await mark(); chatScroll = { ...await scroll('.conversation'), ...await stats(start) };
    console.log(`Run ${iteration}: chat scrolled`);
    await checkpoint(iteration, 'chatScroll', chatScroll);
    await composer.fill('Continue the synthetic checks'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const confirmation = page.getByRole('button', { name: /Finished on PC|Continue here|continue/i }); if (await confirmation.count()) await confirmation.last().click();
    start = await mark(); await page.waitForFunction(() => document.querySelector('.conversation')?.textContent?.includes('Streaming synthetic answer 8'), null, { timeout: 90000 }); await settle(); streaming = { ...await stats(start), updates: pollCount, ...await memory() };
    console.log(`Run ${iteration}: streamed (${Math.round(streaming.elapsedMs)} ms)`);
    await checkpoint(iteration, 'streaming', streaming);
    // Stop synthetic streaming, retaining the latest messages; measured diff workloads run independently.
    if (job) job = { ...job, status: 'done' };
    await page.route('**/api/jobs/*?revision=*', route => route.fulfill({ json: job }));
    await page.waitForTimeout(1100);
    }
    const waitForDiff = () => page.waitForFunction(() => document.querySelector('.diff-content')?.textContent?.includes('const newValue0 = 1;'));
    start = await mark(); await page.getByRole('button', { name: 'Review', exact: true }).click(); await waitForDiff(); await settle(); const diffOpen = { ...await stats(start), mountedRows: await page.locator('.diff-table tr').count(), ...await memory() };
    console.log(`Run ${iteration}: diff opened (${Math.round(diffOpen.elapsedMs)} ms)`);
    await checkpoint(iteration, 'diffOpen', diffOpen);
    start = await mark(); const diffScroll = { ...await scroll('.diff-content'), ...await stats(start) };
    await checkpoint(iteration, 'diffScroll', diffScroll);
    start = await mark(); await page.waitForTimeout(10500); await settle(); const diffIdle = { ...await stats(start), reviewRequests };
    await checkpoint(iteration, 'diffIdle', diffIdle);
    await page.getByRole('button', { name: 'Back to chat', exact: true }).click(); await settle();
    const afterClose = await memory();
    const reviewCycles = [];
    for (let cycle = 0; cycle < cycles; cycle++) {
      await page.getByRole('button', { name: 'Review', exact: true }).click(); await waitForDiff(); await settle();
      await page.getByRole('button', { name: 'Back to chat', exact: true }).click(); await settle(); reviewCycles.push(await memory());
    }
    const navigation = [];
    for (const tab of ['Project', 'Settings', 'Tasks', 'Chats']) {
      start = await mark(); await page.locator('.mobile-nav').getByRole('button', { name: tab, exact: true }).click(); await settle(); navigation.push({ tab, ...await stats(start) });
    }
    results.push({ iteration, chatOpen, typing, chatScroll, streaming, diffOpen, diffScroll, diffIdle, afterClose, reviewCycles, navigation, errors });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify({ capturedAt: new Date().toISOString(), build: path.basename(dist), browser: await browser.version(), viewport: '390x844 CSS px', cpuSlowdown: 4, mobileEmulation: true, physicalAndroid: false, messageCount, changedLineCount, patchBytes: Buffer.byteLength(patch), diffOnly, iterations, results }, null, 2) + '\n');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
