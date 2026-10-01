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
 await page.goto('http://127.0.0.1:5173');await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');await page.getByLabel('Connection key').fill('test-only-'.repeat(5));await page.getByRole('button',{name:'Connect computer',exact:true}).click();await page.getByRole('button',{name:/Review fixture/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
 const panel=page.getByRole('dialog',{name:'Review',exact:true});await expect(panel.locator('.review-file')).toHaveCount(3);await expect(panel).toContainText('src/second.ts updated');
 await expect(panel.locator('.review-filebar select')).toHaveCount(0);
 const first=panel.locator('.review-file').first();await first.getByRole('button').click();await expect(first.getByRole('button')).toHaveAttribute('aria-expanded','false');await expect(first.locator('.diff-table')).toHaveCount(0);
 await panel.getByRole('button',{name:'Review options',exact:true}).click();await panel.getByLabel('.png',{exact:true}).uncheck();await page.keyboard.press('Escape');await expect(panel.locator('.review-file')).toHaveCount(2);await expect(panel).not.toContainText('images/logo.png');
 await first.getByRole('button').click();await expect(first).toContainText('src/first.ts updated');
 await page.screenshot({path:'artifacts/screenshots/review-file-list.png',fullPage:true});
 expect(calls).toContain('src/second.ts');
});
