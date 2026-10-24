import {test,expect,type Page} from '@playwright/test';

async function point(page:Page,index:number,side:'e'|'w'){
 const r=(await page.locator('.whiteboard-item').nth(index).boundingBox())!;
 return {x:side==='e'?r.x+r.width:r.x,y:r.y+r.height/2};
}
async function start(page:Page){
 const p=await point(page,0,'e');await page.mouse.move(p.x,p.y);
 await expect(page.locator('.whiteboard-item').first().getByRole('button',{name:'Connect e',exact:true})).toHaveCSS('opacity','1');
 await page.mouse.down();
}

for(const width of [390,1440])test(`side points only, orthogonal routing and persisted anchors at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports');
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
 const source=(await page.locator('.whiteboard-item').first().boundingBox())!;
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.click(source.x+source.width/2,source.y+source.height/2);
 await expect(page.locator('.wb-port-visible')).toHaveCount(0);
 const target=(await page.locator('.whiteboard-item').last().boundingBox())!;
 for(const p of [{x:target.x+target.width/2,y:target.y+target.height/2},{x:target.x+3,y:target.y+3},{x:target.x-22,y:target.y+target.height/2}]){
  await start(page);await page.mouse.move(p.x,p.y,{steps:8});await expect(page.locator('.wb-connect-target')).toHaveCount(0);await page.mouse.up();await expect(page.locator('.wb-link')).toHaveCount(0);
 }
 await start(page);const end=await point(page,1,'w');await page.mouse.move(end.x+5,end.y,{steps:8});
 await expect(page.locator('.wb-connect-target')).toHaveCount(1);await expect(page.locator('.whiteboard-item').last().getByRole('button',{name:'Connect w',exact:true})).toHaveCSS('opacity','1');
 const preview=await page.locator('.wb-wire').getAttribute('d');await page.mouse.up();
 await expect(page.locator('.wb-link')).toHaveAttribute('d',preview!);
 const coords=[...preview!.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
 expect(coords.length).toBeGreaterThan(2);for(let i=1;i<coords.length;i++)expect(coords[i].x===coords[i-1].x||coords[i].y===coords[i-1].y).toBe(true);
 const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('port-fixture')!));expect(saved.links[0]).toMatchObject({fromSide:'e',toSide:'w'});
 await page.screenshot({path:`.local/ports-${width}.png`});await page.reload();await expect(page.locator('.wb-link')).toHaveAttribute('d',preview!);
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await page.mouse.move(5,850);await expect(page.locator('.wb-port-visible')).toHaveCount(0);
});

test('Escape cancels a live connector and keyboard connections require a destination port',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?ports');
 await start(page);const end=await point(page,1,'w');await page.mouse.move(end.x,end.y);await page.keyboard.press('Escape');await page.mouse.up();await expect(page.locator('.wb-link')).toHaveCount(0);await expect(page.locator('.wb-wire')).toHaveCount(0);
 await page.locator('.whiteboard-text').first().focus();await page.keyboard.press('Space');const source=page.locator('.whiteboard-item').first().getByRole('button',{name:'Connect e',exact:true});await source.focus();await page.keyboard.press('Enter');
 await page.locator('.whiteboard-text').last().focus();await page.keyboard.press('Space');await expect(page.locator('.wb-link')).toHaveCount(0);
 const destination=page.locator('.whiteboard-item').last().getByRole('button',{name:'Connect w',exact:true});await destination.focus();await page.keyboard.press('Enter');await expect(page.locator('.wb-link')).toHaveCount(1);
});
