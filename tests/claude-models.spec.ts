import {test,expect,type Page} from '@playwright/test';
const cwd='C:\\Synthetic\\project';
async function setup(page:Page,fallback=false){
 const sent:any[]=[];
 await page.setViewportSize({width:412,height:915});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  if(p==='/api/health')return route.fulfill({json:{name:'Synthetic PC',roots:[cwd],protocol:1,version:'0.25.11'}});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true,models:[]}]});
  if(p==='/api/projects')return route.fulfill({json:[cwd]});
  if(p==='/api/claude/models')return fallback?route.fulfill({status:503,json:{error:'Synthetic unavailable'}}):route.fulfill({json:{source:'sdk',models:[{id:'sonnet',name:'Sonnet',resolvedModel:'claude-sonnet-fixture',isDefault:true},{id:'claude-sonnet-fixture',name:'claude-sonnet-fixture'},{id:'claude-opus-fixture',name:'claude-opus-fixture'}]}});
  if(p==='/api/jobs'&&route.request().method()==='POST'){const body=route.request().postDataJSON();sent.push(body);return route.fulfill({json:{...body,provider:'claude',status:'done',messages:[],partial:'',approvals:[],startedAt:1,revision:1}});}
  if(p==='/api/workspaces')return route.fulfill({json:{host:true,workspaces:[],boards:[]}});
  if(p==='/api/project-board')return route.fulfill({json:{board:null}});
  if(p.includes('notifications'))return route.fulfill({json:{items:[],unread:0}});
  if(p==='/api/review/availability')return route.fulfill({json:{available:false}});
  if(p.startsWith('/api/updates'))return route.fulfill({json:{enabled:false}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
 await page.getByRole('button',{name:'New',exact:true}).click();
 await expect(page.getByLabel('Message Claude')).toBeVisible();return sent;
}
test('Claude versions are selectable, persisted and sent; an explicit version can be entered',async({page})=>{
 const sent=await setup(page);const models=page.getByLabel('Claude model',{exact:true});
 await expect(models.locator('option[value="claude-sonnet-fixture"]')).toHaveCount(1);
 await models.selectOption('claude-sonnet-fixture');await page.reload();
 await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();await page.getByRole('button',{name:'New',exact:true}).click();
 await expect(models).toHaveValue('claude-sonnet-fixture');
 await page.getByLabel('Message Claude').fill('Synthetic pinned model request');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(()=>sent[0]?.model).toBe('claude-sonnet-fixture');
 await models.selectOption('__custom__');await page.getByLabel('Claude model ID').fill('claude-custom-fixture[1m]');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(models).toHaveValue('claude-custom-fixture[1m]');
 await page.screenshot({path:'.local/claude-model-picker-mobile.png'});
});
test('an older host still offers aliases and a custom ID without blocking the composer',async({page})=>{
 await setup(page,true);await expect(page.getByLabel('Model catalog unavailable')).toBeVisible();
 await page.getByLabel('Claude model',{exact:true}).selectOption('opus');await expect(page.getByLabel('Message Claude')).toBeEnabled();
});
