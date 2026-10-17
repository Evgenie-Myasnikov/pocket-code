import {test,expect} from '@playwright/test';
import {newChat,openSection} from './chat-navigation';
for(const scale of [60,100,130])test(`main headers stay aligned at ${scale}%`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(scale=>{
  sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
  localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale,textSize:16}));
 },scale);
 await page.goto('http://127.0.0.1:5173');
 // The phone starts on Chats: an h1 title, a labelled New chat action and provider chips instead of a select.
 const title=page.locator('.sidebar>.chat-list-actions>h1');await expect(title).toHaveText('Chats');
 await expect(page.locator('.sidebar .workspace-picker-sidebar')).toHaveCount(0);await expect(page.locator('.provider-chips:visible').getByRole('button',{name:'Claude'})).toHaveAttribute('aria-pressed','true');
 const newButton=(await page.getByRole('button',{name:'New chat',exact:true}).boundingBox())!;expect(newButton.height).toBeGreaterThanOrEqual(48);
 const baseline=await page.locator('.sidebar>.chat-list-actions').boundingBox();
 const font=await title.evaluate(e=>getComputedStyle(e).fontSize);
 const titleX=(await title.boundingBox())!.x;
 for(const name of ['Settings','Board','Rules','Changelog']){
  await openSection(page,name);
  const header=page.locator('.workspace>header.chat-header');await expect(header).toBeVisible();
  const box=(await header.boundingBox())!;
  expect(box.y).toBe(baseline!.y);expect(box.height).toBe(baseline!.height);
  const heading=header.getByRole('heading',{level:1});expect(await heading.evaluate(e=>getComputedStyle(e).fontSize)).toBe(font);
  expect((await heading.boundingBox())!.x).toBe(titleX);
  // The inbox lives in the bottom bar on root screens, never in a second header copy.
  await expect(header.locator('.board-notifications-trigger')).toHaveCount(0);await expect(page.locator('.board-notifications-trigger:visible')).toHaveCount(1);
 }
 await newChat(page);await expect(page.locator('.mobile-tabbar')).toHaveCount(0);await expect(page.locator('.mobile-menu-button')).toHaveCount(0);
 await expect(page.locator('.chat-header-conversation').getByRole('heading',{level:1})).toBeVisible();
 await expect(page.locator('.chat-header-main .board-notifications-trigger')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
