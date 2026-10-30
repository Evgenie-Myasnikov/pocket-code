import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
test('chat text does not select while draft editing and explicit copy remain available',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as any).copied=text;}}}));
 await desktop(page);await page.locator('.desktop-sessions button').first().click();const message=page.locator('[data-message-id="answer"]'),paragraph=message.locator('.markdown p').first();
 await paragraph.dblclick();expect(await page.evaluate(()=>window.getSelection()?.toString())).toBe('');
 const input=page.getByLabel('Message Claude',{exact:true});await input.fill('Editable draft');await input.selectText();expect(await input.evaluate((el:HTMLTextAreaElement)=>el.selectionEnd-el.selectionStart)).toBe(14);
 await message.hover();await message.locator('.message-actions').getByRole('button',{name:'Copy',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).copied)).toContain('Interface review');
});
