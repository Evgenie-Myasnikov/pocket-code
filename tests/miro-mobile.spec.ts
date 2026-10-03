import {test,expect} from '@playwright/test';
for(const width of [360,430])test('mobile Miro settings, embedded board and Back at '+width,async({page})=>{
 let miro:null|{root:string;url:string}=null;const root='C:\\Demo\\Atlas';await page.setViewportSize({width,height:850});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-token'.repeat(4)}));localStorage.setItem('pocket-code-language-v1','en');});
 await page.route('https://miro.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Synthetic Miro board</body></html>'}));
 await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;
  if(p==='/api/health')return r.fulfill({json:{protocol:1,name:'Synthetic PC',roots:[root]}});
  if(p==='/api/providers')return r.fulfill({json:[{id:'claude',name:'Claude',available:true,models:[]}]});
  if(p==='/api/projects')return r.fulfill({json:[root]});
  if(p==='/api/workspaces')return r.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/api/project-board')return r.fulfill({json:{board:null,miro,canEdit:true}});
  if(p==='/api/project-board/miro'){const body=r.request().postDataJSON();miro=body.url?{root:body.root,url:body.url}:null;return r.fulfill({json:{miro}});}
  if(p==='/api/updates/status')return r.fulfill({json:{enabled:false}});
  if(p==='/api/board-notifications'||p==='/api/task-notifications')return r.fulfill({json:{items:[],unread:0}});
  return r.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Miro',exact:true}).click();
 await page.getByLabel('Miro board link').fill('https://miro.com/app/board/synthetic_123=/');await page.getByRole('button',{name:'Connect Miro board'}).click();await expect(page.getByRole('status')).toContainText('Miro board connected');
 await page.locator('.mobile-nav').getByRole('button',{name:'Board',exact:true}).click();await expect(page.locator('.mobile-workspace-header')).toHaveCount(0);await page.locator('.project-board-row').getByRole('button').click();await expect(page.locator('iframe[title="Miro live board"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/miro-mobile-'+width+'.png'});
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await expect(page.locator('iframe')).toHaveCount(0);
});
