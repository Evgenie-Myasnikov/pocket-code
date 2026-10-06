import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,language='en',scale=100){
 await page.setViewportSize({width:320,height:740});await page.addInitScript(({language,scale})=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-language-v1',language);localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:14}));},{language,scale});
 const state={items:[{id:'notice-1',provider:'jira',scope:'site-b',sourceLabel:'Jira / Second site',key:'DEMO-2',summary:'Notification target',status:'Review',previousStatus:'In Progress',kind:'status',at:Date.now(),readAt:undefined as number|undefined},{id:'notice-2',provider:'jira',scope:'site-a',sourceLabel:'Jira / First site',key:'DEMO-1',summary:'Comment target',status:'Open',previousStatus:undefined,kind:'comment',at:Date.now(),readAt:undefined as number|undefined}],reads:[] as string[][],issueFailure:false,workflowSites:[] as string[],delay:null as Promise<void>|null};
 const issue=(key:string)=>({key,summary:'Notification target',description:'Description loaded from the notification',status:'Review',priority:'Medium',issueType:'Task',url:'https://example.atlassian.net/browse/'+key,updated:''});
 await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url()),p=url.pathname.replace('/api','');
  if(p==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.18.0',protocol:1}});
  if(p==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,models:[]}]});
  if(p==='/sessions'||p==='/jobs')return route.fulfill({json:[]});
  if(p==='/updates/latest')return route.fulfill({json:{enabled:false}});
  if(p==='/task-notifications')return route.fulfill({json:{items:state.items,unread:state.items.filter(i=>!i.readAt).length,loading:false,checkedAt:Date.now(),sources:[{id:'jira',name:'Jira'}]}});
  if(p==='/task-notifications/read'){const ids=req.postDataJSON().ids;state.reads.push(ids);state.items.forEach(i=>{if(ids.includes(i.id))i.readAt=Date.now();});return route.fulfill({json:{ok:true}});}
  if(p==='/jira/status')return route.fulfill({json:{connected:true,sites:[{id:'site-a',name:'First',url:'https://example.atlassian.net'},{id:'site-b',name:'Second',url:'https://second.atlassian.net'}]}});
  if(p==='/jira/issues')return route.fulfill({json:{issues:[issue('DEMO-1')],next:null}});
  if(p==='/jira/queue')return route.fulfill({json:{items:[],paused:true}});
  if(p==='/jira/issue'){if(state.delay)await state.delay;return state.issueFailure?route.fulfill({status:404,json:{error:'Issue unavailable'}}):route.fulfill({json:issue(url.searchParams.get('key')!)});}
  if(p==='/jira/workflow'){state.workflowSites.push(url.searchParams.get('site')!);return route.fulfill({json:{issue:issue(url.searchParams.get('key')!),stage:'review',role:'developer',actions:[]}});}
  return route.fulfill({status:404,json:{error:'Fixture'}});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:language==='ru'?'Задачи':'Tasks',exact:true}).click();await expect(page.locator('.task-notification-bell>span')).toHaveText('2');return state;
}
for(const language of ['en','ru'])for(const scale of [60,130])test(`notification inbox ${language} ${scale}% keeps unread state and opens the correct Jira site`,async({page})=>{
 const state=await setup(page,language,scale);
 const bell=(await page.locator('.task-notification-bell').boundingBox())!;expect(bell.x+bell.width).toBeLessThanOrEqual(320);expect(bell.width).toBeGreaterThanOrEqual(48);
 await page.screenshot({path:`artifacts/screenshots/task-bell-${language}-${scale}.png`});await page.locator('.task-notification-bell').click();await expect(page.locator('.task-inbox')).toBeVisible();expect(state.reads).toHaveLength(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/screenshots/task-inbox-${language}-${scale}.png`});
 await page.locator('.task-inbox-item').filter({hasText:'DEMO-2'}).click();await expect(page.locator('.task-inbox')).toHaveCount(0);await expect(page.locator('.jira-detail')).toContainText('Description loaded from the notification');expect(state.workflowSites).toContain('site-b');expect(state.reads).toEqual([['notice-1']]);await expect(page.locator('.task-notification-bell>span')).toHaveText('1');
});
test('failed notification navigation stays unread; read-all persists after reload',async({page})=>{
 const state=await setup(page);state.issueFailure=true;await page.locator('.task-notification-bell').click();await page.locator('.task-inbox-item').filter({hasText:'DEMO-2'}).click();await expect(page.locator('.task-inbox [role=alert]')).toContainText('stays unread');expect(state.reads).toHaveLength(0);
 await page.getByRole('button',{name:'Mark all as read'}).click();await expect(page.locator('.task-notification-bell>span')).toHaveCount(0);await page.getByRole('button',{name:'Unread only'}).click();await expect(page.locator('.task-inbox-item')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.locator('.task-notification-bell')).toBeFocused();
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Tasks',exact:true}).click();await expect(page.locator('.task-notification-bell>span')).toHaveCount(0);await page.locator('.task-notification-bell').click();await expect(page.locator('.task-inbox-item')).toHaveCount(2);
});
test('closing the inbox cancels delayed task navigation',async({page})=>{
 const state=await setup(page);let release!:()=>void;state.delay=new Promise<void>(resolve=>{release=resolve;});await page.locator('.task-notification-bell').click();await page.locator('.task-inbox-item').filter({hasText:'DEMO-2'}).click();await page.getByRole('button',{name:'Close notifications',exact:true}).click();release();await expect(page.locator('.jira-detail')).toHaveCount(0);expect(state.reads).toHaveLength(0);
});
