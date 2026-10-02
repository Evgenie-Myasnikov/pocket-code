import {test,expect} from '@playwright/test';
test('sliders and native frame follow palette and theme',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.connect-page').waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {AppearanceSettings,useAppearance}=await import('/src/Appearance.tsx' as string);
  const {watchWindowTheme}=await import('/src/window-theme.ts' as string);
  (window as any).themeCalls=[];(window as any).chrome={webview:{addEventListener:()=>{},postMessage:(v:any)=>{if(v.action==='window-theme')(window as any).themeCalls.push(v);}}};watchWindowTheme();
  const root=document.createElement('div');root.id='appearance-fixture';root.style.cssText='padding:24px;max-width:480px;background:var(--bg)';document.body.replaceChildren(root);
  function Fixture(){return React.createElement(AppearanceSettings,useAppearance());}createRoot(root).render(React.createElement(Fixture));
 });
 const slider=page.locator('input[type=range]').first();await expect(slider).toBeVisible();await expect(slider).toHaveCSS('appearance','none');await expect(slider).toHaveCSS('height','44px');
 const theme=page.locator('select').first();await theme.selectOption('light');
 await expect.poll(()=>page.evaluate(()=>(window as any).themeCalls.at(-1)?.dark)).toBe(false);
 const before=await page.evaluate(()=>(window as any).themeCalls.at(-1).background);await page.locator('.palette-options button').nth(2).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).themeCalls.at(-1).background)).not.toBe(before);
 await slider.focus();const value=Number(await slider.inputValue());await page.keyboard.press('ArrowRight');await expect(slider).toHaveValue(String(value+1));
 await expect(slider).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await slider.blur();
 await expect(page.locator('.palette-options button').first()).toHaveCSS('background-color',await page.evaluate(()=>{const p=document.createElement('span');p.style.background='var(--panel)';document.body.append(p);const color=getComputedStyle(p).backgroundColor;p.remove();return color;}));
 await page.screenshot({path:'artifacts/screenshots/appearance-light.png'});await theme.selectOption('dark');
 await expect(page.locator('.palette-options button').first()).toHaveCSS('background-color',await page.evaluate(()=>{const p=document.createElement('span');p.style.background='var(--panel)';document.body.append(p);const color=getComputedStyle(p).backgroundColor;p.remove();return color;}));
 await page.screenshot({path:'artifacts/screenshots/appearance-dark.png'});
});
