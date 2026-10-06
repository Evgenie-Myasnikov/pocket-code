import {test,expect,type Page} from '@playwright/test';
const root='C:\\Synthetic\\board-project';
async function setup(page:Page){
 const state={reject:false,hold:false,release:()=>{},board:{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic roadmap',root,revision:1,repositoryFile:'project-boards/board-example.json',repositoryRevision:'v1',versions:['Next'],versionSource:'planned',branches:[],notes:[{id:'22222222-2222-4222-8222-222222222222',title:'Example feature',description:'Synthetic criteria',status:'ready',priority:'normal',branch:'',x:24,y:80,dependencies:[]}]}};
 await page.setViewportSize({width:1000,height:850});
 await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)})));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),p=url.pathname;
  if(p==='/api/health')return route.fulfill({json:{name:'Synthetic PC',roots:[root],protocol:1}});
  if(p==='/api/projects')return route.fulfill({json:[root]});
  if(p==='/api/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true}]});
  if(p==='/api/project-board'){
   if(route.request().method()==='POST'){
    if(state.hold)await new Promise<void>(resolve=>{state.release=resolve;});
    if(state.reject)return route.fulfill({status:409,json:{error:'Synthetic revision conflict'}});
    const body=route.request().postDataJSON();state.board={...state.board,notes:body.notes,versions:body.versions,revision:state.board.revision+1};return route.fulfill({json:state.board});
   }
   return route.fulfill({json:{board:state.board,canEdit:true}});
  }
  if(p.includes('notifications'))return route.fulfill({json:{items:[],unread:0}});
  if(p.startsWith('/api/updates'))return route.fulfill({json:{enabled:false}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.project-board-row .board-index-item').click();await expect(page.locator('.board-note')).toBeVisible();return state;
}
async function drag(page:Page){const handle=page.locator('.note-drag'),box=(await handle.boundingBox())!;await page.mouse.move(box.x+20,box.y+14);await page.mouse.down();await page.mouse.move(box.x+44,box.y+54,{steps:4});await page.mouse.up();}
test('board view choice survives leaving and reopening its repository',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'People',exact:true}).click();await expect(page.getByRole('button',{name:'People',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await page.locator('.project-board-row .board-index-item').click();await expect(page.getByRole('button',{name:'People',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('rejected board drag restores the original visible and saved position',async({page})=>{
 const state=await setup(page);state.reject=true;await drag(page);await expect(page.getByRole('alert')).toContainText('Synthetic revision conflict');
 await expect(page.locator('.board-note')).toHaveCSS('left','24px');await expect(page.locator('.board-note')).toHaveCSS('top','80px');expect(state.board.notes[0].x).toBe(24);
});
test('late board save cannot reopen a board after navigating back',async({page})=>{
 const state=await setup(page);state.hold=true;await drag(page);await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','true');
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();state.release();await expect(page.locator('.work-boards')).toHaveAttribute('aria-busy','false');await expect(page.locator('.project-board-row .board-index-item')).toBeVisible();await expect(page.locator('.board-note')).toHaveCount(0);
});
