import {test,expect} from '@playwright/test';
import {openSection} from './chat-navigation';

for(const provider of ['claude','codex'] as const)test(`Jira connection in Settings uses ${provider}, shows status and disconnects`,async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(provider=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace',provider);localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-labs-jira','1');},provider);
 let connected=false;const writes:string[]=[];
 await page.route('**/api/jira/**',route=>{
  const url=new URL(route.request().url());expect(url.searchParams.get('provider')).toBe(provider);
  if(route.request().method()==='POST'){writes.push(url.pathname);if(url.pathname.endsWith('/connect-existing'))connected=true;if(url.pathname.endsWith('/disconnect'))connected=false;}
  return route.fulfill({json:{source:provider,connected,sites:connected?[{id:'synthetic-site',name:'Example Jira',url:'https://example.atlassian.net'}]:[]}});
 });
 await page.goto('http://127.0.0.1:5173');const nav=page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first();await openSection(page,'Settings');await page.locator('[data-settings-category="jira"]').click();
 await expect(nav.getByRole('button',{name:'Jira',exact:true})).toHaveCount(0);await expect(nav.getByRole('button',{name:'Tasks',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:provider==='codex'?'Use Codex connection':'Use Claude connection',exact:true}).click();await expect(page.locator('.jira-connected')).toContainText('Example Jira');
 await page.getByRole('button',{name:'Disconnect Jira',exact:true}).click();await expect(page.locator('.jira-connected')).toHaveCount(0);expect(writes).toEqual(['/api/jira/connect-existing','/api/jira/disconnect']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Jira stays hidden in Settings until issues have a place in the app',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-language-v1','en');});
 const jiraCalls:string[]=[];await page.route('**/api/jira/**',route=>{jiraCalls.push(route.request().url());return route.fulfill({json:{connected:false,sites:[]}});});
 await page.goto('http://127.0.0.1:5173');await openSection(page,'Settings');await expect(page.locator('[data-settings-category="appearance"]')).toBeVisible();
 await expect(page.locator('[data-settings-category="jira"]')).toHaveCount(0);await expect(page.getByText(/Jobs/)).toHaveCount(0);expect(jiraCalls).toEqual([]);
});
