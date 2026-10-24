import {test,expect,type Page,type Locator} from '@playwright/test';

async function dragEnd(page:Page,handle:Locator,target:{x:number;y:number},cancel=false){
 const r=(await handle.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(210);await page.mouse.move(target.x,target.y,{steps:10});await expect(page.locator('.wb-wire')).toHaveCount(1);
 if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
}
async function selectLine(page:Page){await page.locator('.wb-link-hit').focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Move connection end',exact:true})).toHaveCount(1);}
const worldPoint=(page:Page,p:{x:number;y:number})=>page.evaluate(p=>{const r=document.querySelector('.whiteboard-viewport')!.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.whiteboard-world')!).transform).inverse(),v=m.transformPoint({x:p.x-r.left,y:p.y-r.top});return {x:v.x,y:v.y};},p);
const saved=(page:Page)=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('port-fixture')!));

test('a quick point click does not create a connector',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports');
 const r=(await page.locator('.whiteboard-item').first().boundingBox())!;await page.mouse.move(r.x+r.width,r.y+r.height/2);await page.mouse.down();await page.mouse.up();await expect(page.locator('.wb-wire')).toHaveCount(0);await expect(page.locator('.wb-link')).toHaveCount(0);
});

test('selected ends detach, persist freely, reattach with the same ID and undo',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports&linked');await expect(page.locator('.wb-link')).toHaveCount(1);
 const original=await page.locator('.wb-link').getAttribute('d'),free=await worldPoint(page,{x:1050,y:700});await selectLine(page);
 await dragEnd(page,page.getByRole('button',{name:'Move connection end',exact:true}),{x:1050,y:700},true);await expect(page.locator('.wb-link')).toHaveAttribute('d',original!);
 await selectLine(page);await dragEnd(page,page.getByRole('button',{name:'Move connection end',exact:true}),{x:1050,y:700});
 await expect.poll(async()=>(await saved(page)).links[0].toPoint).toEqual(free);let link=(await saved(page)).links[0];expect(link.id).toBe('33333333-3333-4333-8333-333333333333');expect(link.to).toBeUndefined();expect(link.toSide).toBeUndefined();
 await page.reload();await expect(page.locator('.wb-link')).toHaveCount(1);await selectLine(page);
 const r=(await page.locator('.whiteboard-item').last().boundingBox())!;await dragEnd(page,page.getByRole('button',{name:'Move connection end',exact:true}),{x:r.x+r.width/2,y:r.y});
 await expect.poll(async()=>(await saved(page)).links[0].toSide).toBe('n');link=(await saved(page)).links[0];expect(link.id).toBe('33333333-3333-4333-8333-333333333333');expect(link.toPoint).toBeUndefined();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(async()=>(await saved(page)).links[0].toPoint).toEqual(free);
 await page.screenshot({path:'.local/reconnected-free-end.png'});
});

test('the start endpoint can also be detached and pointer cancellation restores it',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports&linked');await selectLine(page);
 const original=await page.locator('.wb-link').getAttribute('d'),handle=page.getByRole('button',{name:'Move connection start',exact:true}),r=(await handle.boundingBox())!;
 await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(210);await page.mouse.move(900,700);await expect(page.locator('.wb-wire')).toHaveCount(1);await handle.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(page.locator('.wb-link')).toHaveAttribute('d',original!);
 const free=await worldPoint(page,{x:950,y:650});await dragEnd(page,handle,{x:950,y:650});await expect.poll(async()=>(await saved(page)).links[0].fromPoint).toEqual(free);expect((await saved(page)).links[0].from).toBeUndefined();
});
