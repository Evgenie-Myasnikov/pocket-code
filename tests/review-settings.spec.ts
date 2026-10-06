import {openChatList,newChat} from './chat-navigation';
import {connectByQr} from './qr-connect';
import {test,expect} from '@playwright/test';
test('Review opens on the right and preserves the draft; smaller settings survive reload',async({page})=>{
  await page.route('**/api/review/availability?*',r=>r.fulfill({json:{available:true,mode:'working'}}));
  await page.route('**/api/review?*',r=>r.fulfill({json:{files:[{path:'src/example.ts',added:1,removed:1,binary:false,untracked:false}],current:'feature',base:'main',branches:['main','feature'],patch:'@@ -1 +1 @@\n-old value\n+new value\n',binary:false}}));
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:/Интеграционный тест/}).click();await page.getByLabel('Message Claude').fill('Keep this draft');
  await page.getByRole('button',{name:'Review',exact:true}).click();await expect(page.getByRole('dialog',{name:'Review'})).toBeVisible();await expect(page.getByText(/^-?old value$/)).toBeVisible();await expect(page.getByText(/^\+?new value$/)).toBeVisible();
  await page.screenshot({path:'artifacts/screenshots/review-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Back to chat',exact:true}).click();await expect(page.getByLabel('Message Claude')).toHaveValue('Keep this draft');
  await page.getByLabel('Claude model').selectOption('sonnet');
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Appearance & language',exact:true}).click();
  await page.getByLabel('Chat text size',{exact:true}).fill('8');await page.getByLabel('Interface scale',{exact:true}).fill('60');
  await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Appearance & language',exact:true}).click();
  await expect(page.getByLabel('Chat text size',{exact:true})).toHaveValue('8');await expect(page.getByLabel('Interface scale',{exact:true})).toHaveValue('60');
  await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();await page.getByRole('button',{name:/Интеграционный тест/}).click();await expect(page.getByLabel('Claude model')).toHaveValue('sonnet');
});
