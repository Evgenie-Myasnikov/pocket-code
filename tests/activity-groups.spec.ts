import {test,expect} from '@playwright/test';
import {openChatList} from './chat-navigation';
import {desktop} from './desktop-fixture';
test('repeated calls collapse into a counted row and expose every command and result',async({page})=>{
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
 await page.route('**/api/sessions?*',r=>r.fulfill({json:[{sessionId:'group-test',summary:'Grouped actions',cwd:'C:/Sample',lastModified:1}]}));
 await page.route('**/api/sessions/group-test/messages?*',r=>r.fulfill({json:{messages:[
  {id:'first',role:'assistant',blocks:[{type:'tool_use',id:'a',name:'Bash',input:{command:'echo first'}}]},
  {id:'first-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'a',content:'First result'}]},
  {id:'progress',role:'assistant',blocks:[{type:'text',text:'Preparing another check.'},{type:'thinking',thinking:'Check the remaining file.'}]},
  {id:'second',role:'assistant',blocks:[{type:'tool_use',id:'b',name:'Command',input:{command:'echo second'}}]},
  {id:'second-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'b',content:'Second result'}]},
  {id:'failed',role:'assistant',blocks:[{type:'tool_use',id:'c',name:'Bash',input:{status:'failed',command:'echo failure'}}]},
  {id:'answer',role:'assistant',blocks:[{type:'text',text:'Completed checks.'}]},
 ],previous:null,next:null}}));
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await openChatList(page);await page.getByRole('button',{name:/Grouped actions/}).click();
 const group=page.locator('.activity-group');await expect(group).toHaveCount(1);await expect(group.locator(':scope > summary')).toHaveText('Ran 2 commands');
 await expect(page.getByText('Preparing another check.')).toBeVisible();
 await expect(group.locator(':scope > summary .chat-disclosure-chevron')).toBeVisible();
 await expect(page.locator('[data-message-id=second]')).toHaveCount(1);await expect(page.getByText('echo first',{exact:false})).toHaveCount(0);
 await expect(page.locator('.tool-card.failed > summary')).toBeVisible();await group.locator(':scope > summary').click();
 await expect(group.locator('.activity-group-items > details')).toHaveCount(2);for(const details of await group.locator('.activity-group-items > details').all())await details.locator('summary').click();
 await expect(group).toContainText('echo first');await expect(group).toContainText('echo second');await expect(group).toContainText('First result');await expect(group).toContainText('Second result');
 await group.locator(':scope > summary').focus();await page.keyboard.press('Enter');await expect(group.locator('.activity-group-items')).toHaveCount(0);
 await page.screenshot({path:'.local/grouped-actions.png'});
});

test('desktop brief mode collects each turn once and detailed mode restores the original rows',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','en');
   localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
   (window as any).branchMessages=[
     {id:'request',role:'user',blocks:[{type:'text',text:'Check the project.'}]},
     {id:'first',role:'assistant',blocks:[{type:'text',text:'Running the first check.'},
       {type:'tool_use',id:'a',name:'Bash',input:{command:'npm test'}},{type:'tool_result',tool_use_id:'a',content:'Passed tests'}]},
     {id:'next',role:'assistant',blocks:[{type:'thinking',thinking:'Check the configuration too.'},
       {type:'tool_use',id:'b',name:'Command',input:{command:'npm run check',status:'completed'}}]},
     {id:'failure',role:'assistant',blocks:[{type:'tool_use',id:'c',name:'powershell',input:{command:'check-missing',status:'failed'}}]},
     {id:'another',role:'user',blocks:[{type:'text',text:'Run the last check.'}]},
     {id:'last',role:'assistant',blocks:[{type:'tool_use',id:'d',name:'exec_command',input:{cmd:'git status',status:'completed'}},
       {type:'tool_use',id:'e',name:'Command',input:{command:'npm run build',status:'running'}}]},
   ];
 });
 await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();
 const histories=page.locator('[data-command-history=true]');
 await expect(histories).toHaveCount(2);
 await expect(histories.first().locator(':scope>summary')).toHaveText('Ran 2 commands');
 await expect(histories.last().locator(':scope>summary')).toHaveText('Ran 1 command');
 await expect(page.getByText('Running the first check.')).toBeVisible();
 await expect(page.locator('[data-message-id=next] details.thinking')).toBeVisible();
 await expect(page.locator('[data-message-id=failure] summary')).toContainText('check-missing');
 await histories.first().locator(':scope>summary').click();
 await expect(histories.first().locator('.activity-group-items>details')).toHaveCount(2);
 await page.keyboard.press('Control+o');
 await expect(histories).toHaveCount(0);
 await expect(page.locator('[data-message-id=first] summary')).toContainText('npm test');
 await expect(page.locator('.activity-row>summary').filter({hasText:'npm run check'})).toBeVisible();
 await page.keyboard.press('Control+o');
 await expect(histories).toHaveCount(2);
 await expect(page.locator('.activity-row>summary').filter({hasText:'npm run build'})).toBeVisible();
 if(process.env.POCKET_COMMAND_HISTORY_CAPTURE){
   await page.evaluate(async()=>{const {setLanguage}=await import('/src/i18n.ts' as string);setLanguage('ru');});
   if(await histories.first().evaluate(row=>(row as HTMLDetailsElement).open))await histories.first().locator(':scope>summary').click();
   await expect(histories.last().locator(':scope>summary')).toHaveText('Выполнил 1 команду');
   await expect(histories.first()).toHaveJSProperty('open',false);
   await page.screenshot({path:process.env.POCKET_COMMAND_HISTORY_CAPTURE,animations:'disabled'});
 }
});
