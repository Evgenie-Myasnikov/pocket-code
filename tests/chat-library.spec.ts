import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('permanent erase requires confirmation from the provider and retains the chat on failure',async({page})=>{
 await desktop(page);
 const chat=page.locator('.desktop-sessions button').filter({hasText:'Interface review'});
 await chat.click();await expect(page.getByText('The responsive layout is ready.',{exact:true})).toBeVisible();
 await chat.click({button:'right'});await page.getByRole('menuitem',{name:'Erase chat…'}).click();
 const dialog=page.getByRole('dialog',{name:'Erase chat',exact:true});
 await expect(dialog.getByRole('combobox')).toHaveValue('erase');await expect(dialog.getByRole('button',{name:'Cancel'})).toBeFocused();
 await page.evaluate(()=>{(window as any).testEraseError='Provider transcript is busy';});
 await dialog.getByRole('button',{name:'Erase permanently'}).click();await expect(dialog.getByRole('alert')).toHaveText('Provider transcript is busy');
 await page.evaluate(()=>{(window as any).testEraseError=undefined;(window as any).testUnconfirmedErase=true;});
 await dialog.getByRole('button',{name:'Erase permanently'}).click();await expect(dialog.getByRole('alert')).toContainText('did not confirm');
 await expect(chat).toBeVisible();
 await page.evaluate(()=>{(window as any).testUnconfirmedErase=false;});
 await dialog.getByRole('button',{name:'Erase permanently'}).click();
 await expect(dialog).toHaveCount(0);await expect(chat).toHaveCount(0);await expect(page.getByText('The responsive layout is ready.',{exact:true})).toHaveCount(0);
});

test('all projects are visible until explicitly filtered; desktop has no Back and context actions reopen',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 const rows=page.locator('.desktop-sessions>button');await expect(rows).toHaveCount(2);
 await expect(page.locator('.desktop-project-links')).toHaveCount(0);
 await rows.first().click();await expect(page.locator('.chat-header .mobile-back')).toHaveCount(0);
 await rows.first().click({button:'right'});await expect(page.getByRole('menu',{name:'Chat actions'})).toBeVisible();await page.keyboard.press('Escape');
 await rows.first().click({button:'right'});await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
 await page.getByRole('textbox',{name:'Chat name'}).fill('Synthetic renamed chat');await page.getByRole('button',{name:'Rename',exact:true}).click();
 await expect(rows.first()).toContainText('Synthetic renamed chat');
 await rows.first().click({button:'right'});await page.getByRole('menuitem',{name:'Erase chat…'}).click();await page.getByRole('combobox',{name:'Action'}).selectOption('list');await page.getByRole('button',{name:'Remove from list',exact:true}).click();await expect(rows).toHaveCount(1);
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
 const tableText='| First | Second | Third | Fourth | Fifth |\n| --- | --- | --- | --- | --- |\n| A | B | C | D | E |';
 await page.evaluate(text=>{
   document.getElementById('markdown-test')!.style.width='260px';
   (window as any).renderMarkdown(text);
 },tableText);
 const scroll=markdown.getByRole('group',{name:'Horizontally scrollable table'});
 await scroll.focus();
 const left=await scroll.evaluate(el=>{el.scrollLeft=48;return el.scrollLeft;});
 expect(left).toBeGreaterThan(0);
 await page.evaluate(text=>(window as any).renderMarkdown(text+'\n\nAdditional detail.'),tableText);
 await expect(markdown).toContainText('Additional detail.');
 await expect(scroll).toBeFocused();
 expect(await scroll.evaluate(el=>el.scrollLeft)).toBe(left);
});

test('only an explicitly added composer folder becomes a sidebar project',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.getByRole('button',{name:'New chat',exact:true}).click();
 await page.getByRole('button',{name:'Attach files',exact:true}).click();
 // The menu opens above the composer; the scrolling overlay must not clip it.
 await expect.poll(()=>page.getByLabel('Add project folder').evaluate(select=>{const r=select.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&Boolean(hit&&select.contains(hit));})).toBe(true);
 await page.getByRole('button',{name:'Add project folder'}).click();
 await page.getByRole('dialog',{name:'Add project folder'}).getByRole('button',{name:'C:\\Demo\\Garden',exact:true}).click();
 await expect(page.locator('.desktop-project-links button')).toHaveCount(1);
 await expect(page.locator('.desktop-project-links button')).toHaveText('Garden');
 await expect(page.locator('.desktop-sessions>button')).toHaveCount(2);
 await page.screenshot({path:'.local/chat-library-desktop.png'});
});

test('keyboard and Back keep the composer attachment picker within the draft',async({page})=>{
 await desktop(page);
 await page.getByRole('button',{name:'New chat',exact:true}).click();
 const draft=page.getByRole('textbox',{name:'Message Claude',exact:true});
 const trigger=page.locator('.composer-attach');
 const attach=page.getByRole('group',{name:'Attach files'}).getByRole('button',{name:'Attach files'});
 const folder=page.getByRole('button',{name:'Add project folder'});
 await draft.fill('Synthetic draft');
 await trigger.focus();await page.keyboard.press('Enter');
 await expect(attach).toBeFocused();await page.keyboard.press('Tab');await expect(folder).toBeFocused();
 await page.keyboard.press('Escape');await expect(attach).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.press('Enter');await page.keyboard.press('Shift+Tab');await expect(trigger).toBeFocused();await expect(attach).toHaveCount(0);
 await trigger.press('Enter');await page.keyboard.press('Tab');await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'Markdown tasks',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/^Access mode:/})).toBeFocused();await expect(attach).toHaveCount(0);
 await trigger.focus();
 await page.keyboard.press('Space');await expect(attach).toBeFocused();
 await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));
 await expect(attach).toHaveCount(0);await expect(trigger).toBeFocused();
 await page.keyboard.press('Enter');await folder.click();
 await page.getByRole('dialog',{name:'Add project folder'}).getByRole('button',{name:'C:\\Demo\\Garden',exact:true}).click();
 await expect(attach).toHaveCount(0);await expect(trigger).toBeFocused();await expect(draft).toHaveValue('Synthetic draft');
});
