import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page,width=390){
 await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{QuestionsHarness}=await import('/tests/fixtures/QuestionsHarness.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(QuestionsHarness));});
 await expect(page.getByRole('button',{name:'Background control'})).toBeVisible();
}
test('Codex questions use stable IDs even when text repeats',async({page})=>{
 await setup(page);
 await page.evaluate(()=>(window as any).askSynthetic([{id:'first',header:'First',question:'Which?',options:[{label:'A',description:'First choice'}]},{id:'second',header:'Second',question:'Which?',options:[{label:'B'}]}],'codex'));
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByText('First choice')).toBeVisible();
 await dialog.locator('fieldset').nth(0).getByRole('radio').check();await dialog.locator('fieldset').nth(1).getByRole('textbox').fill('Another answer');
 await dialog.getByRole('button',{name:'Send answers'}).click();await expect(dialog).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).questionAnswers)).toEqual([{allow:true,answers:{first:'A',second:'Another answer'}}]);
});
test('Claude supports several selections and additional free text',async({page})=>{
 await setup(page,1440);await page.evaluate(()=>(window as any).askSynthetic([{question:'Which checks?',multiSelect:true,options:[{label:'Unit'},{label:'Browser'}]}]));
 await page.getByRole('checkbox',{name:'Unit'}).check();await page.getByRole('checkbox',{name:'Browser'}).check();await page.getByRole('textbox').fill('Also accessibility');
 await page.getByRole('button',{name:'Send answers'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).questionAnswers[0].answers)).toEqual({'Which checks?':'Unit, Browser, Also accessibility'});
});
test('Copilot can constrain input to supplied choices',async({page})=>{
 await setup(page);await page.evaluate(()=>(window as any).askSynthetic([{question:'Pick a format',allowFreeform:false,options:[{label:'JSON'},{label:'Markdown'}]}],'copilot'));
 await expect(page.getByRole('textbox')).toHaveCount(0);await expect(page.getByRole('button',{name:'Send answers'})).toBeDisabled();await page.getByRole('radio',{name:'Markdown'}).check();await page.getByRole('button',{name:'Send answers'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).questionAnswers[0].answers)).toEqual({'Pick a format':'Markdown'});
});
test('Back preserves answers and failed submission can be retried',async({page})=>{
 await setup(page,320);await page.evaluate(()=>(window as any).askSynthetic([{question:'Describe the intended result'}]));
 await page.getByRole('textbox').fill('Keep this answer');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Answer questions'}).click();await expect(page.getByRole('textbox')).toHaveValue('Keep this answer');
 await page.evaluate(()=>{(window as any).failQuestion=true;});await page.getByRole('button',{name:'Send answers'}).click();await expect(page.getByRole('alert')).toContainText('Synthetic network failure');await expect(page.getByRole('textbox')).toHaveValue('Keep this answer');
 expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await page.screenshot({path:'.local/questions-dialog-mobile.png'});
 await page.evaluate(()=>{(window as any).failQuestion=false;});await page.getByRole('button',{name:'Send answers'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).questionAnswers.length)).toBe(1);
});
test('expired requests cannot submit and a new request clears old answers',async({page})=>{
 await setup(page);await page.evaluate(()=>(window as any).askSynthetic([{question:'Short request'}],'claude',200));await expect(page.getByRole('status')).toContainText('expired');await expect(page.getByRole('button',{name:'Send answers'})).toBeDisabled();
 await page.evaluate(()=>(window as any).askSynthetic([{question:'New request'}]));await expect(page.getByRole('textbox')).toHaveValue('');await page.getByRole('button',{name:'Decline',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).questionAnswers)).toEqual([{allow:false}]);
});
