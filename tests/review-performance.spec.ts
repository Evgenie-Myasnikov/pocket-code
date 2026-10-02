import {connectByQr} from './qr-connect';
import {test,expect} from '@playwright/test';

for(const layout of ['unified','split'])test(`large ${layout} diff keeps a bounded DOM and reaches the final line`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(({layout})=>{localStorage.setItem('pocket-code-diff-layout',layout);},{layout});
  const patch='@@ -1,10000 +1,10000 @@ '+ 'long context '.repeat(30)+'\r\n'+Array.from({length:10000},(_,i)=>`-old ${i}${i===0?'x'.repeat(180):''}\r\n+new ${i}${i===9999?'x'.repeat(240):''}`).join('\r\n');
  await page.route('**/api/review/availability?*',route=>route.fulfill({json:{available:true,mode:'working'}}));
  await page.route('**/api/review?*',route=>route.fulfill({json:{files:[{path:'src/large.ts',added:10000,removed:10000,binary:false,untracked:false}],current:'feature',base:'main',branches:['main'],patch,binary:false}}));
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await page.getByRole('button',{name:/Интеграционный тест/}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Review',exact:true}),content=panel.locator('.diff-content');
  await expect(content).toContainText('old 0');
  expect(await panel.locator('tr').count()).toBeLessThan(120);
  const width=await panel.locator('.diff-table').evaluate(element=>element.getBoundingClientRect().width);
  const divider=layout==='split'?await panel.locator('tr.diff-line:not(.hunk)').first().locator('td').nth(2).evaluate(element=>element.getBoundingClientRect().left):0;
  await content.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect(content).toContainText('new 9999');
  expect(await panel.locator('tr').count()).toBeLessThan(120);
  expect(await panel.locator('.diff-table').evaluate(element=>element.getBoundingClientRect().width)).toBeCloseTo(width,0);
  if(layout==='split')expect(await panel.locator('tr.diff-line:not(.hunk)').first().locator('td').nth(2).evaluate(element=>element.getBoundingClientRect().left)).toBeCloseTo(divider,0);
  expect(await panel.locator('tr.diff-line').evaluateAll(elements=>Math.max(...elements.map(element=>element.getBoundingClientRect().height)))).toBeLessThan(26);
  await panel.getByRole('button',{name:'Reading mode',exact:true}).click();
  await expect(content).toContainText('new 9999');
  // At the end, a taller reading viewport clamps the offset to the new bottom.
  expect(await content.evaluate(element=>Math.abs(element.scrollHeight-element.scrollTop-element.clientHeight))).toBeLessThan(3);
  await page.keyboard.press('Escape');
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await panel.getByLabel('Code size',{exact:true}).selectOption('24');await page.keyboard.press('Escape');
  await content.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect(content).toContainText('new 9999');
  await expect(panel.locator('.diff-table')).toHaveCSS('font-size','24px');
  expect(await panel.locator('tr').count()).toBeLessThan(120);
  await content.evaluate(element=>{element.scrollTop=0;});await expect(content).toContainText('old 0');
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await panel.getByLabel('Fit diff to width',{exact:true}).check();await page.keyboard.press('Escape');
  await expect.poll(()=>content.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(2);
  await content.evaluate(element=>{element.scrollTop=element.scrollHeight;});await expect(content).toContainText('new 9999');
  expect(await panel.locator('tr').count()).toBeLessThan(1000);
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await panel.getByLabel('Code size',{exact:true}).selectOption('4');await page.keyboard.press('Escape');
  await expect(panel.locator('.diff-table')).toHaveCSS('font-size','4px');
  await expect.poll(()=>content.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(2);
  await content.evaluate(element=>{element.scrollTop=element.scrollHeight;});await expect(content).toContainText('new 9999');
  expect(await page.evaluate(()=>localStorage.getItem('pocket-code-diff-fit-width'))).toBe('true');
  await content.evaluate(element=>{element.scrollTop=0;});await expect(content).toContainText('old 0');
  await page.screenshot({path:`artifacts/screenshots/diff-fit-${layout}.png`});
});

for(const layout of ['unified','split'])test(`${layout} fallback emoji and CJK glyphs fit stable columns at both code sizes`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(({layout})=>{localStorage.setItem('pocket-code-diff-layout',layout);localStorage.setItem('pocket-code-diff-font-size','14');},{layout});
  const files=['emoji.md','cjk.md'];
  const patch=(file:string)=>'@@ -1,500 +1,500 @@\n'+Array.from({length:500},(_,i)=>{
    const marker=i===0||i===499?(file==='emoji.md'?'\u2705'.repeat(i===0?50:60):'\u65e5\u672c\u8a9e'.repeat(i===0?35:40)):'value';
    return `-old ${i} ${marker}\n+new ${i} ${marker}`;
  }).join('\n');
  await page.route('**/api/review/availability?*',route=>route.fulfill({json:{available:true,mode:'working'}}));
  await page.route('**/api/review?*',route=>{const file=new URL(route.request().url()).searchParams.get('file');return route.fulfill({json:{files:files.map(path=>({path,added:500,removed:500})),current:'feature',base:'main',branches:['main'],patch:file?patch(file):'',binary:false}});});
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await page.getByRole('button',{name:/Интеграционный тест/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Review',exact:true}),content=panel.locator('.diff-content');
  const overflow=()=>panel.locator('.diff-table pre').evaluateAll(elements=>Math.max(0,...elements.map(element=>{
    const range=document.createRange();range.selectNodeContents(element);
    return range.getBoundingClientRect().right-element.parentElement!.getBoundingClientRect().right+7;
  })));
  for(const size of ['14','24']){
    await panel.getByRole('button',{name:'Review options',exact:true}).click();await panel.getByLabel('Code size',{exact:true}).selectOption(size);await page.keyboard.press('Escape');
    for(const file of files){
      for(const name of files){const row=panel.locator('.review-file').filter({has:page.locator('.review-file-heading strong',{hasText:name})});const button=row.getByRole('button');if((await button.getAttribute('aria-expanded')==='true')!==(name===file))await button.click();}
      await content.evaluate(element=>{element.scrollTop=0;});await expect(content).toContainText('old 0');
      await expect.poll(overflow).toBeLessThanOrEqual(1);
      const width=await panel.locator('.diff-table').evaluate(element=>element.getBoundingClientRect().width);
      const divider=layout==='split'?await panel.locator('tr.diff-line:not(.hunk)').first().locator('td').nth(2).evaluate(element=>element.getBoundingClientRect().left):0;
      await content.evaluate(element=>{element.scrollTop=element.scrollHeight;});await expect(content).toContainText('new 499');
      await expect.poll(overflow).toBeLessThanOrEqual(1);
      expect(await panel.locator('.diff-table').evaluate(element=>element.getBoundingClientRect().width)).toBeCloseTo(width,0);
      if(layout==='split')expect(await panel.locator('tr.diff-line:not(.hunk)').first().locator('td').nth(2).evaluate(element=>element.getBoundingClientRect().left)).toBeCloseTo(divider,0);
      expect(await panel.locator('tr').count()).toBeLessThan(120);
    }
  }
});
