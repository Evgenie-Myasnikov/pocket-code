import {test,expect} from '@playwright/test';

// Synthetic host: every answer comes from page.route; "down" makes the tunnel answer 502 with an HTML page.
const root='C:\\Synthetic\\garden-app';
async function setup(page:import('@playwright/test').Page){
 const state={down:false,health:0};
 await page.setViewportSize({width:412,height:915});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-pc-key-'.repeat(4)}));});
 await page.route('**/api/**',route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/api/health')state.health++;
  if(state.down)return route.fulfill({status:502,contentType:'text/html',body:'<html>Bad gateway</html>'});
  if(p==='/api/health')return route.fulfill({json:{protocol:1,name:'Example PC',roots:[root],version:'0.0.0'}});
  if(p==='/api/projects')return route.fulfill({json:[root]});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true}]});
  if(p==='/api/sessions')return route.fulfill({json:[{sessionId:'saved-chat',cwd:root,summary:'Saved chat',lastModified:Date.now()}]});
  if(p.startsWith('/api/sessions/saved-chat/messages'))return route.fulfill({json:{messages:[{id:'m1',role:'assistant',blocks:[{type:'text',text:'Saved reply'}]}],previous:null,next:null}});
  if(p==='/api/workspaces')return route.fulfill({json:{host:true,workspaces:[],boards:[]}});
  if(p.endsWith('notifications'))return route.fulfill({json:{items:[],unread:0}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');
 return state;
}

test('a tunnel 502 shows one connection line, no Codex advice, and keeps the draft with Send disabled',async({page})=>{
 const state=await setup(page);
 await page.getByRole('button',{name:'Saved chat'}).click();await expect(page.getByText('Saved reply',{exact:true})).toBeVisible();
 await page.getByLabel('Message Claude').fill('Synthetic draft');
 state.down=true;
 const line=page.locator('.workspace .connection-status');
 await expect(line).toContainText('The tunnel answers, the PC host does not',{timeout:15000});
 await expect(page.locator('.workspace .connection-status')).toHaveCount(1);
 await expect(page.locator('.workspace [role="alert"]')).toHaveCount(0);
 await expect(page.getByText(/enable the Codex workspace|to enable Codex/)).toHaveCount(0);
 await expect(page.getByText('No connection to the PC · the draft is kept')).toBeVisible();
 await expect(page.getByRole('button',{name:'Send message'})).toBeDisabled();
 await expect(page.getByLabel('Message Claude')).toHaveValue('Synthetic draft');
 // The PC answers again: Retry probes at once and the line goes away.
 state.down=false;await line.getByRole('button',{name:'Retry'}).click();
 await expect(page.locator('.workspace .connection-status')).toHaveCount(0,{timeout:10000});
 await expect(page.getByRole('button',{name:'Send message'})).toBeEnabled();
});
