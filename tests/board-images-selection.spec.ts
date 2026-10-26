import {openSection} from './chat-navigation';
import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';
const one='11111111-1111-4111-8111-111111111111',two='33333333-3333-4333-8333-333333333333';
async function openBoard(page:Page,images=true,root='C:\\Demo\\Atlas'){
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.evaluate(({one,two,images,root})=>{
  const w=window as any;w.uniqueUploads=true;
  const image=(digit:string,caption:string)=>({path:'project-boards/assets/'+digit.repeat(64)+'.png',caption});
  const notes=[{id:one,title:'First synthetic card',description:'First criteria',images:images?[image('a','First concept')]:[]},{id:two,title:'Second synthetic card',description:'Second criteria',images:images?[image('a','First concept'),image('b','Second concept')]:[]}].map((n,i)=>({...n,branch:'',status:'idea',priority:'normal',x:i*330,y:0,dependencies:[]}));
  w.projectBoardOverride={id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root,repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',versions:[],branches:[],notes,canvas:{version:1,items:notes.map(n=>({id:n.id,kind:'card',text:n.title,description:n.description,color:'sand',x:n.x,y:n.y,width:280,height:280})),links:[]}};
 },{one,two,images,root});
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:new RegExp('^'+root.split(/[\\/]/).pop()+'$')})}).click();await expect(page.locator('.whiteboard-item')).toHaveCount(2);
}
const calls=(page:Page)=>page.evaluate(()=>(window as any).desktopCalls.filter((m:any)=>m.action==='write'&&(m.endpoint==='/jobs'||/^\/jobs\/[^/]+\/messages$/.test(m.endpoint))));

test('gallery shows only unique board images, previews originals, drops into chat and returns to the preserved canvas',async({page})=>{
 await openBoard(page);
 await page.locator('.whiteboard-viewport').dispatchEvent('wheel',{deltaX:20,deltaY:20});const transform=await page.locator('.whiteboard-world').evaluate(el=>getComputedStyle(el).transform);
 await page.getByRole('button',{name:'Board images',exact:true}).click();await expect(page.locator('.desktop-chat-host')).toBeVisible();const gallery=page.locator('.board-gallery');await expect(gallery.locator('.board-image-thumb img')).toHaveCount(2);await expect(page.locator('.board-canvas-stage')).toBeHidden();
 expect(await page.locator('.board-gallery-toggle').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.board-discuss')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 await gallery.getByRole('button',{name:'Open image: First concept',exact:true}).click();await expect(page.locator('.image-viewer img')).toBeVisible();await expect.poll(()=>page.locator('.image-viewer img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBe(480);await page.locator('.image-viewer').getByRole('button',{name:'Close',exact:true}).click();
 await gallery.getByRole('button',{name:'Open image: First concept',exact:true}).dragTo(page.getByLabel('Message Claude',{exact:true}));await expect(page.locator('.draft-attachment-image img')).toHaveAttribute('alt','First concept.png');expect((await calls(page)).length).toBe(0);
 await expect.poll(()=>page.locator('.draft-attachment-image img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBe(480);
 await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(page.locator('.board-gallery')).toHaveCount(0);expect(await page.locator('.whiteboard-world').evaluate(el=>getComputedStyle(el).transform)).toBe(transform);
 await page.getByRole('button',{name:'Board images',exact:true}).click();await page.getByLabel('Message Claude',{exact:true}).fill('Keep this draft');await page.evaluate(()=>{(window as any).boardImageMimeType='application/pdf';});await gallery.getByRole('button',{name:'Attach to chat: Second concept',exact:true}).click();await expect(page.locator('.draft-attachment[data-status="failed"]')).toHaveCount(1);await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('Keep this draft');await page.evaluate(()=>{(window as any).boardImageMimeType='image/png';});await page.locator('.draft-attachment[data-status="failed"]').getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.draft-attachment-image')).toHaveCount(2);expect((await calls(page)).length).toBe(0);
 await page.screenshot({path:'.local/board-gallery-chat.png'});
});

test('each message attaches current selection, changed selection replaces it and clearing removes it',async({page})=>{
 await openBoard(page,false);await page.locator(`[data-canvas-id="${one}"] .whiteboard-text`).click();await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.locator('.composer-board-selection')).toContainText('Board selection · 1');
 const send=async(text:string,count:number)=>{await page.getByLabel('Message Claude',{exact:true}).fill(text);await page.locator('.send-button').click();await expect.poll(async()=>(await calls(page)).length).toBe(count);};
 await send('Discuss the first card',1);
 await page.locator(`[data-canvas-id="${two}"] .whiteboard-text`).click();await expect(page.locator('.composer-board-selection')).toHaveAttribute('title','Second synthetic card');await send('Discuss the second card',2);await send('Continue with the same selection',3);
 const records=await page.evaluate(()=>(window as any).desktopCalls.filter((m:any)=>m.endpoint==='/uploads'&&m.data.name==='Board selection.txt').map((m:any)=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m.data.base64),c=>c.charCodeAt(0))).split('\n\n').slice(1).join('\n\n')).selectedIds));
 // Context files begin with product guidance, followed by the bounded JSON snapshot.
 expect(records).toEqual([[one],[two]]);
 const viewport=page.locator('.whiteboard-viewport');const r=(await viewport.boundingBox())!;await page.mouse.click(r.x+20,r.y+r.height-20);await expect(page.locator('.composer-board-selection')).toHaveCount(0);await send('No selected context this time',4);const messages=await calls(page);expect(messages[1].data.attachments).toHaveLength(1);expect(messages[2].data.attachments).toEqual(messages[1].data.attachments);expect(messages[3].data.attachments).toEqual([]);
});

test('area selection is a single context attachment and an empty gallery has a return action',async({page})=>{
 await openBoard(page,false);const viewport=page.locator('.whiteboard-viewport');const r=(await viewport.boundingBox())!;await page.mouse.move(r.x+5,r.y+5);await page.mouse.down();await page.mouse.move(r.x+650,r.y+335,{steps:8});await page.mouse.up();await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.locator('.composer-board-selection')).toContainText('Board selection · 2');await page.getByRole('button',{name:'Board images',exact:true}).click();await expect(page.locator('.board-gallery')).toContainText('No images on this board yet.');await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(viewport).toBeVisible();await expect(page.locator('.composer-board-selection')).toContainText('Board selection · 2');await page.getByRole('button',{name:'Back to boards',exact:true}).click();await expect(page.locator('.composer-board-selection')).toHaveCount(0);
});

test('selection preview reveals its source from canvas or gallery without changing selection, draft or board data',async({page})=>{
 await openBoard(page);
 const first=page.locator(`[data-canvas-id="${one}"]`),second=page.locator(`[data-canvas-id="${two}"]`),viewport=page.locator('.whiteboard-viewport');
 await first.locator('.whiteboard-text').click();await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();
 const input=page.getByRole('textbox',{name:'Message Claude',exact:true}),chip=page.locator('.composer-board-selection');
 await input.fill('Keep the selected context and this draft');await expect(chip).toContainText('Board selection · 1');
 const selectedIds=()=>page.locator('.whiteboard-item.wb-selected').evaluateAll(items=>items.map(item=>item.getAttribute('data-canvas-id')));
 const original=await page.evaluate(()=>JSON.stringify((window as any).projectBoardOverride));expect(await selectedIds()).toEqual([one]);
 for(const gallery of [false,true]){
  await viewport.dispatchEvent('wheel',{deltaX:1500,deltaY:1000});
  await expect.poll(()=>first.evaluate(el=>el.getBoundingClientRect().right)).toBeLessThan(0);
  if(gallery){await page.getByRole('button',{name:'Board images',exact:true}).click();await expect(page.locator('.board-gallery')).toBeVisible();await expect(page.locator('.board-canvas-stage')).toBeHidden();}
  await chip.click();const preview=page.getByRole('dialog',{name:'Message context',exact:true});
  await expect(preview).toContainText('First synthetic card');await expect(preview).not.toContainText('Second synthetic card');await expect(preview.locator('img')).toBeVisible();
  await preview.getByRole('button',{name:'Show on board: First synthetic card',exact:true}).click();
  await expect(preview).toHaveCount(0);await expect(page.locator('.board-gallery')).toHaveCount(0);await expect(viewport).toBeVisible();
  await expect.poll(()=>first.evaluate(el=>{const item=el.getBoundingClientRect(),canvas=document.querySelector('.whiteboard-viewport')!.getBoundingClientRect();return Math.abs(item.x+item.width/2-canvas.x-canvas.width/2)+Math.abs(item.y+item.height/2-canvas.y-canvas.height/2);})).toBeLessThan(3);
  expect(await selectedIds()).toEqual([one]);await expect(second).not.toHaveClass(/wb-selected/);await expect(input).toHaveValue('Keep the selected context and this draft');await expect(chip).toHaveAttribute('title','First synthetic card');
 }
 expect(await page.evaluate(()=>JSON.stringify((window as any).projectBoardOverride))).toBe(original);
 expect(await page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.action==='write'&&call.endpoint==='/project-board'))).toEqual([]);expect(await calls(page)).toEqual([]);
});


test('a delayed follow-up keeps its sent selection after the canvas selection changes',async({page})=>{
 await openBoard(page,false);await page.locator(`[data-canvas-id="${one}"] .whiteboard-text`).click();await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await page.getByLabel('Message Claude',{exact:true}).fill('Start a synthetic turn');await page.locator('.send-button').click();await expect.poll(async()=>(await calls(page)).length).toBe(1);
 await page.evaluate(()=>{(window as any).rejectNextFollowup=true;});await page.getByLabel('Message Claude',{exact:true}).fill('Wait with the first selected card');await page.locator('.send-button').click();await expect.poll(async()=>(await calls(page)).length).toBe(2);await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('');
 await page.locator(`[data-canvas-id="${two}"] .whiteboard-text`).click();await expect(page.locator('.composer-board-selection')).toHaveAttribute('title','Second synthetic card');await page.evaluate(()=>{const run=(window as any).testRuns[0];run.status='done';run.revision++;});await expect.poll(async()=>(await calls(page)).length).toBe(3);const messages=await calls(page);expect(messages[2].data.attachments).toEqual(messages[1].data.attachments);expect(messages[2].data.text).toBe('Wait with the first selected card');
});


test('phone gallery stays compact and its add action attaches an original to the board chat',async({page})=>{
 await page.setViewportSize({width:390,height:844});const root='C:/Synthetic/Gallery',id='44444444-4444-4444-8444-444444444444';let image='',jobs=0;
 const board={id,name:'Synthetic gallery',root,repositoryFile:'board-'+id+'.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',versions:[],branches:[],notes:[{id:one,title:'Phone concept',description:'Synthetic image',branch:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[],images:[{path:'project-boards/assets/'+'a'.repeat(64)+'.png',caption:'Phone concept'}]}]};
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-gallery-token'}));localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-chat-view','grid');});
 await page.route('**/api/**',route=>{const url=new URL(route.request().url()),p=url.pathname.slice(4);
  if(p==='/health')return route.fulfill({json:{name:'Synthetic host',roots:[root],version:'0.28.8',protocol:1}});
  if(p==='/providers')return route.fulfill({json:[{id:'claude',available:true,authenticated:true,models:[]}]});
  if(p==='/projects')return route.fulfill({json:[root]});
  if(p==='/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/project-board')return route.fulfill({json:{board,canEdit:true}});
  if(p==='/project-board/live')return route.fulfill({json:{version:'a'.repeat(64),unchanged:true}});
  if(p==='/project-board/image')return route.fulfill({json:{mimeType:'image/png',data:image}});
  if(p==='/uploads'){const data=route.request().postDataJSON();return route.fulfill({json:{id:'synthetic-image',name:data.name,size:100}});}
  if(p==='/jobs'&&route.request().method()==='POST')jobs++;
  if(['/sessions','/jobs','/activity'].includes(p))return route.fulfill({json:[]});
  if(p==='/updates/latest')return route.fulfill({json:{enabled:false}});
  return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
 });
 await page.goto('http://127.0.0.1:5173');image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;canvas.getContext('2d')!.fillRect(0,0,320,180);return canvas.toDataURL().split(',')[1];});await expect(page.getByRole('button',{name:/Inbox|Входящие/i})).toHaveCount(0);await expect(page.locator('.mobile-tabbar>button')).toHaveCount(3);await expect(page.locator('.chat-view-controls,.chat-grid-view')).toHaveCount(0);await openSection(page,'Board');const button=page.locator('.board-index-item');if(await button.count())await button.first().click();await page.getByRole('button',{name:'Board images',exact:true}).click();await expect(page.locator('.board-gallery .board-image-thumb img')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/board-images-phone.png'});
 await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(page.locator('.whiteboard-viewport')).toBeVisible();await page.getByRole('button',{name:'Board images',exact:true}).click();await page.getByRole('button',{name:'Attach to chat: Phone concept',exact:true}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toBeVisible();await expect(page.locator('.draft-attachment-image img')).toHaveAttribute('alt','Phone concept.png');expect(jobs).toBe(0);
});


test('expired launch restores the board session, native image drag and per-message selection',async({page})=>{
 await openBoard(page);
 await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();
 await page.getByLabel('Message Claude',{exact:true}).fill('Start board session');await page.locator('.send-button').click();await expect.poll(async()=>(await calls(page)).length).toBe(1);
 await page.evaluate(()=>{(window as any).expiredBoardJobs=true;});
 await page.locator('.desktop-rail .desktop-sessions button').first().click();
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 const entry=page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})});if(await entry.count())await entry.click();
 await page.locator('.board-discuss').click();
 await expect(page.getByLabel('Message Claude',{exact:true})).toBeEnabled();
 await expect(page.locator('.error-banner')).toHaveCount(0);
 await page.locator(`[data-canvas-id="${one}"] .whiteboard-text`).click();
 await expect(page.locator('.composer-board-selection')).toContainText('Board selection');
 await page.getByRole('button',{name:'Board images',exact:true}).click();
 const img=page.locator('.board-gallery .board-image-thumb img').first();await expect(img).toBeVisible();const from=(await img.boundingBox())!,to=(await page.getByLabel('Message Claude',{exact:true}).boundingBox())!;
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+from.width/2+15,from.y+from.height/2,{steps:5});await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:15});await page.mouse.up();
 await expect(page.locator('.draft-attachment-image img')).toHaveAttribute('alt','First concept.png');
 await expect(page.locator('.board-context-chip')).toHaveText('Atlas');
 await page.getByLabel('Message Claude',{exact:true}).fill('Discuss restored selection');await page.locator('.send-button').click();await page.getByRole('dialog').getByRole('button',{name:/continue|Продолжить/i}).click();await expect.poll(async()=>(await calls(page)).length).toBe(2);
 const names=await page.evaluate(()=>(window as any).desktopCalls.filter((m:any)=>m.endpoint?.startsWith('/uploads')&&m.action==='write').map((m:any)=>m.data.name));expect(names).toContain('Board selection.txt');
});


test('unavailable pending launch keeps selection and the correct project visible without replacing its binding',async({page})=>{
 await openBoard(page,false,'C:\\Demo\\Garden');
 await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();
 const original=await page.evaluate(()=>{const key=Object.keys(localStorage).find(k=>k.startsWith('pocket-board-conversation-v1:'))!,value=JSON.parse(localStorage.getItem(key)!);value.jobId='missing-synthetic-job';localStorage.setItem(key,JSON.stringify(value));(window as any).expiredBoardJobs=true;return value;});
 await page.locator('.desktop-rail .desktop-sessions button').first().click();await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 const entry=page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Garden$/})});if(await entry.count())await entry.click();await page.locator('.board-discuss').click();
 await expect(page.locator('.error-banner')).toContainText('Synthetic expired job');
 await page.locator(`[data-canvas-id="${one}"] .whiteboard-text`).click();await expect(page.locator('.composer-board-selection')).toHaveAttribute('title','First synthetic card');
 const binding=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('pocket-board-conversation-v1:'))!)!));expect(binding).toEqual(original);
 await expect(page.getByLabel('Message Claude',{exact:true})).toBeDisabled();
});
