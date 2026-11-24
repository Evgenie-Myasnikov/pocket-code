import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('Tasks chooses the provider and model with the chat header menu, and an empty chat list shows no caption',async({page})=>{
 await page.addInitScript(()=>{(window as any).testChatRowsBy={claude:[],codex:[],copilot:[]};});
 await desktop(page,{online:true}).catch(()=>{});
 await expect(page.getByRole('button',{name:'Tasks',exact:true})).toBeVisible();await page.waitForTimeout(800);
 await expect(page.getByText('No chats yet')).toHaveCount(0);
 await page.getByRole('button',{name:'Tasks',exact:true}).click();
 const chip=page.locator('.tasks-scope .header-model-chip');await expect(chip).toContainText('Claude');
 await expect(page.locator('.tasks-scope .provider-picker-trigger')).toHaveCount(0);
 await chip.click();const menu=page.getByRole('menu',{name:'Provider and model'});
 await expect(menu.getByText('Providers',{exact:true})).toBeVisible();
 await menu.getByRole('menuitemradio',{name:'Codex'}).click();
 await expect(page.locator('.tasks-scope .header-model-chip')).toContainText('Codex');
});
