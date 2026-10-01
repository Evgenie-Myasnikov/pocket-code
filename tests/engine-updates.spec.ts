import {test,expect} from '@playwright/test';
test('AI compatibility settings show versions and persist the server-side automatic trigger',async({page})=>{
 let enabled=true,checks=0;const state=()=>({supported:true,enabled,provider:'codex',sourceRoot:'C:\\Workspace\\pocket-code',versions:{codex:'1.2.3',claude:'2.3.4'},changes:checks?[{id:'change',engine:'codex',from:'1.2.2',to:'1.2.3',state:'pending'}]:[]});
 await page.addInitScript(()=>{localStorage.setItem('pocket-code-workspace','codex');sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
 await page.route('**/api/**',route=>{const endpoint=new URL(route.request().url()).pathname;
 if(endpoint==='/api/health')return route.fulfill({json:{name:'Test PC',roots:['C:\\Workspace\\pocket-code'],protocol:1}});
 if(endpoint==='/api/providers')return route.fulfill({json:[{id:'codex',available:true,models:[]}]});
 if(endpoint==='/api/jobs'||endpoint==='/api/sessions')return route.fulfill({json:[]});
 if(endpoint.startsWith('/api/engine-updates')){if(endpoint.endsWith('/settings')){const body=route.request().postDataJSON();if(typeof body.enabled==='boolean')enabled=body.enabled;}if(endpoint.endsWith('/check'))checks++;return route.fulfill({json:state()});}
 return route.fulfill({status:404,json:{error:'Synthetic endpoint'}});
 });
 await page.setViewportSize({width:320,height:740});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Updates',exact:true}).click();
 await expect(page.getByText('Codex 1.2.3 · Claude 2.3.4')).toBeVisible();await page.getByLabel('Create an AI task when a version changes').uncheck();await expect.poll(()=>enabled).toBe(false);
 await page.getByRole('button',{name:'Check AI versions'}).click();await page.locator('.engine-updates summary').click();await expect(page.getByText('Waiting for the project to be idle')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
