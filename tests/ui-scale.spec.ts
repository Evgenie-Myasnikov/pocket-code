import {test,expect} from '@playwright/test';
test('UI scale reaches compact controls and portals without changing canvas geometry; wheel never changes UI scale',async({page})=>{
 await page.setViewportSize({width:1000,height:1000});await page.goto('http://127.0.0.1:5173/tests/ui-scale-fixture.html');
 const sizes:number[][]=[];
 for(const value of [60,100,130]){
  await page.getByRole('slider',{name:'Scale',exact:true}).fill(String(value));
  await page.locator('.provider-picker-trigger').click();
  sizes.push(await page.evaluate(()=>['.board-title h2','.provider-picker-trigger','.provider-picker-menu button','.board-dialog h2'].map(s=>parseFloat(getComputedStyle(document.querySelector(s)!).fontSize))));
  await page.keyboard.press('Escape');
  await expect(page.locator('.whiteboard-item')).toHaveCSS('width','240px');await expect(page.locator('.whiteboard-text')).toHaveCSS('font-size','18px');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pocket-code-appearance-v1')!).scale)).toBe(value);
 }
 for(let i=0;i<4;i++){expect(sizes[0][i]).toBeLessThan(sizes[1][i]);expect(sizes[1][i]).toBeLessThan(sizes[2][i]);}
 const wheel=await page.evaluate(()=>{const ctrl=new WheelEvent('wheel',{ctrlKey:true,deltaY:-100,bubbles:true,cancelable:true}),shift=new WheelEvent('wheel',{shiftKey:true,deltaY:-100,bubbles:true,cancelable:true});document.body.dispatchEvent(ctrl);document.body.dispatchEvent(shift);return {ctrl:ctrl.defaultPrevented,shift:shift.defaultPrevented,scale:JSON.parse(localStorage.getItem('pocket-code-appearance-v1')!).scale};});
 expect(wheel).toEqual({ctrl:true,shift:false,scale:130});
 const before=await page.locator('.whiteboard-world').getAttribute('style');await page.locator('.whiteboard-viewport').dispatchEvent('wheel',{ctrlKey:true,deltaY:-100,clientX:400,clientY:300});await expect(page.locator('.whiteboard-world')).not.toHaveAttribute('style',before!);
});
