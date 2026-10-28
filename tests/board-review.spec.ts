import {test,expect,type Locator,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {openSection} from './chat-navigation';

async function assertReviewVisible(panel:Locator){
  await expect(panel.locator('.diff-content')).toContainText('adaptive');
  // Inert background elements are omitted from hit-testing even when they paint
  // over the dialog. Temporarily restore hit-testing to verify the visual stack.
  expect(await panel.evaluate(el=>{
    const inert=[...document.querySelectorAll<HTMLElement>('[inert]')];
    try{
      inert.forEach(element=>element.inert=false);
      return ['.review-header','.diff-content'].every(selector=>{
        const r=el.querySelector(selector)!.getBoundingClientRect();
        return [r.x+24,r.right-24].every(x=>el.contains(document.elementFromPoint(x,r.y+24)));
      });
    }finally{inert.forEach(element=>element.inert=true);}
  })).toBe(true);
}

for(const width of [1440,960])test(`board chat Review covers the workspace at ${width}px and restores the draft`,async({page})=>{
  await page.setViewportSize({width,height:900});await desktop(page);
  await page.getByRole('separator',{name:'Sidebar width'}).focus();await page.keyboard.press('ArrowRight');
  await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
  await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
  await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Keep the board review draft');
  await page.locator('.desktop-chat-host .header-title').click({button:'right'});
  await page.getByRole('menuitem',{name:'Review',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Review',exact:true});
  await assertReviewVisible(panel);
  await page.screenshot({path:`.local/board-review-${width}.png`});
  const rect=(await panel.boundingBox())!;
  const main=(await page.locator('.desktop-main').boundingBox())!;
  expect(rect.x).toBeCloseTo(main.x,0);expect(rect.width).toBeCloseTo(main.width,0);expect(rect.y).toBe(0);expect(rect.height).toBe(900);
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await expect(panel.getByLabel('Comparison',{exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Back to chat',exact:true}).click();
  await expect(panel).toHaveCount(0);await expect(input).toHaveValue('Keep the board review draft');await expect(page.locator('.whiteboard-viewport')).toBeVisible();
});

async function phoneHost(page:Page){
  const root='C:\\Synthetic\\BoardProject',boardId='11111111-1111-4111-8111-111111111111';
  await page.addInitScript(()=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-board-token'}));
    localStorage.setItem('pocket-code-language-v1','en');
  });
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),p=url.pathname.slice(4);
    if(p==='/health')return route.fulfill({json:{name:'Synthetic board host',roots:[root],version:'0.28.18',protocol:1}});
    if(p==='/providers')return route.fulfill({json:[{id:'claude',available:true,authenticated:true,models:[]}]});
    if(p==='/projects')return route.fulfill({json:[root]});
    if(p==='/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
    if(p==='/project-board')return route.fulfill({json:{board:{id:boardId,name:'Synthetic board',root,repositoryFile:'board-'+boardId+'.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]},canEdit:true}});
    if(p==='/project-board/mcp')return route.fulfill({json:{generation:'synthetic-generation'}});
    if(p==='/project-board/mcp/status')return route.fulfill({json:{state:'ready',tools:[]}});
    if(p==='/project-board/live')return route.fulfill({json:{version:'a'.repeat(64),unchanged:true}});
    if(p==='/sessions'||p==='/jobs'||p==='/activity')return route.fulfill({json:[]});
    if(p==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(p==='/review/availability')return route.fulfill({json:{available:true,mode:'working'}});
    if(p==='/review')return route.fulfill({json:{files:[{path:'src/layout.ts',added:1,removed:1,binary:false}],current:'main',base:'main',branches:['main'],repositoryRoot:root,patch:url.searchParams.has('file')?'@@ -1 +1 @@\n-old\n+adaptive':'',binary:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
}

test('phone board Review fills the screen above the sheet, with options and native Back',async({page})=>{
  await page.setViewportSize({width:390,height:844});await phoneHost(page);await page.goto('http://127.0.0.1:5173');
  await openSection(page,'Board');await page.locator('.board-index-item').first().click();
  await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Keep the phone draft');
  await page.evaluate(()=>(window as any).retainedBoard=document.querySelector('.whiteboard-viewport'));
  await page.getByRole('separator',{name:'Chat panel size'}).focus();await page.keyboard.press('ArrowDown');
  await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Review',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Review',exact:true});await assertReviewVisible(panel);
  expect(await panel.boundingBox()).toEqual({x:0,y:0,width:390,height:844});
  await page.screenshot({path:'.local/board-review-phone.png'});
  await panel.getByRole('button',{name:'Review options',exact:true}).click();
  await expect(panel.getByLabel('Comparison',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));await expect(panel.getByLabel('Comparison',{exact:true})).toBeHidden();await expect(panel).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));await expect(panel).toHaveCount(0);await expect(input).toHaveValue('Keep the phone draft');
  expect(await page.evaluate(()=>(window as any).retainedBoard===document.querySelector('.whiteboard-viewport'))).toBe(true);
  await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(page.locator('.board-header')).toBeVisible();
});

test('ordinary desktop chat keeps Review keyboard focus and returns to its draft',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  await page.getByRole('button',{name:/claude · Interface review/}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Keep the ordinary draft');
  const trigger=page.getByRole('button',{name:'More actions',exact:true});await trigger.click();await page.getByRole('menuitem',{name:'Review',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'Review',exact:true});await assertReviewVisible(panel);
  await expect(panel.getByRole('button',{name:'Back to chat',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(input).toHaveValue('Keep the ordinary draft');await expect(trigger).toBeFocused();
});
