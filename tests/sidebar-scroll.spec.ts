import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a saved desktop chat sends immediately and accepts another message while running',async({page})=>{
 await desktop(page);await page.locator('.desktop-sessions button').first().click();
 const input=page.getByLabel('Message Claude',{exact:true});await input.fill('Start this saved chat');await page.locator('.send-button').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.endpoint==='/jobs'&&call.action==='write').length)).toBe(1);
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(input).toBeEnabled();await input.fill('Continue with this clarification');await page.locator('.send-button').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>/\/jobs\/[^/]+\/messages$/.test(call.endpoint||'')&&call.action==='write').length)).toBe(1);
 await expect(input).toHaveValue('');await input.fill('Typing during the response');await expect(input).toHaveValue('Typing during the response');
});

test('one full-height sidebar scroll track contains projects and recent chats',async({page})=>{
 await page.setViewportSize({width:1440,height:740});await desktop(page);
 await page.locator('.desktop-sessions').evaluate(list=>{const template=list.querySelector('button')!;for(let i=0;i<50;i++){const row=template.cloneNode(true) as HTMLElement;row.textContent=`Synthetic conversation ${i+1}`;list.append(row);}});
 const rail=page.locator('.desktop-rail-content'),sessions=page.locator('.desktop-sessions');
 await expect(rail).toHaveCSS('overflow-y','auto');await expect(sessions).toHaveCSS('overflow-y','visible');
 const box=(await rail.boundingBox())!;expect(box.height).toBeGreaterThan(700);
 await rail.hover();await page.mouse.wheel(0,1200);await expect.poll(()=>rail.evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
 await expect(sessions.locator('button').last()).not.toBeInViewport();
 await rail.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(sessions.locator('button').last()).toBeInViewport();
 await page.screenshot({path:'.local/sidebar-full-height.png'});
});
