import {expect,type Page} from '@playwright/test';
/** Current navigation: the phone starts on Chats with a bottom bar (Chats, Board, More); wide windows keep the sidebar tabs. */
const tabs=(page:Page)=>page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first();
export async function openSection(page:Page,name:string|RegExp){
  const back=page.getByRole('button',{name:/^(Back to chats|Back to board|К доске|К списку чатов)$/}).filter({visible:true});
  await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible,.chat-header-conversation:visible').first().waitFor();
  if(!await tabs(page).count()&&await back.count())await back.click();
  const navigation=tabs(page),target=navigation.getByRole('button',{name,exact:true});
  if(await target.count()){await target.click();return;}
  await navigation.getByRole('button',{name:/^(More|Ещё)$/}).click();
  await page.getByRole('dialog',{name:/^(More|Ещё)$/}).getByRole('button',{name,exact:true}).click();
}
export async function openChatList(page:Page){await openSection(page,/^(Chats|Чаты)$/);}
export async function newChat(page:Page){
  await openChatList(page);
  const back=page.getByRole('button',{name:/^(Back to chats|Back to board|К доске|К списку чатов|Назад к чатам)$/});
  if(await back.isVisible()&&!await page.locator('.new-chat-button:visible').count())await back.click();
  await page.locator('.new-chat-button:visible').first().click();
  await expect(page.locator('.composer textarea')).toBeVisible();
}
/** Provider selection uses the shared compact picker. */
export async function chooseProvider(page:Page,provider:string){
 const name=({claude:'Claude',codex:'Codex',copilot:'Copilot'} as Record<string,string>)[provider];
 const back=page.getByRole('button',{name:/^(Back to chats|Back to board|К доске|К списку чатов)$/}).filter({visible:true});
 if(await back.count())await back.click();
 const picker=page.locator('.sidebar .provider-picker-trigger:visible').first();await picker.click();await page.getByRole('menuitemradio',{name:new RegExp('^'+name)}).click();
}

export async function chooseProjectFolder(page:Page,label:string,path:string){
  await page.getByRole('button',{name:label,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:label,exact:true});
  await dialog.getByRole('searchbox').fill(path);
  await dialog.getByRole('button',{name:path,exact:true}).click();
}
/** Review is an entry of the conversation's "More actions" menu. */
export const chatMenu=(page:Page)=>page.locator('.chat-header-conversation:visible .chat-menu-button').first();
export async function openReview(page:Page){
  await chatMenu(page).click();
  await page.getByRole('menuitem',{name:'Review',exact:true}).click();
}
