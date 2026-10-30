import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('chat fonts persist and prose headings, code and icons use shared roles',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{AppearanceSettings,useAppearance}=await import('/src/Appearance.tsx' as string);const element=document.createElement('div');element.id='font-settings';element.style.cssText='position:fixed;inset:0;z-index:9999;overflow:auto;background:var(--bg)';document.body.append(element);createRoot(element).render(React.createElement(()=>React.createElement(AppearanceSettings,useAppearance())));});
 await page.getByLabel('Chat font',{exact:true}).selectOption('manrope');await page.locator('#font-settings').evaluate(el=>(el as HTMLElement).style.display='none');
 const text=page.locator('.message .markdown p').first();await expect(text).toHaveCSS('font-family',/Manrope/);await expect(page.locator('.message .markdown pre').first()).toHaveCSS('font-family',/JetBrains Mono/);
 const heading=page.locator('.message .markdown h2').first();expect(await heading.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight)/parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(1.3,2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
 await page.reload();await expect.poll(()=>page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--font-chat'))).toContain('Manrope');
});
