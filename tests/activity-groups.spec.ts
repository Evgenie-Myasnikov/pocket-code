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
 // an action line has the text size and follows the text size setting
 const px=(selector:string)=>page.locator(selector).first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize));
 const chat=await page.locator('.conversation-inner .activity-row>summary').first().evaluate(element=>parseFloat(getComputedStyle(element).getPropertyValue('--chat-font-size'))||14);
 expect(await px('.conversation-inner .activity-row>summary')).toBeCloseTo(chat,1);
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
 await expect(page.locator('[data-message-id=next]')).toHaveCount(1);
 const reason=page.locator('details.thinking');
 await expect(reason).toBeVisible();
 expect(await reason.evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('[data-command-history=true]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
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

test('reasoning resumes above command and file updates and resets on the next user turn',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('pocket-code-language-v1','en');
    localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
    (window as any).testHistoryPage=()=>({messages:[],previous:null,next:null});
    (window as any).testRuns=[{id:'turn-fixture',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',
      status:'running',startedAt:Date.now(),baseMessageCount:0,approvals:[],revision:1,partial:'',
      messages:[
        {id:'ask',role:'user',blocks:[{type:'text',text:'Check the example.'}]},
        {id:'plan',role:'assistant',blocks:[{type:'thinking',thinking:'Inspect the sample.'}]},
        {id:'shell',role:'assistant',blocks:[{type:'tool_use',id:'check',name:'Bash',input:{command:'npm test'}}]},
        {id:'shell-result',role:'user',blocks:[{type:'tool_result',tool_use_id:'check',content:'Tests passed.'}]}
      ],writePreviews:[{id:'write',tool:'Write',path:'sample.ts',content:'const ok =',totalBytes:10,totalLines:1}]}];
  });
  await desktop(page);
  await page.locator('.desktop-sessions>button').first().click();
  const reason=page.locator('details.thinking'),commands=page.locator('[data-command-history=true]'),file=page.locator('.edit-activity');
  await expect(reason).toHaveCount(1);
  if(!await reason.evaluate(el=>(el as HTMLDetailsElement).open))await reason.locator('summary').click();
  await expect(reason.locator('.reasoning-content')).toHaveText('Inspect the sample.');
  await reason.evaluate(el=>{(window as any).originalReason=el;});
  await expect(file.locator('.edit-live-snippet')).toHaveText('const ok =');
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0];
    run.messages.push({id:'resume',role:'assistant',blocks:[{type:'thinking',thinking:'Verify the written file.'}]});
    run.writePreviews[0].content+=' true;';run.writePreviews[0].totalBytes+=6;run.revision++;
  });
  await expect(file.locator('.edit-live-snippet')).toHaveText('const ok = true;');
  await expect(reason).toHaveCount(1);
  await expect(reason.locator('.reasoning-content')).toContainText('Inspect the sample.');
  await expect(reason.locator('.reasoning-content')).toContainText('Verify the written file.');
  expect(await reason.evaluate(el=>el===(window as any).originalReason)).toBe(true);
  await expect(commands).toHaveCount(1);
  await expect(commands.locator(':scope>summary')).toHaveText('Ran 1 command');
  expect(await commands.evaluate(el=>Boolean((window as any).originalReason.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0];
    run.writePreviews=[];
    run.messages.push({id:'write-complete',role:'assistant',blocks:[
      {type:'tool_use',id:'write',name:'Write',input:{file_path:'sample.ts',content:'const ok = true;'}},
      {type:'tool_result',tool_use_id:'write',content:'File created.'}
    ]},{id:'next',role:'user',blocks:[{type:'text',text:'Check another example.'}]},
    {id:'next-plan',role:'assistant',blocks:[{type:'thinking',thinking:'Inspect the second example.'}]});
    run.revision++;
  });
  await expect(reason).toHaveCount(2);
  await expect(reason.first()).not.toContainText('Inspect the second example.');
  const next=reason.last();
  if(!await next.evaluate(el=>(el as HTMLDetailsElement).open))await next.locator('summary').click();
  await expect(next.locator('.reasoning-content')).toHaveText('Inspect the second example.');
  await expect(commands).toHaveCount(1);
  await expect(file).toHaveCount(1);
  await expect(file).toHaveAttribute('data-status','done');
});
