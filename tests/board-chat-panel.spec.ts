import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

const binding=(page:Page)=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-board-conversation-v1:')).map(key=>JSON.parse(localStorage.getItem(key)!))[0]);
async function openBoardChat(page:Page){
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 const card=page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})});if(await card.count())await card.click();
 await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.locator('.desktop-chat-host')).toBeVisible();
}

test('the board chat panel can be closed, reopened on the same conversation and replaced with a new chat from visible buttons',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await openBoardChat(page);
 const host=page.locator('.desktop-chat-host'),close=host.getByRole('button',{name:'Close board chat',exact:true}),fresh=host.getByRole('button',{name:'New board chat',exact:true});
 await expect(close).toBeVisible();await expect(fresh).toBeVisible();await expect(host.locator('.chat-menu-button')).toHaveCount(0);
 await page.getByLabel('Message Claude',{exact:true}).fill('Synthetic board discussion');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(async()=>(await binding(page))?.sessionId).toBe('alpha');const first=await binding(page);
 await page.screenshot({path:'.local/board-chat-panel.png'});
 // Close: the board takes the whole width again and keeps its canvas.
 await page.evaluate(()=>(window as any).keptCanvas=document.querySelector('.whiteboard-viewport'));await close.click();
 await expect(page.locator('.desktop-board-chat')).toHaveCount(0);await expect(host).toHaveCount(0);await expect(page.locator('.whiteboard-viewport')).toBeVisible();expect(await page.evaluate(()=>(window as any).keptCanvas===document.querySelector('.whiteboard-viewport'))).toBe(true);
 // Reopen: the same conversation, not a second one.
 await openBoardChat(page);expect((await binding(page)).generation).toBe(first.generation);expect((await binding(page)).sessionId).toBe('alpha');
 // New chat from the visible button.
 await page.locator('.desktop-chat-host').getByRole('button',{name:'New board chat',exact:true}).click();await expect.poll(async()=>(await binding(page)).generation).not.toBe(first.generation);expect((await binding(page)).sessionId).toBeUndefined();await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('Discuss this board with me.');
});
