import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`unified canvas preserves legacy task records at ${width}`,async({page})=>{
 const root='C:/Synthetic/roadmap',id='11111111-1111-4111-8111-111111111111',noteId='22222222-2222-4222-8222-222222222222';
 let board:any={id,name:'Example roadmap',root,revision:0,repositoryFile:'board-example.json',repositoryRevision:'a'.repeat(64),versionSource:'planned',versions:['1.0'],branches:[],notes:[{id:noteId,title:'Existing card',description:'Acceptance criteria',owner:'',branch:'1.0',status:'review',priority:'high',x:20,y:20,dependencies:[]}]};
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-pc-key-'.repeat(4)}));localStorage.setItem('pocket-code-language-v1','en');});
 await page.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(p==='/api/health')return route.fulfill({json:{protocol:1,version:'0.28.0',name:'Example PC',roots:[root]}});
  if(p==='/api/projects')return route.fulfill({json:[root]});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true}]});
  if(p==='/api/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/api/project-board'){
   if(route.request().method()==='POST'){const body=route.request().postDataJSON();expect(body.repositoryRevision).toBe(board.repositoryRevision);board={...board,...body,revision:board.revision+1,repositoryRevision:String(board.revision+1).padStart(64,'0')};return route.fulfill({json:board});}
   return route.fulfill({json:{board,canEdit:true}});
  }
  if(p==='/api/task-runs')return route.fulfill({json:{runs:[]}});
  if(p.endsWith('notifications'))return route.fulfill({json:{items:[],unread:0}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Board',exact:true}).click();await page.locator('.project-board-row .board-index-item').click();
 await expect(page.locator('.whiteboard-item')).toHaveCount(1);await expect(page.locator('.board-task-view,.board-view-toggle,.board-add-note')).toHaveCount(0);
 await expect(page.locator('.whiteboard-toolbar button')).toHaveCount(3);
 await page.getByRole('button',{name:'Existing card',exact:true}).dblclick();await page.getByRole('textbox',{name:'Text',exact:true}).fill('Updated card');await page.getByRole('textbox',{name:'Description',exact:true}).fill('Updated criteria');await page.getByRole('textbox',{name:'Description',exact:true}).press('Control+Enter');
 await expect(page.getByRole('button',{name:'Updated card',exact:true})).toBeVisible();expect(board.notes[0]).toMatchObject({id:noteId,title:'Updated card',description:'Updated criteria',status:'review',branch:'1.0',priority:'high'});
 await page.getByRole('button',{name:'Refresh board',exact:true}).click();await expect(page.getByRole('button',{name:'Updated card',exact:true})).toBeVisible();
 await page.locator('.whiteboard-viewport').click({position:{x:30,y:380}});await page.getByRole('menuitem',{name:'Card',exact:true}).click();await page.getByRole('textbox',{name:'Text',exact:true}).fill('New card');await page.getByRole('textbox',{name:'Text',exact:true}).press('Control+Enter');await expect(page.locator('.wb-card')).toHaveCount(2);expect(board.notes).toHaveLength(2);
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
 await page.getByRole('button',{name:'New card',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect(page.locator('.wb-card')).toHaveCount(1);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.wb-card')).toHaveCount(2);
 await page.screenshot({path:`.local/unified-board-${width}.png`});
 await page.getByRole('button',{name:'Chat',exact:true}).click();await expect(page.locator('.workspace-picker-header select')).toHaveCount(0);await page.locator('.chat-context .provider-picker-trigger').click();await expect(page.getByRole('menuitemradio',{name:'Codex',exact:true})).toBeVisible();await page.screenshot({path:`.local/canvas-chat-provider-${width}.png`});
});
