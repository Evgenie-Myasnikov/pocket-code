import {test,expect,type Page} from '@playwright/test';
import type {ActivityItem,ChatMessage} from '../server/types';

const root='C:\\Workspace\\activity-demo';
function item(id:string,provider:ActivityItem['provider'],status:ActivityItem['status']):ActivityItem{return{id,provider,status,title:`${provider} ${id}`,cwd:root,sessionId:`session-${id}`,startedAt:1,version:`${status}-1`};}
function gate(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
async function host(page:Page){
  const state={items:[item('result','codex','done'),item('question','claude','needs_input'),item('working','codex','running')],activityCalls:0,jobCalls:0,error:0,failedJob:'',history:[] as ChatMessage[],sessions:[] as {sessionId:string;provider:string;cwd:string;summary:string;lastModified:number}[],delay:undefined as ReturnType<typeof gate>|undefined,jobDelay:undefined as ReturnType<typeof gate>|undefined};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic activity PC',roots:[root],version:'0.14.1',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:state.sessions.filter(session=>session.provider===(url.searchParams.get('provider')||'claude'))});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/activity'){
      state.activityCalls++;if(state.delay)await state.delay.promise;
      return state.error?route.fulfill({status:state.error,json:{error:'Synthetic activity outage'}}):route.fulfill({json:state.items});
    }
    if(endpoint.startsWith('/jobs/')){
      state.jobCalls++;
      const id=endpoint.split('/')[2];if(id===state.failedJob)return route.fulfill({status:404,json:{error:'Synthetic job unavailable'}});
      if(state.jobDelay)await state.jobDelay.promise;
      const entry=state.items.find(value=>value.id===id);
      return route.fulfill({json:{...entry,id,sessionId:entry?.sessionId,provider:entry?.provider,cwd:root,status:entry?.status==='needs_input'?'running':entry?.status||'done',messages:[{id:`message-${id}`,role:'assistant',blocks:[{type:'text',text:`Visible result for ${id}`}]}],partial:'',approvals:[],startedAt:1,revision:entry?.status==='done'?2:1,baseMessageCount:0}});
    }
    if(endpoint.includes('/messages'))return route.fulfill({json:{messages:state.history,previous:null,next:null}});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/review/availability')return route.fulfill({json:{available:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
  return state;
}
const drawer=(page:Page)=>page.getByRole('dialog',{name:'Chat activity',exact:true});
const openDrawer=async(page:Page)=>{await page.locator('.activity-entry:visible').first().click();await expect(drawer(page)).toBeVisible();await drawer(page).evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished));});};
async function open(page:Page,scale=100){
  await page.addInitScript(({scale})=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:14}));
  },{scale});
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'New chat',exact:false}).click();await expect(page.getByLabel('Message Claude')).toBeVisible();
}

test('activity groups work across providers and closes without losing a draft',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page);await page.getByLabel('Message Claude').fill('Keep this draft');await openDrawer(page);
  await expect(drawer(page).getByRole('button',{name:'codex result',exact:true})).toBeVisible();await expect(drawer(page).getByRole('button',{name:'claude question',exact:true})).toBeVisible();await expect(drawer(page).getByRole('button',{name:'codex working',exact:true})).toBeVisible();
  await expect(drawer(page).locator('.activity-group')).toHaveCount(3);await page.keyboard.press('Escape');await expect(drawer(page)).toHaveCount(0);await expect(page.getByLabel('Message Claude')).toHaveValue('Keep this draft');await expect(page.locator('.app > .activity-entry')).toBeFocused();
  await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'All chats',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to chats',exact:true}).click();await expect(drawer(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'New chat',exact:false})).toBeVisible();
});

test('a completed result is acknowledged only after loading and stays viewed after reload',async({page})=>{
  const state=await host(page);state.jobDelay=gate();await page.setViewportSize({width:390,height:844});await open(page);await page.getByLabel('Message Claude').fill('Unsent Claude draft');await openDrawer(page);
  try{
    await drawer(page).getByRole('button',{name:'codex result',exact:true}).click();
    expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-code-activity-seen-v1:')).flatMap(key=>JSON.parse(localStorage.getItem(key)||'[]')))).toEqual([]);
    state.jobDelay.resolve();await expect(page.getByText('Visible result for result',{exact:true})).toBeVisible();await openDrawer(page);
    await expect(drawer(page).getByRole('button',{name:'codex result',exact:true})).toHaveCount(0);await expect(drawer(page).getByRole('button',{name:'claude question',exact:true})).toBeVisible();await drawer(page).getByRole('button',{name:'Close activity',exact:true}).click();
    await page.locator('.workspace-picker-header select').selectOption('claude');await expect(page.getByLabel('Message Claude')).toHaveValue('Unsent Claude draft');
    const stored=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-code-activity-seen-v1:')).map(key=>localStorage.getItem(key)).join(''));
    expect(stored).not.toContain('test-only');expect(stored).not.toContain(root);expect(stored).toContain('result');
    await page.reload();await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'codex result',exact:true})).toHaveCount(0);await expect(drawer(page).getByRole('button',{name:'codex working',exact:true})).toBeVisible();
  }finally{state.jobDelay.resolve();}
});

test('an unanswered task remains in activity after its chat is opened',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page);await openDrawer(page);await drawer(page).getByRole('button',{name:'claude question',exact:true}).click();
  await expect(page.getByText('Visible result for question',{exact:true})).toBeVisible();await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'claude question',exact:true})).toBeVisible();
});

test('completion received while reading older messages stays unread until the bottom is reached',async({page})=>{
  await page.emulateMedia({reducedMotion: 'reduce'});await page.clock.install();const state=await host(page);state.items=[item('working','codex','running')];
  state.history=Array.from({length:35},(_,index)=>({id:`older-${index}`,role:'assistant',blocks:[{type:'text',text:`Older saved message ${index}.\n\nThis conversation has enough history to read well above its final result.`}]}));
  await page.setViewportSize({width:390,height:844});await open(page);await openDrawer(page);await drawer(page).getByRole('button',{name:'codex working',exact:true}).click();
  await expect(page.getByText('Visible result for working',{exact:true})).toBeVisible();const conversation=page.locator('.conversation');
  await conversation.evaluate(element=>{element.scrollTop=200;});await expect.poll(()=>conversation.evaluate(element=>element.scrollHeight-element.scrollTop-element.clientHeight)).toBeGreaterThan(500);
  state.items=[{...state.items[0],status:'done',version:'done-2'}];await page.clock.fastForward(3100);await openDrawer(page);await expect(drawer(page).locator('.activity-task-done')).toHaveCount(1);
  await drawer(page).getByRole('button',{name:'Close activity',exact:true}).click();await expect.poll(()=>conversation.evaluate(element=>element.scrollHeight-element.scrollTop-element.clientHeight)).toBeGreaterThan(500);
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-code-activity-seen-v1:')).flatMap(key=>JSON.parse(localStorage.getItem(key)||'[]')))).toEqual([]);
  await conversation.evaluate(element=>{element.scrollTop=element.scrollHeight;});
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('pocket-code-activity-seen-v1:')).flatMap(key=>JSON.parse(localStorage.getItem(key)||'[]')).map(item=>item.id))).toContain('working');
  await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'codex working',exact:true})).toHaveCount(0);
});

test('opening session history acknowledges completion only once its exact final result is loaded',async({page})=>{
  await page.clock.install();const state=await host(page);state.items=[{...item('result','claude','done'),resultMessageId:'final-answer'}];
  state.sessions=[{sessionId:'session-result',provider:'claude',cwd:root,summary:'Saved completed chat',lastModified:1}];
  state.history=[{id:'stale-reply',role:'assistant',blocks:[{type:'text',text:'An earlier response before the task completed.'}]}];
  await page.setViewportSize({width:390,height:844});await open(page);await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'All chats',exact:true})).toHaveCount(0);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to chats',exact:true}).click();await page.getByRole('button',{name:/Saved completed chat/}).click();
  await expect(page.getByText('An earlier response before the task completed.',{exact:true})).toBeVisible();await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'claude result',exact:true})).toBeVisible();
  await drawer(page).getByRole('button',{name:'Close activity',exact:true}).click();state.history=[...state.history,{id:'final-answer',role:'assistant',blocks:[{type:'text',text:'The actual completed result is now in history.'}]}];await page.clock.fastForward(3100);
  await expect(page.getByText('The actual completed result is now in history.',{exact:true})).toBeVisible();await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'claude result',exact:true})).toHaveCount(0);expect(state.jobCalls).toBe(0);
});

test('failure to open a completed chat leaves its result unread',async({page})=>{
  const state=await host(page);state.failedJob='result';await open(page);await openDrawer(page);await drawer(page).getByRole('button',{name:'codex result',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic job unavailable');await openDrawer(page);await expect(drawer(page).getByRole('button',{name:'codex result',exact:true})).toBeVisible();
});

test('activity refresh retains old entries offline and moves finished work to completed',async({page})=>{
  const state=await host(page);await open(page);await openDrawer(page);await expect(drawer(page).locator('.activity-task-running')).toHaveCount(1);
  state.error=503;await drawer(page).getByRole('button',{name:'Refresh activity',exact:true}).click();await expect(drawer(page).locator('.activity-sync-error')).toBeVisible();await expect(drawer(page).getByRole('button',{name:'codex working',exact:true})).toBeVisible();
  state.error=0;state.items=state.items.map(value=>value.id==='working'?{...value,status:'done',version:'done-2'}:value);await drawer(page).getByRole('button',{name:'Retry',exact:true}).click();
  await expect(drawer(page).locator('.activity-sync-error')).toHaveCount(0);await expect(drawer(page).locator('.activity-task-running')).toHaveCount(0);await expect(drawer(page).locator('.activity-task-done')).toHaveCount(2);
});

test('an old host without activity shows an error rather than invented entries',async({page})=>{
  const state=await host(page);state.error=404;await open(page);await openDrawer(page);await expect(drawer(page).locator('.activity-sync-error')).toBeVisible();await expect(drawer(page).locator('.activity-task-row')).toHaveCount(0);await expect(drawer(page).getByRole('button',{name:'Retry',exact:true})).toBeVisible();
});

test('activity polling never overlaps and pauses while the document is hidden',async({page})=>{
  await page.clock.install();const state=await host(page);state.delay=gate();await open(page);
  try{
    await expect.poll(()=>state.activityCalls).toBe(1);await page.clock.fastForward(9100);expect(state.activityCalls).toBe(1);state.delay.resolve();await openDrawer(page);await expect(drawer(page).locator('.activity-task-row')).toHaveCount(3);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    const calls=state.activityCalls;await page.clock.fastForward(9100);expect(state.activityCalls).toBe(calls);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>state.activityCalls).toBe(calls+1);
  }finally{state.delay.resolve();}
});

for(const scale of [60,130])test(`activity fits a narrow phone at ${scale}% scale`,async({page})=>{
  const state=await host(page);state.items[0].title='A long task title that wraps naturally without covering the status or controls';await page.setViewportSize({width:320,height:700});await open(page,scale);await openDrawer(page);await expect(drawer(page).locator('.activity-task-row')).toHaveCount(3);
  const layout=await drawer(page).evaluate(element=>{const box=element.getBoundingClientRect(),buttons=Array.from(element.querySelectorAll('button')).map(item=>item.getBoundingClientRect());return{width:box.width<=innerWidth,buttons:buttons.every(item=>item.x>=0&&item.right<=innerWidth+1&&item.height>=40&&item.width>=40),pageFits:document.documentElement.scrollWidth<=innerWidth};});expect(layout).toEqual({width:true,buttons:true,pageFits:true});
  await page.screenshot({path:`artifacts/screenshots/activity-${scale}-320.png`,fullPage:true});
});

test('right activity drawer remains available in every main section',async({page})=>{
 await host(page);await page.setViewportSize({width:390,height:844});await open(page);
 for(const name of ['Tasks','Chats','Project','Settings']){
  await page.locator('.mobile-nav').getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.app-header')).toHaveCount(0);await expect(page.locator('.app > .activity-entry')).toBeVisible();
  await expect(page.locator('.activity-entry:visible')).toHaveCount(1);
  await openDrawer(page);expect(await drawer(page).evaluate(el=>Math.abs(el.getBoundingClientRect().right-innerWidth))).toBeLessThan(2);await page.keyboard.press('Escape');
  await expect(page.locator('.app > .activity-entry')).toBeFocused();
 }
});

test('Chats tab preserves the open conversation until explicit Back and shows activity priority',async({page})=>{
 const state=await host(page);await page.setViewportSize({width:390,height:844});await open(page);
 const nav=page.locator('.mobile-nav'),chats=nav.getByRole('button',{name:'Chats',exact:true});
 await page.getByLabel('Message Claude').fill('Remember my open chat');
 for(const name of ['Tasks','Project','Settings']){await nav.getByRole('button',{name,exact:true}).click();await chats.click();await expect(page.getByLabel('Message Claude')).toHaveValue('Remember my open chat');}
 await expect(chats.locator('.chat-tab-status-needs_input')).toBeVisible();
 for(const status of ['error','running','done'] as const){state.items=[item('badge','codex',status)];await expect(chats.locator('.chat-tab-status-'+status)).toBeVisible({timeout:6000});}
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'New chat',exact:false})).toBeVisible();
 await nav.getByRole('button',{name:'Settings',exact:true}).click();await chats.click();await expect(page.getByRole('button',{name:'New chat',exact:false})).toBeVisible();
});

test('edge handle supports taps, keyboard and left swipes without opening on vertical gestures',async({page})=>{
 await host(page);await page.setViewportSize({width:390,height:844});await open(page);
 const handle=page.locator('.activity-entry'),box=(await handle.boundingBox())!;
 await expect(handle.locator('svg,.activity-badge')).toHaveCount(0);
 expect(await handle.locator('.activity-handle-line').evaluate(el=>{const r=el.getBoundingClientRect();return [r.width,r.height];})).toEqual([8,72]);
 await page.screenshot({path:'artifacts/screenshots/activity-edge-handle.png',fullPage:true});
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x+30,box.y+110,{steps:6});await page.mouse.up();await expect(drawer(page)).toHaveCount(0);
 await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.mouse.move(box.x-45,box.y+31,{steps:6});await page.mouse.up();await expect(drawer(page)).toBeVisible();
 await page.keyboard.press('Escape');await expect(handle).toBeFocused();await page.keyboard.press('Enter');await expect(drawer(page)).toBeVisible();
 await page.keyboard.press('Escape');await openDrawer(page);
});
test('drawer follows the finger before release and supports closing and cancelling drags',async({page})=>{
 await host(page);await page.setViewportSize({width:390,height:844});await open(page);
 const handle=page.locator('.activity-entry'),h=(await handle.boundingBox())!;
 await page.mouse.move(h.x+30,h.y+30);await page.mouse.down();
 await page.mouse.move(h.x-70,h.y+30,{steps:4});
 await expect(drawer(page)).toBeVisible();const partial=(await drawer(page).boundingBox())!;
 expect(partial.x).toBeGreaterThan(200);expect(partial.x).toBeLessThan(340);
 await page.mouse.move(h.x-170,h.y+30,{steps:4});const pulled=(await drawer(page).boundingBox())!;
 expect(pulled.x).toBeLessThan(partial.x-80);
 await page.screenshot({path:'artifacts/screenshots/activity-drag-partial.png'});
 await page.mouse.up();await expect.poll(async()=>Math.round((await drawer(page).boundingBox())!.x)).toBe(39);
 const pane=(await drawer(page).boundingBox())!;
 await page.mouse.move(pane.x+35,120);await page.mouse.down();await page.mouse.move(pane.x+145,120,{steps:5});
 expect((await drawer(page).boundingBox())!.x).toBeGreaterThan(pane.x+90);
 await page.mouse.up();await expect(drawer(page)).toHaveCount(0);
 // Reversing an opening drag fully must not turn the synthesized click into a tap.
 await page.mouse.move(h.x+30,h.y+30);await page.mouse.down();await page.mouse.move(h.x-50,h.y+30,{steps:4});
 await page.mouse.move(h.x+30,h.y+30,{steps:4});await page.mouse.up();await expect(drawer(page)).toHaveCount(0);
 await handle.click();await expect(drawer(page)).toBeVisible();
 await page.locator('.activity-drawer').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});
 await page.mouse.move(80,120);await page.mouse.down();await page.mouse.move(115,120,{steps:3});
 await page.locator('.activity-drawer').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
 await expect.poll(async()=>Math.round((await drawer(page).boundingBox())!.x)).toBe(39);
});
test('touch drag reveals and dismisses the drawer without waiting for release',async({page})=>{
 await host(page);await page.setViewportSize({width:390,height:844});await open(page);
 const cdp=await page.context().newCDPSession(page);
 const touch=async(type:'touchStart'|'touchMove'|'touchEnd',x=0,y=0)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
 const box=(await page.locator('.activity-entry').boundingBox())!,y=box.y+40;
 await touch('touchStart',375,y);await touch('touchMove',330,y);await touch('touchMove',270,y);
 expect((await drawer(page).boundingBox())!.x).toBeGreaterThan(200);
 await touch('touchMove',170,y);await touch('touchEnd');
 await expect.poll(async()=>Math.round((await drawer(page).boundingBox())!.x)).toBe(39);
 await touch('touchStart',85,130);await touch('touchMove',140,130);await touch('touchMove',220,130);
 await expect.poll(async()=>(await drawer(page).boundingBox())!.x).toBeGreaterThan(130);
 await touch('touchEnd');await expect(drawer(page)).toHaveCount(0);await cdp.detach();
});
