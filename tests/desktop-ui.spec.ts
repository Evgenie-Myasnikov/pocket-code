import {test,expect,type Page} from '@playwright/test';
test('provider status distinguishes login from server and launches only explicit sign-in',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
 const panel=page.locator('.provider-connections');await expect(panel.getByText('Signed in',{exact:true})).toHaveCount(1);
 await expect(panel.getByText('Sign-in required',{exact:true})).toHaveCount(2);
 await expect(panel.getByText('Starts with a task',{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/provider-connections.png'});
 expect(await page.evaluate(()=>(window as any).desktopCalls.filter((v:any)=>v.action==='provider-login').length)).toBe(0);
 await panel.locator('article').filter({has:page.getByRole('heading',{name:'Codex',exact:true})}).getByRole('button',{name:'Device code',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).desktopCalls.find((v:any)=>v.action==='provider-login'))).toMatchObject({provider:'codex',method:'device'});
});
async function desktop(page:Page){
 await page.addInitScript(()=>{
  const listeners:((event:{data:unknown})=>void)[]=[];
  const calls:{action:string;endpoint?:string}[]=[];(window as any).desktopCalls=calls;
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=220;const drawing=canvas.getContext('2d')!;drawing.fillStyle='#263a32';drawing.fillRect(0,0,480,220);drawing.fillStyle='#c3dda8';drawing.font='28px sans-serif';drawing.fillText('Workspace preview',30,65);drawing.fillStyle='#829b86';drawing.fillRect(30,95,110,95);drawing.fillStyle='#48665c';drawing.fillRect(156,95,294,95);const sampleImage=canvas.toDataURL('image/png').split(',')[1];
  let state={online:true,busy:false,status:'Pocket Code · connected',startup:false,autoReconnect:true,internet:true,addresses:[],jira:true};
  const reply=(id:number,value:unknown)=>queueMicrotask(()=>listeners.forEach(listener=>listener({data:{id,value:structuredClone(value)}})));
  (window as any).chrome={...((window as any).chrome||{}),webview:{addEventListener(_type:string,fn:(event:{data:unknown})=>void){listeners.push(fn);},postMessage(message:any){
   calls.push(message);const {id,action}=message;if(action==='state'){reply(id,state);return;}if(action==='settings'){state={...state,...message};reply(id,state);return;}if(action==='device-rename'){const d=(window as any).testDevices.find((d:any)=>d.id===message.deviceId);d.name=message.name;reply(id,{ok:true});return;}if(action==='device-disconnect'){(window as any).testDevices=(window as any).testDevices.filter((d:any)=>d.id!==message.deviceId);reply(id,{ok:true});return;}if(action==='provider-login'){reply(id,{state:'waiting'});return;}if(action==='provider-logout'){reply(id,{state:'idle'});return;}if(action==='check-update'){reply(id,{...state,updateState:'checking'});return;}if(action==='toggle'){state={...state,online:!state.online};reply(id,state);listeners.forEach(listener=>listener({data:{state}}));return;}
   const url=new URL('https://example.invalid'+message.endpoint),p=url.pathname,provider=url.searchParams.get('provider')||'claude';
   const messageBlock=(id:string,text:string)=>({id,role:'assistant',blocks:[{type:'text',text}]});
   if(p==='/sessions'){reply(id,[{sessionId:'alpha',summary:provider+' · Interface review',cwd:'C:\\Demo\\Atlas',lastModified:2},{sessionId:'beta',summary:provider+' · Documentation',cwd:'C:\\Demo\\Garden',lastModified:1}]);return;}
   if(p==='/provider-connections'){reply(id,{providers:['claude','codex','copilot'].map(id=>({id,installed:true,version:'1.0.0',server:id==='claude'?'on-demand':'ready',authenticated:id==='claude',busy:false,login:{state:'idle'},methods:id==='claude'?['browser','console','sso']:['browser','device']}))});return;}
   if(p==='/devices'){reply(id,(window as any).testDevices||[]);return;}
   if(p==='/project-docs'){reply(id,{project:url.searchParams.get('cwd'),truncated:false,documents:[{path:'AGENTS.md',name:'AGENTS.md',kind:'rules',source:'project',appliesTo:'all',bytes:40},{path:'CHANGELOG.md',name:'CHANGELOG.md',kind:'changelog',source:'project',appliesTo:'all',bytes:40}]});return;}
   if(p==='/project-doc'){const path=url.searchParams.get('path');reply(id,{path,name:path,kind:path==='AGENTS.md'?'rules':'changelog',source:'project',appliesTo:'all',bytes:40,content:path==='AGENTS.md'?'# Synthetic rules\n\nUse synthetic data.':'# Changelog\n\n- Synthetic entry'});return;}
   if(p==='/files'){const folder=url.searchParams.get('path')||'C:\Demo\Atlas';reply(id,{path:folder,parent:null,entries:[{name:'README.md',directory:false,path:folder+'\README.md'}]});return;}
   if(p==='/file'){reply(id,{name:'README.md',text:'Synthetic readme'});return;}
   if(p==='/projects'){reply(id,['C:\\Demo\\Atlas','C:\\Demo\\Garden']);return;}
   if(p==='/jobs'){reply(id,(window as any).testRuns||[]);return;}
   if(p.startsWith('/jobs/')){reply(id,((window as any).testRuns||[]).find((run:any)=>run.id===p.split('/').pop()));return;}
   if(p==='/review/availability'){reply(id,{available:true,mode:'working'});return;}
   if(p.endsWith('/messages')){const earlier=url.searchParams.has('end'),start=url.searchParams.has('offset');reply(id,{messages:earlier?[messageBlock('older','Earlier project context')]:[messageBlock('answer',p.includes('/beta/')?'Garden documentation':'## Interface review\n\nThe responsive layout is ready.\n\n```ts\nconst layout = "adaptive";\n```'),{id:'picture',role:'assistant',blocks:[{type:'image',source:{type:'base64',media_type:'image/png',data:sampleImage}}]}],previous:earlier||start?null:5,next:null});return;}
   if(p==='/review'){const file=url.searchParams.get('file');reply(id,{files:[{path:'src/layout.ts',added:2,removed:1,binary:false}],current:'main',base:'main',branches:['main'],repositoryRoot:url.searchParams.get('cwd'),patch:file?'@@ -1 +1,2 @@\n-old\n+adaptive\n+responsive':'',binary:false});return;}
   reply(id,{});
  }}};
 });
 await page.goto('http://127.0.0.1:5173/?desktop=1');
 await expect(page.getByRole('button',{name:/claude · Interface review/})).toBeVisible();
}
test('desktop shares read-only chat, review and results with provider/project selection',async({page})=>{
 await page.setViewportSize({width:1366,height:900});await desktop(page);
 await page.getByLabel('Provider',{exact:true}).selectOption('codex');await page.getByLabel('Project',{exact:true}).selectOption('C:\\Demo\\Atlas');
 await expect(page.getByRole('button',{name:/Documentation/})).toHaveCount(0);
 await page.getByRole('button',{name:/codex · Interface review/}).click();
 await expect(page.getByText('The responsive layout is ready.')).toBeVisible();await expect(page.locator('textarea')).toHaveCount(0);
 await page.getByRole('button',{name:'Review',exact:true}).click();const review=page.getByRole('dialog',{name:'Review',exact:true});await expect(review).toContainText('src/layout.ts');await expect(review).toContainText('adaptive');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Results',exact:true}).click();const results=page.getByRole('dialog',{name:'Results',exact:true});await expect(results).toBeVisible();await results.getByRole('button',{name:/^Images/}).click();await expect(results.locator('.chat-output-image-item')).toHaveCount(1);await results.locator('.chat-output-image-card').click();const viewer=page.getByRole('dialog',{name:'Image',exact:true});await viewer.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(viewer.getByLabel('Zoom',{exact:true})).toContainText('1.5');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.screenshot({path:'artifacts/screenshots/desktop-chat.png'});
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.every((call:any)=>['state','read'].includes(call.action))).toBeTruthy();expect(calls.find((call:any)=>call.endpoint?.startsWith('/review?'))?.endpoint).toContain('Atlas');
});
test('desktop keeps the current chat while switching sections and persists appearance',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Ocean',exact:true}).click();
 await page.getByLabel('Start with Windows').check();await page.getByRole('button',{name:'Chats',exact:true}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 await page.getByRole('button',{name:'Connection',exact:true}).click();await expect(page.getByRole('heading',{name:'Connect your phone'})).toBeVisible();
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.some((call:any)=>call.action==='settings'&&call.startup===true)).toBeTruthy();
});
test('desktop request adapter rejects mutations before reaching the native bridge',async({page})=>{
 await desktop(page);
 const result=await page.evaluate(async()=>{const api=await import('/src/api.ts' as string);try{await api.request({url:'http://127.0.0.1:4318',token:'',desktop:true},'/jobs',{text:'Must not run'});return 'unexpected';}catch(error){return (error as Error).message;}});
 expect(result).toContain('read-only');expect(await page.evaluate(()=>(window as any).desktopCalls.some((call:any)=>call.action==='read'&&call.endpoint==='/jobs'))).toBeFalsy();
});
for(const width of [900,1440,1920])test(`desktop layout fits ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Settings',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('desktop exposes account sign-out confirmation and automatic updates',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText(/Signs out the CLI on this PC/)).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='provider-logout'))).toBeFalsy();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign out now',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='provider-logout'&&c.provider==='claude'))).toBeTruthy();
 await expect(page.getByLabel('Automatically update the Windows app and PC host')).toBeChecked();await page.getByRole('button',{name:'Check for updates',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='check-update'))).toBeTruthy();
});
test('desktop follows the newest run, streams partial text and shows question/error/completion status',async({page})=>{
 await desktop(page);
 await page.evaluate(()=>{const base={cwd:'C:\\Demo\\Atlas',sessionId:'alpha',provider:'claude',messages:[],approvals:[],baseMessageCount:0,revision:1};(window as any).testRuns=[{...base,id:'old',startedAt:1,status:'done',partial:'Stale answer'},{...base,id:'new',startedAt:2,status:'running',partial:'Live response'}];});
 const row=page.locator('.desktop-sessions button').filter({hasText:'Interface review'});
 await expect(row).toContainText('Working');await row.click();
 await expect(page.locator('.desktop-live-text')).toHaveText('Live response');
 await expect(page.getByText('Stale answer',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.partial='Live response continues';run.approvals=[{id:'question'}];run.revision++;});
 await expect(page.locator('.desktop-live-text')).toHaveText('Live response continues');await expect(row).toContainText('Needs your answer');
 await expect(page.locator('.desktop-chat-header')).toContainText('Needs your answer');
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.status='error';run.error='Synthetic run failure';run.approvals=[];run.revision++;});
 await expect(row).toContainText('Error');await expect(page.getByText('Synthetic run failure')).toBeVisible();
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.status='done';delete run.error;run.revision++;});
 await expect(row).toContainText('Completed');
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.filter((c:any)=>c.endpoint?.includes('/messages?')).some((c:any)=>!c.endpoint.includes('&end='))).toBeTruthy();
});
test('PC shows device presence and confirms individual revocation',async({page})=>{
 await desktop(page);await page.evaluate(()=>{(window as any).testDevices=[{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic phone',platform:'android',version:'1',lastSeen:Date.now(),pairedAt:Date.now(),status:'online'},{id:'22222222-2222-4222-8222-222222222222',name:'Synthetic tablet',platform:'android',version:'1',lastSeen:Date.now()-60000,pairedAt:1,status:'offline'}];});
 await page.getByRole('button',{name:'Connection',exact:true}).click();const devices=page.locator('.desktop-devices');await expect(devices).toContainText('Synthetic phone');await expect(devices).toContainText('Online');await expect(devices).toContainText('Offline');
 const phone=devices.getByRole('listitem').filter({hasText:'Synthetic phone'});await phone.getByRole('button',{name:'Rename',exact:true}).click();await phone.getByLabel('Device name').fill('Renamed phone');await phone.getByRole('button',{name:'Save',exact:true}).click();await expect(devices).toContainText('Renamed phone');
 const renamed=devices.getByRole('listitem').filter({hasText:'Renamed phone'});await renamed.getByRole('button',{name:'Disconnect',exact:true}).click();expect(await page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='device-disconnect'))).toBeFalsy();await renamed.getByRole('button',{name:'Cancel',exact:true}).click();
 await renamed.getByRole('button',{name:'Disconnect',exact:true}).click();await renamed.getByRole('button',{name:'Disconnect device',exact:true}).click();await expect(devices.getByRole('listitem').filter({hasText:'Renamed phone'})).toHaveCount(0);await expect(devices.getByRole('listitem').filter({hasText:'Synthetic tablet'})).toContainText('Offline');
 await page.screenshot({path:'artifacts/screenshots/desktop-devices.png'});
});
test('sidebar divider resizes the rail with mouse and keyboard, persists and resets',async({page})=>{
 await page.setViewportSize({width:1280,height:800});await desktop(page);
 const rail=page.locator('.desktop-rail'),handle=page.getByRole('separator',{name:'Sidebar width'});
 const width=async()=>Math.round((await rail.boundingBox())!.width);const initial=await width();
 const box=(await handle.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+200);await page.mouse.down();await page.mouse.move(box.x+box.width/2+120,box.y+200,{steps:6});await page.mouse.up();
 expect(Math.abs(await width()-(initial+120))).toBeLessThanOrEqual(2);
 await page.reload();await expect(page.getByRole('button',{name:/claude · Interface review/})).toBeVisible();expect(Math.abs(await width()-(initial+120))).toBeLessThanOrEqual(2);
 const moved=(await handle.boundingBox())!;await page.mouse.move(moved.x+4,moved.y+200);await page.mouse.down();await page.mouse.move(moved.x+900,moved.y+200,{steps:6});await page.mouse.up();
 expect(await width()).toBe(560);expect(1280-await width()).toBeGreaterThanOrEqual(480);
 await handle.focus();await page.keyboard.press('ArrowLeft');expect(await width()).toBe(544);
 await handle.dblclick();expect(await width()).toBe(initial);
 expect(await page.evaluate(()=>localStorage.getItem('pocket-desktop-rail-width'))).toBe('');
});

test('desktop Project page shows rules, changelog and files of the selected project',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'Project',exact:true}).click();
 const overview=page.locator('.desktop-project');await expect(overview.getByLabel('Project folder')).toHaveValue('C:\\Demo\\Atlas');
 // A single rule file opens directly, as on the phone.
 await overview.getByRole('button',{name:/Rules/}).click();await expect(overview).toContainText('Use synthetic data.');
 await overview.getByRole('button',{name:'Project overview',exact:true}).click();
 await overview.getByRole('button',{name:/^Files/}).click();await expect(overview).toContainText('README.md');
 const reads=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.action==='read').map((c:any)=>c.endpoint.split('?')[0]));
 expect(reads).toEqual(expect.arrayContaining(['/project-docs','/project-doc']));
 expect(await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>!['read','state','settings','window-theme'].includes(c.action)).map((c:any)=>c.action))).toEqual([]);
});
