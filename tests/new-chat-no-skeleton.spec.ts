import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('sending the first message of a new chat never flashes the history placeholder over it',async({page})=>{
 await desktop(page);
 await page.getByRole('button',{name:'New chat',exact:true}).click();
 // Watch for the placeholder for the whole open: one frame of it is the jump the person saw.
 await page.evaluate(()=>{(window as any).skeletonSeen=0;new MutationObserver(()=>{if(document.querySelector('.chat-history-skeleton'))(window as any).skeletonSeen++;}).observe(document.body,{childList:true,subtree:true});});
 const field=page.getByLabel('Message Claude',{exact:true});await field.click();await page.keyboard.type('Explain the layout.');
 await page.keyboard.press('Enter');
 await expect(page.locator('.conversation-inner')).toContainText('Working on your request');
 await page.waitForTimeout(1500);
 expect(await page.evaluate(()=>(window as any).skeletonSeen)).toBe(0);
});
