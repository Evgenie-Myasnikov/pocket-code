import {test,expect} from '@playwright/test';
test('workspace creates a board, saves notes without dependency controls, opens a prepared chat',async({page,request})=>{
 const token='test-only-'.repeat(5),url='http://127.0.0.1:4319';
 const health=await (await request.get(url+'/api/health',{headers:{Authorization:'Bearer '+token}})).json();
 const name='Synthetic workspace '+Date.now();
 const created=await request.post(url+'/api/workspaces',{headers:{Authorization:'Bearer '+token},data:{name,password:'synthetic strong password',roots:[health.roots[0]]}});expect(created.ok()).toBe(true);const ws=await created.json();await request.post(url+'/api/workspace-login',{data:{name,password:'synthetic strong password',displayName:'Morgan'}});
 await page.addInitScript(({url,token,wsId})=>{sessionStorage.setItem('connection',JSON.stringify({url,token,workspaceAccess:{url,token,workspaceId:wsId}}));localStorage.setItem('pocket-code-language','en');},{url,token,wsId:ws.id});
 await page.setViewportSize({width:412,height:915});await page.goto('http://127.0.0.1:5173');
 await page.getByRole('dialog',{name:'Your workspace name'}).getByLabel('What is your name?').fill('Alex');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('dialog',{name:'Your workspace name'})).not.toBeVisible();
 await page.locator('.mobile-nav').getByRole('button',{name:'WorkSpace',exact:true}).click();
 await expect(page.locator('.board-header').getByRole('button',{name:'Workspace',exact:true})).toHaveCount(0);
 await expect(page.locator('.board-header h1')).toHaveText(name);await expect(page.getByRole('combobox',{name:'Workspace',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Edit workspace',exact:true})).toHaveCount(0);
 await expect(page.locator('.workspace-members')).toHaveCount(0);
 await page.locator('.board-header').getByRole('button',{name:'Participants: 2',exact:true}).click();
 const roster=page.getByRole('dialog',{name:'Participants',exact:true});await expect(roster).toBeVisible();await expect(roster.locator('li')).toHaveCount(2);await expect(roster.locator('select')).toHaveCount(0);await expect(roster.getByRole('button',{name:'Revoke access'})).toHaveCount(0);await roster.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByText('Members and roles',{exact:false})).toHaveCount(0);
 let dialog;
 await request.post(url+'/api/boards',{headers:{Authorization:'Bearer '+token},data:{workspaceId:ws.id,name:'Version roadmap',root:health.roots[0],example:false,versionSource:'git'}});await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'WorkSpace',exact:true}).click();await page.getByRole('button',{name:/Version roadmap/}).click();
 for(const title of ['First idea','Second idea']){await expect(page.getByRole('button',{name:'Note',exact:true})).toHaveCount(0);await page.locator('.board-viewport').click({button:'right',position:{x:20,y:title==='First idea'?80:420}});await page.getByRole('menuitem',{name:'Create note'}).click();dialog=page.getByRole('dialog',{name:'Note details'});await dialog.getByLabel('Title',{exact:true}).fill(title);await dialog.getByLabel('Description / acceptance criteria').fill('Synthetic acceptance criteria');await dialog.getByRole('combobox',{name:'Priority',exact:true}).selectOption(title==='First idea'?'low':'critical');await dialog.getByRole('button',{name:'Add participant',exact:true}).click();await page.getByRole('dialog',{name:'Add participant',exact:true}).getByRole('button',{name:'Alex'}).click();if(title==='Second idea'){await dialog.getByRole('button',{name:'Add participant',exact:true}).click();await page.getByRole('dialog',{name:'Add participant',exact:true}).getByRole('button',{name:'Morgan'}).click();}await expect(dialog.locator('fieldset')).toHaveCount(0);await expect(dialog.getByRole('combobox',{name:'Version / branch',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);}
 await expect(page.locator('.board-note')).toHaveCount(2);await expect(page.locator('.board-note').filter({hasText:'Second idea'}).locator('.assignee-chip')).toHaveCount(2);const avatar=await page.locator('.board-note').first().locator('.assignee-chip .person-avatar').boundingBox(),remove=await page.locator('.board-note').first().locator('.assignee-remove').boundingBox();expect(remove!.x+remove!.width/2).toBeGreaterThan(avatar!.x+avatar!.width/2+8);await page.screenshot({path:'artifacts/screenshots/board-avatars-mobile.png'});await expect(page.locator('.board-edges path')).toHaveCount(0);
 expect(await page.locator('.board-note').first().evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}))).toEqual({x:20,y:80});

 // Release keeps the dragged position while the host is still saving.
 await page.route(/\/api\/boards\/[a-f0-9-]+$/,async route=>{if(route.request().method()==='POST')await new Promise(r=>setTimeout(r,800));await route.continue();});
 const card=page.locator('.board-note').first(),handle=card.locator('.note-drag');const handleBox=await handle.boundingBox();
 await page.mouse.move(handleBox!.x+20,handleBox!.y+15);await page.mouse.down();await page.mouse.move(handleBox!.x+60,handleBox!.y+45,{steps:4});await page.mouse.up();
 expect(await card.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}))).toEqual({x:48,y:110});
 await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','false');
 await expect(card).toHaveCSS('left','48px');await page.unroute(/\/api\/boards\/[a-f0-9-]+$/);

 await page.getByRole('button',{name:'People',exact:true}).click();
 const hostColumn=page.getByRole('region',{name:'Alex',exact:true});await expect(page.getByRole('region',{name:'Morgan',exact:true}).locator('.people-task')).toHaveCount(1);
 await expect(hostColumn.locator('.people-task strong')).toHaveText(['Second idea','First idea']);
 await expect(hostColumn.locator('.people-task').first()).toContainText('Critical');await expect(hostColumn.locator('.people-task').first()).toContainText('Idea');
 await hostColumn.locator('.people-task').first().click();
 await page.getByRole('dialog',{name:'Note details'}).getByRole('combobox',{name:'Status',exact:true}).selectOption('working');
 await page.getByRole('dialog',{name:'Note details'}).getByRole('button',{name:'Save',exact:true}).click();
 await expect(hostColumn.locator('.people-task').first()).toContainText('Working');

 await page.screenshot({path:'.local/board-people-mobile.png'});
 await hostColumn.locator('.people-task').filter({hasText:'First idea'}).click();
 await page.getByRole('dialog',{name:'Note details'}).getByRole('button',{name:'Remove Alex',exact:true}).click();
 await page.getByRole('dialog',{name:'Note details'}).getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('region',{name:'Unassigned',exact:true}).locator('.people-task')).toHaveCount(1);
 await expect(hostColumn.locator('.people-task')).toHaveCount(1);
 await page.getByRole('group',{name:'Board view',exact:true}).getByRole('button',{name:'Board',exact:true}).click();
 await expect(page.locator('.board-note').filter({hasText:'Second idea'}).locator('.board-task-meta')).toContainText('Working');
 await expect(page.locator('.board-note').filter({hasText:'Second idea'}).locator('.board-task-meta')).toContainText('Critical');
 await expect(page.getByRole('button',{name:/Zoom out|Zoom in/})).toHaveCount(0);
 const viewport=page.locator('.board-viewport'),canvas=page.locator('.board-canvas');
 await viewport.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});const panBox=await viewport.boundingBox();await page.mouse.move(panBox!.x+350,panBox!.y+300);await page.mouse.down();await page.mouse.move(panBox!.x+230,panBox!.y+300,{steps:6});await page.mouse.up();await expect.poll(()=>viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);await viewport.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});await viewport.hover();await page.keyboard.down('Control');await page.mouse.wheel(0,240);await page.keyboard.up('Control');
 await expect.poll(()=>canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(.9);
 const before=await canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
 const box=await viewport.boundingBox(),cx=box!.x+box!.width/2,cy=box!.y+180;
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-40,y:cy,id:1},{x:cx+40,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy,id:1},{x:cx+65,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(before);
 await expect(page.getByRole('dialog')).toHaveCount(0);

 // Hold empty canvas: movement cancels, a stationary hold opens a menu.
 const holdX=box!.x+box!.width-18,holdY=box!.y+450;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:holdX,y:holdY,id:3}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:holdX-30,y:holdY,id:3}]});
 await page.waitForTimeout(650);await expect(page.getByRole('menu')).toHaveCount(0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:holdX,y:holdY,id:4}]});
 await expect(page.getByRole('menuitem',{name:'Create note'})).toBeVisible();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.getByRole('menuitem',{name:'Create note'}).click();
 await expect(page.getByRole('dialog',{name:'Note details'})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();

 await expect(page.getByLabel('Add version',{exact:true})).toHaveCount(0);
 await page.route(/\/api\/boards\/[a-f0-9-]+\/branch$/,async route=>{
  const input=route.request().postDataJSON();const response=await request.get(route.request().url().replace(/\/branch$/,''),{headers:{Authorization:'Bearer '+token}});const data=await response.json();
  await route.fulfill({json:{...data,versions:[input.name],branches:[input.name]}});
 });
 await page.getByRole('button',{name:'Create branch',exact:true}).click();
 const branchDialog=page.getByRole('dialog',{name:'Create branch'});await branchDialog.getByLabel('Branch name').fill('release/demo');await branchDialog.getByRole('button',{name:'Create',exact:true}).click();
 const heading=page.getByRole('button',{name:'release/demo',exact:true});await heading.scrollIntoViewIfNeeded();const headingBox=await heading.boundingBox();
 await page.mouse.move(headingBox!.x+20,headingBox!.y+20);await page.mouse.down();await expect(page.getByRole('dialog',{name:'Rename branch'})).toBeVisible();await page.mouse.up();
 await page.getByRole('dialog',{name:'Rename branch'}).getByLabel('Branch name').fill('release/next');await page.getByRole('button',{name:'Rename',exact:true}).click();await expect(page.getByRole('button',{name:'release/next',exact:true})).toBeVisible();
 await page.setViewportSize({width:1200,height:915});await viewport.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
 const noteHandle=page.locator('.board-note').filter({hasText:'First idea'}).locator('.note-drag');await noteHandle.scrollIntoViewIfNeeded();const dragBox=await noteHandle.boundingBox(),scale=await canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
 await page.mouse.move(dragBox!.x+20,dragBox!.y+15);await page.mouse.down();await page.mouse.move(dragBox!.x+20+340*scale,dragBox!.y+15,{steps:8});await expect(page.locator('.board-drop-active')).toHaveCount(1);await page.mouse.up();await expect(page.locator('.board-drop-active')).toHaveCount(0);await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','false');
 const savedCatalog=await (await request.get(url+'/api/workspaces',{headers:{Authorization:'Bearer '+token}})).json();
 const savedBoard=await (await request.get(url+'/api/boards/'+savedCatalog.boards.find((b:any)=>b.workspaceId===ws.id).id,{headers:{Authorization:'Bearer '+token}})).json();expect(savedBoard.notes.find((n:any)=>n.title==='First idea').branch).toBe('release/next');
 await page.setViewportSize({width:412,height:915});
 await page.screenshot({path:'artifacts/screenshots/workspace-board-mobile.png'});
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'WorkSpace',exact:true}).click();await page.getByRole('button',{name:/Version roadmap/}).click();await expect(page.locator('.board-note')).toHaveCount(2);
 await page.locator('.board-note').filter({hasText:'First idea'}).getByRole('button',{name:'Discuss with AI',exact:true}).click();await expect(page.locator('textarea')).toHaveValue(/First idea/);
 const catalog=await (await request.get(url+'/api/workspaces',{headers:{Authorization:'Bearer '+token}})).json();expect(catalog.workspaces.find((w:any)=>w.name===name).roots).toContain(health.roots[0]);
});
