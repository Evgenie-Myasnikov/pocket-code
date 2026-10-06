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
test('reduced motion displays all new text immediately with no animated glyphs',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await setup(page);
 await page.evaluate(()=>(window as any).setSyntheticStream('Saved text. New text without animation.'));
 await expect(page.locator('#synthetic-stream')).toHaveText('Saved text. New text without animation.');await expect(page.locator('.stream-glyph')).toHaveCount(0);
});
