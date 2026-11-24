import {test,expect,type Page} from '@playwright/test';

const url='http://127.0.0.1:5173/tests/flow-board-fixture.html';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const board=(page:Page)=>page.evaluate(()=>(window as any).boardValue);
const node=(page:Page,n:number)=>page.locator(`[data-canvas-id="${id(n)}"]`);

test('the board shows cards, notes, frames and connections in the flat style without scrolling inside a card',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  await expect(page.locator('.whiteboard-item')).toHaveCount(5);
  await expect(page.locator('.wb-link')).toHaveCount(2);
  const card=node(page,2);
  await expect(card).toHaveCSS('box-shadow','none');
  for(const part of ['.whiteboard-text','.wb-card-meta'])await expect(card.locator(part)).toHaveCSS('overflow','hidden');
  await card.hover();
  await expect(card.locator('.whiteboard-text')).toHaveCSS('overflow','hidden');
  await page.screenshot({path:'.local/flow-board.png'});
});

test('objects move, a frame carries its contents, and undo restores the board',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  const sticky=node(page,4),box=(await sticky.boundingBox())!;
  await page.mouse.move(box.x+60,box.y+60);await page.mouse.down();await page.mouse.move(box.x+160,box.y+140,{steps:8});await page.mouse.up();
  await expect.poll(async()=>(await board(page)).items[3].x).toBeGreaterThan(960);
  const moved=(await board(page)).items[3];
  expect([moved.x%8,moved.y%8]).toEqual([0,0]);expect(moved.y).toBeGreaterThan(170);
  const label=node(page,1).locator('.wb-frame-label'),frame=(await label.boundingBox())!;
  await page.mouse.move(frame.x+20,frame.y+12);await page.mouse.down();await page.mouse.move(frame.x+20,frame.y+92,{steps:8});await page.mouse.up();
  await expect.poll(async()=>(await board(page)).items[0].y).toBeGreaterThan(100);
  const after=(await board(page)).items.slice(0,3).map((item:{y:number})=>item.y);
  expect([after[1]-after[0],after[2]-after[0]]).toEqual([70,70]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(async()=>(await board(page)).items.slice(0,3).map((item:{y:number})=>item.y)).toEqual([40,110,110]);
});

test('double click edits in place, the context menu creates and deletes, a port drag connects',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  await node(page,4).dblclick();
  await page.getByRole('textbox',{name:'Text',exact:true}).fill('Edited note');await page.keyboard.press('Control+Enter');
  await expect(node(page,4).locator('.whiteboard-text')).toHaveText('Edited note');
  await page.locator('.react-flow__pane').click({button:'right',position:{x:1250,y:600}});
  await page.getByRole('menuitem',{name:'Sticky note',exact:true}).click();
  await page.getByRole('textbox',{name:'Text',exact:true}).fill('Created note');await page.keyboard.press('Control+Enter');
  await expect(page.locator('.whiteboard-item')).toHaveCount(6);
  const from=(await node(page,4).boundingBox())!,to=(await node(page,5).boundingBox())!;
  await node(page,4).hover();
  await page.mouse.move(from.x+from.width/2,from.y+from.height);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+4,{steps:10});await page.mouse.up();
  await expect.poll(async()=>(await board(page)).links.length).toBe(3);
  expect((await board(page)).links[2]).toMatchObject({from:id(4),to:id(5),fromSide:'s',toSide:'n'});
  await node(page,5).click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();
  await expect(page.locator('.whiteboard-item')).toHaveCount(5);
  expect((await board(page)).links.length).toBe(2);
});

test('wheel pans, Ctrl+wheel zooms and Fit shows the whole board',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  const view=page.locator('.react-flow__viewport'),transform=()=>view.evaluate(el=>getComputedStyle(el).transform),zoom=()=>view.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  const start=await transform();
  await page.mouse.move(700,700);await page.mouse.wheel(0,200);
  await expect.poll(transform).not.toBe(start);
  const before=await zoom();
  await page.keyboard.down('Control');await page.mouse.wheel(0,-300);await page.keyboard.up('Control');
  await expect.poll(zoom).toBeGreaterThan(before);
  await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
  await expect(node(page,2)).toBeInViewport();await expect(node(page,5)).toBeInViewport();
});

test('a board of 500 cards and 974 connections renders only what is on screen and pans without rebuilding cards',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url+'?stress');
  await expect(page.locator('.whiteboard-item').first()).toBeVisible();
  const shown=await page.locator('.whiteboard-item').count();
  expect(shown).toBeLessThan(60);
  await page.evaluate(()=>{(window as any).cardRenders=0;});
  await page.mouse.move(700,500);
  const started=Date.now();
  for(let i=0;i<30;i++)await page.mouse.wheel(40,40);
  await page.waitForTimeout(200);
  const renders=await page.evaluate(()=>(window as any).cardRenders);
  console.log(JSON.stringify({shown,panMs:Date.now()-started,cardMetadataRenders:renders}));
  expect(renders).toBeLessThan(200);
});

test('selecting the whole board outlines every object but shows resize handles only for a single selected object',async({page})=>{
  await page.setViewportSize({width:1440,height:900});await page.goto(url);
  await expect(page.locator('.whiteboard-item')).toHaveCount(5);
  await page.locator('.whiteboard-viewport').click({position:{x:20,y:20}});
  await page.keyboard.press('Control+a');
  await expect(page.locator('.wb-selected')).toHaveCount(5);
  await expect(page.locator('.wb-resize-handle')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.locator('.wb-selected')).toHaveCount(0);
  await node(page,4).locator('.whiteboard-text').click();
  await expect(page.locator('.wb-selected')).toHaveCount(1);
  await expect(node(page,4).locator('.wb-resize-handle')).toHaveCount(4);
});
