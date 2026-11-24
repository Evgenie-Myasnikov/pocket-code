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
 await panel.getByRole('button',{name:'Full screen'}).click();await expect(panel).toHaveAttribute('data-expanded','true');
 await panel.getByRole('button',{name:'Exit full screen'}).click();
 await panel.getByRole('button',{name:'Close tab catalog.md'}).click();await expect(panel.getByRole('tab')).toHaveText(['layout.ts']);
 await panel.getByRole('button',{name:'Collapse panel'}).click();await expect(panel).toHaveCount(0);
 // the header button brings the open files back
 await header.getByRole('button',{name:'Open panel'}).click();await expect(page.locator('.chat-side-panel').getByRole('tab',{name:'layout.ts'})).toBeVisible();
});
