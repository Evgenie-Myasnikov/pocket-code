import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`board gallery search and quiet surfaces at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/api/project-board?*',route=>{const root=new URL(route.request().url()).searchParams.get('root')!;return route.fulfill({json:{board:{name:root.endsWith('alpha')?'Release roadmap':'Product ideas',versions:['Now','Next'],notes:[{x:16,y:60,branch:'Now',status:'done',title:'Shared interface'},{x:356,y:60,branch:'Next',status:'working',title:'Better navigation'}]},canEdit:true}});});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{RepositoryBoards}=await import('/src/RepositoryBoards.tsx' as string);
  const root=document.createElement('div');root.className='work-boards';document.body.replaceChildren(root);createRoot(root).render(React.createElement(RepositoryBoards,{connection:{url:'http://127.0.0.1:4319',token:'synthetic'},roots:['C:/Sample/alpha','C:/Sample/beta'],onOpen:()=>{}}));
 });
 await expect(page.locator('.board-index-item')).toHaveCount(2);
 expect(await page.locator('.board-index-item').first().evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('0px');
 await page.getByRole('textbox',{name:'Find board'}).fill('beta');await expect(page.locator('.board-index-item')).toHaveCount(1);await expect(page.locator('.board-index-item')).toContainText('Product ideas');
 await page.getByRole('textbox',{name:'Find board'}).fill('');await expect(page.locator('.board-index-item')).toHaveCount(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/board-gallery-${width}.png`});
});
