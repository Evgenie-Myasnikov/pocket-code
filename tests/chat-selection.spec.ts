import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('words of the transcript can be selected and copied, and a selection offers Copy and Quote',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 const answer=page.locator('.conversation-inner .markdown p').first();
 await expect(answer).toContainText('The responsive layout is ready.');
 expect(await answer.evaluate(element=>getComputedStyle(element).userSelect)).toBe('text');
 // buttons and the action row are not text to select
 expect(await page.locator('.conversation-inner button').first().evaluate(element=>getComputedStyle(element).userSelect)).toBe('none');
 await answer.click({clickCount:3});
 expect(await page.evaluate(()=>getSelection()?.toString().trim())).toContain('The responsive layout is ready.');
 const toolbar=page.getByRole('toolbar',{name:'Selected text'});
 await expect(toolbar).toBeVisible();
 await toolbar.getByRole('button',{name:'Copy'}).click();
 await expect(toolbar).toContainText('Copied');
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('The responsive layout is ready.');
 // the selection stays after Copy; Ctrl+C copies it too
 await page.evaluate(()=>navigator.clipboard.writeText('x'));await page.keyboard.press('Control+c');
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('The responsive layout is ready.');
 await toolbar.getByRole('button',{name:'Quote'}).click();
 await expect(page.locator('.composer textarea')).toHaveValue(/^> The responsive layout is ready\./);
 await expect(toolbar).toHaveCount(0);
});
