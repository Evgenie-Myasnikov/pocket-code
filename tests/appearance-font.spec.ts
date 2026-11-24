import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

const fontOf=(page:import('@playwright/test').Page,selector:string)=>page.locator(selector).first().evaluate(element=>getComputedStyle(element).fontFamily);

test('Appearance chooses one font for the interface and the chat; VS Code fonts by default, any installed font by name',async({page})=>{
 await desktop(page);
 await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/Segoe UI/);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('.settings-index').getByRole('button',{name:'Appearance & language',exact:true}).click();
 const font=page.getByRole('combobox',{name:'Font'});await expect(font).toHaveValue('vscode');
 // the colour-blind switch is gone, the space between blocks is a setting
 await expect(page.getByText('Colour-blind friendly colours')).toHaveCount(0);await expect(page.getByText('Space between blocks')).toBeVisible();
 await font.selectOption('manrope');await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^Manrope/);
 await font.selectOption('installed');
 const name=page.getByRole('textbox',{name:'Installed font name'});await name.fill('Bahnschrift";color:red');await name.press('Enter');
 // only the family name is kept: quotes and CSS punctuation are dropped
 await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^"?Bahnschriftcolorred"?,/);
 await page.reload();await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^"?Bahnschriftcolorred"?,/);
});
