import {test,expect,type Page} from '@playwright/test';

async function setup(page:Page){
 const root='C:/Synthetic/roadmap';
 const state={hold:false,release:()=>{},board:{id:'11111111-1111-4111-8111-111111111111',name:'Version roadmap',root,revision:0,repositoryFile:'board-example.json',repositoryRevision:'initial',versionSource:'planned',versions:[] as string[],branches:[],notes:[] as any[]}};
 await page.setViewportSize({width:412,height:915});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-pc-key-'.repeat(4)}));localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-board-grid-step','8');});
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname;
  if(p==='/api/health')return route.fulfill({json:{protocol:1,name:'Example PC',roots:[root]}});
  if(p==='/api/projects')return route.fulfill({json:[root]});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',available:true}]});
  if(p==='/api/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/api/project-board'){
   if(route.request().method()==='POST'){
    const body=route.request().postDataJSON();expect(body.root).toBe(root);expect(body.repositoryRevision).toBe(state.board.repositoryRevision);
    if(state.hold)await new Promise<void>(resolve=>state.release=resolve);
    state.board={...state.board,notes:body.notes,versions:body.versions,revision:state.board.revision+1,repositoryRevision:String(state.board.revision+1)};
    return route.fulfill({json:state.board});
   }
   return route.fulfill({json:{board:state.board,canEdit:true}});
  }
  if(p==='/api/task-runs')return route.fulfill({json:{runs:[]}});
  if(p.endsWith('notifications'))return route.fulfill({json:{items:[],unread:0}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.project-board-row .board-index-item').click();return state;
}
async function createNote(page:Page,title:string,y:number){
 await page.locator('.board-viewport').click({button:'right',position:{x:20,y}});await page.getByRole('menuitem',{name:'Create note'}).click();
 const dialog=page.getByRole('dialog',{name:'Note details'});await dialog.getByLabel('Title',{exact:true}).fill(title);await dialog.getByLabel('Description / acceptance criteria').fill('Synthetic acceptance criteria');await dialog.getByRole('combobox',{name:'Priority',exact:true}).selectOption(title==='First idea'?'low':'critical');
 await expect(dialog.locator('fieldset')).toHaveCount(0);await expect(dialog.getByRole('combobox',{name:'Version / branch',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).toHaveCount(0);
}

test('repository notes preserve grid drag, priority ordering, versions and edits across reopening',async({page})=>{
 const state=await setup(page);await createNote(page,'First idea',80);await createNote(page,'Second idea',420);
 await expect(page.locator('.board-note')).toHaveCount(2);await expect(page.locator('.board-edges path')).toHaveCount(0);
 const card=page.locator('.board-note').filter({hasText:'First idea'}),handle=card.locator('.note-drag'),position=()=>card.evaluate(el=>({x:parseFloat((el as HTMLElement).style.left),y:parseFloat((el as HTMLElement).style.top)}));
 const before=await position();state.hold=true;const box=(await handle.boundingBox())!;await page.mouse.move(box.x+20,box.y+15);await page.mouse.down();await page.mouse.move(box.x+60,box.y+47,{steps:4});await page.mouse.up();
 await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','true');const optimistic=await position();expect(optimistic).not.toEqual(before);expect(optimistic.x%8).toBe(0);expect(optimistic.y%8).toBe(0);state.hold=false;state.release();await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','false');expect(await position()).toEqual(optimistic);
 await page.getByRole('button',{name:'People',exact:true}).click();const tasks=page.getByRole('region',{name:'Unassigned',exact:true});await expect(tasks.locator('.people-task strong')).toHaveText(['Second idea','First idea']);await tasks.locator('.people-task').first().click();
 await page.getByRole('dialog',{name:'Note details'}).getByRole('combobox',{name:'Status',exact:true}).selectOption('working');await page.getByRole('dialog',{name:'Note details'}).getByRole('button',{name:'Save',exact:true}).click();await expect(tasks.locator('.people-task').first()).toContainText('Working');
 await page.getByRole('group',{name:'Board view',exact:true}).getByRole('button',{name:'Board',exact:true}).click();await expect(page.locator('.board-note').filter({hasText:'Second idea'})).toContainText('Critical');
 await page.getByRole('button',{name:'Create version',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Create version'});await dialog.getByLabel('Version name').fill('1.0');await dialog.getByRole('button',{name:'Create',exact:true}).click();
 const heading=page.getByRole('button',{name:'1.0',exact:true});await heading.scrollIntoViewIfNeeded();const headingBox=(await heading.boundingBox())!;await page.mouse.move(headingBox.x+20,headingBox.y+20);await page.mouse.down();dialog=page.getByRole('dialog',{name:'Rename version'});await expect(dialog).toBeVisible();await page.mouse.up();await dialog.getByLabel('Version name').fill('1.1');await dialog.getByRole('button',{name:'Rename',exact:true}).click();await expect(page.getByRole('button',{name:'1.1',exact:true})).toBeVisible();
 await page.setViewportSize({width:1200,height:915});await card.scrollIntoViewIfNeeded();const dragBox=(await handle.boundingBox())!;await page.mouse.move(dragBox.x+20,dragBox.y+15);await page.mouse.down();await page.mouse.move(dragBox.x+360,dragBox.y+15,{steps:8});await expect(page.locator('.board-drop-active')).toHaveCount(1);await page.mouse.up();await expect(page.locator('.board-drop-active')).toHaveCount(0);await expect.poll(()=>state.board.notes.find(n=>n.title==='First idea')?.branch).toBe('1.1');
 await page.reload();await page.locator('.project-board-row .board-index-item').click();await expect(page.locator('.board-note')).toHaveCount(2);await expect(page.locator('.board-note').filter({hasText:'Second idea'})).toContainText('Working');
 await page.locator('.board-note').filter({hasText:'Second idea'}).click({button:'right'});await page.getByRole('dialog',{name:'Delete note',exact:true}).getByRole('button',{name:'Delete note',exact:true}).click();await expect(page.locator('.board-note')).toHaveCount(1);expect(state.board.notes[0].title).toBe('First idea');
});

test('repository canvas pans and zooms, and a stationary touch hold creates a note',async({page})=>{
 await setup(page);const viewport=page.locator('.board-viewport'),canvas=page.locator('.board-canvas');await expect(page.getByRole('button',{name:/Zoom out|Zoom in/})).toHaveCount(0);
 const panBox=(await viewport.boundingBox())!;await page.mouse.move(panBox.x+350,panBox.y+300);await page.mouse.down();await page.mouse.move(panBox.x+230,panBox.y+300,{steps:6});await page.mouse.up();await expect.poll(()=>viewport.evaluate(el=>el.scrollLeft)).toBeGreaterThan(50);await viewport.evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
 await viewport.hover();await page.keyboard.down('Control');await page.mouse.wheel(0,240);await page.keyboard.up('Control');await expect.poll(()=>canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(.9);
 const before=await canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a),box=(await viewport.boundingBox())!,cx=box.x+box.width/2,cy=box.y+180,cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-40,y:cy,id:1},{x:cx+40,y:cy,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy,id:1},{x:cx+65,y:cy,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(()=>canvas.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(before);
 const holdX=box.x+box.width-18,holdY=box.y+450;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:holdX,y:holdY,id:3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:holdX-30,y:holdY,id:3}]});await page.waitForTimeout(650);await expect(page.getByRole('menu')).toHaveCount(0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:holdX,y:holdY,id:4}]});await expect(page.getByRole('menuitem',{name:'Create note'})).toBeVisible();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByRole('menuitem',{name:'Create note'}).click();await expect(page.getByRole('dialog',{name:'Note details'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();
});
