import {test,expect} from '@playwright/test';
import {newChat,openSection} from './chat-navigation';
for(const width of [320,390])test(`inbox sits in the bottom bar at ${width}px and opens full-size`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale:130,textSize:16}));});
 await page.route('**/api/board-notifications',route=>route.fulfill({json:{items:[]}}));await page.goto('http://127.0.0.1:5173');
 await openSection(page,'Settings');
 const bell=page.locator('.mobile-tabbar').getByRole('button',{name:'Inbox'});await expect(bell).toBeVisible();const rect=(await bell.boundingBox())!;expect(rect.width).toBeGreaterThanOrEqual(48);expect(rect.height).toBeGreaterThanOrEqual(48);expect(rect.x+rect.width).toBeLessThanOrEqual(width);
 await expect(page.locator('header.chat-header .board-notifications-trigger')).toHaveCount(0);await expect(page.locator('main.workspace > .board-notifications')).toHaveCount(0);
 await bell.click();await expect(page.getByRole('dialog',{name:'Inbox'})).toBeVisible();expect((await page.getByRole('dialog').boundingBox())!.width).toBeGreaterThan(width-30);await page.getByRole('button',{name:'Close',exact:true}).click();await expect(bell).toBeFocused();
 // Inside a conversation the bar is hidden, so the header keeps the same inbox.
 await newChat(page);await expect(page.locator('.chat-header-main').getByRole('button',{name:'Inbox'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.local/bell-header-${width}.png`});
});
