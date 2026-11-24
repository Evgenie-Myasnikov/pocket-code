import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

const fontOf=(page:import('@playwright/test').Page,selector:string)=>page.locator(selector).first().evaluate(element=>getComputedStyle(element).fontFamily);

test('Appearance chooses one font for the interface and the chat; VS Code fonts by default, any installed font by name',async({page})=>{
 await page.setViewportSize({width:1280,height:1200});await desktop(page);
 await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/Segoe UI/);
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('.settings-index').getByRole('button',{name:'Appearance & language',exact:true}).click();
 const font=page.getByRole('combobox',{name:'Font'});await expect(font).toHaveValue('vscode');
 // the smoothing window of arriving text is a setting: 0.5 s by default, and it is kept on the document
 await expect(page.getByRole('radio',{name:'0.5 s'})).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-text-delay','500');
 await page.getByRole('radio',{name:'At once'}).check({force:true});await expect(page.locator('html')).toHaveAttribute('data-text-delay','0');
 await page.getByRole('radio',{name:'1 s'}).check({force:true});await expect(page.locator('html')).toHaveAttribute('data-text-delay','1000');
 await page.getByRole('radio',{name:'0.5 s'}).check({force:true});
 // the colour-blind switch is gone, the space between blocks is a setting
 await expect(page.getByText('Colour-blind friendly colours')).toHaveCount(0);await expect(page.getByText('Space between blocks')).toBeVisible();
 await font.selectOption('manrope');await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^Manrope/);
 await font.selectOption('installed');
 const name=page.getByRole('textbox',{name:'Installed font name'});await name.fill('Bahnschrift";color:red');await name.press('Enter');
 // only the family name is kept: quotes and CSS punctuation are dropped
 await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^"?Bahnschriftcolorred"?,/);
 await page.reload();await expect.poll(()=>fontOf(page,'.desktop-rail')).toMatch(/^"?Bahnschriftcolorred"?,/);
});
