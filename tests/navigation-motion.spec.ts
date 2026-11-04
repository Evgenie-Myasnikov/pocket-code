import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

async function pauseEntrance(page:Page,trigger:string,panel:string){
 return page.evaluate(async({trigger,panel})=>{
  const button=document.querySelector<HTMLButtonElement>(trigger)!;button.focus();button.click();
  await new Promise(requestAnimationFrame);
  const element=document.querySelector<HTMLElement>(panel)!,animations=element.getAnimations();
  if(!animations.length)throw new Error('Expected a live entrance animation');
  for(const animation of animations){animation.pause();animation.currentTime=Number(animation.effect!.getTiming().duration)/2;}
  (window as any).entranceAnimations=animations;(window as any).entranceElement=element;
  await new Promise(requestAnimationFrame);
  const style=getComputedStyle(element),transform=new DOMMatrixReadOnly(style.transform);
  return {native:animations.every(animation=>!(animation instanceof CSSAnimation)),opacity:Number(style.opacity),x:transform.m41,y:transform.m42,durations:animations.map(animation=>Number(animation.effect!.getTiming().duration))};
 },{trigger,panel});
}

const activeAnimations=(page:Page,selector:string)=>page.locator(selector).evaluate(element=>element.getAnimations().filter(animation=>animation.playState==='running'||animation.playState==='paused').length);

test('rail labels support hover, keyboard and Escape outside a collapsed sidebar',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const rail=page.locator('.desktop-rail'),board=rail.getByRole('button',{name:'Board',exact:true}),chats=rail.getByRole('button',{name:'Chats',exact:true});
 await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 await board.hover();const tooltip=page.getByRole('tooltip');await expect(tooltip).toHaveText('Board');
 const tip=(await tooltip.boundingBox())!,bounds=(await rail.boundingBox())!;expect(tip.x+tip.width).toBeGreaterThan(bounds.x+bounds.width);expect(tip.x+tip.width).toBeLessThan(1440);
 await tooltip.hover();await expect(tooltip).toBeVisible();await page.keyboard.press('Escape');await expect(tooltip).toHaveCount(0);
 await page.mouse.move(900,700);await chats.focus();await page.keyboard.press('Tab');await expect(board).toBeFocused();await expect(tooltip).toHaveText('Board');
 for(const theme of ['dark','light']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.screenshot({path:`.local/interaction-rail-tooltip-${theme}.png`,animations:'disabled'});}
 await page.keyboard.press('Escape');await expect(tooltip).toHaveCount(0);await expect(board).toBeFocused();await expect(chats).toHaveAttribute('aria-current','page');
 await page.keyboard.press('Enter');await expect(board).toHaveAttribute('aria-current','page');await expect(tooltip).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('Tab');await expect(tooltip).toHaveText('More');expect(await activeAnimations(page,'.rail-tooltip')).toBe(0);
 await page.emulateMedia({forcedColors:'active'});expect(await activeAnimations(page,'.rail-tooltip')).toBe(0);await expect(tooltip).toHaveCSS('border-top-style','solid');
});

test('phone menu uses a short entrance and preserves keyboard focus with motion disabled',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 const more=page.locator('.mobile-tabbar').getByRole('button',{name:'More',exact:true});await expect(more).toBeVisible();
 const middle=await pauseEntrance(page,'.mobile-tabbar>button:last-child','.mobile-menu-panel');
 expect(middle.native).toBe(true);expect(middle.durations.every(duration=>duration===200)).toBe(true);expect(middle.y).toBeGreaterThan(0);expect(middle.y).toBeLessThan(16);
 await page.locator('.mobile-menu-panel').evaluate(el=>el.getAnimations().forEach(animation=>animation.finish()));
 const menu=page.getByRole('dialog',{name:'More',exact:true});await expect(menu).toBeVisible();await page.screenshot({path:'.local/interaction-phone-menu.png',animations:'disabled'});
 await expect.poll(()=>activeAnimations(page,'.mobile-menu-panel')).toBe(0);await expect(page.locator('.mobile-menu-panel')).toHaveCSS('transform','none');
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(more).toBeFocused();
 await page.emulateMedia({reducedMotion:'reduce'});await more.click();expect(await activeAnimations(page,'.mobile-menu-panel')).toBe(0);expect(await activeAnimations(page,'.mobile-menu-backdrop')).toBe(0);
 await menu.getByRole('button',{name:'Settings',exact:true}).click();await expect(menu).toHaveCount(0);await expect(more).toHaveClass(/active/);
 await page.emulateMedia({forcedColors:'active'});await more.click();expect(await activeAnimations(page,'.mobile-menu-panel')).toBe(0);await expect(menu.getByRole('button',{name:'Settings',exact:true})).toHaveCSS('outline-style','solid');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const preference of ['reducedMotion','forcedColors'] as const)test(`Motion menu cancels an active entrance when ${preference} changes without replay or draft loss`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions>button').first().click();
 const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Synthetic retained draft');await input.evaluate(node=>(window as any).retainedComposer=node);
 const middle=await pauseEntrance(page,'.desktop-sessions .chat-list-action','.card-action-menu');
 expect(middle.native).toBe(true);expect(middle.opacity).toBeGreaterThan(0);expect(middle.opacity).toBeLessThan(1);expect(middle.y).toBeGreaterThan(0);
 await page.emulateMedia(preference==='reducedMotion'?{reducedMotion:'reduce'}:{forcedColors:'active'});
 await expect.poll(()=>activeAnimations(page,'.card-action-menu')).toBe(0);
 await expect(page.locator('.card-action-menu')).toHaveCSS('opacity','1');await expect(page.locator('.card-action-menu')).toHaveCSS('transform','none');
 expect(await page.locator('.card-action-menu').evaluate(element=>({opacity:(element as HTMLElement).style.opacity,transform:(element as HTMLElement).style.transform}))).toEqual({opacity:'',transform:''});
 await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});expect(await activeAnimations(page,'.card-action-menu')).toBe(0);
 await page.keyboard.press('Escape');await expect(page.getByRole('menu',{name:'Chat actions'})).toHaveCount(0);await expect(page.locator('.desktop-sessions .chat-list-action').first()).toBeFocused();
 await expect(input).toHaveValue('Synthetic retained draft');expect(await input.evaluate(node=>node===(window as any).retainedComposer)).toBe(true);
 expect(errors).toEqual([]);
});

test('rapid menu dismissal cancels Motion effects and reopening retains focus and the composer',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await desktop(page);await page.locator('.desktop-sessions>button').first().click();
 const input=page.getByRole('textbox',{name:'Message Claude',exact:true});await input.fill('Synthetic rapid-menu draft');await input.evaluate(node=>(window as any).retainedComposer=node);
 await pauseEntrance(page,'.desktop-sessions .chat-list-action','.card-action-menu');
 await page.keyboard.press('Escape');await expect(page.locator('.card-action-menu')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).entranceAnimations.every((animation:Animation)=>animation.playState==='idle'))).toBe(true);
 const reopened=await pauseEntrance(page,'.desktop-sessions .chat-list-action','.card-action-menu');expect(reopened.native).toBe(true);
 await expect(page.getByRole('menuitem',{name:'Rename',exact:true})).toBeFocused();await expect(page.locator('.card-action-menu')).toHaveCount(1);
 await page.locator('.card-action-menu').evaluate(element=>element.getAnimations().forEach(animation=>animation.finish()));
 await expect.poll(()=>activeAnimations(page,'.card-action-menu')).toBe(0);
 await page.keyboard.press('Escape');await expect(page.locator('.desktop-sessions .chat-list-action').first()).toBeFocused();
 await expect(input).toHaveValue('Synthetic rapid-menu draft');expect(await input.evaluate(node=>node===(window as any).retainedComposer)).toBe(true);expect(errors).toEqual([]);
});

test('Motion press follows replacement rail icons and cancels on release, blur and reduced motion',async({page})=>{
 await desktop(page);const toggle=page.locator('.desktop-rail-heading button'),selector='.desktop-rail-heading button';
 const press=async(keyboard=false)=>page.evaluate(async({selector,keyboard})=>{
  const button=document.querySelector<HTMLButtonElement>(selector)!;button.focus();
  button.dispatchEvent(keyboard?new KeyboardEvent('keydown',{key:' ',bubbles:true}):new PointerEvent('pointerdown',{button:0,isPrimary:true,pointerType:'mouse',bubbles:true}));
  const icon=button.querySelector('svg')!,animations=icon.getAnimations();if(!animations.length)throw new Error('The current rail icon did not animate');
  for(const animation of animations){animation.pause();animation.currentTime=Number(animation.effect!.getTiming().duration)/2;}
  await new Promise(requestAnimationFrame);return new DOMMatrixReadOnly(getComputedStyle(icon).transform).a;
 },{selector,keyboard});
 for(const expanded of ['false','true']){
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded',expanded);const size=await toggle.boundingBox();
  const scale=await press();expect(scale).toBeGreaterThan(.88);expect(scale).toBeLessThan(1);expect((await toggle.boundingBox())!.width).toBe(size!.width);
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{button:0,isPrimary:true,pointerType:'mouse'})));
  await toggle.locator('svg').evaluate(icon=>icon.getAnimations().forEach(animation=>animation.finish()));
  await expect.poll(()=>activeAnimations(page,selector+' svg')).toBe(0);await expect(toggle.locator('svg')).toHaveCSS('transform','none');
 }
 await press(true);await toggle.evaluate(button=>button.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true})));
 await toggle.locator('svg').evaluate(icon=>icon.getAnimations().forEach(animation=>animation.finish()));
 await expect.poll(()=>activeAnimations(page,selector+' svg')).toBe(0);await expect(toggle.locator('svg')).toHaveCSS('transform','none');
 await press(true);await page.locator('.desktop-new-chat').focus();expect(await activeAnimations(page,selector+' svg')).toBe(0);await expect(toggle.locator('svg')).toHaveCSS('transform','none');
 await press();await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>activeAnimations(page,selector+' svg')).toBe(0);await expect(toggle.locator('svg')).toHaveCSS('transform','none');
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{button:0,isPrimary:true,pointerType:'mouse'})));
});

test('menus remain visible and keyboard operable when native animation is unavailable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(Element.prototype,'animate',{value:undefined,configurable:true,writable:true}));
 await desktop(page);const trigger=page.locator('.desktop-sessions .chat-list-action').first();await trigger.focus();await page.keyboard.press('Enter');
 const menu=page.getByRole('menu',{name:'Chat actions'});await expect(menu).toBeVisible();await expect(menu).toHaveCSS('opacity','1');await expect(menu).toHaveCSS('transform','none');
 await expect(page.getByRole('menuitem',{name:'Rename',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
});
