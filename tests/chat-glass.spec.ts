import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {newChat} from './chat-navigation';
for(const theme of ['dark','light'])test(`shared chat surfaces and menus in ${theme} theme`,async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(theme=>{localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme,palette:'neutral',scale:100,textSize:14}));(window as any).branchMessages=[{id:'request',role:'user',blocks:[{type:'text',text:'Review the synthetic layout and keep the controls readable.'}]},{id:'reply',role:'assistant',blocks:[{type:'text',text:'The layout uses one shared surface.\n\n```ts\nconst surface = "glass";\n```'}]}];},theme);
 await desktop(page);await page.locator('.desktop-sessions button').first().click();
 const bubble=page.locator('.user-message-content');
 await expect(bubble).toHaveCSS('backdrop-filter','blur(8px)');
 await expect(page.locator('article.message.user')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await expect(page.locator('article.message.user')).toHaveCSS('backdrop-filter','none');
 await page.locator('.chat-header .chat-menu-button').click();
 await expect(page.locator('.chat-menu')).toHaveCSS('backdrop-filter','blur(20px)');
 await expect(page.locator('.chat-menu')).toHaveCSS('opacity','1');
 await expect(page.locator('.composer-tools')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 await page.screenshot({path:`.local/chat-surfaces-${theme}.png`});
 await page.emulateMedia({forcedColors:'active'});
 await expect(bubble).toHaveCSS('backdrop-filter','none');
 await expect(page.locator('.chat-menu')).toHaveCSS('backdrop-filter','none');
});
for(const width of [390,1440])test(`visible atmosphere and glass preserve interaction at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 if(width>600){await desktop(page);await page.locator('.desktop-sessions button').first().click();}
 else{await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace','claude');});await page.goto('http://127.0.0.1:5173');await newChat(page);}
 const atmosphere=page.locator('.chat-atmosphere'),composer=page.locator('.assistant-composer');
 await expect(atmosphere.locator('canvas')).toBeVisible();await expect(atmosphere).toHaveCSS('position','absolute');
 await expect.poll(()=>atmosphere.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(.3);
 const bounds=await atmosphere.boundingBox();expect(bounds!.height).toBeGreaterThan(500);
 await expect(composer).toHaveCSS('backdrop-filter','blur(18px) saturate(1.2)');
 await expect(page.locator('.chat-edge-glass i')).toHaveCount(6);
 await expect(page.locator('.chat-edge-glass')).toHaveCSS('pointer-events','none');
 const input=page.getByLabel('Message Claude',{exact:true});await input.fill('SyntheticLongUnbrokenDraft'.repeat(12));
 const inputBox=(await input.boundingBox())!,usageBox=(await page.locator('.composer-input>.usage-indicator').boundingBox())!;
 expect(inputBox.x+inputBox.width).toBeLessThanOrEqual(usageBox.x-7);
 expect(inputBox.width).toBeGreaterThan(100);
 if(width>600){await expect(page.locator('.desktop-rail')).toHaveCSS('backdrop-filter','blur(22px) saturate(1.15)');await expect(page.locator('.code-block').first()).toHaveCSS('backdrop-filter','blur(12px)');await expect(page.locator('.code-block>pre').first()).toHaveCSS('background-color','rgba(0, 0, 0, 0)');}
 await page.screenshot({path:`.local/chat-glass-${width}.png`});
 await page.evaluate(()=>document.documentElement.dataset.chatEdgeFade='off');await expect(page.locator('.chat-edge-glass')).toBeHidden();
 await page.emulateMedia({reducedMotion:'reduce'});await expect(atmosphere.locator('canvas')).toHaveCount(0);await expect(atmosphere).toBeVisible();
 await page.emulateMedia({forcedColors:'active'});await expect(atmosphere).toBeHidden();await expect(composer).toHaveCSS('backdrop-filter','none');
});
