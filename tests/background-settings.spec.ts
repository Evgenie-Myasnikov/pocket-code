import {test,expect} from '@playwright/test';

test('preview animates with backgrounds disabled and updates color while paused',async({page})=>{
 await page.addInitScript(()=>{const counts=new WeakMap();(window as any).previewDraws=(c:HTMLCanvasElement)=>counts.get(c)||0;const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...args){counts.set(this.canvas,(counts.get(this.canvas)||0)+1);return draw.apply(this,args);};});
 await page.goto('http://127.0.0.1:5173');await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundSettings}=await import('/src/background-settings.tsx' as string);const host=document.createElement('div');host.className='desktop-app';host.innerHTML='<div class="chat-atmosphere"></div><div class="embedded-chat" id="preview-settings"></div>';document.body.replaceChildren(host);createRoot(host.querySelector('#preview-settings')!).render(React.createElement(BackgroundSettings));});
 await expect(page.getByLabel('Show background')).not.toBeChecked();await page.getByRole('button',{name:'Iridescence',exact:true}).click();
 const canvas=page.locator('.background-preview canvas');await expect(canvas).toBeVisible();const count=await canvas.evaluate(c=>(window as any).previewDraws(c));await expect.poll(()=>canvas.evaluate(c=>(window as any).previewDraws(c))).toBeGreaterThan(count+5);
 await page.getByLabel('Motion speed').fill('0');await expect(page.locator('.background-preview .chat-atmosphere')).toHaveAttribute('data-moving','false');
 await page.getByLabel('Background color',{exact:true}).fill('#ff2233');await page.waitForTimeout(150);const red=await canvas.screenshot();const stopped=await canvas.evaluate(c=>(window as any).previewDraws(c));await page.waitForTimeout(120);expect(await canvas.evaluate(c=>(window as any).previewDraws(c))).toBe(stopped);
 await page.getByLabel('Background color',{exact:true}).fill('#2244ff');await page.waitForTimeout(150);expect((await canvas.screenshot()).equals(red)).toBe(false);
 await page.getByLabel('Motion speed').fill('100');await canvas.scrollIntoViewIfNeeded();const resumed=await canvas.evaluate(c=>(window as any).previewDraws(c));await expect.poll(()=>canvas.evaluate(c=>(window as any).previewDraws(c))).toBeGreaterThan(resumed+5);
 await expect(page.getByRole('group',{name:'Background style'}).getByRole('button')).toHaveCount(10);await expect(page.getByRole('button',{name:'Silk',exact:true})).toHaveCount(0);
});
test('phone background defaults off and explicit settings persist',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 const mount=()=>page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default;const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;const {BackgroundSettings}=await import('/src/background-settings.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(BackgroundSettings));});
 await mount();await expect(page.getByLabel('Show background')).not.toBeChecked();await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-preview','true');
 await page.getByLabel('Show background').check();await expect(page.locator('.chat-atmosphere')).toBeVisible();
 const styles=page.getByRole('group',{name:'Background style'});await expect(styles.getByRole('button')).toHaveCount(10);
 await styles.getByRole('button',{name:'SoftAurora',exact:true}).click();await expect(page.locator('.chat-atmosphere .soft-aurora__canvas')).toBeVisible();await expect(styles.getByRole('button',{name:'SoftAurora',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-moving','false');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByLabel('Motion speed').fill('0');await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-moving','false');await page.getByLabel('Intensity').fill('65');
 await page.reload();await mount();await expect(page.getByLabel('Show background')).toBeChecked();await expect(page.getByRole('button',{name:'SoftAurora',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('Motion speed')).toHaveValue('0');await expect(page.getByLabel('Intensity')).toHaveValue('65');
 await page.getByLabel('Show background').uncheck();await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-preview','true');
});
