import {openChatList,newChat} from './chat-navigation';
import {test,expect,type Page} from '@playwright/test';

const reviewer={id:'child-review',name:'Review access checks and navigation',status:'running',prompt:'Check access boundaries and navigation. Report findings only.',provider:'codex'};
const researcher={id:'child-research',name:'Research task',status:'completed',prompt:'Inspect the available notes.',result:'The notes are consistent.',provider:'codex'};
const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
const message=(id:string,text:string)=>({id,role:'assistant',blocks:[{type:'text',text}]});
function gate(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
async function mockHost(page:Page,options:{failure?:boolean;slow?:ReturnType<typeof gate>;calls?:string[];long?:boolean}={}){
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');options.calls?.push(endpoint);
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic PC',roots:['C:\\Workspace\\example'],protocol:1,version:'0.11.0'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true,authenticated:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'parent-session',provider:'codex',summary:'Agent activity example',cwd:'C:\\Workspace\\example',lastModified:Date.now()}]});
    if(endpoint==='/sessions/parent-session/subagents')return options.failure?route.fulfill({status:503,json:{error:'Synthetic offline host'}}):route.fulfill({json:{agents:[options.long?{...reviewer,name:'VeryLongAgentName'.repeat(24),prompt:'A long task description. '.repeat(80)}:reviewer,researcher]}});
    if(endpoint==='/sessions/parent-session/subagents/child-review/messages'){
      if(options.slow)await options.slow.promise;
      return options.failure?route.fulfill({status:404,json:{error:'Child history unavailable'}}):route.fulfill({json:{messages:[message('review-message','Verified the permission boundaries.')]}});
    }
    if(endpoint==='/sessions/parent-session/subagents/child-research/messages')return route.fulfill({json:{messages:[message('research-message','Research details from the child chat.')]}});
    if(endpoint==='/sessions/parent-session/messages')return route.fulfill({json:{messages:[{id:'parent-message',role:'assistant',blocks:[{type:'text',text:'Parent conversation remains here.'},{type:'subagent',agent:{...reviewer,result:'Saved review summary remains available.'}}]}],previous:null,next:null}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/review/availability')return route.fulfill({json:{available:true,mode:'working'}});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });
}
async function openChat(page:Page,language='en',scale=100){
  await page.addInitScript(({language,scale,connection})=>{localStorage.setItem('pocket-code-language-v1',language);sessionStorage.setItem('connection',JSON.stringify(connection));localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',textSize:14,scale}));},{language,scale,connection});
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await page.locator('.workspace-picker-sidebar select').selectOption('codex');
  await page.getByRole('button',{name:/Agent activity example/}).click();
  await expect(page.getByText('Parent conversation remains here.')).toBeVisible();
}
const panel=(page:Page)=>page.locator('.subagents-panel');

test('agent activity opens read-only child messages and Back restores list and parent draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mockHost(page);await openChat(page);
  await page.screenshot({path:'artifacts/screenshots/subagent-chat-quiet.png',fullPage:true});
  await page.getByLabel('Message Codex').fill('Keep the parent draft');
  await page.locator('.subagent-card').click();await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByText('Verified the permission boundaries.')).toBeVisible();
  await expect(panel(page).locator('textarea')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(panel(page).locator('.subagent-row')).toHaveCount(2);
  await panel(page).getByRole('button',{name:/Research task/}).click();await expect(panel(page).getByText('Research details from the child chat.')).toBeVisible();
  await panel(page).getByRole('button',{name:'Back to chat',exact:true}).click();
  await expect(panel(page)).toHaveCount(0);await expect(page.getByLabel('Message Codex')).toHaveValue('Keep the parent draft');
  await expect(page.locator('.subagent-card')).toBeFocused();
  await newChat(page);await expect(page.locator('.chat-header-actions .subagents-entry')).toHaveCount(0);
});

test('saved task and result remain readable when child history is unavailable',async({page})=>{
  await page.setViewportSize({width:360,height:760});await mockHost(page,{failure:true});await openChat(page);
  await page.locator('.subagent-card').click();await expect(panel(page).getByText('Saved review summary remains available.')).toBeVisible();
  await expect(panel(page).getByText('Check access boundaries and navigation. Report findings only.')).toBeVisible();
  await expect(panel(page).getByText('Could not refresh messages. The task and result remain below.')).toBeVisible();
  await expect(panel(page).getByText('Verified the permission boundaries.')).toHaveCount(0);
});
test('Back closes a child image before leaving the agent context',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mockHost(page);
  await page.route('**/api/sessions/parent-session/subagents/child-review/messages?*',route=>route.fulfill({json:{messages:[{id:'child-image',role:'assistant',blocks:[{type:'image',source:{type:'base64',media_type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='}}]}]}}));
  await openChat(page);await page.locator('.subagent-card').click();
  await panel(page).getByRole('button',{name:'Open image',exact:true}).click();
  await expect(page.locator('.image-overlay')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.locator('.image-overlay')).toHaveCount(0);await expect(panel(page).locator('.subagent-detail')).toBeVisible();
  await page.keyboard.press('Escape');await expect(panel(page).locator('.subagent-row')).toHaveCount(2);
});

test('late child responses cannot replace a different selected agent and polling stops on close',async({page})=>{
  const slow=gate(),calls:string[]=[];await mockHost(page,{slow,calls});await page.setViewportSize({width:390,height:844});await openChat(page);
  await page.locator('.subagent-card').click();await expect(panel(page).getByText('Loading messages…')).toBeVisible();
  await panel(page).getByRole('button',{name:'All agents'}).click();await panel(page).getByRole('button',{name:/Research task/}).click();
  await expect(panel(page).getByText('Research details from the child chat.')).toBeVisible();slow.resolve();
  await expect(panel(page).getByText('Verified the permission boundaries.')).toHaveCount(0);
  await panel(page).getByRole('button',{name:'Back to chat',exact:true}).click();
  const count=calls.filter(value=>value.includes('/subagents/')&&value.endsWith('/messages')).length;
  await page.waitForTimeout(4300);expect(calls.filter(value=>value.includes('/subagents/')&&value.endsWith('/messages'))).toHaveLength(count);
});

for(const profile of [{width:320,height:640,language:'en',scale:130},{width:360,height:760,language:'ru',scale:100},{width:844,height:390,language:'en',scale:100},{width:1280,height:800,language:'en',scale:100}]){
  test(`agent panel fits ${profile.width}x${profile.height} ${profile.language} ${profile.scale}%`,async({page})=>{
    await page.setViewportSize(profile);await mockHost(page,{long:true});await openChat(page,profile.language,profile.scale);
    await expect(page.locator('.chat-header-actions>button')).toHaveCount(4);
    for(const button of await page.locator('.chat-header-actions>button').all()){
      const box=(await button.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(profile.width);expect(box.width).toBeGreaterThanOrEqual(48);
    }
    await page.screenshot({path:`.local/subagents-header-${profile.width}.png`});
    await expect(page.locator('.subagent-activity')).toHaveCount(0);await page.locator('.chat-header-actions .subagents-entry').click();await expect(panel(page).locator('.subagent-row')).toHaveCount(2);
    const metrics=await panel(page).evaluate(element=>{const box=element.getBoundingClientRect();return{left:box.left,right:box.right,bottom:box.bottom,width:box.width,spill:element.scrollWidth-element.clientWidth,targets:[...element.querySelectorAll('button')].map(button=>button.getBoundingClientRect().height)};});
    expect(metrics.left).toBeGreaterThanOrEqual(0);expect(metrics.right).toBeLessThanOrEqual(profile.width);expect(metrics.bottom).toBeLessThanOrEqual(profile.height);expect(metrics.spill).toBeLessThanOrEqual(1);expect(metrics.targets.every(height=>height>=48)).toBeTruthy();
    if(profile.width>760)expect(metrics.width).toBeLessThan(profile.width);
    await panel(page).locator('.subagent-row').first().click();await expect(panel(page).getByText('Verified the permission boundaries.')).toBeVisible();
    expect(await panel(page).evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`artifacts/screenshots/subagents-${profile.width}-${profile.language}.png`,fullPage:true});
  });
}
