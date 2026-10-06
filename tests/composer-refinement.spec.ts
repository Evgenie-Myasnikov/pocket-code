import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,width=390,scale=100){
 await page.setViewportSize({width,height:844});
 await page.addInitScript(scale=>{localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale,textSize:16}));},scale);
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {ComposerHarness}=await import('/tests/fixtures/ComposerHarness.tsx' as string);
  const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(ComposerHarness));
 });
 await expect(page.getByLabel('Synthetic prompt')).toBeVisible();
}
for(const [width,scale] of [[320,60],[320,130],[390,100],[1440,100]])test(`composer grows, preserves shortcuts and fits ${width}px at ${scale}%`,async({page})=>{
 await setup(page,width,scale);const input=page.getByLabel('Synthetic prompt');const initial=(await input.boundingBox())!.height;
 await input.fill(Array.from({length:24},(_,i)=>`Prompt line ${i}`).join('\n'));
 expect((await input.boundingBox())!.height).toBeGreaterThan(initial);expect((await input.boundingBox())!.height).toBeLessThanOrEqual(260);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const control of await page.locator('.composer-tools button,.composer-tools select').all()){const box=(await control.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);}
 await input.press('Control+Enter');await expect(page.getByLabel('Sent')).toHaveText('1');await expect(input).toHaveValue('');
 await page.getByLabel('Stop synthetic').click();await expect(page.getByLabel('Stop synthetic')).toHaveCount(0);
 await input.fill('Explain the architecture and suggest the next step.');
 await page.screenshot({path:`.local/composer-${width}-${scale}.png`,fullPage:true});
});
test('new characters fade in with Markdown intact, then collapse to plain nodes; history never reanimates',async({page})=>{
 await setup(page);await expect(page.locator('.stream-glyph')).toHaveCount(0);
 await page.evaluate(()=>(window as any).setSyntheticStream('Saved text. **Fresh characters** and 👨‍👩‍👧‍👦'));
 await expect(page.locator('#synthetic-stream strong')).toHaveText('Fresh characters');
 await expect(page.locator('.stream-glyph').first()).toBeAttached();
 expect(await page.locator('.stream-glyph').count()).toBeLessThanOrEqual(192);
 expect(await page.locator('.stream-glyph').allTextContents()).not.toContain('Saved text.');
 await expect(page.locator('.stream-glyph')).toHaveCount(0);
 await page.evaluate(()=>(window as any).setSyntheticStream('A replaced history snapshot.'));
 await expect(page.locator('#synthetic-stream')).toHaveText('A replaced history snapshot.');await expect(page.locator('.stream-glyph')).toHaveCount(0);
});

test('first live fragment reveals letters progressively and catches up without changing text',async({page})=>{
 await setup(page);
 const text='Плавный ответ 👨‍👩‍👧‍👦 без рывков.';
 await page.evaluate(text=>(window as any).setFreshStream(text),text);
 await expect.poll(async()=>{const value=await page.locator('#fresh-stream').innerText();return value.length>0&&value.length<text.length;}).toBe(true);
 await expect(page.locator('#fresh-stream .stream-glyph').first()).toBeAttached();
 await expect(page.locator('#fresh-stream')).toHaveText(text);
 await page.evaluate(text=>(window as any).setFreshStream(text+' Ещё один фрагмент.'),text);
 await expect(page.locator('#fresh-stream')).toHaveText(text+' Ещё один фрагмент.');
});

test('reduced motion bypasses letter pacing for a fresh response',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 await page.evaluate(()=>(window as any).setFreshStream('Полный ответ сразу.'));
 await expect(page.locator('#fresh-stream')).toHaveText('Полный ответ сразу.');
 await expect(page.locator('#fresh-stream .stream-glyph')).toHaveCount(0);
});

test('frequent deltas do not restart or starve the letter queue',async({page})=>{
 await setup(page);
 const progress=await page.evaluate(async()=>{
  let text='',intermediate=false;
  for(let i=0;i<70;i++){
   text+='a';(window as any).setFreshStream(text);
   await new Promise(resolve=>setTimeout(resolve,8));
   const shown=document.querySelector('#fresh-stream')?.textContent||'';
   if(i>10&&shown.length>0&&shown.length<text.length)intermediate=true;
  }
  return {text,intermediate};
 });
 expect(progress.intermediate).toBe(true);
 await expect(page.locator('#fresh-stream')).toHaveText(progress.text);
});
test('reduced motion displays all new text immediately with no animated glyphs',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 await page.evaluate(()=>(window as any).setSyntheticStream('Saved text. New text without animation.'));
 await expect(page.locator('#synthetic-stream')).toHaveText('Saved text. New text without animation.');await expect(page.locator('.stream-glyph')).toHaveCount(0);
});

test('letter speed persists and instant mode flushes a pending answer without fades',async({page})=>{
 await setup(page);const speed=page.getByLabel('Letter reveal speed');
 await expect(speed).toHaveValue('40');await speed.selectOption('20');
 const text='A long synthetic answer. '.repeat(20);
 await page.evaluate(text=>(window as any).setFreshStream(text),text);
 await expect.poll(async()=>{const value=await page.locator('#fresh-stream').innerText();return value.length>0&&value.length<text.trim().length;}).toBe(true);
 await speed.selectOption('0');await expect(page.locator('#fresh-stream')).toHaveText(text.trim());await expect(page.locator('#fresh-stream .stream-glyph')).toHaveCount(0);
 await setup(page);await expect(page.getByLabel('Letter reveal speed')).toHaveValue('0');
 await page.evaluate(()=>(window as any).setFreshStream('Immediate answer'));await expect(page.locator('#fresh-stream')).toHaveText('Immediate answer');await expect(page.locator('#fresh-stream .stream-glyph')).toHaveCount(0);
});
