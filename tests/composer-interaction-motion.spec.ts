import {test,expect} from '@playwright/test';

for(const width of [390,1440])test(`active composer has a stable subtle pulse and honors reduced motion at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{ChatComposer}=await import('/src/ChatComposer.tsx' as string);
  const element=document.createElement('div');element.style.cssText='padding:16px';document.body.replaceChildren(element);const root=createRoot(element);
  (window as any).composerMotion=(state:any={})=>root.render(React.createElement(ChatComposer,{text:'',label:'Synthetic message',placeholder:'Message',uploading:false,canSend:false,attachments:[],controls:null,stopLabel:'Stop',onText:()=>{},onRemove:()=>{},onFiles:()=>{},onSend:()=>{},onStop:()=>{},...state}));(window as any).composerMotion();
 });
 const stop=page.locator('.stop-button');await expect(stop).toBeVisible();expect(await stop.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('composer-active-halo');expect(await stop.evaluate(el=>getComputedStyle(el,'::after').transform)).toBe('none');const before=await stop.boundingBox();await page.waitForTimeout(200);expect(await stop.boundingBox()).toEqual(before);
 await page.emulateMedia({reducedMotion:'reduce'});expect(await stop.evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>(window as any).composerMotion({stopRetry:true}));await expect(page.locator('.prompt-composer')).not.toHaveAttribute('data-pulsing','true');await page.evaluate(()=>(window as any).composerMotion({stopping:true}));await expect(page.locator('.prompt-composer')).not.toHaveAttribute('data-pulsing','true');await expect(stop).toBeDisabled();
});
