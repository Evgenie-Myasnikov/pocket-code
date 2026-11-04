import {test,expect,type Page,chromium} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {desktop} from './desktop-fixture';

const paragraphs=()=>Array.from({length:40},(_,i)=>({id:'saved-'+i,role:'assistant',blocks:[{type:'text',text:`Saved introduction ${i}\n\n`+'Synthetic conversation paragraph. '.repeat(16)}]}));
async function saveChat(page:Page){
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.evaluate(messages=>{(window as any).branchMessages=messages;},paragraphs());
 await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 await expect(page.getByText('Saved introduction 39',{exact:false})).toBeVisible();
 await page.waitForTimeout(1000);
 await page.locator('.desktop-sessions button').filter({hasText:'Documentation'}).click();
}

test('cached opening reaches the latest reply before slow history refresh',async({page})=>{
 await saveChat(page);
 await page.evaluate(()=>{const bridge=(window as any).chrome.webview,original=bridge.postMessage.bind(bridge),held:any[]=[];bridge.postMessage=(message:any)=>{if(message.endpoint?.includes('/alpha/messages')){held.push(message);return;}original(message);};(window as any).releaseHistory=()=>held.splice(0).forEach(original);});
 await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 await expect(page.getByText('Saved introduction 39',{exact:false})).toBeVisible({timeout:1500});
 await expect.poll(()=>page.locator('.conversation').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight),{timeout:1500}).toBeLessThan(5);
 // A refresh must not pull a reader back down after they scroll into the cache.
 await page.locator('.conversation').hover();await page.mouse.wheel(0,-700);await page.waitForTimeout(300);
 const before=await page.locator('.conversation').evaluate(el=>el.scrollTop);
 await page.evaluate(()=>(window as any).releaseHistory());await page.waitForTimeout(300);
 expect(await page.locator('.conversation').evaluate(el=>el.scrollTop)).toBeCloseTo(before,0);
});

test('opening an active chat retains cached earlier replies during base-history refresh',async({page})=>{
 await saveChat(page);
 await page.evaluate(()=>{
  (window as any).testRuns=[{id:'active-synthetic',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',messages:[{id:'saved-39',role:'assistant',blocks:[{type:'text',text:'Current agent introduction'}]}],partial:'Current agent continuation',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:39}];
  const bridge=(window as any).chrome.webview,original=bridge.postMessage.bind(bridge);bridge.postMessage=(message:any)=>{if(message.endpoint?.includes('/alpha/messages'))return;original(message);};
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.endpoint?.startsWith('/jobs?')).length),{timeout:8000}).toBeGreaterThan(1);
 await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 await expect(page.getByText('Current agent introduction',{exact:true})).toHaveCount(1);
 await expect(page.getByText('Saved introduction 0',{exact:false})).toHaveCount(1);
 await expect(page.getByText('Saved introduction 38',{exact:false})).toHaveCount(1);
 await expect(page.locator('[data-message-id="saved-39"]')).toHaveCount(1);
});

for(const beginning of [false,true])test(`Codex keeps expanded ${beginning?'beginning':'tail'} pages while reading and refreshes on Latest`,async({page})=>{
 await page.setViewportSize({width:1440,height:400});await desktop(page);
 await page.evaluate(()=>{(window as any).testHistoryPage=(url:URL)=>{
  const start=url.searchParams.get('from')==='start',older=url.searchParams.has('end'),first=start||older?0:30;
  return {messages:Array.from({length:30},(_,i)=>({id:'paged-'+(i+first),role:'assistant',blocks:[{type:'text',text:'Paged reply '+(i+first)+'\n\nSynthetic page content with enough text to read.'}]})),previous:first===0?null:30,next:start?30:null};
 };});
 await page.locator('.desktop-rail .provider-picker-trigger').click();await page.getByRole('menuitemradio',{name:'Codex',exact:true}).click();
 await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 await expect(page.getByText('Paged reply 59',{exact:true})).toHaveCount(1);
 const scroll=page.locator('.conversation');
 await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBeGreaterThan(40);
 if(beginning){await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Go to beginning',exact:true}).click();await expect(page.getByText('Paged reply 0',{exact:true})).toHaveCount(1);}
 await scroll.evaluate((el,beginning)=>{el.scrollTop=beginning?el.scrollHeight:0;el.dispatchEvent(new Event('scroll'));},beginning);
 await expect(page.getByText('Paged reply 0',{exact:true})).toHaveCount(1);await expect(page.getByText('Paged reply 59',{exact:true})).toHaveCount(1);
 await scroll.evaluate((el,beginning)=>{el.scrollTop=beginning?el.scrollHeight:0;el.dispatchEvent(new Event('scroll'));},beginning);
 await page.waitForTimeout(3600);
 await expect(page.getByText('Paged reply 0',{exact:true})).toHaveCount(1);await expect(page.getByText('Paged reply 59',{exact:true})).toHaveCount(1);
 await page.evaluate(()=>{(window as any).testHistoryPage=()=>({messages:[{id:'latest-server',role:'assistant',blocks:[{type:'text',text:'Authoritative refreshed reply'}]}],previous:null,next:null});});
 await page.getByRole('button',{name:'Jump to latest messages',exact:true}).click();
 await expect(page.getByText('Authoritative refreshed reply',{exact:true})).toBeVisible();
 await expect(page.getByText('Paged reply 0',{exact:true})).toHaveCount(0);await expect(page.getByText('Paged reply 59',{exact:true})).toHaveCount(0);
});

test('opening pages and beginning pages survive a full browser restart on disk',async()=>{
 const profile=await mkdtemp(join(tmpdir(),'pocket-history-profile-'));
 const launch=()=>chromium.launchPersistentContext(profile,{executablePath:process.env.POCKET_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let context=await launch();
 try{
  let page=await context.newPage();await page.goto('http://127.0.0.1:5173');
  await page.route('**/api/sessions/durable/messages?*',route=>{const beginning=new URL(route.request().url()).searchParams.has('from');return route.fulfill({json:{messages:Array.from({length:200},(_,i)=>({id:String(i+(beginning?0:200)),role:'assistant',blocks:[{type:'text',text:'Synthetic durable reply '+i}]})),previous:beginning?null:200,next:beginning?200:null}});});
  await page.evaluate(async()=>{const {chatHistoryRequest}=await import('/src/'+'chat-history-cache.ts');for(const suffix of ['','&from=start'])await chatHistoryRequest({url:location.origin,token:'synthetic-durable-token'},'/sessions/durable/messages?provider=codex&window=200'+suffix,'synthetic-durable-scope');});
  await context.close();context=await launch();page=await context.newPage();await page.goto('http://127.0.0.1:5173');
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/sessions/durable/messages?*',async route=>{await held;await route.abort();});
  await page.evaluate(async()=>{const {chatHistoryRequest}=await import('/src/'+'chat-history-cache.ts');(window as any).cachedPages=[];(window as any).durableReads=Promise.all(['','&from=start'].map(suffix=>chatHistoryRequest({url:location.origin,token:'synthetic-durable-token'},'/sessions/durable/messages?provider=codex&window=200'+suffix,'synthetic-durable-scope',(page:any)=>(window as any).cachedPages.push(page.messages.length))));});
  await expect.poll(()=>page.evaluate(()=>(window as any).cachedPages)).toEqual([200,200]);release();
  const saved=await page.evaluate(async()=>{const pages=await (window as any).durableReads;return pages.map((page:any)=>({length:page.messages.length,first:page.messages[0].id,last:page.messages.at(-1).id}));});
  expect(saved).toEqual([{length:200,first:'200',last:'399'},{length:200,first:'0',last:'199'}]);
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});
