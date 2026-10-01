import {test,expect} from '@playwright/test';
test('common PC Jira setup selects a connection and runs browser login without exposing the key in the URL',async({page})=>{
 const selections:string[]=[];let waiting=false;
 await page.route('**/api/jira/pc-login',route=>{if(route.request().method()==='POST')waiting=true;return route.fulfill({json:{source:'claude',state:waiting?'waiting':'idle',message:waiting?'Complete sign-in in the browser.':''}});});
 await page.route('**/api/jira/pc-source',route=>{selections.push(route.request().postDataJSON().source);return route.fulfill({json:{connected:true}});});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4319/setup/jira#synthetic-setup-key');
 await expect(page).toHaveURL('http://127.0.0.1:4319/setup/jira');
 await page.getByRole('button',{name:'Использовать подключение Claude'}).click();await expect(page.getByRole('status')).toContainText('Jira подключена');expect(selections).toEqual(['claude']);
 await page.getByRole('button',{name:'Войти в Atlassian'}).click();await expect(page.getByRole('button',{name:'Войти в Atlassian'})).toBeDisabled();await expect(page.getByRole('status')).toContainText('Complete sign-in');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/screenshots/jira-pc-setup.png',fullPage:true});
});
