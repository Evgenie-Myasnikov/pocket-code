import {openChatList,newChat,chooseProvider,openSection} from './chat-navigation';
import {connectByQr} from './qr-connect';
import {desktop} from './desktop-fixture';
import {test,expect,type Page} from '@playwright/test';
const snapshot=(name:string,value:number)=>({checkedAt:Date.now(),ordinaryUsageAllowed:null,buckets:[{id:'quota',name,windows:[{id:'primary',remainingPercent:value,usedPercent:100-value,windowDurationMins:300,resetsAt:null},{id:'secondary',remainingPercent:90,usedPercent:10,windowDurationMins:10080,resetsAt:null}]}]});
async function open(page:Page){
  await page.route('**/api/providers',route=>route.fulfill({json:['claude','codex'].map(id=>({id,name:id,available:true,authenticated:true,models:[]}))}));
  await page.route('**/api/jobs?*',route=>route.fulfill({json:[]}));
  await page.route('**/api/sessions?*',route=>route.fulfill({json:[{sessionId:'quota-chat',summary:'Quota example',cwd:'C:\\Test',lastModified:1}]}));
  await page.route('**/api/sessions/quota-chat/messages?*',route=>route.fulfill({json:{messages:[{id:'answer',role:'assistant',blocks:[{type:'text',text:'Example response'}]}],previous:null,next:null}}));
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);await page.getByRole('button',{name:'Quota example',exact:false}).click();
}
test('Send remains clickable in the center of the allowance ring',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 await page.getByLabel('Message Claude',{exact:true}).fill('Send through the center');await page.locator('.send-button').click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.endpoint==='/jobs'&&call.action==='write').length)).toBe(1);
 await expect(page.locator('.composer-submit .stop-button')).toBeVisible();await expect(page.locator('.composer-submit .usage-indicator')).toHaveCount(1);
 const control=page.locator('.composer-submit .usage-indicator');await control.focus();await page.keyboard.press('Enter');await expect(page.locator('.codex-usage')).toBeVisible();
});

test('background polling pauses and a failed refresh becomes unknown rather than a stale current percentage',async({page})=>{
  await page.setViewportSize({width:390,height:844});let fail=false,reads=0;
  await page.route('**/api/claude/usage',route=>{reads++;return fail?route.fulfill({status:503,json:{error:'Unavailable'}}):route.fulfill({json:snapshot('Claude',18)});});
  await open(page);await expect(page.locator('.usage-indicator')).toHaveText('18%');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  const before=reads;await page.clock.install();await page.clock.fastForward(65_000);expect(reads).toBe(before);
  fail=true;await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('.usage-indicator')).toHaveText('—');await expect(page.locator('.usage-indicator')).toHaveAccessibleName('Claude: limits unavailable');
});
test('switching providers discards late quota responses',async({page})=>{
  await page.setViewportSize({width:390,height:844});let started=0,release!:()=>void;const hold=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/claude/usage',async route=>{started++;await hold;await route.fulfill({json:snapshot('Claude',2)});});
  await page.route('**/api/codex/usage',route=>route.fulfill({json:snapshot('Codex',67)}));
  await open(page);await expect.poll(()=>started).toBeGreaterThan(0);await page.getByRole('button',{name:'Back to chats',exact:true}).click();await chooseProvider(page,'codex');await page.getByRole('button',{name:'Quota example',exact:false}).click();await expect(page.locator('.usage-indicator')).toHaveText('67%');release();await expect(page.locator('.usage-indicator')).toHaveAccessibleName('Codex: 67% allowance remaining');
});

for(const width of [320,390,1440])test(`quota ring surrounds Send with separate limit controls at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:840});await page.route('**/api/claude/usage',route=>route.fulfill({json:snapshot('Claude',42)}));await open(page);
 const ring=page.locator('.usage-indicator'),form=page.locator('.prompt-composer'),send=page.locator('.send-button'),submit=page.locator('.composer-submit');
 await expect(ring).toHaveAccessibleName('Claude: 42% allowance remaining');await expect(submit.locator('.usage-indicator')).toHaveCount(1);
 await page.mouse.move(0,0);await expect(ring.getByRole('tooltip')).toBeHidden();
 const r=(await ring.boundingBox())!,s=(await send.boundingBox())!,f=(await form.boundingBox())!;
 expect(Math.abs(r.x+r.width/2-s.x-s.width/2)).toBeLessThanOrEqual(.5);expect(Math.abs(r.y+r.height/2-s.y-s.height/2)).toBeLessThanOrEqual(.5);
 expect(r.width).toBe(s.width);expect(r.x+r.width).toBeLessThanOrEqual(f.x+f.width);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 if(width<=600){expect(f.width).toBeGreaterThan(width-60);const models=(await page.locator('.composer-models').boundingBox())!,actions=(await page.locator('.composer-actions').boundingBox())!;expect(Math.abs(actions.y-models.y)).toBeLessThanOrEqual(6);}
 await page.getByLabel('Message Claude').fill('Keep quota draft');await page.screenshot({path:`.local/quota-send-${width}.png`,animations:'disabled'});
 await submit.hover();await expect(ring.getByRole('tooltip')).toBeVisible();await expect(ring.getByRole('tooltip')).toHaveText('42%');
 await ring.click({position:{x:r.width/2,y:1}});await expect(page.locator('.codex-usage')).toContainText('42% remaining');await openSection(page,'Chats');await expect(page.getByLabel('Message Claude')).toHaveValue('Keep quota draft');
 await ring.focus();await page.keyboard.press('Enter');await expect(page.locator('.codex-usage')).toContainText('42% remaining');
});
