import {test,expect,type Page} from '@playwright/test';

const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
async function position(page:Page,x:number,y:number){return page.locator('.whiteboard-viewport').evaluate((el,p)=>{const rect=el.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(el.querySelector('.whiteboard-world')!).transform);return {x:rect.left+matrix.e+p.x*matrix.a,y:rect.top+matrix.f+p.y*matrix.d};},{x,y});}
async function area(page:Page,a:{x:number;y:number},b:{x:number;y:number}){const start=await position(page,a.x,a.y),end=await position(page,b.x,b.y);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await expect(page.getByTestId('canvas-selection')).toBeVisible();await page.screenshot({path:'.local/board-area-marquee.png'});await page.mouse.up();}
const stored=(page:Page)=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('port-fixture')||'null'));
test('left drag selects a group to move, copy, delete and restore with its links',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports&linked');
 await area(page,{x:80,y:60},{x:900,y:550});await expect(page.locator('.wb-selected')).toHaveCount(2);
 const start=await position(page,240,190);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+80,start.y+56,{steps:8});await page.mouse.up();
 await expect.poll(async()=> (await stored(page)).items[0].x).toBe(200);expect((await stored(page)).items[1].x).toBe(700);
 await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await expect(page.locator('.whiteboard-item')).toHaveCount(4);await expect(page.locator('.wb-selected')).toHaveCount(2);const pasted=await stored(page);expect(pasted.links).toHaveLength(2);expect(pasted.links[1].from).toBe(pasted.items[2].id);expect(pasted.links[1].to).toBe(pasted.items[3].id);
 await page.keyboard.press('Delete');await expect(page.locator('.whiteboard-item')).toHaveCount(2);expect((await stored(page)).links).toHaveLength(1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(4);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(2);
 await page.screenshot({path:'.local/board-area-selection.png'});
});
test('middle drag pans over nodes without moving them; reverse and Shift selection work at zoom',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports&linked');
 const node=page.locator(`[data-canvas-id="${one}"]`),before=(await node.boundingBox())!,point=await position(page,240,190);
 await page.mouse.move(point.x,point.y);await page.mouse.down({button:'middle'});await page.mouse.move(point.x+112,point.y+64,{steps:8});await page.mouse.up({button:'middle'});await expect.poll(async()=>Math.round((await node.boundingBox())!.x-before.x)).toBe(112);expect((await stored(page))?.items[0].x??120).toBe(120);
 await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await expect.poll(()=>page.locator('.whiteboard-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeGreaterThan(1);await page.keyboard.up('Control');
 await area(page,{x:390,y:290},{x:100,y:80});await expect(page.locator('.wb-selected')).toHaveCount(1);
 await page.keyboard.down('Shift');await area(page,{x:600,y:300},{x:880,y:520});await page.keyboard.up('Shift');await expect(page.locator('.wb-selected')).toHaveCount(2);
 const empty=await position(page,10,10);await page.mouse.move(empty.x,empty.y);await page.mouse.down();await page.mouse.move(empty.x+10,empty.y+10);await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.wb-selected')).toHaveCount(2);await expect(page.getByTestId('canvas-selection')).toHaveCount(0);
});
test('context menu copies and deletes the entire selected group and pastes at the requested point',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports&linked');await area(page,{x:80,y:60},{x:900,y:550});
 await page.locator(`[data-canvas-id="${two}"] .whiteboard-text`).click({button:'right'});await page.getByRole('menuitem',{name:'Copy',exact:true}).click();
 await page.locator(`[data-canvas-id="${one}"] .whiteboard-text`).click({button:'right'});await page.getByRole('menuitem',{name:'Delete',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(0);
 const point=await position(page,200,100);await page.mouse.click(point.x,point.y,{button:'right'});await page.getByRole('menuitem',{name:'Paste',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(2);const data=await stored(page);expect(data.items[0].x).toBe(200);expect(data.items[0].y).toBe(100);expect(data.links).toHaveLength(1);
});
