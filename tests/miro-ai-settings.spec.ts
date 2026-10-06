import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,baseURL:string,canManage:boolean){
 const writes:{path:string;body:any}[]=[];let status={configured:false,authenticated:false,enabled:false,allowWrite:false,signInPending:false,canManage,linked:true,redirectUri:'http://127.0.0.1:4318/miro/oauth/callback'};
 await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','en'));
 await page.route('**/api/**',async route=>{const pathname=new URL(route.request().url()).pathname,body=route.request().postDataJSON();if(body)writes.push({path:pathname,body});
  if(pathname==='/api/project-board')return route.fulfill({json:{miro:{url:'https://miro.com/app/board/synthetic_board/'},canEdit:true}});
  if(pathname==='/api/miro/status')return route.fulfill({json:status});
  if(pathname==='/api/miro/config'){status={...status,configured:true};return route.fulfill({json:{ok:true}});}
  if(pathname==='/api/miro/token'){status={...status,authenticated:true};return route.fulfill({json:{ok:true}});}
  if(pathname==='/api/miro/access'){status={...status,enabled:body.enabled,allowWrite:body.allowWrite};return route.fulfill({json:status});}
  if(pathname==='/api/miro/disconnect'){status={...status,authenticated:false,enabled:false,allowWrite:false};return route.fulfill({json:{ok:true}});}
  if(pathname==='/api/miro/items')return route.fulfill({json:{items:[{id:'synthetic-note'}]}});
  return route.fulfill({json:[]});
 });
 await page.goto(baseURL);await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{MiroHarness}=await import('/tests/fixtures/MiroHarness.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(MiroHarness));});
 await expect(page.getByRole('heading',{name:'AI access'})).toBeVisible();return writes;
}
test('Miro PC setup keeps credentials out of persistent browser storage and enables each capability explicitly',async({page,baseURL})=>{
 const writes=await setup(page,baseURL||'http://127.0.0.1:5173',true);
 await page.getByText('Set up Miro sign-in',{exact:true}).click();await page.getByLabel('Client ID',{exact:true}).fill('synthetic-client');await page.getByLabel('Client secret',{exact:true}).fill('synthetic-secret');await page.getByRole('button',{name:'Save app configuration'}).click();await expect(page.getByLabel('Client secret',{exact:true})).toHaveValue('');
 await page.getByText('Use an app access token',{exact:true}).click();await page.getByLabel('Access token',{exact:true}).fill('synthetic-token');await page.getByRole('button',{name:'Check and save token'}).click();await expect(page.getByLabel('Access token',{exact:true})).toHaveValue('');
 const read=page.getByLabel('Allow AI to read this board',{exact:true}),write=page.getByLabel('Allow AI to update sticky notes, text and cards',{exact:true});await expect(read).not.toBeChecked();await expect(write).toBeDisabled();await read.click();await expect(read).toBeChecked();await expect(write).toBeEnabled();await write.click();await expect(write).toBeChecked();
 await page.getByRole('button',{name:'Check board access'}).click();await expect(page.getByText('Access checked. Items on the first page: 1')).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('synthetic-secret'))).toBe(false);expect(await page.locator('form form').count()).toBe(0);
 await page.getByRole('button',{name:'Disconnect AI access'}).click();await expect(read).toBeDisabled();await expect(page.getByLabel('Miro board link')).toHaveValue('https://miro.com/app/board/synthetic_board/');
 expect(writes.some(w=>w.path==='/api/project-board/miro')).toBe(false);expect(writes.filter(w=>w.path==='/api/miro/access').map(w=>w.body)).toEqual([{root:'C:\\Synthetic\\Atlas',enabled:true,allowWrite:false},{root:'C:\\Synthetic\\Atlas',enabled:true,allowWrite:true}]);
});
test('Miro phone settings show host-owned AI access without credential controls or overflow',async({page,baseURL})=>{
 await page.setViewportSize({width:360,height:800});await setup(page,baseURL||'http://127.0.0.1:5173',false);
 await expect(page.getByText('Set up access on the host PC.')).toBeVisible();await expect(page.getByLabel('Client secret',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Access token',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Disconnect AI access'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
