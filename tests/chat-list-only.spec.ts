import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('desktop keeps list navigation without search, inbox or grid despite saved grid preference',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.addInitScript(()=>localStorage.setItem('pocket-code-chat-view','grid'));await desktop(page);
 await expect(page.getByRole('button',{name:/Inbox|Входящие/i})).toHaveCount(0);await expect(page.locator('.chat-view-controls,.chat-grid-view,.desktop-chat-grid')).toHaveCount(0);
 await expect(page.getByPlaceholder('Find a chat')).toHaveCount(0);const provider=page.locator('.desktop-rail .provider-picker-trigger');await expect(provider).toHaveCSS('border-top-width','0px');await provider.click();await expect(page.getByRole('menuitemradio',{name:'Claude',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:/claude · Documentation/})).toBeVisible();await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'More actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:/Inbox|Входящие/i})).toHaveCount(0);await page.keyboard.press('Escape');await page.keyboard.press('Control+Alt+u');await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).desktopCalls.some((m:any)=>m.endpoint==='/board-notifications'))).toBe(false);
 await page.reload();await expect(page.getByRole('button',{name:/claude · Interface review/})).toBeVisible();await expect(page.locator('.chat-view-controls,.chat-grid-view')).toHaveCount(0);await page.screenshot({path:'.local/chat-list-only-desktop.png'});
});
