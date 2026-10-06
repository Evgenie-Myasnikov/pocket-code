import {test,expect} from '@playwright/test';
test('history results clear for a pending chat and a late previous scan cannot repopulate them',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.includes('/sessions/first/messages')){if(u.searchParams.get('offset')==='1')await gate;return route.fulfill({json:{messages:[{id:'old',role:'assistant',blocks:[{type:'text',text:'[Old report](report.md)'}]}],next:u.searchParams.get('offset')==='1'?null:1}});}
  if(u.pathname.includes('/sessions/second/messages'))return route.fulfill({json:{messages:[],next:null}});
  return route.fulfill({json:[]});
 });
 await page.goto('http://127.0.0.1:5173');await page.evaluate(async()=>{const harness=await import('/tests/fixtures/OutputIndexHarness.tsx' as string);harness.mount();});
 await expect(page.locator('output')).toContainText('Old report');await page.getByRole('button',{name:'New pending chat'}).click();await expect(page.locator('output')).not.toContainText('Old report');release();await page.getByRole('button',{name:'Second chat'}).click();await expect(page.locator('output')).toContainText('"count":0');await expect(page.locator('output')).not.toContainText('Old report');
});
