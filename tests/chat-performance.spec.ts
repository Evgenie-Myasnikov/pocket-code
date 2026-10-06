import {openChatList,newChat} from './chat-navigation';
import {connectByQr} from './qr-connect';
import {test,expect,type Page} from '@playwright/test';

async function connect(page:Page){
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:'Performance history',exact:false}).click();
}

test('collapsed command outputs stay unmounted, update when opened, and retain disclosure across polls',async({page})=>{
  let suffix='Original command output';
  await page.route('**/api/sessions?*',route=>route.fulfill({json:[{sessionId:'performance-history',summary:'Performance history',cwd:'C:\\Test',lastModified:1}]}));
  await page.route('**/api/sessions/performance-history/messages?*',route=>route.fulfill({json:{messages:Array.from({length:60},(_,index)=>({
    id:`command-${index}`,role:'assistant',blocks:[
      {type:'tool_use',id:`call-${index}`,name:'Command',input:{command:`check ${index}`}},
      {type:'tool_result',tool_use_id:`call-${index}`,content:`${suffix}\n\n`+Array.from({length:150},(_,row)=>`- Row ${row}: **structured result** from command ${index}`).join('\n')},
    ],
  })),previous:null,next:null}}));
  await connect(page);
  await expect(page.locator('.activity-row')).toHaveCount(60);
  await expect(page.locator('.activity-details')).toHaveCount(0);
  await expect(page.locator('.tool-result-content')).toHaveCount(0);
  const last=page.locator('.activity-row').last();await last.locator('summary').click();
  await expect(last.locator('.tool-result-content')).toContainText('Original command output');
  await page.getByLabel('Message Claude').fill('A clarification while reading command details');
  suffix='Updated command output';
  await expect(last.locator('.tool-result-content')).toContainText('Updated command output',{timeout:8000});
  await expect(last).toHaveAttribute('open','');
  await expect(page.locator('.activity-details')).toHaveCount(1);
  await last.locator('summary').click();await expect(page.locator('.activity-details')).toHaveCount(0);
});

test('unchanged history avoids cache rewrites and background polls resume with fresh content',async({page})=>{
  let reads=0,text='Saved performance reply';
  await page.addInitScript(()=>{
    (window as any).__chatWrites=0;const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key.startsWith('pocket-code-chats-v1:'))(window as any).__chatWrites++;return original.call(this,key,value);};
  });
  await page.route('**/api/sessions?*',route=>route.fulfill({json:[{sessionId:'performance-history',summary:'Performance history',cwd:'C:\\Test',lastModified:1}]}));
  await page.route('**/api/sessions/performance-history/messages?*',route=>{reads++;return route.fulfill({json:{messages:[{id:'saved-message',role:'assistant',blocks:[{type:'text',text}]}],previous:null,next:null}});});
  await connect(page);await expect(page.getByText('Saved performance reply',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-code-chats-v1:')).some(key=>JSON.parse(localStorage.getItem(key)||'{}')['chat:performance-history']))).toBeTruthy();
  const firstWrites=await page.evaluate(()=>(window as any).__chatWrites),firstReads=reads;
  await expect.poll(()=>reads,{timeout:8000}).toBeGreaterThan(firstReads);
  await page.waitForTimeout(600);expect(await page.evaluate(()=>(window as any).__chatWrites)).toBe(firstWrites);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  const backgroundReads=reads;await page.waitForTimeout(3300);expect(reads).toBe(backgroundReads);
  text='Latest reply after resume';
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByText('Latest reply after resume',{exact:true})).toBeVisible();
});
