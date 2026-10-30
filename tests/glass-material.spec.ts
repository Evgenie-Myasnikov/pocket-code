import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

for(const theme of ['dark','light'] as const)test(`${theme} glass attenuates real transcript edges while retaining backdrop color`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions button').first().click();
 await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.chatEdgeFade='off';const conversation=document.querySelector<HTMLElement>('.conversation')!;conversation.style.background='repeating-linear-gradient(90deg,#fff 0 2px,#111 2px 4px)';},theme);
 const form=page.locator('.prompt-composer'),wrapper=page.locator('.composer-with-usage'),box=(await form.boundingBox())!,clip={x:Math.round(box.x+box.width/2),y:Math.round(box.y+20),width:128,height:12};
 const blurred=await page.screenshot({clip,animations:'disabled'});await wrapper.evaluate(el=>(el as HTMLElement).style.setProperty('--composer-backdrop','none'));const sharp=await page.screenshot({clip,animations:'disabled'});
 const energy=await page.evaluate(async({a,b})=>{const read=async(src:string)=>{const image=new Image();image.src='data:image/png;base64,'+src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const bytes=context.getImageData(0,0,image.width,image.height).data;let edge=0;for(let y=0;y<image.height;y++)for(let x=1;x<image.width;x++)edge+=Math.abs(bytes[(y*image.width+x)*4]-bytes[(y*image.width+x-1)*4]);return edge/((image.width-1)*image.height);};return {blurred:await read(a),sharp:await read(b)};},{a:blurred.toString('base64'),b:sharp.toString('base64')});
 console.log('Glass edge energy',energy);expect(energy.sharp).toBeGreaterThan(8);expect(energy.blurred).toBeLessThan(energy.sharp*.15);
 await wrapper.evaluate(el=>(el as HTMLElement).style.removeProperty('--composer-backdrop'));
 const color=async(value:string)=>{await page.locator('.conversation').evaluate((el,value)=>(el as HTMLElement).style.background=value,value);const bytes=await page.screenshot({clip,animations:'disabled'});return page.evaluate(async(src)=>{const image=new Image();image.src='data:image/png;base64,'+src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data;let red=0,blue=0;for(let i=0;i<data.length;i+=4){red+=data[i];blue+=data[i+2];}return {red:red/(data.length/4),blue:blue/(data.length/4)};},bytes.toString('base64'));};
 const red=await color('#ff0000'),blue=await color('#0000ff');console.log('Glass transmitted color',{red,blue});
 expect(red.red-blue.red,'glass must transmit a visible amount of backdrop color').toBeGreaterThan(90);
 expect(blue.blue-red.blue).toBeGreaterThan(90);
 await page.locator('.conversation').evaluate(el=>(el as HTMLElement).style.background='repeating-linear-gradient(90deg,#fff 0 2px,#111 2px 4px)');await page.screenshot({path:'.local/glass-real-transcript.png'});
 await page.locator('.conversation').evaluate(el=>(el as HTMLElement).style.background='radial-gradient(ellipse at 65% 100%,#67458b,transparent 60%),radial-gradient(ellipse at 5% 70%,#126b67,transparent 65%),#101014');await page.screenshot({path:`.local/glass-material-preview-${theme}.png`});
 await page.emulateMedia({forcedColors:'active'});expect(await wrapper.evaluate(el=>getComputedStyle(el,'::before').backdropFilter)).toBe('none');
});
