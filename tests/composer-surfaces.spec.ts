import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('access popup escapes the composer and keeps keyboard selection and dismissal',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 const chip=page.locator('.access-chip');await chip.click();const menu=page.locator('.access-menu');await expect(menu).toBeVisible();
 expect(await menu.evaluate(el=>el.parentElement===document.body)).toBe(true);
 await expect(menu).toHaveCSS('backdrop-filter','blur(14px) saturate(1.1)');
 await menu.evaluate(el=>{const box=el.getBoundingClientRect(),behind=document.createElement('div');behind.id='behind-access';behind.style.cssText=`position:fixed;z-index:1;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;background:repeating-linear-gradient(90deg,#fff 0 2px,#111 2px 4px);pointer-events:none`;document.body.insertBefore(behind,el);});
 const box=(await menu.boundingBox())!,clip={x:box.x+12,y:box.y+8,width:100,height:20};const blurred=await page.screenshot({clip});await menu.evaluate(el=>(el as HTMLElement).style.setProperty('backdrop-filter','none','important'));const sharp=await page.screenshot({clip});expect(blurred.equals(sharp),'popup must diffuse real backdrop pixels').toBe(false);
 await menu.evaluate(el=>(el as HTMLElement).style.removeProperty('backdrop-filter'));await page.locator('#behind-access').evaluate(el=>el.remove());
 await expect(menu.locator('[aria-checked=true]')).toBeFocused();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(menu).toHaveCount(0);await expect(chip).toBeFocused();
 await chip.click();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(chip).toBeFocused();
 await chip.click();await page.getByLabel('Message Claude',{exact:true}).click();await expect(menu).toHaveCount(0);
});

test('native model and effort pickers use themed top-layer menus',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{ModelPicker}=await import('/src/ModelPicker.tsx' as string),{EffortPicker}=await import('/src/EffortPicker.tsx' as string);const root=document.createElement('div');root.style.cssText='position:absolute;bottom:20px;left:20px;right:20px;display:flex';document.body.replaceChildren(root);createRoot(root).render(React.createElement(React.Fragment,null,React.createElement(ModelPicker,{provider:'codex',name:'Codex',value:'standard',models:[{id:'standard',name:'Standard'},{id:'small',name:'Small'}],onChange:()=>{}}),React.createElement(EffortPicker,{value:'medium',options:['low','medium','high'],onChange:()=>{}})));});
 const model=page.getByLabel('Codex model'),effort=page.getByLabel('Codex reasoning effort');
 for(const picker of [model,effort]){
  await expect(picker).toHaveCSS('appearance','base-select');await picker.click();await expect(picker).toHaveJSProperty('disabled',false);
  expect(await picker.evaluate(el=>el.matches(':open'))).toBe(true);
  expect(await picker.evaluate(el=>getComputedStyle(el,'::picker(select)').backdropFilter)).toBe('blur(14px) saturate(1.1)');
  await page.screenshot({path:picker===model?'.local/model-glass-menu.png':'.local/effort-glass-menu.png'});
  await page.keyboard.press('Escape');expect(await picker.evaluate(el=>el.matches(':open'))).toBe(false);
 }
});
