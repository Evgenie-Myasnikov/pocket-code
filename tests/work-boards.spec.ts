import {test,expect} from '@playwright/test';
test('workspace creates a board, saves notes and dependencies, opens a prepared chat',async({page,request})=>{
 const token='test-only-'.repeat(5),url='http://127.0.0.1:4319';
 const health=await (await request.get(url+'/api/health',{headers:{Authorization:'Bearer '+token}})).json();
 const name='Synthetic workspace '+Date.now();
 await page.addInitScript(({url,token})=>{sessionStorage.setItem('connection',JSON.stringify({url,token}));localStorage.setItem('pocket-code-language','en');},{url,token});
 await page.setViewportSize({width:412,height:915});await page.goto('http://127.0.0.1:5173');
 await page.locator('.mobile-nav').getByRole('button',{name:'Work',exact:true}).click();
 await page.locator('.board-toolbar').getByRole('button',{name:'Workspace',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Workspace settings'});await dialog.getByLabel('Name',{exact:true}).fill(name);await dialog.locator('input[type=password]').fill('synthetic strong password');await dialog.locator('input[type=checkbox]').first().check();await dialog.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Project board',exact:true}).click();dialog=page.getByRole('dialog',{name:'New board'});await dialog.getByLabel('Name',{exact:true}).fill('Version roadmap');await dialog.getByRole('button',{name:'Save',exact:true}).click();
 for(const title of ['First idea','Second idea']){await page.getByRole('button',{name:'Note',exact:true}).click();dialog=page.getByRole('dialog',{name:'Note details'});await dialog.getByLabel('Title',{exact:true}).fill(title);await dialog.getByLabel('Description / acceptance criteria').fill('Synthetic acceptance criteria');if(title==='Second idea')await dialog.getByLabel('First idea').check();await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);}
 await expect(page.locator('.board-note')).toHaveCount(2);await expect(page.locator('.board-edges path')).toHaveCount(1);
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(page.getByRole('button',{name:'85%',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/workspace-board-mobile.png'});
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Work',exact:true}).click();await page.getByRole('button',{name:/Version roadmap/}).click();await expect(page.locator('.board-note')).toHaveCount(2);
 await page.getByRole('button',{name:'Discuss with AI',exact:true}).first().click();await expect(page.locator('textarea')).toHaveValue(/First idea/);
 const catalog=await (await request.get(url+'/api/workspaces',{headers:{Authorization:'Bearer '+token}})).json();expect(catalog.workspaces.find((w:any)=>w.name===name).roots).toContain(health.roots[0]);
});
