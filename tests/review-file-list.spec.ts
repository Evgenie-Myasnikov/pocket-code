import {connectByQr} from './qr-connect';
import {test,expect} from '@playwright/test';
test('review scrolls through collapsible files and filters detected extensions',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const files=['src/first.ts','src/second.ts','images/logo.png'];const calls:string[]=[];
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  if(p==='/api/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],protocol:1,version:'0.19.8'}});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',available:true}]});
  if(p==='/api/sessions')return route.fulfill({json:[{sessionId:'chat',summary:'Review fixture',cwd:'C:\\Fixture',lastModified:1}]});
  if(p.endsWith('/messages'))return route.fulfill({json:{messages:[],previous:null,next:null}});
  if(p==='/api/jobs')return route.fulfill({json:[]});
  if(p==='/api/review/availability')return route.fulfill({json:{available:true,mode:'working'}});
  if(p==='/api/review'){const file=url.searchParams.get('file');if(file)calls.push(file);return route.fulfill({json:{files:files.map(path=>({path,added:2,removed:1,binary:path.endsWith('.png')})),current:'main',base:'main',branches:['main'],binary:file?.endsWith('.png'),patch:file?'@@ -1 +1,2 @@\n-old\n+'+file+' updated\n+done':''}});}
  return route.fulfill({status:404,json:{error:'Fixture endpoint'}});
 });
 await page.goto('http://127.0.0.1:5173');await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await page.getByRole('button',{name:/Review fixture/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Review',exact:true});await expect(panel.locator('.review-file')).toHaveCount(3);await expect(panel).toContainText('src/second.ts updated');
 await expect(panel.locator('.review-filebar select')).toHaveCount(0);
 const first=panel.locator('.review-file').first();await first.getByRole('button').click();await expect(first.getByRole('button')).toHaveAttribute('aria-expanded','false');await expect(first.locator('.diff-table')).toHaveCount(0);
 await panel.getByRole('button',{name:'Review options',exact:true}).click();await panel.getByLabel('.png',{exact:true}).uncheck();await page.keyboard.press('Escape');await expect(panel.locator('.review-file')).toHaveCount(2);await expect(panel).not.toContainText('images/logo.png');
 await first.getByRole('button').click();await expect(first).toContainText('src/first.ts updated');
 await page.screenshot({path:'artifacts/screenshots/review-file-list.png',fullPage:true});
 expect(calls).toContain('src/second.ts');
});

test('split gutters remain fixed across unequal files and layout modes are visible',async({page})=>{
 await page.setViewportSize({width:1600,height:1000});
 await page.route('**/api/review/availability?*',route=>route.fulfill({json:{available:true,mode:'working'}}));
 await page.route('**/api/review?*',route=>{const file=new URL(route.request().url()).searchParams.get('file');return route.fulfill({json:{files:['short.ts','long.ts'].map(path=>({path,added:1,removed:0})),current:'main',base:'main',branches:['main'],binary:false,patch:file?'@@ -1 +1,2 @@\n context\n+'+(file==='short.ts'?'short':'a longer synthetic example for the other file'):''}});});
 await page.goto('http://127.0.0.1:5173');await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await page.getByRole('button',{name:/Интеграционный тест/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Review',exact:true});await panel.getByRole('button',{name:'Split',exact:true}).click();await expect(panel.locator('.diff-table.split')).toHaveCount(2);
 await expect(panel).toContainText('a longer synthetic example');
 const positions=await panel.locator('.diff-table.split').evaluateAll(tables=>tables.map(table=>{const cells=table.querySelector('tr:not(.hunk):not(.diff-spacer)')!.children;return {gutter:cells[0].getBoundingClientRect().width,right:cells[2].getBoundingClientRect().left,left:cells[1].getBoundingClientRect().width,other:cells[3].getBoundingClientRect().width};}));
 expect(positions[0].right).toBeCloseTo(positions[1].right,0);for(const p of positions){expect(p.gutter).toBeLessThan(90);expect(p.left).toBeCloseTo(p.other,0);}
 await panel.getByRole('button',{name:'Unified',exact:true}).click();await expect(panel.locator('.diff-table.unified')).toHaveCount(2);
 expect(await page.evaluate(()=>localStorage.getItem('pocket-code-diff-layout'))).toBe('unified');
 await page.screenshot({path:'artifacts/screenshots/diff-alignment-unified.png'});
});
test('new files fill the width in split mode; modified files support inline replacements',async({page})=>{
 await page.setViewportSize({width:1400,height:900});
 await page.route('**/api/review/availability?*',route=>route.fulfill({json:{available:true,mode:'working'}}));
 await page.route('**/api/review?*',route=>{const file=new URL(route.request().url()).searchParams.get('file');return route.fulfill({json:{files:['new.ts','changed.ts'].map(path=>({path,added:2,removed:path==='new.ts'?0:2})),current:'main',branches:['main'],binary:false,patch:file==='new.ts'?'@@ -0,0 +1,2 @@\n+new file one\n+new file two':file?'@@ -1,3 +1,3 @@\n context\n-old one\n-old two\n+new one\n+new two':''}});});
 await page.goto('http://127.0.0.1:5173');await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await page.getByRole('button',{name:/Интеграционный тест/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Review',exact:true});await panel.getByRole('button',{name:'Split',exact:true}).click();
 const added=panel.locator('.review-file').filter({hasText:'new.ts'}),changed=panel.locator('.review-file').filter({hasText:'changed.ts'});
 await expect(added.locator('.diff-table.single-file')).toBeVisible();await expect(changed.locator('.diff-table.split')).toBeVisible();
 const offset=await added.locator('pre').first().evaluate(el=>el.getBoundingClientRect().left-el.closest('table')!.getBoundingClientRect().left);expect(offset).toBeLessThan(100);
 await panel.getByRole('button',{name:'Unified',exact:true}).click();await expect(changed.locator('.diff-table.unified')).toBeVisible();
 expect(await changed.locator('pre').allTextContents()).toEqual([' context','-old one','-old two','+new one','+new two']);
 await panel.getByRole('button',{name:'Split',exact:true}).click();await expect(added.locator('.diff-table.single-file')).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/diff-new-file-width.png'});
});
