import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

const signedOut=[{id:'claude',available:false,authenticated:false,models:[]},{id:'codex',available:true,authenticated:true,models:[]}];

test('a chat through a local model or API connection does not ask for the Claude sign-in; a Claude chat still does',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-claude-account','5b7c0d3e-0000-4000-8000-00000000a001');
   (window as any).testTaskTextAccounts=[{id:'5b7c0d3e-0000-4000-8000-00000000a001',name:'Strata · flash-coder-iq1_m'}];
   (window as any).testChatRowsBy={claude:[{sessionId:'alpha',summary:'claude · Interface review',cwd:'C:\Demo\Atlas',lastModified:2,account:'5b7c0d3e-0000-4000-8000-00000000a001'}],codex:[],copilot:[]};
   (window as any).testProviders=[{id:'claude',available:false,authenticated:false,models:[]},{id:'codex',available:true,authenticated:true,models:[]}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 await page.waitForTimeout(1500);
 await expect(page.locator('.network-banner')).toHaveCount(0);
 await expect(page.getByText(/Claude (недоступен|is unavailable)/)).toHaveCount(0);
});

test('without a local model the same signed-out Claude is reported',async({page})=>{
 await page.addInitScript(p=>{(window as any).testProviders=p;},signedOut);
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 await expect(page.locator('.network-banner')).toContainText('Claude is unavailable');
});
