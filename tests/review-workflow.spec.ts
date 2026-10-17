import {openChatList} from './chat-navigation';
import {connectByQr} from './qr-connect';
import {test,expect,type Page} from '@playwright/test';

// Synthetic repository: one modified, one new (untracked), one deleted, one binary and one generated file.
const root='C:\\Workspace\\garden-app';
const long='const summary = '+'"synthetic value" + '.repeat(8)+'"end";';
type File={path:string;added:number;removed:number;binary?:boolean;untracked?:boolean;status?:string;generated?:boolean;fingerprint?:string};
const patches:Record<string,string>={
  'src/plants.ts':'@@ -1,4 +1,4 @@ export function water\n context line\n-const total = formatDate(value);\n+const total = formatRelativeDate(value, now);\n-'+long.replace('end','old')+'\n+'+long+'\n',
  'src/Component.tsx':'@@ -0,0 +1,3 @@\n+export function Component() {\n+  return null;\n+}',
  'src/legacy.ts':'@@ -1,2 +0,0 @@\n-old one\n-old two',
};
type State={messages:unknown[];files:File[];calls:URL[];fingerprint:string;availability:{available:boolean;mode:string;added?:number;removed?:number;files?:number}};
async function host(page:Page,files?:File[]){
  const state:State={messages:[],calls:[],fingerprint:'aaaaaaaaaaaaaaaa',availability:{available:true,mode:'working',added:42,removed:7,files:5},files:files||[
    {path:'src/plants.ts',added:2,removed:2,status:'modified',fingerprint:'p1'},
    {path:'src/Component.tsx',added:3,removed:0,untracked:true,status:'untracked',fingerprint:'c1'},
    {path:'src/legacy.ts',added:0,removed:2,status:'deleted',fingerprint:'l1'},
    {path:'assets/logo.png',added:0,removed:0,binary:true,status:'modified',fingerprint:'b1'},
    {path:'package-lock.json',added:120,removed:80,status:'modified',generated:true,fingerprint:'g1'},
  ]};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');state.calls.push(url);
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic review PC',roots:[root],protocol:1,version:'0.26.9'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'review-chat',provider:'claude',summary:'Garden review',cwd:root,lastModified:Date.now()}]});
    if(endpoint.includes('/messages'))return route.fulfill({json:{messages:state.messages,previous:null,next:null}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/review/availability')return route.fulfill({json:state.availability});
    if(endpoint==='/review'){
      const file=url.searchParams.get('file'),item=state.files.find(entry=>entry.path===file);
      return route.fulfill({json:{repositoryRoot:root,projectPath:root,scope:'.',current:'feature/beds',base:'main',branches:file?[]:['main','feature/beds'],files:state.files,fingerprint:state.fingerprint,binary:!!item?.binary,patch:file?patches[file]||'':''}});
    }
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
  return state;
}
const panel=(page:Page)=>page.getByRole('dialog',{name:'Review',exact:true});
async function open(page:Page,init?:()=>void){
  if(init)await page.addInitScript(init);
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:/Garden review/}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect(panel(page).locator('.review-file')).not.toHaveCount(0);
}
const file=(page:Page,path:string)=>panel(page).locator(`.review-file[data-path="${path}"]`);

test('phone: Auto shows one column, Split is unavailable and long lines wrap without sideways scrolling',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page,()=>localStorage.setItem('pocket-code-diff-layout','split'));
  const review=panel(page);
  await expect(review.getByRole('button',{name:'Split',exact:true})).toBeDisabled();
  await expect(review.getByRole('button',{name:'Split',exact:true})).toHaveAttribute('title','Split needs a wider screen');
  await expect(file(page,'src/plants.ts').locator('.diff-table')).toHaveClass(/unified/);
  await expect(file(page,'src/plants.ts').locator('.diff-table')).toHaveClass(/wrap/);
  const patch=file(page,'src/plants.ts').locator('.review-file-patch');
  expect(await patch.evaluate(element=>element.scrollWidth-element.clientWidth)).toBeLessThanOrEqual(1);
  const tall=await file(page,'src/plants.ts').locator('tr.diff-line',{hasText:'synthetic value'}).first().evaluate(element=>element.getBoundingClientRect().height);
  expect(tall).toBeGreaterThan(40);
  // Compact gutter: code starts within about 70 px of the table edge on a phone.
  const start=await file(page,'src/plants.ts').locator('td.code').first().evaluate(element=>element.getBoundingClientRect().left-element.closest('table')!.getBoundingClientRect().left);
  expect(start).toBeLessThan(70);
  await page.screenshot({path:'artifacts/screenshots/review-phone-wrap.png'});
});

test('desktop: Split keeps two equal halves for a long line and the divider aligns across files',async({page})=>{
  await host(page);await page.setViewportSize({width:1600,height:1000});await open(page);
  const review=panel(page);
  await expect(review.getByRole('button',{name:'Auto',exact:true})).toHaveAttribute('aria-pressed','true');
  const table=file(page,'src/plants.ts').locator('.diff-table');await expect(table).toHaveClass(/split/);
  const box=await review.boundingBox();
  const halves=await table.evaluate(element=>{const cells=element.querySelector('tr.diff-line:not(.hunk)')!.children;return {left:cells[2].getBoundingClientRect().width,right:cells[5].getBoundingClientRect().width,end:cells[5].getBoundingClientRect().right,divider:cells[3].getBoundingClientRect().left};});
  expect(Math.abs(halves.left-halves.right)).toBeLessThan(2);
  expect(halves.end).toBeLessThanOrEqual(box!.x+box!.width+1);
  await expect(review.locator('.review-tree')).toBeVisible();
  // Changed words are marked inside the replaced line.
  await expect(file(page,'src/plants.ts').locator('mark.diff-word-del')).toHaveText(['formatDate','old']);
  await expect(file(page,'src/plants.ts').locator('mark.diff-word-add').first()).toHaveText('formatRelativeDate');
  // The hunk header is readable and shows the enclosing function.
  await expect(file(page,'src/plants.ts').locator('tr.hunk')).toContainText('Lines 1–4');
  await expect(file(page,'src/plants.ts').locator('tr.hunk .hunk-context')).toHaveText('export function water');
  await expect(file(page,'src/Component.tsx').locator('tr.hunk')).toHaveCount(0);
  await page.screenshot({path:'artifacts/screenshots/review-desktop-split.png'});
});

test('file status, truthful counters and generated files collapsed without loading',async({page})=>{
  const state=await host(page);await page.setViewportSize({width:390,height:844});await open(page);
  await expect(file(page,'src/Component.tsx').locator('.review-file-status')).toHaveText('Not in Git');
  await expect(file(page,'src/Component.tsx').locator('.review-stats')).toContainText('+3');
  await expect(file(page,'src/legacy.ts').locator('.review-file-status')).toHaveText('Deleted');
  await expect(file(page,'assets/logo.png').locator('.review-stats')).toHaveText('—');
  const generated=file(page,'package-lock.json');
  await expect(generated.locator('.review-file-status')).toHaveText('Generated');
  await expect(generated.locator('.review-file-toggle')).toHaveAttribute('aria-expanded','false');
  await generated.scrollIntoViewIfNeeded();await page.waitForTimeout(300);
  expect(state.calls.some(url=>url.searchParams.get('file')==='package-lock.json')).toBe(false);
});

test('viewed marks collapse files, survive reopening and clear when the agent edits the file again',async({page})=>{
  const state=await host(page);await page.setViewportSize({width:390,height:844});await open(page);
  const review=panel(page),plants=file(page,'src/plants.ts');
  await expect(review.locator('.review-files-button')).toContainText('Viewed 0/5');
  await plants.getByRole('checkbox',{name:'Viewed'}).check();
  await expect(plants.locator('.review-file-toggle')).toHaveAttribute('aria-expanded','false');
  await expect(review.locator('.review-files-button')).toContainText('Viewed 1/5');
  await review.getByRole('button',{name:'Back to chat',exact:true}).click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect(file(page,'src/plants.ts').getByRole('checkbox',{name:'Viewed'})).toBeChecked();
  state.files=state.files.map(item=>item.path==='src/plants.ts'?{...item,fingerprint:'p2'}:item);state.fingerprint='bbbbbbbbbbbbbbbb';
  await panel(page).getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(file(page,'src/plants.ts').locator('.review-file-changed')).toHaveText('Changed since viewed');
  await expect(file(page,'src/plants.ts').getByRole('checkbox',{name:'Viewed'})).not.toBeChecked();
});

test('file list sheet jumps to a file and Next marks the current file viewed',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page);
  const review=panel(page);
  await review.locator('.review-files-button').click();
  const sheet=page.getByRole('dialog',{name:'Changed files',exact:true});await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Collapse all',exact:true})).toBeVisible();
  await sheet.getByRole('button',{name:/legacy\.ts/}).click();await expect(sheet).toHaveCount(0);
  await expect(file(page,'src/legacy.ts').locator('.review-file-toggle')).toBeFocused();
  await review.locator('.diff-content').evaluate(element=>{element.scrollTop=0;});
  await review.getByRole('button',{name:/^Next/}).click();
  await expect(file(page,'src/plants.ts').getByRole('checkbox',{name:'Viewed'})).toBeChecked();
});

test('a line number quotes the line into the chat draft while Review stays open',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page);
  const plants=file(page,'src/plants.ts');
  await plants.locator('td.num[data-side="new"][data-line="2"]').click();
  const bar=panel(page).getByRole('region',{name:'Selected lines'});await expect(bar).toContainText('plants.ts:L2');
  await bar.getByRole('button',{name:'Ask the agent'}).click();
  await expect(panel(page).getByRole('status').filter({hasText:'Added to the message'})).toBeVisible();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole('button',{name:'Back to chat',exact:true}).click();
  await expect(page.getByLabel('Message Claude')).toHaveValue(/src\/plants\.ts:L2\n```\nconst total = formatRelativeDate\(value, now\);\n```/);
});

test('idle polling keeps patches, the summary counts filtered files and the header shows the change size',async({page})=>{
  await page.clock.install();
  const state=await host(page);await page.setViewportSize({width:1280,height:800});await open(page);
  await expect(page.getByRole('button',{name:'Review',exact:true}).locator('.review-button-stats')).toHaveCount(1);
  const review=panel(page);await expect(file(page,'src/plants.ts')).toContainText('formatRelativeDate');
  const reads=()=>state.calls.filter(url=>url.pathname==='/api/review'&&url.searchParams.get('file')==='src/plants.ts').length;
  const before=reads(),lists=state.calls.filter(url=>url.pathname==='/api/review'&&!url.searchParams.get('file')).length;
  await page.clock.fastForward(6000);
  await expect.poll(()=>state.calls.filter(url=>url.pathname==='/api/review'&&!url.searchParams.get('file')).length).toBeGreaterThan(lists);
  expect(reads()).toBe(before);
  await review.getByRole('button',{name:'Review options',exact:true}).click();
  await review.getByLabel('.ts',{exact:true}).uncheck();await page.keyboard.press('Escape');
  await expect(review.locator('.review-files-button')).toContainText('3 of 5 files');
  await expect(review.locator('.review-filter-note')).toContainText('Hidden types: 1');
  await review.getByRole('button',{name:'Show all types',exact:true}).click();
  await expect(review.locator('.review-files-button')).toContainText('5 files');
});

test('empty comparison explains itself and offers the branch comparison',async({page})=>{
  const state=await host(page,[]);await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:/Garden review/}).click();await page.getByRole('button',{name:'Review',exact:true}).click();
  const review=panel(page);await expect(review).toContainText('No uncommitted changes in garden-app');
  await review.getByRole('button',{name:'Compare with the main branch'}).click();
  await expect.poll(()=>state.calls.some(url=>url.pathname==='/api/review'&&url.searchParams.get('mode')==='branch')).toBe(true);
});

test('the turn chip opens Review on the files of that turn, with all changes one tap away',async({page})=>{
  const state=await host(page);await page.setViewportSize({width:390,height:844});
  state.messages=[{id:'ask',role:'user',blocks:[{type:'text',text:'Water the plants'}]},{id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'e1',name:'Edit',input:{file_path:'C:/Workspace/garden-app/src/plants.ts',old_string:'a',new_string:'b'}}]},{id:'done',role:'assistant',blocks:[{type:'text',text:'Done.'}]}];
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:/Garden review/}).click();
  await page.locator('button.turn-changes').click();
  const review=panel(page);await expect(review.locator('.review-file')).toHaveCount(1);
  await expect(review.locator('.review-filter-note')).toContainText('Only files from this turn');
  await review.locator('.review-filter-note').getByRole('button',{name:'Show all',exact:true}).click();
  await expect(review.locator('.review-file')).toHaveCount(5);
  await file(page,'src/plants.ts').getByRole('button',{name:'20 more context lines'}).click();
  await expect.poll(()=>state.calls.some(url=>url.searchParams.get('file')==='src/plants.ts'&&url.searchParams.get('context')==='23')).toBe(true);
});

test('a turn whose files no longer differ says so and offers all changes',async({page})=>{
  const state=await host(page);await page.setViewportSize({width:390,height:844});
  state.messages=[{id:'ask',role:'user',blocks:[{type:'text',text:'Tidy up'}]},{id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'e1',name:'Edit',input:{file_path:'C:/Workspace/garden-app/src/committed.ts',old_string:'a',new_string:'b'}}]},{id:'done',role:'assistant',blocks:[{type:'text',text:'Done.'}]}];
  await page.goto('http://127.0.0.1:5173');await openChatList(page);
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));await openChatList(page);
  await page.getByRole('button',{name:/Garden review/}).click();await page.locator('button.turn-changes').click();
  const review=panel(page);await expect(review.locator('.review-empty')).toContainText('The files of this turn no longer differ in this comparison.');
  await review.locator('.review-empty').getByRole('button',{name:'Show all',exact:true}).click();
  await expect(review.locator('.review-file')).toHaveCount(5);
});

test('Viewed checkboxes are 48 px targets and Review keys do nothing while Review is hidden',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});await open(page);
  const review=panel(page),plants=file(page,'src/plants.ts');
  const box=await plants.locator('label.review-viewed').boundingBox();expect(box!.width).toBeGreaterThanOrEqual(48);expect(box!.height).toBeGreaterThanOrEqual(48);
  await review.locator('.review-files-button').click();
  const row=await page.getByRole('dialog',{name:'Changed files',exact:true}).locator('label.review-nav-viewed').first().boundingBox();expect(row!.width).toBeGreaterThanOrEqual(48);expect(row!.height).toBeGreaterThanOrEqual(48);
  await page.keyboard.press('Escape');await review.locator('.diff-content').focus();
  // A Windows chat keeps Review mounted while the Board or Settings page is shown.
  const shell=page.locator('aside.review-panel');await shell.evaluate(element=>{element.style.display='none';});await page.keyboard.press('v');
  await shell.evaluate(element=>{element.style.display='';});
  await expect(review.locator('.review-file.viewed')).toHaveCount(0);
  await page.keyboard.press('v');await expect(plants.getByRole('checkbox',{name:'Viewed'})).toBeChecked();
});
