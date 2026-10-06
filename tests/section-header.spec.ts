import {test,expect} from '@playwright/test';
import {newChat} from './chat-navigation';
for(const scale of [60,100,130])test(`main headers stay aligned at ${scale}%`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(scale=>{
  sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
  localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale,textSize:16}));
 },scale);
 await page.goto('http://127.0.0.1:5173');
 const nav=page.locator('.mobile-nav');await nav.getByRole('button',{name:'Chats',exact:true}).click();
 const provider=page.locator('.sidebar .workspace-picker-sidebar select');await expect(provider).toBeVisible();
 const baseline=await page.locator('.sidebar>.chat-list-actions').boundingBox();
 const font=await provider.evaluate(e=>getComputedStyle(e).fontSize);
 const titleX=(await provider.boundingBox())!.x;
 const bellBox=(await page.locator('.chat-list-actions .board-notifications-trigger').boundingBox())!;
 for(const name of ['Settings','Board','Rules','Changelog']){
  await nav.getByRole('button',{name,exact:true}).click();
  const header=page.locator('.workspace>header.chat-header');await expect(header).toBeVisible();
  const box=(await header.boundingBox())!;
  expect(box.y).toBe(baseline!.y);expect(box.height).toBe(baseline!.height);
  const title=header.locator('h1,.header-title>strong');expect(await title.evaluate(e=>getComputedStyle(e).fontSize)).toBe(font);
  expect((await title.boundingBox())!.x).toBe(titleX);
  const bell=(await header.locator('.board-notifications-trigger').boundingBox())!;expect(bell.x).toBe(bellBox.x);expect(bell.y).toBe(bellBox.y);
 }
 await newChat(page);expect(await nav.evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');
 const chatBell=(await page.locator('.chat-header-main .board-notifications-trigger').boundingBox())!;expect(chatBell.x).toBe(bellBox.x);expect(chatBell.y).toBe(bellBox.y);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
