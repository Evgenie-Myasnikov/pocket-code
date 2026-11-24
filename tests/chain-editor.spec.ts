import {expect,test} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';

test('a chain is built from steps and can loop back with a condition and a lap limit',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.addInitScript(()=>{
    const fixture=window as any;
    fixture.testChainRequest=(path:string,input?:any)=>{
      if(input?.tasks){fixture.startedChain=input;fixture.acceptedTask={...input,status:'running',loop:input.loop&&{...input.loop,lap:1},steps:input.tasks.map((step:any)=>({...step,status:'pending'}))};}
      return {value:fixture.acceptedTask??[]};
    };
  });
  await desktop(page);
  await desktopSection(page,'Tasks');
  // Create Task is the only way to make a task: it opens the step-by-step editor.
  await page.getByRole('button',{name:'Create Task',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Chain of steps'});
  const start=form.getByRole('button',{name:'Start chain',exact:true});
  await expect(start).toBeDisabled();
  await form.getByRole('textbox',{name:'Step 1 · instruction'}).fill('Review the glossary and list remarks.');
  await form.getByRole('textbox',{name:'Step 2 · instruction'}).fill('Fix the listed remarks.');
  await expect(start).toBeEnabled();
  await form.getByRole('button',{name:'Add step',exact:true}).click();
  await expect(start).toBeDisabled();
  await form.getByRole('button',{name:'Remove step 3',exact:true}).click();
  await form.getByRole('switch',{name:/Repeat in a loop/}).check();
  await expect(form.getByText('then back to step 1')).toBeVisible();
  await form.getByRole('textbox',{name:'Stop when'}).fill('the review has no remarks');
  await form.getByRole('spinbutton',{name:/Lap limit/}).fill('4');
  await expect(form.getByText(/Also stops when a step fails/)).toBeVisible();
  await page.screenshot({path:'.local/chain-editor.png'});
  await form.getByRole('button',{name:'Start loop',exact:true}).click();
  await expect(form).toBeHidden();
  const sent=await page.evaluate(()=>(window as any).startedChain);
  expect(sent.loop).toEqual({maxLaps:4,until:'the review has no remarks',stopIdle:true});
  expect(sent.tasks.map((task:{title:string;body:string})=>[task.title,task.body])).toEqual([
    ['Review the glossary and list remarks.','Review the glossary and list remarks.'],['Fix the listed remarks.','Fix the listed remarks.']]);
  expect(sent.name).toBe('Review the glossary and list remarks.');
  await expect(page.getByText('Lap 1 of 4 · until: the review has no remarks')).toBeVisible();
  await page.screenshot({path:'.local/chain-loop-panel.png'});
});
