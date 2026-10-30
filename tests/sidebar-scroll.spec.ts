import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a saved desktop chat sends immediately and accepts another message while running',async({page})=>{
 await desktop(page);await page.locator('.desktop-sessions button').first().click();
 const title=page.locator('.desktop-chat-host .header-title');await expect(title).toBeHidden();
 await page.locator('.desktop-chat-host .chat-menu-button').click();await expect(page.getByRole('menu',{name:'More actions',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('.desktop-rail-heading button').click();await expect(title).toBeVisible();await page.locator('.desktop-rail-heading button').click();await expect(title).toBeHidden();
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
 const divider=page.getByRole('separator',{name:'Sidebar width'});
 for(const minimum of [false,true]){
  if(minimum){await divider.focus();for(let i=0;i<15;i++)await page.keyboard.press('Shift+ArrowLeft');}
  const scroll=(await rail.boundingBox())!,handle=(await divider.boundingBox())!;
  expect(scroll.x+scroll.width).toBeLessThanOrEqual(handle.x);
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[role=separator]')!==null,{x:scroll.x+scroll.width-2,y:scroll.y+120})).toBe(false);
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('role'),{x:handle.x+handle.width/2,y:handle.y+120})).toBe('separator');
 }
 await divider.focus();await page.keyboard.press('Home');
 await rail.hover();await page.mouse.wheel(0,1200);await expect.poll(()=>rail.evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
 await expect(sessions.locator('button').last()).not.toBeInViewport();
 await rail.evaluate(el=>el.scrollTop=el.scrollHeight);await expect(sessions.locator('button').last()).toBeInViewport();
 await page.screenshot({path:'.local/sidebar-full-height.png'});
});
