import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
test('chat position setting moves transcript and composer and survives reload',async({page})=>{
 await page.setViewportSize({width:1800,height:1000});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{AppearanceSettings,useAppearance}=await import('/src/Appearance.tsx' as string);const el=document.createElement('div');el.id='alignment-settings';el.style.cssText='position:fixed;inset:0;overflow:auto;z-index:9999;background:var(--bg)';document.body.append(el);createRoot(el).render(React.createElement(()=>React.createElement(AppearanceSettings,useAppearance())));});
 const positions:number[][]=[];
 for(const value of ['left','center','right']){await page.locator('#alignment-settings').evaluate(e=>(e as HTMLElement).style.display='block');await page.getByLabel('Chat position',{exact:true}).selectOption(value);await expect(page.locator('html')).toHaveAttribute('data-chat-align',value);await page.locator('#alignment-settings').evaluate(e=>(e as HTMLElement).style.display='none');positions.push(await page.locator('.chat-canvas').evaluate(el=>['.conversation-inner','.composer-area'].map(s=>el.querySelector(s)!.getBoundingClientRect().x)));}
 for(const column of [0,1]){expect(positions[0][column]).toBeLessThan(positions[1][column]);expect(positions[1][column]).toBeLessThan(positions[2][column]);}
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-chat-align','right');
});
