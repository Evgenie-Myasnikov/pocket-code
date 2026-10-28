import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('all projects are visible until explicitly filtered; desktop has no Back and context actions reopen',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const rows=page.locator('.desktop-sessions>button');await expect(rows).toHaveCount(2);
 await expect(page.locator('.desktop-project-links')).toHaveCount(0);
 await rows.first().click();await expect(page.locator('.chat-header .mobile-back')).toHaveCount(0);
 await rows.first().click({button:'right'});await expect(page.getByRole('menu',{name:'Chat actions'})).toBeVisible();await page.keyboard.press('Escape');
 await rows.first().click({button:'right'});await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await page.getByRole('textbox',{name:'Chat name'}).fill('Synthetic renamed chat');await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await expect(rows.first()).toContainText('Synthetic renamed chat');
 await rows.first().click({button:'right'});await page.getByRole('menuitem',{name:'Delete from Pocket Code'}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(rows).toHaveCount(1);
});

test('a running title pulses without a Running label and retains height when another chat opens',async({page})=>{
 await page.addInitScript(()=>{(window as any).testRuns=[{id:'run-one',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',startedAt:100,messages:[],approvals:[],revision:1}];});
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const row=page.locator('.desktop-sessions>button[data-running=true]');await expect(row).toHaveCount(1);
 await expect(row.locator('.desktop-run-label')).toHaveCount(0);await expect(row.locator('[data-status=running]')).toHaveCount(0);
 await row.click();const height=(await row.boundingBox())!.height;
 await page.locator('.desktop-sessions>button').last().click();expect((await row.boundingBox())!.height).toBe(height);
 await expect(row.locator('strong')).toHaveCSS('animation-name','chat-title-breathe');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(row.locator('strong')).toHaveCSS('animation-name','none');
});

test('streaming Markdown completes emphasis and keeps code, links and images safe',async({page})=>{
 await desktop(page);
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default;
  const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {Markdown}=await import('/src/RichBlocks.tsx' as string);
  const node=document.createElement('section');node.id='markdown-test';document.body.append(node);
  const root=createRoot(node);
  (window as any).renderMarkdown=(text:string)=>root.render(React.createElement(Markdown,{text,streaming:true}));
  (window as any).renderMarkdown('**Unfinished emphasis');
 });
 const markdown=page.locator('#markdown-test');await expect(markdown.locator('strong')).toHaveText('Unfinished emphasis');
 await page.evaluate(()=>(window as any).renderMarkdown('**Finished emphasis**\n\n```ts\nconst answer = 42;\n```\n\n[Unsafe](javascript:alert(1))\n\n![Remote](https://example.invalid/image.png)\n\n<script>window.bad=true</script>'));
 await expect(markdown.locator('pre')).toHaveText('const answer = 42;\n');
 await expect(markdown.locator('a[href^="javascript:"]')).toHaveCount(0);
 await expect(markdown.locator('img,script')).toHaveCount(0);
 await expect(markdown.getByRole('button',{name:/Load external image/})).toBeVisible();
 await expect(markdown.locator('pre .stream-glyph')).toHaveCount(0);
});

test('only an explicitly added composer folder becomes a sidebar project',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.getByRole('button',{name:'New chat',exact:true}).click();
 await page.getByRole('button',{name:'Attach files',exact:true}).click();
 await page.getByLabel('Add project folder').selectOption('C:\\Demo\\Garden');
 await expect(page.locator('.desktop-project-links button')).toHaveCount(1);
 await expect(page.locator('.desktop-project-links button')).toHaveText('Garden');
 await expect(page.locator('.desktop-sessions>button')).toHaveCount(2);
 await page.screenshot({path:'.local/chat-library-desktop.png'});
});
