import {test,expect} from '@playwright/test';
for(const variant of ['StreamHandoffHarness','StaleSnapshotHarness'])test(`stream presentation never rewinds: ${variant}`,async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.locator('.desktop-tabs:visible').waitFor();
 await page.evaluate(async name=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const module=await import('/tests/fixtures/TranscriptFollowHarness.tsx' as string);
  const node=document.createElement('div');document.body.replaceChildren(node);createRoot(node).render(React.createElement(module[name]));
 },variant);
 if(variant==='StreamHandoffHarness'){
  const text='A newly streaming response with enough words to reveal slowly.';
  await page.evaluate(text=>(window as any).streamHandoff(text),text);
  await expect.poll(async()=>(await page.locator('.markdown').innerText()).length).toBeGreaterThan(12);
  await page.evaluate(()=>(window as any).finishHandoff());
  await expect(page.locator('[data-message-id=final] .markdown')).toHaveText(text,{timeout:250});
  await expect(page.locator('[data-message-id=final] .stream-glyph')).toHaveCount(0);
 }else{
  const target='Existing text. '+ 'More words arrive smoothly. '.repeat(5);
  await expect(page.locator('.markdown')).toHaveText('Existing text.');
  await page.evaluate(text=>(window as any).updateSnapshot(text),target);
  await expect.poll(async()=>(await page.locator('.markdown').innerText()).length).toBeGreaterThan(25);
  const before=(await page.locator('.markdown').innerText()).length;
  await page.evaluate(()=>(window as any).updateSnapshot('Existing text. '));
  const lengths=await page.evaluate(async()=>{const values:number[]=[];for(let i=0;i<15;i++){await new Promise(requestAnimationFrame);values.push((document.querySelector('.markdown') as HTMLElement).innerText.length);}return values;});
  expect(Math.min(...lengths)).toBeGreaterThanOrEqual(before);
  await page.evaluate(()=>(window as any).endSnapshot('Final corrected text.'));
  await expect(page.locator('.markdown')).toHaveText('Final corrected text.');
 }
});
test('loaded running text is immediate; new letters follow layout and manual scroll is retained',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.locator('.desktop-tabs:visible').waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {TranscriptFollowHarness}=await import('/tests/fixtures/TranscriptFollowHarness.tsx' as string);
  const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(TranscriptFollowHarness));
 });
 const old=page.locator('[data-message-id="old"] .markdown'),scroll=page.locator('.conversation');
 await expect(old).toHaveText('Already received response. '.repeat(30).trim());await expect(old.locator('.stream-glyph')).toHaveCount(0);
 await page.evaluate(()=>(window as any).toggleTranscript());await expect(scroll).toHaveCount(0);await page.evaluate(()=>(window as any).toggleTranscript());
 await expect(old).toHaveText('Already received response. '.repeat(30).trim());await expect(old.locator('.stream-glyph')).toHaveCount(0);
 await page.evaluate(()=>(window as any).appendAnswer());const reply=page.locator('[data-message-id="new"] .markdown');
 await expect.poll(async()=>(await reply.innerText()).length).toBeGreaterThan(50);
 expect((await reply.innerText()).length).toBeLessThan(468);
 const gap=()=>scroll.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight);
 await expect.poll(gap).toBeLessThan(3);
 await scroll.hover();await page.mouse.wheel(0,-220);await expect.poll(gap).toBeGreaterThan(80);
 const top=await scroll.evaluate(el=>el.scrollTop);
 await page.evaluate(()=>(window as any).finishAnswer());await expect(reply).toHaveText('New flowing answer with multiple lines. '.repeat(12).trim(),{timeout:15000});
 expect(await scroll.evaluate(el=>el.scrollTop)).toBeCloseTo(top,0);
 await page.evaluate(()=>(window as any).toggleTranscript());await expect(scroll).toHaveCount(0);await page.evaluate(()=>(window as any).toggleTranscript());
 await expect(reply).toHaveText('New flowing answer with multiple lines. '.repeat(12).trim());await expect(page.locator('.stream-glyph')).toHaveCount(0);
 await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
 await page.evaluate(()=>(window as any).addImageSpace());await expect.poll(gap).toBeLessThan(3);
});

test('first partial answer animates, but reopening an active partial shows its snapshot immediately',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.locator('.desktop-tabs:visible').waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {PartialSnapshotHarness}=await import('/tests/fixtures/TranscriptFollowHarness.tsx' as string);
  const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(PartialSnapshotHarness));
 });
 const text='Partial response already received from the provider. '.repeat(4);
 await page.evaluate(text=>(window as any).setPartial(text),text);
 await expect.poll(async()=>(await page.locator('.markdown').innerText()).length).toBeGreaterThan(0);
 expect((await page.locator('.markdown').innerText()).length).toBeLessThan(text.length);
 await page.evaluate(()=>(window as any).togglePartial());await expect(page.locator('.markdown')).toHaveCount(0);
 await page.evaluate(()=>(window as any).togglePartial());await expect(page.locator('.markdown')).toHaveText(text.trim());await expect(page.locator('.stream-glyph')).toHaveCount(0);
});
