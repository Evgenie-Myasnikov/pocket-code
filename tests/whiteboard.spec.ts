import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`canvas editing and compact provider picker at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html');
 await page.locator('.provider-picker-trigger').click();await page.getByRole('menuitemradio',{name:'Claude',exact:true}).click();await expect(page.locator('.provider-picker-trigger')).toContainText('Claude');
 await page.getByRole('button',{name:'Sticky note',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(1);
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Text',exact:true}).fill('Plan the next milestone');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.whiteboard-text')).toHaveText('Plan the next milestone');
 await page.getByRole('button',{name:'Text',exact:true}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(2);await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
 await page.getByRole('button',{name:'Connect',exact:true}).click();await page.getByRole('button',{name:'Plan the next milestone',exact:true}).click();await expect(page.locator('.whiteboard-links line')).toHaveCount(1);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.whiteboard-links line')).toHaveCount(0);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.locator('.whiteboard-links line')).toHaveCount(1);
 await page.getByRole('button',{name:'Fit canvas',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/whiteboard-${width}.png`});
});
