import {test,expect} from '@playwright/test';

for(const width of [320,390,1440])for(const scale of [60,130])test(`conversation header stays in one row at ${width}px and ${scale}%`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first().waitFor();
 page.on('pageerror',error=>console.log('Header fixture error:',error.message));
 await page.evaluate(async scale=>{
  document.documentElement.style.setProperty('--ui-scale',String(scale/100));
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {ChatHeader}=await import('/src/ChatHeader.tsx' as string),root=document.createElement('div');root.className='app show-chat';document.body.replaceChildren(root);
  const click=(action:string)=>()=>{root.dataset.action=action;};
  createRoot(root).render(React.createElement('main',{className:'workspace'},React.createElement(ChatHeader,{title:'A long synthetic conversation title with more text',project:'Example project',provider:'Codex',branch:'feature/synthetic-branch',onBack:click('back'),review:{disabled:false,open:click('review'),stats:{added:12,removed:3,files:2}},outputs:{disabled:false,open:click('outputs')},subagents:{count:3,running:1,disabled:false,open:click('agents')},reading:{disabled:false,open:click('reading')}})));
 },scale);
 const header=page.locator('.chat-header-conversation'),back=header.getByRole('button',{name:'Back to chats',exact:true}),more=header.getByRole('button',{name:'More actions',exact:true});
 await expect(more).toBeVisible();await expect(header.getByRole('button')).toHaveCount(2);
 const a=(await back.boundingBox())!,b=(await more.boundingBox())!,title=(await header.locator('.header-title').boundingBox())!;
 expect(Math.abs(a.y+a.height/2-b.y-b.height/2)).toBeLessThan(2);expect(Math.abs(a.y+a.height/2-title.y-title.height/2)).toBeLessThan(2);expect(a.width).toBe(b.width);expect(title.x).toBeGreaterThanOrEqual(a.x+a.width);expect(title.x+title.width).toBeLessThanOrEqual(b.x);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/header-single-row-${width}-${scale}.png`});
 await more.click();const menu=page.getByRole('menu',{name:'More actions',exact:true});await expect(menu.getByText('feature/synthetic-branch')).toBeVisible();await expect(menu.getByRole('menuitem',{name:'Results',exact:true})).toBeVisible();await expect(menu.getByRole('menuitem',{name:/Subagents/})).toBeVisible();await menu.getByRole('menuitem',{name:'Review',exact:true}).click();await expect(menu).toHaveCount(0);expect(await page.locator('body>div').getAttribute('data-action')).toBe('review');await expect(more).toBeFocused();
});
