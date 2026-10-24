import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`canvas editing and compact provider picker at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html');
 await page.locator('.provider-picker-trigger').click();await page.getByRole('menuitemradio',{name:'Claude',exact:true}).click();await expect(page.locator('.provider-picker-trigger')).toContainText('Claude');
 await page.locator('.whiteboard-viewport').click({position:{x:40,y:60}});await expect(page.getByRole('menu')).toHaveCount(0);
 await page.locator('.whiteboard-viewport').click({button:'right',position:{x:40,y:60}});await page.getByRole('menuitem',{name:'Sticky note',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(1);
 await page.getByRole('textbox',{name:'Text',exact:true}).fill('Plan the next milestone');await page.getByRole('textbox',{name:'Text',exact:true}).press('Control+Enter');await expect(page.locator('.whiteboard-text')).toHaveText('Plan the next milestone');
 await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
 await page.locator('.whiteboard-viewport').click({button:'right',position:{x:80,y:300}});await page.getByRole('menuitem',{name:'Text',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(2);
 await page.getByRole('textbox',{name:'Text',exact:true}).fill('Result');await page.getByRole('textbox',{name:'Text',exact:true}).press('Control+Enter');await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
 const card=page.locator('.whiteboard-item').last();const before=await card.boundingBox();expect((await card.locator('[data-resize="e"]').boundingBox())!.width).toBeGreaterThanOrEqual(19);const corner=await card.locator('[data-resize="se"]').boundingBox();expect(corner!.width).toBeGreaterThanOrEqual(27);await page.mouse.move(corner!.x+corner!.width/2,corner!.y+corner!.height/2);await page.mouse.down();await page.mouse.move(corner!.x+57,corner!.y+47,{steps:8});await page.mouse.up();expect((await card.boundingBox())!.width).toBeGreaterThan(before!.width+20);
 const source=await card.boundingBox(),target=await page.locator('.whiteboard-item').first().boundingBox();await page.mouse.move(source!.x,source!.y+source!.height/2);await expect(card.getByRole('button',{name:'Connect w',exact:true})).toHaveCSS('opacity','1');await page.mouse.down();await page.mouse.move(target!.x+target!.width,target!.y+target!.height/2,{steps:8});await page.mouse.up();await expect(page.locator('.wb-link')).toHaveCount(1);const link=page.locator('.wb-link');expect(await link.getAttribute('d')).toMatch(/^M/);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.wb-link')).toHaveCount(0);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.locator('.wb-link')).toHaveCount(1);
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/whiteboard-${width}.png`});
});

test('pinch zoom changes the view without moving canvas objects',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html');
 const viewport=page.locator('.whiteboard-viewport'),world=page.locator('.whiteboard-world'),before=await world.getAttribute('style');
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:420},{x:240,y:420}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:420},{x:280,y:420}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(world).not.toHaveAttribute('style',before!);await expect(page.getByRole('menu')).toHaveCount(0);await expect(viewport.locator('.whiteboard-item')).toHaveCount(0);
});
