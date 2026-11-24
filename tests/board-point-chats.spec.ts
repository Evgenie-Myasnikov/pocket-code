import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

const first='11111111-1111-4111-8111-111111111111',second='33333333-3333-4333-8333-333333333333';
async function openBoard(page:Page){
  await page.setViewportSize({width:1440,height:900});await page.addInitScript(()=>{(window as any).testPlanCatalog={providers:['claude','codex'],accounts:[],executors:[{provider:'claude',label:'Claude'},{provider:'codex',label:'Codex'},{provider:'claude',account:'44444444-4444-4444-8444-444444444444',model:'sample-local',label:'Sample local model'}]};});await desktop(page);
  await page.evaluate(({first,second})=>{
    const notes=[{id:first,title:'Synthetic near card',description:'Acceptance criteria',branch:'',status:'idea',priority:'normal',x:40,y:40,dependencies:[]},
      {id:second,title:'Synthetic distant card',description:'Other criteria',branch:'',status:'idea',priority:'normal',x:3000,y:1800,dependencies:[]}];
    (window as any).projectBoardOverride={id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:'C:\\Demo\\Atlas',repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versions:[],branches:[],notes,
      canvas:{version:1,items:notes.map(n=>({id:n.id,kind:'card',text:n.title,description:n.description,color:'sand',x:n.x,y:n.y,width:280,height:280})),links:[]}};
  },{first,second});
  await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
  await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
  await expect(page.locator('.wb-card')).toHaveCount(2);
}

test('the board has no side chat: a chat starts at a point, attaches the nearest card, collapses, survives a reload and is removed',async({page})=>{
  await openBoard(page);
  await expect(page.locator('.board-header .whiteboard-toolbar').getByRole('button',{name:'New card',exact:true})).toBeVisible();
  await expect(page.locator('.whiteboard .whiteboard-toolbar')).toHaveCount(0);
  await expect(page.locator('.board-header').getByRole('button',{name:'Chat',exact:true})).toHaveCount(0);
  await page.locator('.react-flow__pane').click({button:'right',position:{x:420,y:150}});
  await page.getByRole('menuitem',{name:'Chat here',exact:true}).click();
  const chat=page.getByRole('region',{name:'Chat on the board'});
  await expect(chat).toBeVisible();
  await expect(chat.getByRole('list',{name:'Attached cards'})).toHaveCount(0);
  await chat.getByRole('button',{name:'Cards: 1',exact:true}).click();
  const cards=chat.getByRole('list',{name:'Attached cards'});
  await expect(cards.getByRole('listitem')).toHaveCount(1);
  await expect(cards).toContainText('Synthetic near card');
  await expect(chat.getByRole('textbox').first()).toBeVisible();
  await page.screenshot({path:'.local/board-point-chat.png'});
  await expect(chat.locator('.composer-submit-usage .usage-indicator')).toBeVisible();
  await chat.getByRole('button',{name:'Provider and model',exact:true}).click();
  const menu=page.getByRole('menu',{name:'Provider and model'});
  await expect(menu.getByRole('menuitem',{name:'Sample local model'})).toBeVisible();
  await menu.getByRole('menuitem',{name:'Model: Opus'}).click();
  await expect(chat.locator('.model-picker select')).toHaveValue('opus');
  await page.screenshot({path:'.local/board-point-chat-model.png'});
  const before=(await chat.boundingBox())!;
  const pane=(await page.locator('.react-flow__pane').boundingBox())!;
  await page.mouse.move(pane.x+pane.width/2,pane.y+pane.height-40);await page.mouse.wheel(0,120);
  await expect.poll(async()=>(await chat.boundingBox())!.y).toBeLessThan(before.y-60);
  await chat.getByRole('button',{name:'Collapse chat',exact:true}).click();
  await expect(chat).toHaveCount(0);
  const pin=page.getByRole('button',{name:/^Open chat: /});
  await expect(pin).toHaveText('1');
  await pin.click();
  await chat.getByRole('button',{name:/^Detach card: /}).click();
  await expect(chat.getByRole('button',{name:/^Cards: /})).toHaveCount(0);
  await chat.getByRole('button',{name:'Collapse chat',exact:true}).click();
  await expect(pin).toHaveText('');
  await page.reload();await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
  const tile=page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})});if(await tile.count())await tile.click();
  await expect(pin).toBeVisible();
  await pin.click();await expect(chat).toBeVisible();
  await chat.getByRole('button',{name:'Remove chat from the board',exact:true}).click();
  await chat.getByRole('button',{name:'Remove',exact:true}).click();
  await expect(chat).toHaveCount(0);await expect(pin).toHaveCount(0);
});
