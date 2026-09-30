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
  await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');
  await page.getByLabel('Connection key').fill('test-only-'.repeat(5));
  await page.getByRole('button',{name:'Connect computer',exact:true}).click();
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();
  await expect(page.getByText(/Jira uses the existing Atlassian MCP/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Connect',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Disconnect Jira',exact:true}).click();
  await page.getByRole('button',{name:'Use Claude connection',exact:true}).click();
  await expect(page.getByText(/Connected · Example Jira/)).toBeVisible();
});
