import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const names=['veil','silk','gradientBlinds','plasmaWave','ghostFibers','fluxLines','lightfall','moltenMetal','prismaticBurst','aurora','iridescence'];
test('upstream backgrounds render, resize and release canvases in Strict Mode',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/INVALID_OPERATION|shader.*error/i.test(m.text()))errors.push(m.text());});
 await page.addInitScript(()=>{const counts=new WeakMap();(window as any).backgroundDraws=(canvas:HTMLCanvasElement)=>counts.get(canvas)||0;for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'] as const){const old=WebGL2RenderingContext.prototype[key];(WebGL2RenderingContext.prototype as any)[key]=function(...args:any[]){counts.set(this.canvas,(counts.get(this.canvas)||0)+1);return (old as any).apply(this,args);};}});
 await page.setViewportSize({width:640,height:360});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
 const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundEffect}=await import('/src/BackgroundEffect.tsx' as string);
 const host=document.createElement('div');host.id='effect';host.style.cssText='width:100vw;height:100vh;background:#101014';document.body.replaceChildren(host);const root=createRoot(host);
 (window as any).renderBackground=(kind:string,paused=false,light=false)=>root.render(React.createElement(React.StrictMode,null,React.createElement(BackgroundEffect,{key:kind,kind,color:'',speed:40,paused,light})));
 });
 const dir=process.env.POCKET_CAPTURE_BACKGROUNDS==='1'?'src/assets/backgrounds':'.local/background-renders';mkdirSync(dir,{recursive:true});
 for(const name of names){
 await page.evaluate(name=>(window as any).renderBackground(name),name);await expect(page.locator('#effect canvas')).toHaveCount(1);await page.waitForTimeout(650);
 await page.setViewportSize({width:600,height:340});await page.waitForTimeout(100);await page.setViewportSize({width:640,height:360});await page.waitForTimeout(100);
 const data=await page.locator('#effect').screenshot({path:`${dir}/${name}.png`});expect(data.length,`${name} rendered image`).toBeGreaterThan(2000);
 await page.evaluate(name=>(window as any).renderBackground(name,true),name);await page.waitForTimeout(400);await expect(page.locator('#effect canvas')).toHaveCount(1);const draws=await page.locator('#effect canvas').evaluate(c=>(window as any).backgroundDraws(c));await page.waitForTimeout(300);expect(await page.locator('#effect canvas').evaluate(c=>(window as any).backgroundDraws(c)),`${name} stops drawing when paused`).toBe(draws);
 }
 expect(errors).toEqual([]);
});
