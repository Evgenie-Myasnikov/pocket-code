import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {connectByQr} from './qr-connect';
import {openChatList} from './chat-navigation';

test('desktop chat actions are discoverable and do not switch the conversation or draft',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const rows=page.locator('.desktop-sessions>button'),actions=page.locator('.desktop-sessions .chat-list-action');
 await expect(rows).toHaveCount(2);await rows.first().click();
 const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Synthetic draft to retain');
 const other=actions.nth(1);await rows.nth(1).hover();await expect(other).toHaveCSS('opacity','1');
 await expect(rows.nth(1)).toHaveCSS('padding-right','42px');
 const textRight=await rows.nth(1).locator('strong').evaluate(el=>el.getBoundingClientRect().right);expect(textRight).toBeLessThanOrEqual((await other.boundingBox())!.x);
 const row=await rows.nth(1).boundingBox(),button=await other.boundingBox();expect(button!.x+button!.width).toBeLessThanOrEqual(row!.x+row!.width);expect(button!.y).toBeGreaterThanOrEqual(row!.y);
 await other.click();await expect(page.getByRole('menu',{name:'Chat actions'})).toBeVisible();
 await other.click();await expect(page.getByRole('menu',{name:'Chat actions'})).toHaveCount(0);await other.click();
 await expect(rows.first()).toHaveAttribute('aria-pressed','true');await expect(input).toHaveValue('Synthetic draft to retain');
 await page.keyboard.press('Escape');await expect(other).toBeFocused();
 await page.keyboard.press('Enter');await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await page.getByRole('textbox',{name:'Chat name'}).fill('Synthetic reference notes');await page.getByRole('button',{name:'Rename',exact:true}).click();
 await expect(rows.nth(1)).toContainText('Synthetic reference notes');await expect(input).toHaveValue('Synthetic draft to retain');
 await expect(rows.first()).toHaveAttribute('aria-pressed','true');
 await actions.nth(1).click();await page.getByRole('menuitem',{name:'Delete from Pocket Code'}).click();
 await expect(page.getByRole('dialog',{name:'Delete chat'})).toContainText('Synthetic reference notes');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(rows).toHaveCount(2);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(actions.first()).toHaveCSS('transition-duration','0s');
 await page.screenshot({path:'.local/chat-actions-desktop.png'});
});

test('running chat action keeps deletion unavailable and keyboard focus visible',async({page})=>{
 await page.addInitScript(()=>{(window as any).testRuns=[{id:'synthetic-running',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',startedAt:100,messages:[],approvals:[],revision:1}];});
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const row=page.locator('.desktop-sessions>button[data-running=true]'),action=page.locator('.desktop-sessions .chat-list-action').first();
 await row.focus();await page.keyboard.press('Tab');await expect(action).toBeFocused();await expect(action).toHaveCSS('opacity','1');
 await page.keyboard.press('Enter');await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();
 await expect(page.getByRole('menuitem',{name:'Rename',exact:true})).toBeEnabled();await page.keyboard.press('Escape');await expect(action).toBeFocused();
});

for(const pending of [false,true])test(`phone exposes a separate touch action without opening the chat (approval=${pending})`,async({page})=>{
 if(pending)await page.route('**/api/jobs?*',route=>route.fulfill({json:[{id:'synthetic-approval',provider:'claude',sessionId:'e91de51c-70e1-4373-a7b9-21a294c6ab00',cwd:'C:\\Demo\\Atlas',status:'running',startedAt:100,messages:[],approvals:[{id:'approval',tool:'Write',input:{file_path:'synthetic.txt'}}],revision:1}]}));
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 await connectByQr(page);await openChatList(page);
 const row=page.locator('.sidebar .session-row').first(),action=page.locator('.sidebar .chat-list-action').first();
 await expect(row).toBeVisible();await expect(action).toHaveCSS('opacity','1');
 if(pending)await expect(row.locator('.run-status.run-status-needs_input')).toHaveCount(1);
 const bounds=await action.boundingBox();expect(bounds!.width).toBeGreaterThanOrEqual(44);expect(bounds!.height).toBeGreaterThanOrEqual(44);
 await action.click();await expect(page.getByRole('menu',{name:'Chat actions'})).toBeVisible();await expect(row).toBeVisible();
 if(pending)await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();
 await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Rename chat'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(row).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(pending){await row.click({button:'right'});await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();await page.keyboard.press('Escape');}
 else {await page.screenshot({path:'.local/chat-actions-phone.png'});await row.click();await expect(page.locator('.composer textarea')).toBeVisible();}
});
