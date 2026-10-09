import {test,expect} from '@playwright/test';
import {openChatList} from './chat-navigation';
test('repeated calls collapse into a counted row and expose every command and result',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
 await page.route('**/api/sessions?*',r=>r.fulfill({json:[{sessionId:'group-test',summary:'Grouped actions',cwd:'C:/Sample',lastModified:1}]}));
 await page.route('**/api/sessions/group-test/messages?*',r=>r.fulfill({json:{messages:[
  {id:'first',role:'assistant',blocks:[{type:'tool_use',id:'a',name:'Bash',input:{command:'echo first'}}]},
  {id:'first-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'a',content:'First result'}]},
  {id:'second',role:'assistant',blocks:[{type:'tool_use',id:'b',name:'Command',input:{command:'echo second'}}]},
  {id:'second-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'b',content:'Second result'}]},
  {id:'failed',role:'assistant',blocks:[{type:'tool_use',id:'c',name:'Bash',input:{status:'failed',command:'echo failure'}}]},
  {id:'answer',role:'assistant',blocks:[{type:'text',text:'Completed checks.'}]},
 ],previous:null,next:null}}));
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await openChatList(page);await page.getByRole('button',{name:/Grouped actions/}).click();
 const group=page.locator('.activity-group');await expect(group).toHaveCount(1);await expect(group.locator(':scope > summary')).toHaveText('Ran command×2');
 await expect(page.locator('.conversation .lucide-chevron-right')).toHaveCount(0);
 await expect(page.locator('[data-message-id=second]')).toHaveCount(1);await expect(page.getByText('echo first',{exact:false})).toHaveCount(0);
 await expect(page.locator('.tool-card.failed > summary')).toBeVisible();await group.locator(':scope > summary').click();
 for(const details of await group.locator('.activity-group-items > details').all())await details.locator('summary').click();
 await expect(group).toContainText('echo first');await expect(group).toContainText('echo second');await expect(group).toContainText('First result');await expect(group).toContainText('Second result');
 await group.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(group.locator('.activity-group-items')).toHaveCount(0);
 await page.screenshot({path:'.local/grouped-actions.png'});
});
