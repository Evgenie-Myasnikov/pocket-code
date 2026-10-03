import {test,expect} from '@playwright/test';
test('Rules and Changelog replace Project and isolate documents when switching Git projects',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-key-'.repeat(4)})));
 await page.route('**/api/**',route=>{const u=new URL(route.request().url()),kind=u.searchParams.get('kind'),root=u.searchParams.get('cwd');const doc={path:kind==='rules'?'AGENTS.md':'CHANGELOG.md',name:'CHANGELOG.md',kind:kind||'changelog',source:'Project root',appliesTo:'all',bytes:80};const p=u.pathname;return route.fulfill({json:p==='/api/health'?{protocol:1,roots:['C:/Demo/Atlas'],name:'Demo'}:p==='/api/document-projects'?[{root:'C:/Demo/Atlas',name:'Atlas',documents:[doc]},{root:'C:/Demo/Orbit',name:'Orbit',documents:[doc]}]:p==='/api/project-docs'?{project:root,documents:[{...doc,kind:'rules',path:'AGENTS.md',name:'AGENTS.md'},doc],truncated:false}:p==='/api/project-doc'?{...doc,content:'# '+root?.split('/').at(-1)+'\n\nCurrent recorded changes.'}:[]});});
 await page.goto('http://127.0.0.1:5173');const nav=page.locator('.mobile-nav');await expect(nav.getByRole('button',{name:'Project',exact:true})).toHaveCount(0);
 await nav.getByRole('button',{name:'Changelog',exact:true}).click();await expect(page.getByLabel('Git project')).toHaveValue('C:/Demo/Atlas');await expect(page.locator('.project-docs-markdown')).toContainText('Atlas');
 await page.getByLabel('Git project').selectOption('C:/Demo/Orbit');await expect(page.locator('.project-docs-markdown')).toContainText('Orbit');await expect(page.locator('.project-docs-markdown')).not.toContainText('Atlas');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:'artifacts/screenshots/document-library-mobile.png'});
 await nav.getByRole('button',{name:'Rules',exact:true}).click();await expect(page.locator('.project-docs-markdown')).toBeVisible();await expect(page.getByRole('button',{name:'Project overview',exact:true})).toHaveCount(0);
});
