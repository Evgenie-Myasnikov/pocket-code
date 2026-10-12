import {test,expect} from '@playwright/test';
for(const width of [320,390])test(`mobile drawer replaces bottom tabs and preserves chat at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)})));
 await page.goto('http://127.0.0.1:5173');
 const menu=()=>page.getByRole('button',{name:'Navigation menu',exact:true}).filter({visible:true});
 await expect(menu()).toBeVisible();await expect(page.locator('.app>.mobile-nav')).toHaveCount(0);
 let baseline:number|undefined;
 for(const section of ['Chats','Rules','Changelog','Settings','Board']){
  await menu().click();const dialog=page.getByRole('dialog',{name:'App sections'});await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:section,exact:true}).click();await expect(dialog).toHaveCount(0);
  const box=(await menu().boundingBox())!;baseline??=box.y;expect(box.y).toBe(baseline);expect(box.x).toBeLessThan(25);
 }
 await menu().click();await page.getByRole('dialog').getByRole('button',{name:'Chats',exact:true}).click();await page.getByRole('button',{name:'New',exact:true}).click();
 await page.locator('.composer textarea').fill('Keep this draft');await menu().click();await page.getByRole('dialog').getByRole('button',{name:'Settings',exact:true}).click();
 await menu().click();await page.getByRole('dialog').getByRole('button',{name:'Chats',exact:true}).click();await expect(page.locator('.composer textarea')).toHaveValue('Keep this draft');
 await menu().click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'App sections'})).toHaveCount(0);await expect(menu()).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await menu().click();await expect.poll(()=>page.locator('.mobile-menu-panel').evaluate(el=>getComputedStyle(el).transform)).toBe('none');await page.screenshot({path:`.local/mobile-menu-${width}.png`});
});
