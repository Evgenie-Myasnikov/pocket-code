import {test,expect} from '@playwright/test';
import {connectByQr} from './qr-connect';

test('mobile observes PC updates and requests a check only after a user click',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 let checks=0,legacy=0;let state='idle';
 await page.route('**/api/updates/**',route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/check')){checks++;state='downloading';}if(url.pathname.endsWith('/latest'))legacy++;return route.fulfill({json:{enabled:true,state}});});
 await page.route('**/api/host-update/**',route=>{legacy++;return route.fulfill({json:{supported:false,currentVersion:'0.0.0',state:'idle'}});});
 await page.goto('http://127.0.0.1:5173');await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
 await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Updates',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Updates from PC'})).toBeVisible();expect(checks).toBe(0);expect(legacy).toBe(0);
 await expect(page.getByLabel('Automatically download updates when connected to PC')).toHaveCount(0);
 await page.getByRole('button',{name:'Check for updates on PC'}).click();await expect(page.getByText('The PC is downloading and verifying the APK…')).toBeVisible();expect(checks).toBe(1);expect(legacy).toBe(0);
});
