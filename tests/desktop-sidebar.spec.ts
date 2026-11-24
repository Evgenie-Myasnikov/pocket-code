import {test,expect} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';

test('sidebar collapses without replacing the chat, keeps its preference and moves utilities into Settings',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);const rail=page.locator('.desktop-rail');
 await expect(rail.locator('.desktop-shortcuts-button,.desktop-connection-status')).toHaveCount(0);
 await rail.getByRole('button',{name:/claude · Interface review/}).click();await page.getByLabel('Message Claude',{exact:true}).fill('Preserve this synthetic draft');await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await expect(rail).toHaveClass(/rail-collapsed/);await expect.poll(async()=>(await rail.boundingBox())!.width).toBeLessThanOrEqual(72);await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('Preserve this synthetic draft');await page.screenshot({path:'.local/desktop-sidebar-collapsed.png'});
 await expect(rail.getByRole('button',{name:'Find a chat',exact:true})).toHaveCount(0);await rail.getByRole('button',{name:'Expand sidebar',exact:true}).click();await expect(rail.getByPlaceholder('Find a chat')).toHaveCount(0);await expect(rail.getByRole('button',{name:/claude · Interface review/})).toBeVisible();
 await expect(rail.getByRole('button',{name:'More',exact:true})).toHaveCount(0);for(const name of ['Rules','Changelog','Settings'])await expect(rail.getByRole('button',{name,exact:true})).toBeVisible();
 await desktopSection(page,'Rules');await expect(page.locator('.desktop-project')).toBeVisible();await desktopSection(page,'Changelog');await expect(page.locator('.desktop-project')).toBeVisible();await desktopSection(page,'Settings');await page.locator('[data-settings-category="chat"]').click();await page.getByRole('button',{name:'Keyboard shortcuts',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Keyboard shortcuts',exact:true});await expect(dialog).toBeVisible();await expect(dialog).not.toContainText('Ctrl+Alt+U');await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Control+/');await expect(dialog).toBeVisible();await page.keyboard.press('Escape');
 await rail.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('Preserve this synthetic draft');await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.reload();await expect(rail).toHaveClass(/rail-collapsed/);await rail.getByRole('button',{name:'Expand sidebar',exact:true}).click();await expect(rail.getByRole('button',{name:/claude · Interface review/})).toBeVisible();await page.screenshot({path:'.local/desktop-sidebar-expanded.png'});
});

test('New chat stays in the icon rail and recent conversations reopen with the library collapsed',async({page})=>{
  await page.setViewportSize({width:1280,height:824});
  await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','ru'));
  await desktop(page);
  const rail=page.locator('.desktop-rail'),nav=rail.getByRole('navigation',{name:'Навигация'});
  const start=nav.getByRole('button',{name:'Новый чат',exact:true});
  await expect(start).toBeVisible();
  await expect(start).toHaveAttribute('aria-keyshortcuts','Control+N');
  await expect(rail.locator('.rail-chat-folder')).toHaveCount(0);await expect(rail.locator('.desktop-sessions>button').first()).toBeVisible();
  await nav.getByRole('button',{name:'Задачи',exact:true}).click();
  await expect(start).toBeVisible();
  await nav.getByRole('button',{name:'Свернуть панель',exact:true}).click();
  await expect(start).toBeVisible();
  await nav.getByRole('button',{name:'claude · Interface review',exact:true}).click();
  await expect(page.locator('.composer textarea')).toBeVisible();
  if(process.env.POCKET_RAIL_PREVIEW)await page.screenshot({path:process.env.POCKET_RAIL_PREVIEW});
  await start.click();
  await expect(page.locator('.composer textarea')).toBeVisible();
  await expect(nav.getByRole('button',{name:'Развернуть панель',exact:true})).toBeVisible();
});
