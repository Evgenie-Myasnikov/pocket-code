import {test,expect} from '@playwright/test';
for(const width of [320,390])test(`bottom bar starts on Chats, hides inside a conversation and keeps the draft at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)})));
 await page.goto('http://127.0.0.1:5173');
 const bar=page.locator('.mobile-tabbar');
 await expect(bar).toBeVisible();await expect(page.locator('.mobile-menu-button')).toHaveCount(0);
 await expect(bar.getByRole('button',{name:'Chats',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.sidebar>.chat-list-actions>h1')).toHaveText('Chats');
 // While the inbox sheet is open it alone is the current place in the bar.
 const inbox=bar.getByRole('button',{name:'Inbox',exact:true});await inbox.click();await expect(page.getByRole('dialog',{name:'Inbox',exact:true})).toBeVisible();await expect(inbox).toHaveAttribute('aria-current','page');await expect(bar.locator('[aria-current]')).toHaveCount(1);await expect(bar.locator('button.active')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(bar.getByRole('button',{name:'Chats',exact:true})).toHaveAttribute('aria-current','page');
 for(const button of await bar.getByRole('button').all()){const box=(await button.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(48);expect(box.x+box.width).toBeLessThanOrEqual(width+1);}
 const more=bar.getByRole('button',{name:'More',exact:true});
 for(const section of ['Rules','Changelog','Settings']){
  await more.click();const sheet=page.getByRole('dialog',{name:'More'});await expect(sheet).toBeVisible();
  await sheet.getByRole('button',{name:section,exact:true}).click();await expect(sheet).toHaveCount(0);
  await expect(page.locator('.workspace>header').getByRole('heading',{level:1})).toHaveText(section);await expect(more).toHaveClass(/active/);
 }
 await bar.getByRole('button',{name:'Board',exact:true}).click();await expect(page.getByRole('heading',{name:'Board',exact:true})).toBeVisible();
 // Back from another root section returns to the start section.
 await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));await expect(bar.getByRole('button',{name:'Chats',exact:true})).toHaveAttribute('aria-current','page');
 await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(bar).toHaveCount(0);
 await page.locator('.composer textarea').fill('Keep this draft');
 await page.getByRole('button',{name:'Back to chats',exact:true}).click();await expect(bar).toBeVisible();
 await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(page.locator('.composer textarea')).toHaveValue('Keep this draft');
 await page.getByRole('button',{name:'Back to chats',exact:true}).click();
 await more.click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'More'})).toHaveCount(0);await expect(more).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await more.click();await expect.poll(()=>page.locator('.mobile-menu-panel').evaluate(el=>getComputedStyle(el).transform)).toBe('none');await page.screenshot({path:`.local/mobile-menu-${width}.png`});
});
