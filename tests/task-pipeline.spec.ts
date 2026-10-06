import {test,expect,type Page} from '@playwright/test';
import type {TaskRun} from '../server/task-runs';
const runId='33333333-3333-4333-8333-333333333333';
const acceptedTask={title:'Accepted scope: accessible note search',description:'Accepted criteria:\n1. Keyboard focus remains visible.\n2. Escape restores focus to the search button.',branch:'Next',priority:'high' as const};
function syntheticRun():TaskRun{return {id:runId,boardId:'11111111-1111-4111-8111-111111111111',noteId:'22222222-2222-4222-8222-222222222222',noteRevision:'fixture-revision',title:acceptedTask.title,noteSnapshot:{...acceptedTask},provider:'codex',projectPath:'/fixture/project',stage:'questions',revision:1,createdAt:1700000000000,updatedAt:1700000000000,jobs:[],worktree:{runId,projectPath:'/fixture/project',repositoryRoot:'/fixture/project',cwd:'/fixture/tasks/task-one',branch:'pocket/task-one',baseCommit:'a'.repeat(40)}};}
async function setup(page:Page,existing=true,width=390,options:{delayResult?:boolean;delayCreate?:boolean}={}){
  await page.setViewportSize({width,height:844});
  await page.addInitScript(()=>{localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme:'dark',palette:'neutral',scale:100,textSize:16}));});
  let run=syntheticRun(),available=existing,verificationCurrent=false,approvalCurrent=false,rejectSave=false;
  let releaseResult=()=>{},releaseCreate=()=>{},firstResult=true;
  const resultGate=new Promise<void>(resolve=>releaseResult=resolve),createGate=new Promise<void>(resolve=>releaseCreate=resolve);
  const calls:{method:string;path:string;query:URLSearchParams;body:any}[]=[];
  const checks=[{label:'Tests',executable:'npm',args:['test'],timeoutMs:120000}];
  await page.route('https://fixture.invalid/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.method()==='POST'?req.postDataJSON():undefined;
    calls.push({method:req.method(),path,query:url.searchParams,body});
    if(path==='/api/task-runs'&&req.method()==='GET')return route.fulfill({json:{runs:available?[run]:[]}});
    if(path==='/api/task-runs'&&req.method()==='POST'){run={...run,id:body.id,provider:body.provider,worktree:{...run.worktree!,runId:body.id}};available=true;if(options.delayCreate)await createGate;return route.fulfill({json:run});}
    if(path.endsWith('/result')){const snapshot={run:structuredClone(run),verificationCurrent,approvalCurrent};if(firstResult&&options.delayResult){firstResult=false;await resultGate;}return route.fulfill({json:snapshot});}
    if(path.endsWith('/checks')&&req.method()==='GET')return route.fulfill({json:{checks}});
    if(path.endsWith('/checks')&&req.method()==='POST'){
      if(rejectSave){rejectSave=false;run={...run,revision:run.revision+1};return route.fulfill({status:409,json:{error:'The task run changed. Refresh before continuing.'}});}
      run={...run,revision:run.revision+1,verificationPlan:body.checks};return route.fulfill({json:run});
    }
    if(path.endsWith('/check')&&req.method()==='POST'){
      run={...run,revision:run.revision+1,stage:'checks',verificationPlan:body.checks,verification:{status:'running',snapshot:{baseCommit:'a'.repeat(40),headCommit:'a'.repeat(40),branch:'pocket/task-one',fingerprint:'b'.repeat(64)},startedAt:1700000001000,evidence:[]}};
      return route.fulfill({json:run});
    }
    if(path.endsWith('/approve')&&req.method()==='POST'){run={...run,revision:run.revision+1,stage:'approved',approval:{at:1700000005000,revision:run.revision,fingerprint:'b'.repeat(64)}};approvalCurrent=true;return route.fulfill({json:run});}
    if(path===`/api/task-runs/${runId}/review`){
      const file=url.searchParams.get('file');return route.fulfill({json:{files:[{path:'src/search.ts',added:2,removed:1,binary:false},{path:'src/search.test.ts',added:1,removed:0,binary:false}],current:'pocket/task-one',base:'a'.repeat(40),branches:[],projectPath:run.worktree!.cwd,repositoryRoot:run.worktree!.cwd,scope:'task',binary:false,patch:file?'@@ -1 +1,2 @@\n-old\n+'+file+' updated\n+done':''}});
    }
    return route.fulfill({status:404,json:{error:'Unexpected synthetic route'}});
  });
  const base=test.info().project.use.baseURL||'http://127.0.0.1:5173';await page.goto(base+'/tests/fixtures/task-pipeline.html');
  await expect(page.getByRole('button',{name:'Prepare task chat'})).toBeVisible();
  return {calls,releaseResult,releaseCreate,finish(){verificationCurrent=true;run={...run,stage:'review',revision:run.revision+1,verification:{...run.verification!,status:'passed',finishedAt:1700000004000,evidence:[{...checks[0],startedAt:1700000002000,finishedAt:1700000004000,exitCode:0,passed:true,timedOut:false,output:'Synthetic verification passed',truncated:false}]}};},invalidate(){verificationCurrent=false;approvalCurrent=false;},conflict(){rejectSave=true;}};
}

test('saved repository note prepares an isolated draft with selected provider and stable source card',async({page})=>{
  const state=await setup(page,false);
  await page.getByRole('checkbox',{name:'Unsaved note'}).check();await expect(page.getByRole('button',{name:'Prepare task chat'})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Unsaved note'}).uncheck();await page.getByRole('combobox',{name:'Provider',exact:true}).selectOption('claude');
  await page.getByRole('button',{name:'Prepare task chat'}).click();
  const output=page.getByTestId('chat-target');await expect(output).toContainText('/fixture/tasks/task-one');
  const target=JSON.parse((await output.textContent())!);expect(target.taskRun.provider).toBe('claude');expect(target.note.id).toBe('22222222-2222-4222-8222-222222222222');expect(target.prompt).toContain('Do not merge, publish or approve your own result');
  expect(target.prompt).toContain(acceptedTask.title+'\n\n'+acceptedTask.description);
  expect(target.prompt).not.toContain('Accessible search for project notes');expect(target.prompt).not.toContain('Add keyboard navigation and a clear empty state.');
  const call=state.calls.find(call=>call.method==='POST');expect(call?.body.noteRevision).toBe('fixture-revision');expect(call?.body.root).toBe('/fixture/project');expect(state.calls.some(call=>call.path==='/api/jobs')).toBe(false);
});

for(const width of [390,1440])test(`task checks and approval remain tied to a current snapshot at ${width}px`,async({page})=>{
  const state=await setup(page,true,width);await page.getByRole('button',{name:/codex · Needs an answer/}).click();
  const dialog=page.getByRole('dialog',{name:'Task result',exact:true});await expect(dialog).toBeVisible();
  const criteria=dialog.locator('details').filter({has:page.locator('summary').getByText('Accepted task and criteria',{exact:true})});
  await criteria.locator('summary').click();await expect(criteria.locator('p')).toHaveText(acceptedTask.description);await expect(dialog.getByRole('heading',{name:acceptedTask.title,exact:true})).toBeVisible();
  const approve=dialog.getByRole('button',{name:'Approve checked result'});await expect(approve).toBeDisabled();
  await dialog.getByRole('button',{name:'Use project scripts'}).click();await expect(dialog.locator('.task-check-plan')).toContainText('npm test');
  await dialog.getByRole('button',{name:'Save automatic checks'}).click();await expect(dialog.getByRole('button',{name:'Save automatic checks'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Run checks now'}).click();await expect(dialog.getByRole('button',{name:'Checking…'})).toBeDisabled();await expect(approve).toBeDisabled();
  state.finish();await dialog.getByRole('button',{name:'Refresh task',exact:true}).click();await expect(approve).toBeEnabled();
  await dialog.locator('.task-check-evidence summary').filter({hasText:'Tests · 0'}).click();await expect(dialog).toContainText('Synthetic verification passed');
  await page.screenshot({path:`.local/task-pipeline-${width}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await approve.click();await expect(dialog.getByRole('status')).toHaveText('Approved');await expect(approve).toBeDisabled();
  state.invalidate();await dialog.getByRole('button',{name:'Refresh task',exact:true}).click();await expect(dialog).toContainText('approval is no longer current');await expect(dialog).toContainText('working copy changed; recheck required');await expect(approve).toBeDisabled();
  expect(state.calls.filter(call=>call.method==='POST').map(call=>call.path.split('/').at(-1))).toEqual(['checks','check','approve']);
});

test('revision conflict preserves drafted checks and reports the failed save',async({page})=>{
  const state=await setup(page);await page.getByRole('button',{name:/codex · Needs an answer/}).click();
  const dialog=page.getByRole('dialog',{name:'Task result',exact:true});await dialog.getByRole('button',{name:'Use project scripts'}).click();state.conflict();
  await dialog.getByRole('button',{name:'Save automatic checks'}).click();await expect(dialog.getByRole('alert')).toHaveText('The task run changed. Refresh before continuing.');
  await expect(dialog.locator('.task-check-plan')).toContainText('npm test');await expect(dialog.getByRole('button',{name:'Save automatic checks'})).toBeEnabled();
});

test('task diff and each file use the isolated task review endpoint',async({page})=>{
  const state=await setup(page);await page.getByRole('button',{name:/codex · Needs an answer/}).click();
  await page.getByRole('button',{name:'Review task changes'}).click();const review=page.getByRole('dialog',{name:'Review',exact:true});await expect(review).toBeVisible();
  await expect(review.locator('.review-file')).toHaveCount(2);await expect(review).toContainText('src/search.ts updated');
  await review.locator('.review-file').nth(1).scrollIntoViewIfNeeded();await expect(review).toContainText('src/search.test.ts updated');
  expect(state.calls.filter(call=>call.path.endsWith('/review')).map(call=>call.query.get('file'))).toContain('src/search.ts');
  expect(state.calls.some(call=>call.path==='/api/review')).toBe(false);
});

test('late initial task status cannot erase a saved verification plan',async({page})=>{
  const state=await setup(page,true,390,{delayResult:true});await page.getByRole('button',{name:/codex · Needs an answer/}).click();
  const dialog=page.getByRole('dialog',{name:'Task result',exact:true});await dialog.getByRole('button',{name:'Use project scripts'}).click();
  await dialog.getByRole('button',{name:'Save automatic checks'}).click();await expect(dialog.getByRole('button',{name:'Save automatic checks'})).toBeDisabled();
  const response=page.waitForResponse(response=>response.url().endsWith('/result'));state.releaseResult();await response;
  await expect(dialog.locator('.task-check-plan')).toContainText('npm test');await expect(dialog.getByRole('button',{name:'Run checks now'})).toBeEnabled();
});

test('closing a note during preparation does not reopen a chat from the late response',async({page})=>{
  const state=await setup(page,false,390,{delayCreate:true});await page.getByRole('button',{name:'Prepare task chat'}).click();
  await expect.poll(()=>state.calls.some(call=>call.method==='POST'&&call.path==='/api/task-runs')).toBe(true);
  await page.getByRole('checkbox',{name:'Show task controls'}).uncheck();
  const response=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/task-runs'));state.releaseCreate();await response;
  await expect(page.getByTestId('chat-target')).toHaveText('null');
});

async function fullAppTask(page:Page,desktop:boolean){
  const calls:{path:string;method:string;body:any}[]=[];let run:TaskRun|null=null,job:any=null;
  const note={id:'22222222-2222-4222-8222-222222222222',title:'Accessible search for project notes',description:'Synthetic acceptance: keyboard navigation preserves focus.',branch:'Next',status:'ready',priority:'normal',owner:'',x:24,y:96,dependencies:[]};
  const board={id:'11111111-1111-4111-8111-111111111111',name:'Synthetic roadmap',root:'/fixture/project',notes:[note],revision:3,repositoryRevision:'fixture-revision',repositoryFile:'board-fixture.json',versionSource:'planned',versions:['Next'],branches:[]};
  const respond=(endpoint:string,body?:any)=>{
    const url=new URL(endpoint,'https://fixture.invalid'),path=url.pathname.replace(/^\/api/,'');calls.push({path,method:body===undefined?'GET':'POST',body});
    if(path==='/health')return {name:'Synthetic host',roots:['/fixture/project'],protocol:1,version:'0.25.11'};
    if(path==='/projects')return ['/fixture/project'];
    if(path==='/providers')return ['claude','codex','copilot'].map(id=>({id,name:id,available:true,authenticated:true,models:[]}));
    if(path==='/workspaces')return {host:true,workspaces:[],boards:[]};
    if(path==='/project-board')return {board,canEdit:true};
    if(path==='/board-notifications'||path==='/task-notifications')return {items:[],unread:0};
    if(path==='/activity/events')return {events:[],now:Date.now()};
    if(path==='/task-runs'){
      if(body)run={...syntheticRun(),id:body.id,provider:body.provider,worktree:{...syntheticRun().worktree!,runId:body.id}};
      return body?run:{runs:run?[run]:[]};
    }
    if(path.startsWith('/task-runs/'))return path.endsWith('/result')?{run,verificationCurrent:false,approvalCurrent:false}:path.endsWith('/checks')?{checks:[]}:run;
    if(path==='/jobs'){
      if(body){job={...body,sessionId:'task-session',status:'running',startedAt:1700000000000,revision:1,baseMessageCount:0,messages:[],partial:'Synthetic task in progress',approvals:[]};if(run)run={...run,stage:'working',sessionId:job.sessionId,jobs:[job.id]};}
      return body?job:job?[job]:[];
    }
    if(path.startsWith('/jobs/'))return job;
    if(path==='/sessions'||path==='/activity')return [];
    if(path.endsWith('/messages'))return {messages:[],previous:null,next:null};
    if(path==='/review/availability')return {available:false};
    if(path==='/usage')return {available:false};
    return {};
  };
  await page.setViewportSize({width:desktop?1440:390,height:900});
  await page.addInitScript(({desktop})=>{
    localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-workspace','claude');localStorage.setItem('pocket-desktop-provider','claude');
    localStorage.setItem('pocket-desktop-project-codex','/fixture/previous-project');
    if(!desktop)sessionStorage.setItem('connection',JSON.stringify({url:'https://fixture.invalid',token:'synthetic-test-only'}));
    else {
      const listeners:((event:{data:unknown})=>void)[]=[];
      Object.assign(window,{chrome:{webview:{addEventListener:(_name:string,listener:(event:{data:unknown})=>void)=>listeners.push(listener),postMessage:(message:any)=>{
        const respond=(value:unknown)=>listeners.forEach(listener=>listener({data:{id:message.id,value}}));
        if(message.action==='state'){respond({online:true,busy:false,status:'Synthetic host',startup:false,autoReconnect:false,internet:false,addresses:[],jira:false});return;}
        if(message.action==='notification-pending'){respond({chat:null});return;}
        if(message.action==='read'||message.action==='write'){void (window as any).taskFixtureRequest(message.endpoint,message.data).then(respond);return;}
        respond(true);
      }}}});
    }
  },{desktop});
  await page.exposeFunction('taskFixtureRequest',respond);
  await page.route('https://fixture.invalid/api/**',async route=>route.fulfill({json:respond(route.request().url(),route.request().method()==='POST'?route.request().postDataJSON():undefined)}));
  await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+(desktop?'/?desktop=1':'/'));
  if(desktop)await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();
  const card=page.locator('.project-board-row').filter({hasText:'Synthetic roadmap'});await card.getByRole('button').click();
  await page.locator('.note-content').click();const dialog=page.getByRole('dialog',{name:'Note details',exact:true});
  await dialog.getByRole('combobox',{name:'Provider',exact:true}).selectOption('codex');
  await dialog.getByRole('button',{name:'Prepare task chat',exact:true}).click();
  return {calls,getRun:()=>run};
}

for(const desktop of [true,false])test(`${desktop?'desktop':'mobile'} board task switches provider and sends in its isolated working copy`,async({page})=>{
  const state=await fullAppTask(page,desktop);const input=page.locator('.composer textarea');
  await expect(input).toHaveValue(/Implementation working copy: \/fixture\/tasks\/task-one/);
  const prompt=await input.inputValue();expect(prompt).toContain(acceptedTask.title+'\n\n'+acceptedTask.description);expect(prompt).not.toContain('Synthetic acceptance: keyboard navigation preserves focus.');
  const chat=page.locator(desktop?'.embedded-chat':'.app');await expect(chat.locator('.chat-start-context')).toHaveCount(0);
  await expect(chat.locator('.project-picker')).toHaveCount(0);await expect(chat.locator('.workspace-picker-header')).toHaveCount(0);
  expect(state.calls.some(call=>call.path==='/jobs'&&call.method==='POST')).toBe(false);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>state.calls.find(call=>call.path==='/jobs'&&call.method==='POST')).toMatchObject({body:{provider:'codex',cwd:'/fixture/tasks/task-one',taskRunId:state.getRun()!.id}});
  expect(state.calls.find(call=>call.path==='/jobs'&&call.method==='POST')!.body.text).toBe(prompt);
  await expect(page.locator('.conversation')).toContainText('Synthetic task in progress');
  if(desktop){
    await page.locator('.desktop-rail').getByRole('combobox',{name:'Provider',exact:true}).selectOption('claude');
    await expect(page.locator('.desktop-chat-host')).toHaveCount(0);
  }
});
