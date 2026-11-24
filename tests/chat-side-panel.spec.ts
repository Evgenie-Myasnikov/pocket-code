import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a file from the turn result opens as a tab of the side panel and the chat stays usable',async({page})=>{
 await page.addInitScript(()=>{
   (window as any).branchMessages=[
     {id:'ask',role:'user',blocks:[{type:'text',text:'Update the catalog layout.'}]},
     {id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'change',name:'File changes',input:{status:'completed',changes:[
       {path:'src/layout.ts',kind:'update',diff:'@@\n-old\n+adaptive'},{path:'docs/catalog.md',kind:'add',diff:'# Catalog'}]}}]},
     {id:'done',role:'assistant',blocks:[{type:'text',text:'Updated the catalog layout.'}]}];
 });
 await desktop(page);
 await page.getByRole('button',{name:/claude · Interface review/}).click();
 const header=page.locator('.desktop-chat-host header.chat-header-panel');await expect(header).toBeVisible();
 // the old dots menu (Review, Results, Subagents, branch, Reading mode, Go to beginning, Brief/Detailed) is gone, and so is Subagents
 await expect(header.getByRole('button',{name:'More actions'})).toHaveCount(0);
 await expect(header.getByRole('button',{name:'Open panel'})).toHaveCount(0);
 const card=page.getByRole('region',{name:'Turn result'});
 await card.getByRole('button',{name:/Files: 2/}).click();
 await expect(card.getByRole('button',{name:'View diff'})).toHaveCount(0);
 await card.getByRole('button',{name:'src/layout.ts'}).click();await card.getByRole('button',{name:'docs/catalog.md'}).click();
 const panel=page.locator('.chat-side-panel');await expect(panel).toBeVisible();
 await expect(panel.getByRole('tab')).toHaveText(['layout.ts','catalog.md']);
 await expect(panel.getByRole('tab',{name:'catalog.md'})).toHaveAttribute('aria-selected','true');
 await expect(panel).toContainText('Synthetic readme');await expect(page.getByRole('dialog')).toHaveCount(0);
 // not a modal: the message field beside the panel still takes text, and the chat makes room
 const field=page.getByLabel('Message Claude',{exact:true});await field.click();await page.keyboard.type('still here');await expect(field).toContainText('still here');
 const chat=await page.locator('.desktop-chat-host').boundingBox(),side=await panel.boundingBox();
 expect(chat!.x+chat!.width).toBeLessThanOrEqual(side!.x+2);
 await page.screenshot({path:'.local/chat-side-panel.png'});
 // the foreground is a step lighter than the chat, and the chat list sits between the icon strip and the chat (after Strata)
 const bg=(selector:string)=>page.locator(selector).first().evaluate(e=>getComputedStyle(e).backgroundColor);
 const transparent=(value:string)=>value==='rgba(0, 0, 0, 0)';
 expect(await bg('.chat-side-panel')).not.toBe(await bg('.desktop-app'));expect(transparent(await bg('.file-reader-docked'))).toBe(true);
 expect(await bg('.desktop-rail')).not.toBe(await bg('.desktop-app'));expect(await bg('.desktop-chat-host header.chat-header')).toBe(await bg('.desktop-rail'));
 // the left edge drags like a splitter; the width is remembered and double-click returns to half the chat area
 const edge=panel.getByRole('separator',{name:'Panel width'}),before=(await panel.boundingBox())!;
 const grip=(await edge.boundingBox())!;await page.mouse.move(grip.x+grip.width/2,grip.y+300);await page.mouse.down();await page.mouse.move(grip.x-80,grip.y+300,{steps:6});await page.mouse.up();
 const wider=(await panel.boundingBox())!;expect(wider.width).toBeGreaterThan(before.width+60);
 expect(Number(await page.evaluate(()=>localStorage.getItem('pocket-chat-side-width')))).toBeCloseTo(wider.width,-1);
 const chatNow=(await page.locator('.desktop-chat-host').boundingBox())!;expect(chatNow.x+chatNow.width).toBeLessThanOrEqual(wider.x+2);
 await edge.dblclick();await expect.poll(async()=>Math.round((await panel.boundingBox())!.width)).toBe(Math.round(before.width));
 await panel.getByRole('button',{name:'Full screen'}).click();await expect(panel).toHaveAttribute('data-expanded','true');
 await panel.getByRole('button',{name:'Exit full screen'}).click();
 await panel.getByRole('button',{name:'Close tab catalog.md'}).click();await expect(panel.getByRole('tab')).toHaveText(['layout.ts']);
 await panel.getByRole('button',{name:'Collapse panel'}).click();await expect(panel).toHaveCount(0);
 // the header button brings the open files back
 await header.getByRole('button',{name:'Open panel'}).click();await expect(page.locator('.chat-side-panel').getByRole('tab',{name:'layout.ts'})).toBeVisible();
});
