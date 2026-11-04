import {expect,test} from '@playwright/test';

const names=['prism','lightRays','gradientWaves','sideRays','rippleGrid','pixelSnow','topography','dither','orb','beams'];

test('new backgrounds respond to motion preferences after mounting with reduced motion',async({page})=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const counts=new WeakMap();(window as any).backgroundDraws=(canvas:HTMLCanvasElement)=>counts.get(canvas)||0;
  for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'] as const){
   const original=WebGL2RenderingContext.prototype[key];
   (WebGL2RenderingContext.prototype as any)[key]=function(...args:any[]){counts.set(this.canvas,(counts.get(this.canvas)||0)+1);return (original as any).apply(this,args);};
  }
 });
 await page.setViewportSize({width:640,height:360});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BackgroundEffect}=await import('/src/BackgroundEffect.tsx' as string);
  const host=document.createElement('div');host.id='effect';host.style.cssText='width:100vw;height:100vh;background:#101014';document.body.replaceChildren(host);const root=createRoot(host);
  (window as any).renderBackground=(kind:string)=>root.render(React.createElement(React.StrictMode,null,React.createElement(BackgroundEffect,{key:kind,kind,color:'',speed:40,paused:false,light:false})));
 });
 const draws=()=>page.locator('#effect canvas').evaluate(canvas=>(window as any).backgroundDraws(canvas));
 for(const name of names){
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(name=>(window as any).renderBackground(name),name);
  await expect(page.locator('#effect canvas')).toHaveCount(1);await page.waitForTimeout(500);
  const initial=await draws();expect(initial,`${name} renders its initial static frame`).toBeGreaterThan(0);
  await page.waitForTimeout(200);expect(await draws(),`${name} initially respects reduced motion`).toBe(initial);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(draws,{message:`${name} resumes without being reselected`}).toBeGreaterThan(initial);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(400);
  const stopped=await draws();await page.waitForTimeout(200);expect(await draws(),`${name} stops after a preference change`).toBe(stopped);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(draws,{message:`${name} resumes after a second preference change`}).toBeGreaterThan(stopped);
 }
 expect(errors).toEqual([]);
});
