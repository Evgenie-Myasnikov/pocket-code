import {test,expect,type Page} from '@playwright/test';

export async function desktop(page:Page){
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
   if(p==='/project-board/image'){if(message.data){(window as any).boardImageData=message.data.data;reply(id,{path:'project-boards/assets/'+'a'.repeat(64)+'.png',caption:message.data.caption});}else reply(id,{mimeType:(window as any).boardImageMimeType||'image/png',data:(window as any).boardImageData||sampleImage});return;}
   if(p==='/project-board/delete'){(window as any).deletedRoot=message.data.root;reply(id,{ok:true});return;}
   if(p==='/project-board/create'){(window as any).createdProjectBoard={id:'22222222-2222-4222-8222-222222222222',name:'Project board',root:message.data.root,repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'b'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]};reply(id,(window as any).createdProjectBoard);return;}
   if(p==='/project-board/live'){const board=(window as any).projectBoardOverride,version=board?.repositoryRevision||'a'.repeat(64);reply(id,{version,activity:(window as any).testBoardActivity||null,...(board&&url.searchParams.get('known')!==version?{board}:{unchanged:true})});return;}
   if(p==='/project-board'){if((window as any).deletedRoot===url.searchParams.get('root')){reply(id,{board:null});return;}if((window as any).projectBoardOverride){if(message.data){Object.assign((window as any).projectBoardOverride,message.data);reply(id,(window as any).projectBoardOverride);}else reply(id,{board:(window as any).projectBoardOverride});return;}if((window as any).missingProjectBoard){reply(id,{board:(window as any).createdProjectBoard||null,miro:(window as any).miroBoard?.root===url.searchParams.get('root')?(window as any).miroBoard:null});return;}reply(id,{board:{id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:url.searchParams.get('root'),repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]}});return;}
   if(p==='/repository-board'){reply(id,{id:'22222222-2222-4222-8222-222222222222',name:'Shared roadmap',root:url.searchParams.get('root'),repositoryFile:url.searchParams.get('file'),revision:0,source:'project-changelog',versionSource:'planned',notes:[],versions:[],branches:[]});return;}
   if(p==='/board-snapshots'||p==='/repository-boards'){reply(id,[{file:'board-11111111-1111-4111-8111-111111111111.json',name:'Shared roadmap',noteCount:0}]);return;}
   if(p==='/board-snapshots/import'){const board={id:'22222222-2222-4222-8222-222222222222',name:'Shared roadmap',root:message.data.root,revision:0,versionSource:'planned',notes:[],versions:[]};(window as any).testBoards=[board];reply(id,board);return;}
   if(/^\/boards\/[^/]+\/snapshot$/.test(p)){reply(id,{path:'project-boards/board-22222222-2222-4222-8222-222222222222.json'});return;}
   if(/^\/boards\/[^/]+\/delete$/.test(p)){(window as any).testBoards=[];reply(id,{ok:true});return;}
   if(/^\/boards\/[^/]+$/.test(p)){reply(id,(window as any).testBoards?.find((b:any)=>b.id===p.split('/')[2]));return;}
   if(p==='/uploads'){reply(id,{id:(window as any).uniqueUploads?crypto.randomUUID():'pasted-image',name:message.data.name,size:atob(message.data.base64||'').length||100});return;}
   if(p==='/activity'){reply(id,(window as any).testActivity||[]);return;}
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
   if(/^\/jobs\/[^/]+\/messages$/.test(p)&&action==='write'){if((window as any).rejectNextFollowup){(window as any).rejectNextFollowup=false;queueMicrotask(()=>listeners.forEach(listener=>listener({data:{id,error:'Synthetic turn closing',status:409}})));return;}const run=(window as any).testRuns.find((r:any)=>r.id===p.split('/')[2]);run.revision++;reply(id,run);return;}
   if(p.startsWith('/jobs/')&&(window as any).expiredBoardJobs){queueMicrotask(()=>listeners.forEach(listener=>listener({data:{id,error:'Synthetic expired job',code:'host_response',status:404}})));return;}
   if(p.startsWith('/jobs/')){reply(id,((window as any).testRuns||[]).find((run:any)=>run.id===p.split('/').pop()));return;}
   if(p==='/review/availability'){reply(id,{available:true,mode:'working'});return;}
   if(p.endsWith('/messages')){const earlier=url.searchParams.has('end'),start=url.searchParams.has('offset');reply(id,{messages:earlier?[messageBlock('older','Earlier project context')]:[messageBlock('answer',p.includes('/beta/')?'Garden documentation':'## Interface review\n\nThe responsive layout is ready.\n\n```ts\nconst layout = "adaptive";\n```'),{id:'picture',role:'assistant',blocks:[{type:'image',source:{type:'base64',media_type:'image/png',data:sampleImage}}]}],previous:earlier||start?null:5,next:null});return;}
   if(p==='/review'){const file=url.searchParams.get('file');reply(id,{files:[{path:'src/layout.ts',added:2,removed:1,binary:false}],current:'main',base:'main',branches:['main'],repositoryRoot:url.searchParams.get('cwd'),patch:file?'@@ -1 +1,2 @@\n-old\n+adaptive\n+responsive':'',binary:false});return;}
   reply(id,{});
  }}};
 });
 await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+'/?desktop=1');
 await expect(page.getByRole('button',{name:/claude · Interface review/})).toBeVisible();
}

export async function desktopSection(page:Page,name:string){
 const button=page.locator('.desktop-rail').getByRole('button',{name,exact:true});if(await button.count()){await button.click();return;}await page.locator('.desktop-rail').getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();
}
