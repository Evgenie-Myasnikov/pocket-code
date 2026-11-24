import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('ready chat actions retain the draft, export Markdown and survive streaming',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.locator('.desktop-sessions button').first().click();
 const message=page.locator('[data-message-id="answer"]');
 await expect(message.getByRole('button',{name:'Quote in reply'})).toBeVisible();
 const input=page.getByLabel('Message Claude',{exact:true});await input.fill('Existing draft');
 await message.getByRole('button',{name:'Quote in reply'}).click();await expect(input).toBeFocused();await expect(input).toHaveValue(/Existing draft\n\n> ## Interface review/);
 const download=page.waitForEvent('download');await message.getByRole('button',{name:'Download message Markdown'}).click();expect((await download).suggestedFilename()).toBe('message.md');
 await input.fill('A synthetic follow-up');await page.locator('.send-button').click();await expect(page.locator('.partial-message,.message').filter({hasText:'Working on your request'}).first()).toBeVisible();
 expect(errors).toEqual([]);await page.screenshot({path:'.local/ready-chat-dark.png'});
});

