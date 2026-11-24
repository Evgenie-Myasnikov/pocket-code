import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a read file shows its path and its text as a chat code block, without the reader fields and line numbers',async({page})=>{
 await page.addInitScript(()=>{
   const lines=Array.from({length:30},(_,i)=>`${String(i+30).padStart(6)}→    int value${i} = ${i};`).join('\n');
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'done',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Look at the panel.'}]},
       {id:'a',role:'assistant',blocks:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:'C:/Demo/Atlas/Panel.cs',offset:30,limit:30}}]},
       {id:'r',role:'user',blocks:[{type:'tool_result',tool_use_id:'r1',content:lines+'\n\n<system-reminder>Note for the model.</system-reminder>'}]},
       {id:'b',role:'assistant',blocks:[{type:'text',text:'Done.'}]}],
     approvals:[],revision:1,startedAt:Date.now()-5000,finishedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 const card=page.locator('.conversation-inner .tool-card').filter({hasText:'Panel.cs'}).first();
 await card.locator('summary').first().click();
 await expect(card.locator('.tool-file-path')).toHaveText('C:/Demo/Atlas/Panel.cs');
 await expect(card.locator('.tool-fields')).toHaveCount(0);
 const code=card.locator('.tool-file-preview pre');
 await expect(code).toContainText('int value0 = 0;');await expect(code).not.toContainText('→');await expect(code).not.toContainText('Note for the model');
 await expect(card.getByRole('button',{name:'… 18 more lines'})).toBeVisible();
 // the same code size as a code block in an answer
 const size=await code.evaluate(element=>getComputedStyle(element).fontSize);
 await page.screenshot({path:'.local/read-file-card.png'});
 expect(Number.parseFloat(size)).toBeLessThan(15);
});
