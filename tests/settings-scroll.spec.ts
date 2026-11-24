import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a long settings page scrolls inside the framed window area',async({page})=>{
 await page.setViewportSize({width:1280,height:560});await desktop(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('.settings-index').getByRole('button',{name:'Appearance & language',exact:true}).click();
 const main=page.locator('.desktop-main');
 const size=await main.evaluate(e=>({scroll:e.scrollHeight,client:e.clientHeight}));
 expect(size.scroll).toBeGreaterThan(size.client);
 const box=(await main.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,600);
 await expect.poll(()=>main.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 await expect(page.getByRole('button',{name:'Reset appearance'})).toBeInViewport();
});
