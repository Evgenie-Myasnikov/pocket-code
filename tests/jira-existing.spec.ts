import {connectByQr} from './qr-connect';
import { test, expect } from '@playwright/test';
test('existing Claude connection reconnects without Android browser login', async ({ page }) => {
  let connected = true;
  await page.route('**/api/jira/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/disconnect')) connected = false;
    else if (pathname.endsWith('/connect-existing')) connected = true;
    else if (!pathname.endsWith('/status')) return route.fulfill({status:400,json:{error:'Unexpected request'}});
    return route.fulfill({json:{connected,source:'claude',sites:connected?[{id:'site',name:'Example Jira',url:'https://example.atlassian.net'}]:[]}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();
  await expect(page.getByText(/Jira uses the existing Atlassian MCP/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Connect',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Disconnect Jira',exact:true}).click();
  await page.getByRole('button',{name:'Use Claude connection',exact:true}).click();
  await expect(page.getByText(/Connected · Example Jira/)).toBeVisible();
});

test('Jira settings use the selected workspace and never silently select Claude',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace','codex');});
 await page.route('**/api/providers',route=>route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]}));
 const reconnects:string[]=[];
 await page.route('**/api/jira/**',route=>{const url=new URL(route.request().url()),provider=url.searchParams.get('provider');if(url.pathname.endsWith('connect-existing'))reconnects.push(route.request().postDataJSON().provider);return route.fulfill({json:{connected:false,source:provider,sites:[]}});});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();
 await expect(page.getByText(/Tools run directly, without a model turn/)).toBeVisible();
 await page.getByRole('button',{name:'Use Codex connection',exact:true}).click();expect(reconnects).toEqual(['codex']);
 await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
 await page.locator('.workspace-picker-sidebar select').selectOption('claude');
 await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use Claude connection',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Use Claude connection',exact:true}).click();expect(reconnects).toEqual(['codex','claude']);
});
