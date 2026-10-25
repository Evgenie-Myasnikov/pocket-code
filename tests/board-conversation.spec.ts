import {test,expect,type Page} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';
async function boardChat(page:Page){
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 const button=page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})});if(await button.count())await button.click();
 await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.locator('.desktop-chat-host')).toBeVisible();
}
const binding=(page:Page)=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-board-conversation-v1:')).map(key=>JSON.parse(localStorage.getItem(key)!))[0]);
test('desktop board chat survives navigation and reload until New board chat is explicitly selected',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await boardChat(page);
 await page.getByLabel('Message Claude',{exact:true}).fill('Synthetic board discussion');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(async()=>(await binding(page))?.sessionId).toBe('alpha');const first=await binding(page);
 await desktopSection(page,'Changelog');await boardChat(page);expect((await binding(page)).generation).toBe(first.generation);await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('');
 await page.reload();await expect(page.locator('.desktop-rail')).toBeVisible();await boardChat(page);expect((await binding(page)).sessionId).toBe('alpha');await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'New board chat',exact:true}).click();await expect.poll(async()=>(await binding(page)).generation).not.toBe(first.generation);expect((await binding(page)).sessionId).toBeUndefined();await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('Discuss this board with me.');
 await page.reload();await expect(page.locator('.desktop-rail')).toBeVisible();await boardChat(page);expect((await binding(page)).sessionId).toBeUndefined();
});
