import {expect,type Page} from '@playwright/test';
/** Current navigation: the app starts on Board; New is a conversation-list item. */
export async function openChatList(page:Page){
  const navigation=page.locator('.mobile-nav:visible,.desktop-tabs:visible').first();
  await navigation.getByRole('button',{name:/^(Chats|Чаты)$/,exact:true}).click();
}
export async function newChat(page:Page){
  await openChatList(page);
  const back=page.getByRole('button',{name:/^(Back to chats|К списку чатов|Назад к чатам)$/});
  if(await back.isVisible())await back.click();
  await page.getByRole('button',{name:'New',exact:true}).click();
  await expect(page.locator('.composer textarea')).toBeVisible();
}
