import {newChat} from './chat-navigation';
﻿import {test,expect} from '@playwright/test';
for(const width of [320,390])test(`bell shares section header at ${width}px and opens full-size inbox`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale:130,textSize:16}));});
 await page.route('**/api/board-notifications',route=>route.fulfill({json:{items:[]}}));await page.goto('http://127.0.0.1:5173');
 const nav=page.locator('.mobile-nav');await nav.getByRole('button',{name:'Settings',exact:true}).click();
 const bell=page.locator('header.chat-header').getByRole('button',{name:'Board notifications'});await expect(bell).toBeVisible();const rect=(await bell.boundingBox())!;expect(rect.width).toBeGreaterThanOrEqual(48);expect(rect.height).toBeGreaterThanOrEqual(48);expect(rect.x+rect.width).toBeLessThanOrEqual(width);
 await expect(page.locator('main.workspace > .board-notifications')).toHaveCount(0);await bell.click();await expect(page.getByRole('dialog',{name:'Board notifications'})).toBeVisible();expect((await page.getByRole('dialog').boundingBox())!.width).toBeGreaterThan(width-30);await page.getByRole('button',{name:'Close',exact:true}).click();await expect(bell).toBeFocused();
 await newChat(page);await expect(page.locator('.chat-header-main').getByRole('button',{name:'Board notifications'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/bell-header-${width}.png`});
});
