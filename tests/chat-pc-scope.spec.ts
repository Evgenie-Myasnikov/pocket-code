import {test,expect} from '@playwright/test';
import {connectByQr} from './qr-connect';
test('board navigation and legacy workspace metadata preserve PC chats while credentials isolate identical session IDs',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const tokenA='synthetic-pc-a-'.repeat(4),tokenB='synthetic-pc-b-'.repeat(4),url='http://127.0.0.1:4319',one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
 await page.addInitScript(({url,tokenA,one,two})=>{const accesses=[{url,token:'workspace-one',workspaceId:one,name:'Team One'},{url,token:'workspace-two',workspaceId:two,name:'Team Two'}];sessionStorage.setItem('connection',JSON.stringify({url,token:tokenA,workspaceAccess:accesses[0],workspaceAccesses:accesses}));},{url,tokenA,one,two});
 await page.route('**/api/**',route=>{const u=new URL(route.request().url()),key=route.request().headers().authorization,pc=key==='Bearer '+tokenB?'B':'A';let json:any=[];
  if(u.pathname==='/api/health')json={protocol:1,name:'PC '+pc,roots:['C:\\Example'],version:'test'};
  if(u.pathname==='/api/providers')json=['claude','codex','copilot'].map(id=>({id,available:true,authenticated:true}));
  if(u.pathname==='/api/projects')json=['C:\\Example'];
  if(u.pathname==='/api/sessions')json=[{sessionId:'identical-id',cwd:'C:\\Example',summary:'Conversation '+pc,lastModified:1,provider:u.searchParams.get('provider')||'claude'}];
  if(u.pathname.includes('/messages'))json={messages:[{id:'same-message',role:'assistant',blocks:[{type:'text',text:'Private reply '+pc}]}],previous:null,next:null};
  if(u.pathname==='/api/workspaces'){const id=key==='Bearer workspace-two'?two:one;json={host:false,workspaces:[{id,name:id===one?'Team One':'Team Two',roots:[],role:'viewer',me:{id:'person',name:'Alex Example',needsName:false},people:[]}],boards:[]};}
  if(u.pathname==='/api/board-notifications')json={items:[]};
  return route.fulfill({json});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
 for(const provider of ['codex','copilot','claude']){
  await page.locator('.workspace-picker-sidebar select').selectOption(provider);
  await expect(page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true})).toHaveClass('active');
  await expect(page.getByRole('button',{name:/Conversation A/})).toBeVisible();
  await expect(page.locator('.mobile-workspace-header')).toHaveCount(0);
 }
 await page.getByRole('button',{name:/Conversation A/}).click();await expect(page.getByText('Private reply A')).toBeVisible();await page.getByLabel('Message Claude').fill('Draft on A');
 await page.locator('.mobile-nav').getByRole('button',{name:'Board',exact:true}).click();await expect(page.locator('.mobile-workspace-header')).toHaveCount(0);await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByLabel('Message Claude')).toHaveValue('Draft on A');await expect(page.getByText('Private reply A')).toBeVisible();
 async function changePc(token:string){await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'PC connection',exact:true}).click();await connectByQr(page,url,token);await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('connection')||'{}').token)).toBe(token);await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();}
 await changePc(tokenB);await page.getByRole('button',{name:/Conversation B/}).click();await expect(page.getByText('Private reply B')).toBeVisible();await expect(page.getByText('Private reply A')).toHaveCount(0);await expect(page.getByLabel('Message Claude')).toHaveValue('');await page.getByLabel('Message Claude').fill('Draft on B');
 await changePc(tokenA);await expect(page.getByLabel('Message Claude')).toHaveValue('Draft on A');await expect(page.getByText('Private reply A')).toBeVisible();
});
