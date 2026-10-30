import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

async function mountSettings(page:Page){
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundSettings}=await import('/src/background-settings.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(BackgroundSettings));});
}

test('background area switches preserve old settings, persist independently and reset',async({page})=>{
 await page.addInitScript(()=>{if(!localStorage.getItem('pocket-code-background-v1'))localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:true,style:'galaxy',speed:0,color:'#2357aa',intensity:60}));});
 await page.goto('http://127.0.0.1:5173');await mountSettings(page);
 const chat=page.getByLabel('Conversation backdrop',{exact:true}),controls=page.getByLabel('Background behind transparent controls',{exact:true}),sidebar=page.getByLabel('Chat sidebar background',{exact:true});
 for(const region of [chat,controls,sidebar])await expect(region).toBeChecked();
 await chat.uncheck();await controls.uncheck();await expect(sidebar).toBeChecked();
 await page.reload();await mountSettings(page);await expect(chat).not.toBeChecked();await expect(controls).not.toBeChecked();await expect(sidebar).toBeChecked();
 await expect(page.getByLabel('Background color',{exact:true})).toHaveValue('#2357aa');await expect(page.getByLabel('Motion speed')).toHaveValue('0');await expect(page.getByLabel('Intensity')).toHaveValue('60');
 await page.getByLabel('Show background').uncheck();await expect(page.locator('.background-preview canvas')).toBeVisible();
 await page.getByRole('button',{name:'Reset background'}).click();for(const region of [chat,controls,sidebar])await expect(region).toBeChecked();
 const malformed=await page.evaluate(async()=>{const {normalizeBackground}=await import('/src/background-settings.tsx' as string);return normalizeBackground({chat:'false',controls:0,sidebar:null});});expect(malformed).toMatchObject({chat:true,controls:true,sidebar:true});
});

test('disabled areas are opaque independently and all-off removes the shared shader',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 const set=async(patch:Record<string,boolean>)=>page.evaluate(patch=>{const key='pocket-code-background-v1';localStorage.setItem(key,JSON.stringify({enabled:true,chat:true,controls:true,sidebar:true,style:'galaxy',speed:0,...patch}));window.dispatchEvent(new Event('pocket-background-changed'));},patch);
 await set({controls:false});const root=page.locator('html');await expect(root).toHaveAttribute('data-background-controls','false');
 const glass=()=>page.locator('.composer-with-usage').evaluate(el=>{const style=getComputedStyle(el,'::before');return {blur:style.backdropFilter,color:style.backgroundColor,panel:getComputedStyle(document.documentElement).getPropertyValue('--panel').trim()};});
 expect((await glass()).blur).toBe('none');await expect(page.locator('.desktop-rail')).not.toHaveCSS('backdrop-filter','none');
 await page.locator('.access-chip').click();await expect(page.locator('.access-menu')).toHaveCSS('backdrop-filter','none');await page.keyboard.press('Escape');
 await set({sidebar:false});await expect(root).toHaveAttribute('data-background-sidebar','false');await expect(page.locator('.desktop-rail')).toHaveCSS('backdrop-filter','none');expect((await glass()).blur).toBe('blur(14px) saturate(1.1)');
 await set({chat:false});await expect(root).toHaveAttribute('data-background-chat','false');const conversation=page.locator('.chat-canvas>.conversation');expect(await conversation.evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');await expect(page.locator('.desktop-rail')).not.toHaveCSS('backdrop-filter','none');expect((await glass()).blur).toBe('blur(14px) saturate(1.1)');
 await set({chat:false,controls:false,sidebar:false});await expect(page.locator('.desktop-app>.chat-atmosphere')).toHaveCount(0);await page.screenshot({path:'.local/background-regions-off.png'});
 await set({chat:false,controls:false,sidebar:true});await expect(page.locator('.desktop-app>.chat-atmosphere canvas')).toHaveCount(1);
});
