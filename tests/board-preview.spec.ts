import {test,expect} from '@playwright/test';
test('board contents form a decorative preview while card actions and names remain usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {ProjectBoardCard}=await import('/src/ProjectBoardCard.tsx' as string);
  const root=document.createElement('div');root.className='project-board-grid';document.body.replaceChildren(root);
  (window as any).cardActions=[];
  createRoot(root).render(React.createElement('div',{className:'project-board-row'},React.createElement(ProjectBoardCard,{name:'Release roadmap',project:'Sample project',disabled:false,busy:false,preview:{versions:['Now','Next'],notes:[{x:16,y:48,branch:'Now',status:'done',title:'Design system'},{x:356,y:48,branch:'Next',status:'working',title:'Notification center'}]},onOpen:()=>{(window as any).cardActions.push('open');},onDelete:()=>{(window as any).cardActions.push('delete');}})));
 });
 const card=page.getByRole('button',{name:'Release roadmap Sample project'});await expect(card).toBeVisible();await expect(card.locator('svg')).toHaveAttribute('aria-hidden','true');
 await expect(card.locator('[data-preview-note]')).toHaveCount(2);await expect(card.locator('svg')).toHaveAttribute('preserveAspectRatio','xMidYMid meet');await card.click();await card.click({button:'right'});expect(await page.evaluate(()=>(window as any).cardActions)).toEqual(['open','delete']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/board-card-preview.png'});
});
