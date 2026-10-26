import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {openSection} from './chat-navigation';

test('opening and revisiting a board refresh MCP, ordinary refresh and gallery navigation do not',async({page})=>{
 await desktop(page);const rail=page.locator('.desktop-rail');
 const count=()=>page.evaluate(()=>new Set((window as any).desktopCalls.filter((c:any)=>c.endpoint==='/project-board/mcp'&&c.action==='write').map((c:any)=>c.data.opening)).size);
 await rail.getByRole('button',{name:'Board',exact:true}).click();
 await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
 await expect.poll(count).toBe(1);
 const first=await page.evaluate(()=>(window as any).desktopCalls.find((c:any)=>c.endpoint==='/project-board/mcp').data.opening);
 await page.getByRole('button',{name:'Refresh board',exact:true}).click();
 await page.getByRole('button',{name:'Board images',exact:true}).click();await page.getByRole('button',{name:'Back to board',exact:true}).click();
 expect(await count()).toBe(1);
 await rail.getByRole('button',{name:'Chats',exact:true}).click();await rail.getByRole('button',{name:'Board',exact:true}).click();
 await expect.poll(count).toBe(2);
 const second=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint==='/project-board/mcp').at(-1).data.opening);expect(second).not.toBe(first);
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();await expect.poll(count).toBe(3);
});


test('retained mobile board starts a new MCP entry after leaving while sheet and gallery preserve the current entry',async({page})=>{
 await page.setViewportSize({width:390,height:844});const root='C:\\Synthetic\\BoardProject',id='11111111-1111-4111-8111-111111111111',objectId='22222222-2222-4222-8222-222222222222',openings:string[]=[],requests={view:0,status:0,live:0,runs:0};
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-board-token'}));localStorage.setItem('pocket-code-language-v1','en');});
 await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname.slice(4);
  if(path==='/health')return route.fulfill({json:{name:'Synthetic board host',roots:[root],version:'0.28.14',protocol:1}});
  if(path==='/providers')return route.fulfill({json:[{id:'claude',available:true,authenticated:true,models:[]}]});
  if(path==='/projects')return route.fulfill({json:[root]});
  if(path==='/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(path==='/project-board')return route.fulfill({json:{board:{id,name:'Synthetic board',root,repositoryFile:'board-'+id+'.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',notes:[{id:objectId,title:'Synthetic retained selection',description:'Keep selection and camera',branch:'',owner:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[]}],versions:[],branches:[]},canEdit:true}});
  if(path==='/project-board/mcp'&&route.request().method()==='POST'){openings.push(route.request().postDataJSON().opening);return route.fulfill({json:{generation:'synthetic-generation'}});}
  if(path==='/project-board/mcp/status'){requests.status++;return route.fulfill({json:{state:'ready',tools:[]}});}
  if(path==='/project-board/view'){requests.view++;return route.fulfill({json:{command:null}});}
  if(path==='/project-board/live'){requests.live++;return route.fulfill({json:{version:'a'.repeat(64),unchanged:true,activity:null}});}
  if(path==='/task-runs'){requests.runs++;return route.fulfill({json:{runs:[]}});}
  if(['/sessions','/jobs','/activity'].includes(path))return route.fulfill({json:[]});
  if(path==='/updates/latest')return route.fulfill({json:{enabled:false}});
  return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
 });
 const count=()=>new Set(openings).size;
 await page.goto('http://127.0.0.1:5173');await openSection(page,'Board');const card=page.locator('.board-index-item');if(await card.count())await card.first().click();await expect(page.locator('.whiteboard-viewport')).toBeVisible();await expect.poll(count).toBe(1);const first=openings[0];await page.evaluate(()=>(window as any).retainedEntryCanvas=document.querySelector('.whiteboard-viewport'));
 await page.locator(`[data-canvas-id="${objectId}"] .whiteboard-text`).click();await page.locator('.whiteboard-viewport').dispatchEvent('wheel',{deltaX:20,deltaY:20});const transform=await page.locator('.whiteboard-world').evaluate(el=>getComputedStyle(el).transform);await expect.poll(()=>requests.view).toBeGreaterThan(0);await expect.poll(()=>requests.status).toBeGreaterThan(0);
 await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toBeHidden();expect(count()).toBe(1);
 await page.getByRole('button',{name:'Board images',exact:true}).click();await page.getByRole('button',{name:'Back to board',exact:true}).click();expect(count()).toBe(1);
 await openSection(page,'Settings');await expect(page.locator('.mobile-board-stage')).toBeHidden();await page.waitForTimeout(300);const hiddenRequests={...requests};await page.waitForTimeout(2200);expect(requests).toEqual(hiddenRequests);await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));await openSection(page,'Board');await expect(page.locator('.board-header')).toBeVisible();expect(await page.evaluate(()=>(window as any).retainedEntryCanvas===document.querySelector('.whiteboard-viewport'))).toBe(true);await expect.poll(count).toBe(2);expect(openings.at(-1)).not.toBe(first);await expect(page.locator(`[data-canvas-id="${objectId}"]`)).toHaveClass(/wb-selected/);expect(await page.locator('.whiteboard-world').evaluate(el=>getComputedStyle(el).transform)).toBe(transform);await expect.poll(()=>requests.view).toBeGreaterThan(hiddenRequests.view);
});
