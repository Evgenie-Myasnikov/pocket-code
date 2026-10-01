import {test,expect,type Page} from '@playwright/test';

const otherRoot='C:\\Workspace\\other-project',chatRoot='C:\\Workspace\\chat-project';
const paths=['src/first.ts','src/second.ts','src/third.ts'];
const patch=(name:string)=>`@@ -1,90 +1,90 @@\n${Array.from({length:90},(_,index)=>`-${name} old ${index}\n+${name} new ${index}`).join('\n')}\n`;
function gate(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
type State={calls:URL[];chatCwd:string;delayed?:ReturnType<typeof gate>;delayedFinished:boolean};
async function host(page:Page){
  const state:State={calls:[],chatCwd:chatRoot,delayedFinished:false};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');state.calls.push(url);
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic review PC',roots:[otherRoot,chatRoot],protocol:1,version:'0.14.1'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'review-chat',provider:'claude',summary:'Chat repository test',cwd:state.chatCwd,lastModified:Date.now()}]});
    if(endpoint.includes('/messages'))return route.fulfill({json:{messages:[{id:'reply',role:'assistant',blocks:[{type:'text',text:'Saved review conversation.'}]}],previous:null,next:null}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/review/availability')return route.fulfill({json:{available:true,mode:'working'}});
    if(endpoint==='/review'){
      const file=url.searchParams.get('file')||paths[0];
      if(file===paths[1]&&state.delayed)await state.delayed.promise;
      await route.fulfill({json:{repositoryRoot:url.searchParams.get('cwd'),projectPath:url.searchParams.get('cwd'),current:'feature/mobile-review',base:'main',branches:['main','feature/mobile-review'],files:paths.map(path=>({path,added:90,removed:90,binary:false,untracked:false})),patch:patch(file),binary:false}});
      if(file===paths[1])state.delayedFinished=true;
      return;
    }
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
  return state;
}
const review=(page:Page)=>page.getByRole('dialog',{name:'Review',exact:true});
async function connect(page:Page,language='en',scale=100){
  await page.addInitScript(({language,scale})=>{
    localStorage.setItem('pocket-code-language-v1',language);
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:14}));
  },{language,scale});
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel(language==='ru'?'Адрес компьютера':'Computer address').fill('http://127.0.0.1:4319');
  await page.getByLabel(language==='ru'?'Ключ подключения':'Connection key').fill('test-only-'.repeat(5));
  await page.getByRole('button',{name:language==='ru'?'Подключить компьютер':'Connect computer',exact:true}).click();
  await page.getByRole('button',{name:/Chat repository test/}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect(review(page).locator('.diff-content')).toContainText('src/first.ts new 0');
}

test('Review uses the selected chat repository and keeps comparison options out of the header',async({page})=>{
  const state=await host(page);await page.setViewportSize({width:390,height:844});await connect(page);
  const panel=review(page);await expect(panel).toContainText('chat-project');
  expect(state.calls.filter(url=>url.pathname==='/api/review').every(url=>url.searchParams.get('cwd')===chatRoot)).toBe(true);
  expect(state.calls.some(url=>url.pathname==='/api/review/availability'&&url.searchParams.get('cwd')===chatRoot)).toBe(true);
  await expect(panel.getByRole('button',{name:'Review options',exact:true})).toHaveAttribute('aria-expanded','false');
  await expect(panel.getByLabel('Comparison',{exact:true})).toBeHidden();
  await expect(panel.locator('.review-file-heading')).toHaveCount(3);
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Review options',exact:true})).toHaveAttribute('aria-expanded','true');
  await panel.getByLabel('Comparison',{exact:true}).selectOption('branch');
  await expect(panel.getByLabel('Base branch',{exact:true})).toBeVisible();
  await panel.getByLabel('Base branch',{exact:true}).selectOption('main');
  await expect.poll(()=>state.calls.some(url=>url.pathname==='/api/review'&&url.searchParams.get('mode')==='branch'&&url.searchParams.get('base')==='main')).toBe(true);
});

test('Review reading mode preserves the diff position and draft, and Back restores controls first',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await connect(page);
  await review(page).getByRole('button',{name:'Back to chat',exact:true}).click();
  await page.getByLabel('Message Claude').fill('Keep my review draft');
  await page.getByRole('button',{name:'Review',exact:true}).click();
  const panel=review(page),content=panel.locator('.diff-content');await expect(content).toContainText('src/first.ts new 0');
  await content.evaluate(element=>{element.scrollTop=480;});const before=await content.evaluate(element=>element.scrollTop);
  await panel.getByRole('button',{name:'Reading mode',exact:true}).click();
  const restore=panel.getByRole('button',{name:'Show review controls',exact:true});await expect(restore).toBeVisible();await expect(restore).toBeFocused();
  await expect(panel.getByLabel('Changed files',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Review options',exact:true})).toBeHidden();
  expect(Math.abs(await content.evaluate(element=>element.scrollTop)-before)).toBeLessThanOrEqual(1);
  await page.keyboard.press('Tab');await expect(content).toBeFocused();
  await page.keyboard.press('Tab');await expect(panel.locator('.review-file-heading').first()).toBeFocused();
  const afterKeyboard=await content.evaluate(element=>element.scrollTop);
  await page.keyboard.press('Escape');await expect(panel).toBeVisible();await expect(panel.getByRole('button',{name:'Reading mode',exact:true})).toBeFocused();
  expect(Math.abs(await content.evaluate(element=>element.scrollTop)-afterKeyboard)).toBeLessThanOrEqual(1);
  await panel.getByRole('button',{name:'Reading mode',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));
  await expect(panel.getByRole('button',{name:'Reading mode',exact:true})).toBeVisible();await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Reading mode',exact:true}).click();await restore.click();await expect(panel.getByLabel('Changed files',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.getByRole('button',{name:'Review',exact:true})).toBeFocused();
  await expect(page.getByLabel('Message Claude')).toHaveValue('Keep my review draft');
});

test('late file responses stay inside their own file and cannot reopen a collapsed patch',async({page})=>{
  const state=await host(page);state.delayed=gate();await connect(page);
  const panel=review(page),first=panel.locator('.review-file').nth(0),second=panel.locator('.review-file').nth(1),third=panel.locator('.review-file').nth(2);
  try{
    await first.getByRole('button').click();
    await expect.poll(()=>state.calls.some(url=>url.searchParams.get('file')===paths[1])).toBe(true);
    await second.getByRole('button').click();await expect(third).toContainText('src/third.ts new 0');
    state.delayed.resolve();await expect.poll(()=>state.delayedFinished).toBe(true);
    await expect(second.locator('.diff-table')).toHaveCount(0);await expect(third).not.toContainText('src/second.ts new 0');
  }finally{state.delayed.resolve();}
});

test('Review closes when the selected chat changes its project during history refresh',async({page})=>{
  await page.clock.install();const state=await host(page);await connect(page);state.chatCwd=otherRoot;
  await page.clock.fastForward(15100);await expect(review(page)).toHaveCount(0);
});

test('Review refreshes changed content without losing scroll and keeps options over the full diff',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await connect(page);
  const panel=review(page),content=panel.locator('.diff-content');
  await content.evaluate(element=>{element.scrollTop=240;});
  const before=await content.boundingBox();
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  expect((await content.boundingBox())?.height).toBe(before?.height);
  await panel.getByLabel('Code size',{exact:true}).selectOption('18');
  await page.keyboard.press('Escape');
  await expect(panel.locator('.diff-table').first()).toHaveCSS('font-size','18px');
  expect(await content.evaluate(element=>element.scrollTop)).toBe(240);
  await page.route('**/api/review?*',route=>route.fulfill({json:{files:[{path:paths[0],added:91,removed:90}],current:'feature/mobile-review',base:'main',branches:['main'],patch:patch('updated'),binary:false}}));
  await expect(content).toContainText('updated new 0',{timeout:9000});
  expect(await content.evaluate(element=>element.scrollTop)).toBe(240);
  await panel.getByRole('button',{name:'Back to chat',exact:true}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect(review(page).locator('.diff-table')).toHaveCSS('font-size','18px');
});

test('Review recovers when a selected file is committed and retains the last patch on network failure',async({page})=>{
  await host(page);await connect(page);
  let failed=false;
  await page.route('**/api/review?*',route=>{
    if(failed)return route.fulfill({status:503,json:{error:'Offline'}});
    if(new URL(route.request().url()).searchParams.get('file')===paths[0])return route.fulfill({status:404,json:{error:'This file is not in the current comparison.'}});
    return route.fulfill({json:{files:[{path:paths[1],added:90,removed:90}],current:'feature',base:'main',branches:['main'],patch:patch('remaining'),binary:false}});
  });
  const panel=review(page);
  await expect(panel.locator('.review-file-heading')).toHaveCount(1,{timeout:9000});await expect(panel.locator('.review-file-heading')).toContainText(paths[1]);
  await expect(panel.locator('.diff-content')).toContainText('remaining new 0');
  failed=true;
  await expect(panel.getByRole('alert')).toBeVisible({timeout:9000});
  await expect(panel.locator('.diff-content')).toContainText('remaining new 0');
});

for(const language of ['en','ru'])for(const scale of [60,130])test(`Review fits a 320px phone with ${language} controls at ${scale}% scale`,async({page})=>{
  await host(page);await page.setViewportSize({width:320,height:700});await connect(page,language,scale);
  const panel=review(page),options=panel.getByRole('button',{name:language==='ru'?'Параметры ревью':'Review options',exact:true});
  const inBounds=()=>panel.evaluate(element=>{
    const visible=Array.from(element.querySelectorAll<HTMLElement>('button,select')).filter(item=>item.getClientRects().length);
    return visible.every(item=>{const box=item.getBoundingClientRect();return box.x>=0&&box.right<=innerWidth+1&&box.height>=40&&box.width>=40;})&&document.documentElement.scrollWidth<=innerWidth;
  });
  expect(await inBounds()).toBe(true);await options.click();expect(await inBounds()).toBe(true);
  await panel.getByLabel(language==='ru'?'Сравнение':'Comparison',{exact:true}).selectOption('branch');await expect(panel.getByLabel(language==='ru'?'Базовая ветка':'Base branch',{exact:true})).toBeVisible();expect(await inBounds()).toBe(true);
  await page.screenshot({path:`artifacts/screenshots/review-${language}-${scale}-320.png`,fullPage:true});
  await page.keyboard.press('Escape');
  await panel.getByRole('button',{name:language==='ru'?'Режим чтения':'Reading mode',exact:true}).click();expect(await inBounds()).toBe(true);
});
