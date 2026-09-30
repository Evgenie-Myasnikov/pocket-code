import { test, expect } from '@playwright/test';

test('matching tool call and result use one disclosure without hiding errors or unrelated results', async ({page}) => {
  const session='synthetic-tools';
  await page.route('**/api/sessions?*',route=>route.fulfill({json:[{sessionId:session,summary:'Tool activity',cwd:'C:\\Test',lastModified:1}]}));
  await page.route(`**/api/sessions/${session}/messages?*`,route=>route.fulfill({json:{messages:[{id:'activity',role:'assistant',blocks:[
    {type:'tool_use',id:'command',name:'Command',input:{command:'synthetic check'}},
    {type:'tool_result',tool_use_id:'command',is_error:true,content:[{type:'text',text:'Synthetic command failed'}]},
    {type:'tool_result',tool_use_id:'other',content:'Unrelated output stays visible'},
    {type:'codexItem',content:{type:'futureActivity',text:'Preserved extra activity'}},
  ]}],previous:null,next:null}}));
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');
  await page.getByLabel('Connection key').fill('test-only-'.repeat(5));
  await page.getByRole('button',{name:'Connect computer',exact:true}).click();
  await page.getByRole('button',{name:/Tool activity/}).click();
  const paired=page.locator('.tool-card.combined');
  await expect(paired).toHaveCount(1);await expect(paired).toHaveClass(/failed/);
  await expect(paired.locator('summary')).toContainText('Tool error');
  await paired.locator('summary').click();
  await expect(paired).toContainText('synthetic check');await expect(paired).toContainText('Synthetic command failed');
  await expect(page.locator('.tool-card.result')).toHaveCount(1);
  await page.locator('.tool-card.result summary').click();
  await expect(page.getByText('Unrelated output stays visible')).toBeVisible();
  await page.getByText('Activity details',{exact:true}).click();
  await expect(page.getByText(/Preserved extra activity/)).toBeVisible();
});
