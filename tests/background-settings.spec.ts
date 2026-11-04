import {test,expect} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';

async function settleBackground(page:import('@playwright/test').Page){
 await expect(page.locator('.background-style-options [aria-pressed=true]')).toHaveCount(1);
 await expect(page.locator('.background-preview canvas')).toBeVisible();
 // Wait for the lazy renderer's first frame and the previous tile's color transition.
 await page.waitForTimeout(350);
}

test('settings keep an opaque surface and accessible background selection in both themes',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await desktop(page);await desktopSection(page,'Settings');
 await page.locator('[data-settings-category="appearance"]').click();
 const settings=page.locator('.desktop-settings'),main=page.locator('.desktop-main'),selected=page.getByRole('button',{name:'Galaxy',exact:true});
 for(const theme of ['dark','light']){
  await page.locator(`input[name=appearance-theme][value=${theme}]`).check();
  const background=await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor);
  await expect(settings).toHaveCSS('background-color',background);await expect(main).toHaveCSS('background-color',background);
  await selected.click();await expect(selected).toHaveAttribute('aria-pressed','true');await expect(selected.locator('.background-style-title>svg')).toHaveCSS('opacity','1');
  await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(selected).toBeFocused();expect(await selected.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await expect(page.locator('.background-preview-caption')).toContainText('Galaxy');
  await page.locator('.background-settings').scrollIntoViewIfNeeded();
  await settleBackground(page);
  await page.screenshot({path:`.local/settings-background-desktop-${theme}.png`});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.settings-detail>.appearance-settings')).toHaveCSS('animation-name','none');await expect(selected).toHaveCSS('transition-duration','0s');
 await page.emulateMedia({forcedColors:'active'});await expect(selected).toHaveCSS('outline-style','solid');await expect(page.locator('.background-preview canvas')).not.toBeVisible();
});

test('background controls fit a phone and retain keyboard selection without motion',async({page})=>{
 await page.setViewportSize({width:390,height:900});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundSettings}=await import('/src/background-settings.tsx' as string);await import('/src/SettingsPanel.tsx' as string);const root=document.createElement('section');root.className='settings-panel settings-categorized';root.style.cssText='height:100dvh;overflow:auto;padding:16px';document.body.replaceChildren(root);createRoot(root).render(React.createElement(BackgroundSettings));});
 for(const theme of ['dark','light']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  const effect=page.getByRole('button',{name:'Iridescence',exact:true});await effect.focus();await page.keyboard.press('Enter');await expect(effect).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.settings-panel').evaluate(el=>el.scrollTop=0);await settleBackground(page);await page.screenshot({path:`.local/settings-background-phone-${theme}.png`});
 }
 await page.setViewportSize({width:320,height:640});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});const effect=page.getByRole('button',{name:'Galaxy',exact:true});await effect.focus();await page.keyboard.press('Enter');await expect(effect).toHaveAttribute('aria-pressed','true');await expect(effect).toHaveCSS('transition-duration','0s');
});

test('live Galaxy has no extra radial haze behind the transparent shader',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:true,style:'galaxy',color:'',intensity:100,speed:0}));const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundSettings}=await import('/src/background-settings.tsx' as string);const host=document.createElement('div');document.body.replaceChildren(host);createRoot(host).render(React.createElement(BackgroundSettings));});
 const atmosphere=page.locator('.background-preview .chat-atmosphere');await expect(atmosphere.locator('canvas')).toBeVisible();
 await expect(atmosphere).toHaveCSS('background-image','none');
 await expect(atmosphere).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await page.locator('.background-preview').screenshot({path:'.local/galaxy-preview-no-haze.png'});
});

test('preview animates with backgrounds disabled and updates color while paused',async({page})=>{
 await page.addInitScript(()=>{const counts=new WeakMap();(window as any).previewDraws=(c:HTMLCanvasElement)=>counts.get(c)||0;const draw=WebGL2RenderingContext.prototype.drawArrays;WebGL2RenderingContext.prototype.drawArrays=function(...args){counts.set(this.canvas,(counts.get(this.canvas)||0)+1);return draw.apply(this,args);};});
 await page.goto('http://127.0.0.1:5173');await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundSettings}=await import('/src/background-settings.tsx' as string);const host=document.createElement('div');host.className='desktop-app';host.innerHTML='<div class="chat-atmosphere"></div><div class="embedded-chat" id="preview-settings"></div>';document.body.replaceChildren(host);createRoot(host.querySelector('#preview-settings')!).render(React.createElement(BackgroundSettings));});
 await expect(page.getByLabel('Show background')).not.toBeChecked();await page.getByRole('button',{name:'Iridescence',exact:true}).click();
 const canvas=page.locator('.background-preview canvas');await expect(canvas).toBeVisible();const count=await canvas.evaluate(c=>(window as any).previewDraws(c));await expect.poll(()=>canvas.evaluate(c=>(window as any).previewDraws(c))).toBeGreaterThan(count+5);
 await page.getByLabel('Motion speed').fill('0');await expect(page.locator('.background-preview .chat-atmosphere')).toHaveAttribute('data-moving','false');
 await page.getByLabel('Background color',{exact:true}).fill('#ff2233');await page.waitForTimeout(150);const red=await canvas.screenshot();const stopped=await canvas.evaluate(c=>(window as any).previewDraws(c));await page.waitForTimeout(120);expect(await canvas.evaluate(c=>(window as any).previewDraws(c))).toBe(stopped);
 await page.getByLabel('Background color',{exact:true}).fill('#2244ff');await page.waitForTimeout(150);expect((await canvas.screenshot()).equals(red)).toBe(false);
 await page.getByLabel('Motion speed').fill('100');await canvas.scrollIntoViewIfNeeded();const resumed=await canvas.evaluate(c=>(window as any).previewDraws(c));await expect.poll(()=>canvas.evaluate(c=>(window as any).previewDraws(c))).toBeGreaterThan(resumed+5);
 await expect(page.getByRole('group',{name:'Background style'}).getByRole('button')).toHaveCount(17);
 for(const name of ['Aurora','LiquidChrome','FloatingLines','Silk'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 const migrated=await page.evaluate(async()=>{const {normalizeBackground}=await import('/src/background-settings.tsx' as string);return ['aurora','liquidChrome','floatingLines'].map(style=>normalizeBackground({style}).style);});expect(migrated).toEqual(['veil','veil','veil']);
});
test('phone background defaults off and explicit settings persist',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 const mount=()=>page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default;const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;const {BackgroundSettings}=await import('/src/background-settings.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(BackgroundSettings));});
 await mount();await expect(page.getByLabel('Show background')).not.toBeChecked();await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-preview','true');
 await page.getByLabel('Show background').check();await expect(page.locator('.chat-atmosphere')).toBeVisible();
 const styles=page.getByRole('group',{name:'Background style'});await expect(styles.getByRole('button')).toHaveCount(17);
 await styles.getByRole('button',{name:'SoftAurora',exact:true}).click();await expect(page.locator('.chat-atmosphere .soft-aurora__canvas')).toBeVisible();await expect(styles.getByRole('button',{name:'SoftAurora',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-moving','false');await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByLabel('Motion speed').fill('0');await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-moving','false');await page.getByLabel('Intensity').fill('65');
 await page.reload();await mount();await expect(page.getByLabel('Show background')).toBeChecked();await expect(page.getByRole('button',{name:'SoftAurora',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByLabel('Motion speed')).toHaveValue('0');await expect(page.getByLabel('Intensity')).toHaveValue('65');
 await page.getByLabel('Show background').uncheck();await expect(page.locator('.chat-atmosphere')).toHaveAttribute('data-preview','true');
});
