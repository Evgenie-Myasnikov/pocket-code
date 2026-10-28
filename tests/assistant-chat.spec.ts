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
 await input.fill('A synthetic follow-up');await page.locator('.send-button').click();await page.getByRole('button',{name:/Finished on PC/}).click();await expect(page.locator('.partial-message,.message').filter({hasText:'Working on your request'}).first()).toBeVisible();
 expect(errors).toEqual([]);await page.screenshot({path:'.local/ready-chat-dark.png'});
});

test('compact sidebar filters projects and restores recent chats without remounting a draft',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();const input=page.getByLabel('Message Claude',{exact:true});await input.fill('Keep this draft');
 const projects=page.locator('.desktop-project-links');await projects.getByRole('button',{name:'Garden',exact:true}).click();await expect(page.locator('.desktop-sessions button')).toHaveCount(1);await expect(page.locator('.desktop-sessions')).toContainText('Documentation');await expect(input).toHaveValue('Keep this draft');
 await projects.getByRole('button',{name:'Garden',exact:true}).click();await expect(page.locator('.desktop-sessions button')).toHaveCount(2);
 await page.screenshot({path:'.local/ready-sidebar.png'});
});

test('reduced motion uses the static theme background',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await desktop(page);await page.locator('.desktop-sessions button').first().click();await expect(page.locator('.chat-atmosphere')).toBeAttached();await expect(page.locator('.chat-atmosphere canvas')).toHaveCount(0);
});

test('start atmosphere mounts only in the visible chat and fits the light theme',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'light',palette:'neutral',scale:100,textSize:14})));await desktop(page);await page.locator('.desktop-rail').getByRole('button',{name:'New chat',exact:true}).click();await expect(page.locator('.chat-atmosphere canvas')).toBeAttached();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-empty','true');await page.setViewportSize({width:1440,height:900});await expect.poll(()=>page.locator('.chat-atmosphere canvas').evaluate((el:HTMLCanvasElement)=>el.width)).toBeGreaterThan(900);expect(await page.locator('.chat-atmosphere canvas').evaluate((el:HTMLCanvasElement)=>el.getContext('webgl2')?.getError()??0)).toBe(0);await page.screenshot({path:'.local/ready-chat-light.png'});
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await expect(page.locator('.chat-atmosphere canvas')).toHaveCount(0);expect(errors).toEqual([]);
});
