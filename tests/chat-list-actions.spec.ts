import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {connectByQr} from './qr-connect';
import {openChatList} from './chat-navigation';

test('a muted conversation stays identifiable when reopening the library',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','ru');
   localStorage.setItem('pocket-desktop-rail-width','390');
 });
 await page.setViewportSize({width:1280,height:900});await desktop(page);
 await page.addInitScript(()=>{
   (window as any).chatChanges={'claude:alpha':{title:'Проверка каталога'},'claude:beta':{title:'Обновление справочника'}};
 });
 const list=page.locator('.desktop-session-groups');
 const bells=list.getByRole('button',{name:'Уведомления чата',exact:true});
 await list.locator('.desktop-sessions>button').nth(1).hover();await bells.nth(1).click();await expect(bells.nth(1)).toHaveAttribute('aria-pressed','false');
 await page.reload();await expect(bells.nth(1)).toHaveAttribute('aria-pressed','false');await expect(bells.first()).toHaveAttribute('aria-pressed','true');
 await list.locator('.desktop-sessions>button').nth(1).hover();await list.getByRole('button',{name:'Действия чата',exact:true}).nth(1).click();
 const menu=page.getByRole('menu',{name:'Действия чата'});await expect(menu.getByRole('menuitem',{name:'Включить уведомления'})).toBeVisible();
 if(process.env.POCKET_CHAT_NOTIFICATION_PREVIEW){
   await page.evaluate(()=>document.fonts.ready.then(()=>true));
   const a=(await page.locator('.desktop-library>.desktop-list-caption').boundingBox())!,b=(await menu.boundingBox())!;
   const x=Math.max(0,Math.min(a.x,b.x)-8),y=Math.max(0,a.y-8);
   await page.screenshot({path:process.env.POCKET_CHAT_NOTIFICATION_PREVIEW,animations:'disabled',clip:{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x+8,height:b.y+b.height-y+10}});
 }
});

test('desktop chat actions are discoverable and do not switch the conversation or draft',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const rows=page.locator('.desktop-sessions>button'),actions=page.locator('.desktop-sessions .chat-list-action');
 await expect(rows).toHaveCount(2);await rows.first().click();
 const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Synthetic draft to retain');
 const other=actions.nth(1);await rows.nth(1).hover();await expect(other).toHaveCSS('opacity','1');
 const otherBell=page.getByRole('button',{name:'Chat notifications',exact:true}).nth(1);
 const textRight=await rows.nth(1).locator('strong').evaluate(el=>el.getBoundingClientRect().right);expect(textRight).toBeLessThanOrEqual((await otherBell.boundingBox())!.x);
 await otherBell.click();await expect(otherBell).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Chat notifications',exact:true}).first()).toHaveAttribute('aria-pressed','true');
 await expect(input).toHaveValue('Synthetic draft to retain');await expect(rows.first()).toHaveAttribute('aria-pressed','true');
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
 const bell=page.getByRole('button',{name:'Chat notifications',exact:true}).first();
 await row.focus();await page.keyboard.press('Tab');await expect(bell).toBeFocused();await page.keyboard.press('Space');await expect(bell).toHaveAttribute('aria-pressed','false');
 await expect(row).toHaveAttribute('data-running','true');await page.keyboard.press('Tab');await expect(action).toBeFocused();await expect(action).toHaveCSS('opacity','1');
 await page.keyboard.press('Enter');await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();
 await expect(page.getByRole('menuitem',{name:'Rename',exact:true})).toBeEnabled();
 await page.getByRole('menuitem',{name:'Unmute notifications'}).click();await expect(bell).toHaveAttribute('aria-pressed','true');await expect(action).toBeFocused();
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
 await page.getByRole('menuitem',{name:'Mute notifications'}).click();
 const bell=page.locator('.sidebar .chat-mute-action').first();await expect(bell).toHaveAttribute('aria-pressed','false');
 await expect(row).toBeVisible();await action.click();await expect(page.getByRole('menuitem',{name:'Unmute notifications'})).toBeVisible();
 if(pending)await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();
 await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Rename chat'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(row).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(pending){await row.click({button:'right'});await expect(page.getByRole('menuitem',{name:'Delete from Pocket Code'})).toBeDisabled();await page.keyboard.press('Escape');}
 else {await page.screenshot({path:'.local/chat-actions-phone.png'});await row.click();await expect(page.locator('.composer textarea')).toBeVisible();}
});
