import {readFileSync} from 'node:fs';
const roadmap=JSON.parse(readFileSync(new URL('../project-boards/board-7b004a10-920c-4ba7-a070-254318083e90.json',import.meta.url),'utf8'));
import {test,expect,type Page} from '@playwright/test';
test('repository boards open directly and refresh from their source',async({page})=>{
 await desktop(page);await expect(page.locator('.desktop-brand')).toHaveCount(0);await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 await expect(page.getByRole('button',{name:'Workspace boards',exact:true})).toHaveCount(0);await expect(page.locator('.project-board-grid .board-index-item svg')).toHaveCount(0);const cards=page.locator('.project-board-grid .board-index-item');await expect(cards).toHaveCount(2);const a=await cards.nth(0).boundingBox(),b=await cards.nth(1).boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);expect(b!.x).toBeGreaterThan(a!.x);await page.screenshot({path:'.local/board-grid-0258.png'});await page.locator('.project-board-row').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).getByRole('button').click();await expect(page.getByRole('heading',{name:'Atlas',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Delete board',exact:true})).toHaveCount(0);
 const reads=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint?.startsWith('/project-board?')).length);await page.getByRole('button',{name:'Refresh board',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint?.startsWith('/project-board?')).length)).toBe(reads+1);
});
test('workspace deletion requires confirmation and removes the card',async({page})=>{
 await page.addInitScript(()=>{(window as any).testWorkspaces=[{id:'11111111-1111-4111-8111-111111111111',name:'Disposable example',roots:['C:\\Demo\\Atlas'],role:'host',people:[],members:[]}];});
 await desktop(page);await page.getByRole('button',{name:'WorkSpace',exact:true}).click();await page.locator('summary').filter({hasText:'Disposable example'}).click();await page.getByRole('button',{name:'Delete workspace',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Project files stay on the PC.');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('summary').filter({hasText:'Disposable example'})).toBeVisible();await page.getByRole('button',{name:'Delete workspace',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await expect(page.locator('summary').filter({hasText:'Disposable example'})).toHaveCount(0);
});
test('desktop chat supports scoped select all, copy and paste',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();
 const input=page.locator('.composer textarea');await input.fill('Synthetic draft');await input.press('Control+a');await input.press('Control+c');await input.press('End');await input.press('Control+v');await expect(input).toHaveValue('Synthetic draftSynthetic draft');
 await page.locator('.conversation-inner').click({position:{x:10,y:10}});await page.keyboard.press('Control+a');const selected=await page.evaluate(()=>getSelection()?.toString());expect(selected).toContain('The responsive layout is ready.');expect(selected).not.toContain('WorkSpace');
 await page.keyboard.press('Control+c');await input.fill('');await page.locator('.conversation-inner').click({position:{x:10,y:10}});await page.keyboard.press('Control+v');await expect(input).toBeFocused();expect(await input.inputValue()).toContain('The responsive layout is ready.');
});
test('Connection QR and WorkSpace administration are separate',async({page})=>{
 await page.addInitScript(()=>{(window as any).testWorkspaces=[{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic team',roots:['C:\\Demo\\Atlas'],role:'host',people:[{id:'host',name:'Alex Morgan',role:'host'}],members:[]}];});
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByLabel('QR role')).toHaveCount(0);
 await page.getByRole('button',{name:'WorkSpace',exact:true}).click();
 await page.locator('summary').filter({hasText:'Synthetic team'}).click();
 await expect(page.locator('.workspace-roster')).toContainText('Alex Morgan');
 await expect(page.getByLabel('Participant role')).toHaveValue('developer');
 await expect(page.locator('.desktop-rail').getByLabel('Project',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'artifacts/screenshots/workspace-management.png'});
});
test('workspace lists each person once and exposes host approval and removal',async({page})=>{
 await page.addInitScript(()=>{(window as any).testWorkspaces=[{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic team',roots:['C:\\Demo\\Atlas'],role:'host',people:[{id:'host',name:'Alex Example',role:'host'},{id:'33333333-3333-4333-8333-333333333333',name:'Morgan Example',role:'viewer'}],members:[{id:'33333333-3333-4333-8333-333333333333',name:'Morgan Example',role:'viewer',approval:'approved'},{id:'44444444-4444-4444-8444-444444444444',name:'Taylor Example',role:'viewer',approval:'pending'}]}];});
 await desktop(page);await page.getByRole('button',{name:'WorkSpace',exact:true}).click();await page.locator('summary').filter({hasText:'Synthetic team'}).click();
 const roster=page.locator('.workspace-roster');await expect(roster.getByText('Morgan Example',{exact:true})).toHaveCount(1);await expect(roster.getByText('Taylor Example',{exact:true})).toHaveCount(1);
 await expect(roster.getByRole('button',{name:'Approve',exact:true})).toBeVisible();await expect(roster.getByRole('button',{name:'Decline',exact:true})).toBeVisible();await expect(roster.getByRole('button',{name:'Remove member',exact:true})).toHaveCount(2);
 await page.screenshot({path:'.local/workspace-approval-desktop.png'});
});
test('desktop keeps a draft across navigation and submits through the shared chat',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'New',exact:true}).click();
 await page.locator('textarea').fill('Synthetic planning request');
 await page.getByRole('button',{name:'Settings',exact:true}).first().click();
 await page.getByRole('button',{name:'New',exact:true}).click();
 await expect(page.locator('textarea')).toHaveValue('Synthetic planning request');
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='write'&&/^\/jobs(?:\?|$)/.test(c.endpoint)&&c.data.text==='Synthetic planning request'))).toBe(true);
 await expect(page.locator('textarea')).toHaveValue('');
});
test('provider status distinguishes login from server and launches only explicit sign-in',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:/^AI accounts/}).click();await page.getByRole('button',{name:'Claude',exact:true}).click();const panel=page.locator('.provider-connections');await expect(panel.getByText('Signed in',{exact:true})).toHaveCount(1);
 
 await expect(panel.getByText('Starts with a task',{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/provider-connections.png'});
 expect(await page.evaluate(()=>(window as any).desktopCalls.filter((v:any)=>v.action==='provider-login').length)).toBe(0);
 await page.getByRole('button',{name:'AI accounts',exact:true}).click();await page.getByRole('button',{name:'Codex',exact:true}).click();await panel.getByRole('button',{name:'Device code',exact:true}).click();
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
   calls.push(message);const {id,action}=message;if(action==='state'||action==='pairing-role'){reply(id,state);return;}if(action==='settings'){state={...state,...message};reply(id,state);return;}if(action==='device-rename'){const d=(window as any).testDevices.find((d:any)=>d.id===message.deviceId);d.name=message.name;reply(id,{ok:true});return;}if(action==='device-disconnect'){(window as any).testDevices=(window as any).testDevices.filter((d:any)=>d.id!==message.deviceId);reply(id,{ok:true});return;}if(action==='provider-login'){reply(id,{state:'waiting'});return;}if(action==='provider-logout'){reply(id,{state:'idle'});return;}if(action==='check-update'){reply(id,{...state,updateState:'checking'});return;}if(action==='toggle'){state={...state,online:!state.online};reply(id,state);listeners.forEach(listener=>listener({data:{state}}));return;}
   const url=new URL('https://example.invalid'+message.endpoint),p=url.pathname,provider=url.searchParams.get('provider')||'claude';
   const messageBlock=(id:string,text:string)=>({id,role:'assistant',blocks:[{type:'text',text}]});
   if(p==='/pairing-role'){reply(id,{role:'host'});return;}
   if(p==='/health'){reply(id,{name:'Synthetic PC',roots:['C:\\Demo\\Atlas','C:\\Demo\\Garden'],version:'0.22.7',protocol:1});return;}
   if(p==='/providers'){reply(id,[{id:'claude',available:true,models:[]},{id:'codex',available:true,authenticated:true,models:[]}]);return;}
   if(/^\/workspaces\/[^/]+\/delete$/.test(p)){(window as any).testWorkspaces=(window as any).testWorkspaces.filter((w:any)=>w.id!==p.split('/')[2]);reply(id,{ok:true});return;}
   if(p==='/workspaces'){reply(id,{host:true,canManageWorkspaces:true,activeWorkspaceId:(window as any).testWorkspaces?.[0]?.id,workspaces:(window as any).testWorkspaces||[],boards:(window as any).testBoards||[]});return;}
   if(p==='/board-notifications'){reply(id,{items:(window as any).testBoardNotices||[]});return;}if(p==='/board-notifications/read'){(window as any).testBoardNotices=((window as any).testBoardNotices||[]).map((n:any)=>({...n,readAt:Date.now()}));reply(id,{ok:true});return;}
   if(p==='/project-board/miro'){(window as any).miroBoard=message.data.url?{root:message.data.root,url:message.data.url}:null;reply(id,{miro:(window as any).miroBoard});return;}
   if(p==='/project-board/create'){(window as any).createdProjectBoard={id:'22222222-2222-4222-8222-222222222222',name:'Project board',root:message.data.root,repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'b'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]};reply(id,(window as any).createdProjectBoard);return;}
   if(p==='/project-board'){if((window as any).projectBoardOverride){reply(id,{board:(window as any).projectBoardOverride});return;}if((window as any).missingProjectBoard){reply(id,{board:(window as any).createdProjectBoard||null,miro:(window as any).miroBoard?.root===url.searchParams.get('root')?(window as any).miroBoard:null});return;}reply(id,{board:{id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:url.searchParams.get('root'),repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]}});return;}
   if(p==='/repository-board'){reply(id,{id:'22222222-2222-4222-8222-222222222222',name:'Shared roadmap',root:url.searchParams.get('root'),repositoryFile:url.searchParams.get('file'),revision:0,source:'project-changelog',versionSource:'planned',notes:[],versions:[],branches:[]});return;}
   if(p==='/board-snapshots'||p==='/repository-boards'){reply(id,[{file:'board-11111111-1111-4111-8111-111111111111.json',name:'Shared roadmap',noteCount:0}]);return;}
   if(p==='/board-snapshots/import'){const board={id:'22222222-2222-4222-8222-222222222222',name:'Shared roadmap',root:message.data.root,revision:0,versionSource:'planned',notes:[],versions:[]};(window as any).testBoards=[board];reply(id,board);return;}
   if(/^\/boards\/[^/]+\/snapshot$/.test(p)){reply(id,{path:'project-boards/board-22222222-2222-4222-8222-222222222222.json'});return;}
   if(/^\/boards\/[^/]+\/delete$/.test(p)){(window as any).testBoards=[];reply(id,{ok:true});return;}
   if(/^\/boards\/[^/]+$/.test(p)){reply(id,(window as any).testBoards?.find((b:any)=>b.id===p.split('/')[2]));return;}
   if(p==='/uploads'){reply(id,{id:'pasted-image',name:message.data.name,size:100});return;}
   if(p==='/activity'){reply(id,[]);return;}
   if(p==='/task-notifications'){reply(id,{items:[],unread:0});return;}
   if(p==='/jobs'&&action==='write'){const run={...message.data,provider:message.data.provider||'claude',sessionId:'alpha',status:'running',messages:[],partial:'Working on your request',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:0};(window as any).testRuns=[run];reply(id,run);return;}
   if(p==='/sessions'){reply(id,[{sessionId:'alpha',summary:provider+' · Interface review',cwd:'C:\\Demo\\Atlas',lastModified:2},{sessionId:'beta',summary:provider+' · Documentation',cwd:'C:\\Demo\\Garden',lastModified:1}]);return;}
   if(p==='/provider-connections'){reply(id,{providers:['claude','codex','copilot'].map(id=>({id,installed:true,version:'1.0.0',server:id==='claude'?'on-demand':'ready',authenticated:id==='claude',busy:false,login:{state:'idle'},methods:id==='claude'?['browser','console','sso']:['browser','device']}))});return;}
   if(p==='/devices'){reply(id,(window as any).testDevices||[]);return;}
   if(p==='/document-projects'){reply(id,[{root:'C:\\Demo\\Atlas',name:'Atlas',documents:[]}]);return;}
   if(p==='/project-rules'){if(action==='write')(window as any).boardRuleEnabled=message.data.boardMaintenance;reply(id,{boardMaintenance:(window as any).boardRuleEnabled!==false,canEdit:true});return;}
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
test('desktop shares editable chat, review and results with provider/project selection',async({page})=>{
 await page.setViewportSize({width:1366,height:900});await desktop(page);
 await page.getByLabel('Provider',{exact:true}).selectOption('codex');
 await expect(page.getByRole('button',{name:/Documentation/})).toBeVisible();
 await page.getByRole('button',{name:/codex · Interface review/}).click();
 await expect(page.getByText('The responsive layout is ready.')).toBeVisible();await expect(page.locator('textarea')).toBeVisible();
 await page.getByRole('button',{name:'Review',exact:true}).click();const review=page.getByRole('dialog',{name:'Review',exact:true});await expect(review).toContainText('src/layout.ts');await expect(review).toContainText('adaptive');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Results',exact:true}).click();const results=page.getByRole('dialog',{name:'Results',exact:true});await expect(results).toBeVisible();await results.getByRole('button',{name:/^Images/}).click();await expect(results.locator('.chat-output-image-item')).toHaveCount(1);await results.locator('.chat-output-image-card').click();const viewer=page.getByRole('dialog',{name:'Image',exact:true});await viewer.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(viewer.getByLabel('Zoom',{exact:true})).toContainText('1.5');await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.screenshot({path:'artifacts/screenshots/desktop-chat.png'});
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.every((call:any)=>['state','read','window-theme','write'].includes(call.action))).toBeTruthy();expect(calls.find((call:any)=>call.endpoint?.startsWith('/review?'))?.endpoint).toContain('Atlas');
});
test('desktop keeps the current chat while switching sections and persists appearance',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:/^Appearance and language/}).click();await page.getByRole('button',{name:'Ocean',exact:true}).click();await page.getByRole('button',{name:'All settings',exact:true}).click();await page.getByRole('button',{name:/^Windows application/}).click();
 await page.getByLabel('Start with Windows').check();await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Connection',exact:true}).click();await expect(page.getByRole('heading',{name:'Connect your phone'})).toBeVisible();
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.some((call:any)=>call.action==='settings'&&call.startup===true)).toBeTruthy();
});
test('desktop request adapter sends mutations to the native write allowlist',async({page})=>{
 await desktop(page);
 await page.evaluate(async()=>{const api=await import('/src/api.ts' as string);await api.request({url:'http://127.0.0.1:4318',token:'',desktop:true},'/jobs',{text:'Synthetic request'});});
 expect(await page.evaluate(()=>(window as any).desktopCalls.some((call:any)=>call.action==='write'&&call.endpoint==='/jobs'&&call.data.text==='Synthetic request'))).toBeTruthy();
});
for(const width of [900,1440,1920])test(`desktop layout fits ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Settings',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('desktop exposes account sign-out confirmation and automatic updates',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:/^AI accounts/}).click();await page.getByRole('button',{name:'Claude',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText(/Signs out the CLI on this PC/)).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='provider-logout'))).toBeFalsy();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign out now',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='provider-logout'&&c.provider==='claude'))).toBeTruthy();
 await page.getByRole('button',{name:'AI accounts',exact:true}).click();await page.getByRole('button',{name:'All settings',exact:true}).click();await page.getByRole('button',{name:/^Updates/}).click();await expect(page.getByLabel('Automatically update the Windows app and PC host')).toBeChecked();await page.getByRole('button',{name:'Check for updates',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.action==='check-update'))).toBeTruthy();
});
test('desktop follows the newest run, streams partial text and shows question/error/completion status',async({page})=>{
 await desktop(page);
 await page.evaluate(()=>{const base={cwd:'C:\\Demo\\Atlas',sessionId:'alpha',provider:'claude',messages:[],approvals:[],baseMessageCount:0,revision:1};(window as any).testRuns=[{...base,id:'old',startedAt:1,status:'done',partial:'Stale answer'},{...base,id:'new',startedAt:2,status:'running',partial:'Live response'}];});
 const row=page.locator('.desktop-sessions button').filter({hasText:'Interface review'});
 await expect(row).toContainText('Working');await row.click();
 await expect(page.getByText('Live response',{exact:true})).toBeVisible();
 await expect(page.getByText('Stale answer',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.partial='Live response continues';run.approvals=[{id:'question',tool:'Write',input:{file_path:'synthetic.txt'},createdAt:Date.now()}];run.revision++;});
 await expect(page.getByText('Live response continues',{exact:true})).toBeVisible();await expect(row).toContainText('Needs your answer');
 await expect(page.getByRole('button',{name:'Allow',exact:true})).toBeVisible();
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.status='error';run.error='Synthetic run failure';run.approvals=[];run.revision++;});
 await expect(row).toContainText('Error');await expect(page.getByText('Synthetic run failure')).toBeVisible();
 await page.evaluate(()=>{const run=(window as any).testRuns[1];run.status='done';delete run.error;run.revision++;});
 await expect(row).toContainText('Completed');
 const calls=await page.evaluate(()=>(window as any).desktopCalls);expect(calls.filter((c:any)=>c.endpoint?.includes('/messages?')).some((c:any)=>c.endpoint.includes('/sessions/alpha/messages?'))).toBeTruthy();
});
test('PC shows device presence and confirms individual revocation',async({page})=>{
 await desktop(page);await page.evaluate(()=>{(window as any).testDevices=[{id:'11111111-1111-4111-8111-111111111111',name:'Synthetic phone',platform:'android',version:'1',lastSeen:Date.now(),pairedAt:Date.now(),status:'online'},{id:'22222222-2222-4222-8222-222222222222',name:'Synthetic tablet',platform:'android',version:'1',lastSeen:Date.now()-60000,pairedAt:1,status:'offline'}];});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Connection',exact:true}).click();const devices=page.locator('.desktop-devices');await expect(devices).toContainText('Synthetic phone');await expect(devices).toContainText('Online');await expect(devices).toContainText('Offline');
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

test('desktop has direct Rules and Changelog with internal Git project selection',async({page})=>{
 await desktop(page);const nav=page.getByRole('navigation');await expect(nav.getByRole('button',{name:'Project',exact:true})).toHaveCount(0);await nav.getByRole('button',{name:'Rules',exact:true}).click();
 await expect(page.getByLabel('Git project')).toHaveValue('C:\\Demo\\Atlas');await expect(page.locator('.project-docs-markdown')).toContainText('Use synthetic data.');await nav.getByRole('button',{name:'Changelog',exact:true}).click();await expect(page.locator('.project-docs-markdown')).toContainText('Synthetic entry');
 await expect(page.locator('.document-library').getByRole('button',{name:/^Refresh/})).toHaveCount(1);const before=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint?.startsWith('/project-doc?')).length);await page.getByRole('button',{name:'Refresh projects',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint?.startsWith('/project-doc?')).length)).toBeGreaterThan(before);await page.screenshot({path:'artifacts/screenshots/desktop-changelog.png'});
});

for(const width of [900,1440])test('workspace creation fits '+width,async({page})=>{
 await desktop(page);await page.setViewportSize({width,height:800});await page.getByRole('button',{name:'WorkSpace',exact:true}).click();await page.getByRole('button',{name:'Create workspace',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Create workspace',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox',{name:'Repository',exact:true}).locator('option')).toHaveCount(2);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await page.screenshot({path:'.local/workspace-create-'+width+'.png'});
});

test('personal chats stay visible independently of the shared board workspace',async({page})=>{
 await page.addInitScript(()=>{(window as any).testWorkspaces=[{id:'11111111-1111-4111-8111-111111111111',name:'Shared board',roots:['C:\\Other\\Repository'],role:'host',members:[]}];});
 await desktop(page);await expect(page.getByRole('combobox',{name:'Workspace',exact:true})).toHaveCount(0);await page.getByRole('button',{name:/claude \u00b7 Interface review/}).click();await expect(page.locator('.embedded-chat')).toBeVisible();
 await page.getByRole('navigation').getByRole('button',{name:'Board',exact:true}).click();await expect(page.getByRole('button',{name:'Workspace boards',exact:true})).toHaveCount(0);await expect(page.locator('.project-board-row').first()).toBeVisible();await expect(page.getByRole('combobox',{name:'Workspace',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:/claude \u00b7 Interface review/}).click();await expect(page.locator('.embedded-chat')).toBeVisible();
});

test('desktop board inbox shows a targeted question and marks it read after opening',async({page})=>{
 await page.addInitScript(()=>{const boardId='22222222-2222-4222-8222-222222222222',noteId='33333333-3333-4333-8333-333333333333';(window as any).testBoards=[{id:boardId,name:'Example',root:'C:\\Demo\\Atlas',revision:0,versions:[],versionSource:'planned',notes:[{id:noteId,title:'Example feature',description:'Acceptance criteria',branch:'',status:'idea',owner:'',dependencies:[],x:1200,y:900}]}];(window as any).testBoardNotices=[{id:'notice',boardId,noteId,recipientId:'host',kind:'question',title:'Example feature',message:'Which format should be supported?',at:1}];});
 await desktop(page);await page.getByRole('button',{name:'Board notifications',exact:true}).click();await page.screenshot({path:'.local/notifications-0255.png'});await page.getByRole('button',{name:/Clarification requested.*Example feature/}).click();await expect(page.getByRole('dialog',{name:'Note details'})).toBeVisible();await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Example feature');await expect(page.getByRole('dialog',{name:'Note details'})).toContainText('Which format should be supported?');await expect(page.getByRole('heading',{name:'Example',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).testBoardNotices[0].readAt)).toBeTruthy();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.board-note-highlight')).toBeInViewport();await page.screenshot({path:'.local/notification-board-0256.png'});
});

test('desktop pastes an image attachment using the native clipboard event',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await desktop(page);
 await page.getByRole('button',{name:/Interface review/}).first().click();
 await page.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const blob=await new Promise<Blob>(r=>canvas.toBlob(b=>r(b!),'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);});
 await page.locator('.composer textarea').fill('Keep this draft');await page.locator('.composer textarea').press('Control+v');
 await expect(page.locator('.draft-attachment img')).toBeVisible();await expect(page.locator('.composer textarea')).toHaveValue('Keep this draft');
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint?.startsWith('/uploads')).length)).toBe(1);
 await page.locator('.attachment-remove').click();await expect(page.locator('.draft-attachment')).toHaveCount(0);
});

test('creates the board for the clicked project without a board selector',async({page})=>{
 await page.addInitScript(()=>{(window as any).missingProjectBoard=true;});await desktop(page);await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 await expect(page.locator('.project-board-row').filter({hasText:'Garden'})).toHaveCount(0);await expect(page.locator('.project-board-row svg.lucide-chevron-right')).toHaveCount(0);await page.getByRole('button',{name:'Add project board',exact:true}).click();await page.getByLabel('Project for new board').selectOption('C:\\Demo\\Garden');await page.getByRole('button',{name:'Create project board',exact:true}).click();
 const createdName=await page.evaluate(()=>(window as any).createdProjectBoard.name);await expect(page.getByRole('heading',{name:createdName,exact:true})).toBeVisible();await expect(page.locator('.work-boards select')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).createdProjectBoard.root)).toBe('C:\\Demo\\Garden');
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await page.locator('.project-board-row').filter({hasText:'Garden'}).getByRole('button').click();await expect(page.getByRole('button',{name:'Create project board',exact:true})).toHaveCount(0);
});

test('Russian Pocket Code roadmap keeps dependencies as data without visual connectors',async({page})=>{
 await page.addInitScript(board=>{(window as any).projectBoardOverride={...board,id:'7b004a10-920c-4ba7-a070-254318083e90',root:'C:\\Demo\\Atlas',revision:0,repositoryRevision:'a'.repeat(64),repositoryFile:'board-7b004a10-920c-4ba7-a070-254318083e90.json',versionSource:'planned',branches:[],notes:board.notes.map((n:any)=>({...n,owner:'',assigneeIds:[]}))};},roadmap);
 await desktop(page);await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.project-board-row').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).getByRole('button').click();await expect(page.locator('.board-note')).toHaveCount(19);
 await page.locator('.board-viewport').dispatchEvent('wheel',{deltaY:440,ctrlKey:true,clientX:320,clientY:150});await page.screenshot({path:'.local/russian-board-0256.png'});
 expect(roadmap.notes.some((note:{dependencies:string[]})=>note.dependencies.length>0)).toBe(true);
 await expect(page.locator('.board-edges, .board-roadmap-links')).toHaveCount(0);
});
test('built-in board rule can be disabled and re-enabled from project Rules',async({page})=>{
 await desktop(page);await page.getByRole('navigation').getByRole('button',{name:'Rules',exact:true}).click();
 const toggle=page.getByRole('checkbox',{name:'Maintain the project board'});await expect(toggle).toBeChecked();await toggle.uncheck();await expect(toggle).not.toBeChecked();await toggle.check();await expect(toggle).toBeChecked();
 await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.action==='write'&&c.endpoint==='/project-rules').length)).toBe(2);
});
for(const width of [390,1440])test('Miro board embeds, survives reopening and disconnects without deletion at '+width,async({page})=>{
 await page.setViewportSize({width,height:850});await page.route('https://miro.com/**',r=>r.fulfill({contentType:'text/html',body:'<html><body>Miro synthetic board</body></html>'}));
 await page.addInitScript(()=>{(window as any).missingProjectBoard=true;});await desktop(page);await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
 await page.getByRole('button',{name:'Add project board',exact:true}).click();await page.getByLabel('Project for new board').selectOption('C:\\Demo\\Garden');await page.getByLabel('Board type').selectOption('miro');await page.getByLabel('Miro board link').fill('https://miro.com/app/board/synthetic_123=/?share_link_id=discard');await page.getByRole('button',{name:'Connect Miro board',exact:true}).click();
 const frame=page.locator('iframe[title="Miro live board"]');await expect(frame).toHaveAttribute('src','https://miro.com/app/live-embed/synthetic_123=/?autoplay=true&usePostAuth=true');await expect(page.getByRole('link',{name:'Open in browser'})).toHaveAttribute('href','https://miro.com/app/board/synthetic_123=/');
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await page.locator('.project-board-row').filter({hasText:'Garden'}).getByRole('button').click();await expect(frame).toBeVisible();
 await page.getByRole('button',{name:'Disconnect Miro board',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('The Miro board is kept.');await page.getByRole('button',{name:'Disconnect',exact:true}).click();await expect(frame).toHaveCount(0);await expect(page.locator('.project-board-row')).toHaveCount(0);
});
test('Miro connection is in settings and WorkSpace is absent from navigation',async({page})=>{
 await page.addInitScript(()=>{(window as any).missingProjectBoard=true;});await desktop(page);
 await expect(page.getByRole('navigation').getByRole('button',{name:'WorkSpace',exact:true})).toHaveCount(0);
 await page.getByRole('navigation').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Miro',exact:true}).click();
 await page.getByLabel('Miro project').selectOption('C:\\Demo\\Garden');await page.getByLabel('Miro board link').fill('https://miro.com/app/board/synthetic_123=/');await page.getByRole('button',{name:'Connect Miro board'}).click();await expect(page.getByRole('status')).toContainText('Miro board connected');
 await page.getByRole('button',{name:'Disconnect link'}).click();await expect(page.getByRole('button',{name:'Disconnect link'})).toHaveCount(0);
});
test('composer pointer focus uses a soft background without a textarea outline',async({page})=>{
 await desktop(page);await page.getByRole('button',{name:'New',exact:true}).click();const field=page.locator('textarea');await field.click();
 await expect(field).toBeFocused();expect(await field.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
 expect(await page.locator('.composer').evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(field).toBeFocused();expect(await page.locator('.composer').evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');
});
