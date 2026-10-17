import {test,expect} from '@playwright/test';
for(const width of [320,1280])test(`compact attachments, focus and edge treatment at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});
 const imageData=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=100;const context=canvas.getContext('2d')!;context.fillStyle='#7b91bd';context.fillRect(0,0,160,100);return canvas.toDataURL('image/png').split(',')[1];});
 await page.route('**/api/message-attachment?**',route=>{
  const image=new URL(route.request().url()).searchParams.get('path')?.endsWith('.png');
  return route.fulfill({json:image?{name:'diagram.png',mimeType:'image/png',data:imageData}:{name:'notes.md',mimeType:'text/markdown',text:'# Notes\n\nSynthetic attachment'}});
 });
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {CompactChatHarness}=await import('/tests/fixtures/CompactChatHarness.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(CompactChatHarness));
 });
 await expect(page.locator('.message.user .markdown')).toHaveText('Please review the diagram.');
 await expect(page.locator('.message-attachments button')).toHaveCount(2);
 await expect(page.locator('.message-attachment-image img')).toBeVisible();
 await page.getByRole('button',{name:'Open diagram.png'}).click();await expect(page.getByRole('dialog',{name:'Image',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.image-viewer-stage')).toHaveAttribute('data-zoom','1.50');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Open diagram.png'})).toBeFocused();
 await page.getByRole('button',{name:'Open notes.md'}).click();await expect(page.getByRole('heading',{name:'Notes',exact:true})).toBeVisible();await page.keyboard.press('Escape');
 expect(await page.locator('.conversation').evaluate(el=>getComputedStyle(el).maskImage)).toContain('linear-gradient');
 if(width===320)expect(await page.locator('.mobile-back').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`.local/compact-chat-${width}.png`});
});
test('usage details clear failed refreshes and do not present expired quotas as current',async({page})=>{
 let mode='valid';
 await page.route('**/api/claude/usage',route=>mode==='failed'?route.fulfill({status:503,json:{error:'Synthetic unavailable'}}):route.fulfill({json:{checkedAt:Date.now(),ordinaryUsageAllowed:null,buckets:[{id:'claude',name:'Claude',windows:[{id:'primary',usedPercent:30,remainingPercent:70,windowDurationMins:300,resetsAt:Math.floor(Date.now()/1000)+(mode==='expired'?-1:3600)}]}]}}));
 await page.goto('http://127.0.0.1:5173');await page.locator('.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {CodexUsage}=await import('/src/CodexUsage.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(CodexUsage,{connection:{url:'http://127.0.0.1:4319',token:'synthetic'},provider:'claude'}));
 });
 await expect(page.locator('.codex-usage progress')).toHaveAttribute('value','70');
 mode='expired';await page.getByRole('button',{name:'Refresh limits'}).click();await expect(page.locator('.codex-usage progress')).toHaveCount(0);await expect(page.locator('.codex-usage-window')).toContainText('No data');
 mode='failed';await page.getByRole('button',{name:'Refresh limits'}).click();await expect(page.locator('.codex-usage-bucket')).toHaveCount(0);await expect(page.locator('.codex-usage [role="status"]')).toBeVisible();
});
