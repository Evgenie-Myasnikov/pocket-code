import {test,expect,type Page} from '@playwright/test';

const root='C:\\Workspace\\jira-demo';
const issue=(number:number,extra:Record<string,unknown>={})=>({key:`DEMO-${number}`,summary:`Task ${number}`,description:`Requirements for task ${number}.`,status:'Open',priority:'Medium',issueType:'Task',url:`https://example.atlassian.net/browse/DEMO-${number}`,updated:'',...extra});
const transition=(id:string,fields:Record<string,unknown>={})=>({id,name:'Proceed',to:{id:`status-${id}`,name:'Ready for QA'},fields});
type State={queries:URL[];actions:any[];batches:any[];recoveries:any[];previews:number;view:any;queue:any;issues?:(url:URL)=>{issues:any[];next:string|null}};
async function fixture(page:Page,custom:Partial<State>={}){
  const state:State={queries:[],actions:[],batches:[],recoveries:[],previews:0,queue:{paused:true,items:[]},view:{issue:issue(1),stage:'open',role:'developer',actions:[{id:'start_development',label:'Start development',kind:'start',transitions:[transition('start')]}]},...custom};
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic Jira PC',protocol:1,version:'0.11.0',roots:[root]}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions'||endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:true,source:'claude',sites:[{id:'site-a',name:'Example Jira',url:'https://example.atlassian.net'},{id:'site-b',name:'Second Jira',url:'https://second.example.atlassian.net'}]}});
    if(endpoint==='/jira/issues'){state.queries.push(url);return route.fulfill({json:state.issues?.(url)||{issues:[issue(1),issue(2)],next:null}});}
    if(endpoint==='/jira/issue')return route.fulfill({json:state.view.issue});
    if(endpoint==='/jira/workflow')return route.fulfill({json:{...state.view,role:url.searchParams.get('role')}});
    if(endpoint==='/jira/workflow/pr'){state.previews++;return route.fulfill({json:{ready:true,base:'main',head:'feature/demo',headSha:'a'.repeat(40),files:['src/example.ts'],commits:2}});}
    if(endpoint==='/jira/workflow/action'){const data=route.request().postDataJSON();state.actions.push(data);state.view={...state.view,issue:{...state.view.issue,status:'Ready for QA'},actions:[]};return route.fulfill({json:{view:state.view}});}
    if(endpoint==='/jira/workflow/recover'){state.recoveries.push(route.request().postDataJSON());delete state.view.pending;return route.fulfill({json:{view:state.view}});}
    if(endpoint==='/jira/queue'){
      if(route.request().method()==='POST'){const body=route.request().postDataJSON();state.batches.push(body);state.queue={paused:false,items:body.keys.map((key:string)=>({id:key,key,cwd:root,status:'queued'}))};}
      return route.fulfill({json:state.queue});
    }
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });
  return state;
}
async function connect(page:Page,language='en'){
  await page.goto('http://127.0.0.1:5173');await page.getByLabel(language==='ru'?'Адрес компьютера':'Computer address').fill('http://127.0.0.1:4319');await page.getByLabel(language==='ru'?'Ключ подключения':'Connection key').fill('test-only-'.repeat(5));await page.getByRole('button',{name:language==='ru'?'Подключить компьютер':'Connect computer',exact:true}).click();
  await page.locator('.mobile-nav').getByRole('button',{name:language==='ru'?'Задачи':'Tasks',exact:true}).click();await expect(page.getByRole('button',{name:'Task 1',exact:true})).toBeVisible();
}
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});});
test.use({hasTouch:true,isMobile:true});

test('required time estimate is entered before a task transition and is not a worklog',async({page})=>{
 const state=await fixture(page,{view:{issue:issue(1),stage:'open',role:'developer',actions:[{id:'start_development',label:'Start development',kind:'start',transitions:[transition('start',{timetracking:{name:'Time tracking',required:true,schema:{type:'timetracking',system:'timetracking'}}})]}]}});
 await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();await page.getByRole('button',{name:'Start development',exact:true}).click();
 const submit=page.locator('.jira-form-actions').getByRole('button',{name:'Start development',exact:true});await expect(submit).toBeDisabled();
 await page.getByLabel('Time estimate',{exact:true}).fill('0m');await expect(submit).toBeDisabled();
 await page.getByLabel('Time estimate',{exact:true}).fill('2h');await expect(submit).toBeEnabled();await submit.click();
 await expect.poll(()=>state.actions.length).toBe(1);expect(state.actions[0].fields).toEqual({timetracking:{originalEstimate:'2h'}});
});

test('search and category preserve selection; select all matches every page and requires a batch confirmation',async({page})=>{
  const state=await fixture(page,{issues:url=>url.searchParams.get('search')==='render'&&url.searchParams.get('type')==='Bug'?url.searchParams.get('cursor')?{issues:[issue(3,{summary:'Render task 3',issueType:'Bug'})],next:null}:{issues:[issue(2,{summary:'Render task 2',issueType:'Bug'})],next:'page-2'}:{issues:[issue(1)],next:null}});
  await connect(page);await expect(page.getByLabel('Project folder for Claude')).toHaveCount(0);await page.getByRole('button',{name:'Select tasks',exact:true}).click();await page.getByLabel('Select DEMO-1',{exact:true}).check();
  await page.getByLabel('Search issues').fill('render');await page.locator('.jira-more-filters summary').click();await page.getByLabel('Issue type',{exact:true}).fill('Bug');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await expect(page.getByRole('button',{name:'Render task 2',exact:true})).toBeVisible();await expect(page.getByText('Selected: 1',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Select all matching',exact:true}).click();await expect(page.getByLabel('Select DEMO-3',{exact:true})).toBeChecked();await expect(page.getByText('Selected: 2',{exact:true})).toBeVisible();
  expect(state.queries.some(url=>url.searchParams.get('cursor')==='page-2'&&url.searchParams.get('search')==='render'&&url.searchParams.get('type')==='Bug')).toBe(true);
  await page.getByRole('button',{name:'Continue',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Start selected tasks'});await expect(dialog).toContainText('Start 2 tasks?');await expect(dialog).toContainText('Developer');expect(state.batches).toHaveLength(0);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.batches).toHaveLength(0);await page.getByRole('button',{name:'Continue',exact:true}).click();await dialog.getByRole('button',{name:'Start selected (2)',exact:true}).click();
  await expect.poll(()=>state.batches.length).toBe(1);expect(state.batches[0]).toMatchObject({keys:['DEMO-2','DEMO-3'],role:'developer',cwd:root,mode:'default'});expect(state.batches[0].batchId).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Jira role persists through reload and detail shows only eligible actions with required fields',async({page})=>{
  const state=await fixture(page,{view:{issue:issue(1,{status:'PR Review'}),stage:'pr_review',actions:[{id:'approve_review',label:'Approve review',kind:'transition',transitions:[transition('approve',{resolution:{name:'Resolution',required:true,schema:{type:'option'},allowedValues:[{id:'1',name:'Verified'}]}})]}]}});
  await connect(page);await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();await page.getByLabel('Jira role').selectOption('reviewer');await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Jira',exact:true}).click();await expect(page.getByLabel('Jira role')).toHaveValue('reviewer');
  await page.locator('.mobile-nav').getByRole('button',{name:'Tasks',exact:true}).click();await page.getByRole('button',{name:'Task 1',exact:true}).click();await expect(page.getByLabel('Search issues')).toHaveCount(0);await expect(page.getByRole('button',{name:'Start development',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Approve review',exact:true}).click();await expect(page.getByRole('button',{name:'Approve review',exact:true})).toBeDisabled();await page.getByLabel('Resolution *',{exact:true}).selectOption('0');await page.getByRole('button',{name:'Approve review',exact:true}).click();
  await expect.poll(()=>state.actions.length).toBe(1);expect(state.actions[0]).toMatchObject({role:'reviewer',action:'approve_review',transitionId:'approve',fields:{resolution:{id:'1'}}});
  await page.getByRole('button',{name:'Back to issues',exact:true}).click();await expect(page.getByLabel('Search issues')).toBeVisible();
});

test('unsupported required fields block an action and expose Jira; changing target status resets fields',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pocket-code-jira-role-v1','qa'));
  const state=await fixture(page,{view:{issue:issue(1,{status:'In QA'}),stage:'qa',actions:[{id:'pass_qa',label:'Pass QA',kind:'transition',transitions:[transition('unsupported',{reviewer:{name:'Reviewer account',required:true,schema:{type:'user'}}}),{...transition('supported',{note:{name:'Test result',required:true,schema:{type:'string'}}}),to:{id:'done',name:'Done'}}]}]}});
  await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();await page.getByRole('button',{name:'Pass QA',exact:true}).click();await expect(page.getByRole('button',{name:'Pass QA',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('Reviewer account');await expect(page.getByRole('alert').getByRole('link',{name:'Open in Jira'})).toBeVisible();
  await page.getByLabel('New status',{exact:true}).selectOption('supported');await page.getByLabel('Test result *',{exact:true}).fill('Passed on test device');await page.getByRole('button',{name:'Pass QA',exact:true}).click();await expect.poll(()=>state.actions.length).toBe(1);expect(state.actions[0]).toMatchObject({role:'qa',transitionId:'supported',fields:{note:'Passed on test device'}});
});

test('Send for review shows a PR preview and waits for explicit final confirmation',async({page})=>{
  const state=await fixture(page,{view:{issue:issue(1,{status:'In Development'}),stage:'development',actions:[{id:'submit_review',label:'Send for review',kind:'pr',transitions:[transition('review')]}]}});
  await connect(page);expect(state.previews).toBe(0);await page.getByRole('button',{name:'Task 1',exact:true}).click();expect(state.previews).toBe(0);await page.getByRole('button',{name:'Send for review',exact:true}).click();await expect(page.getByText('feature/demo',{exact:true})).toBeVisible();await expect(page.getByText('Commits: 2',{exact:true})).toBeVisible();expect(state.actions).toHaveLength(0);
  await page.getByLabel('PR title').fill('DEMO-1: Reviewed change');await page.getByRole('button',{name:'Refresh issue',exact:true}).click();await expect.poll(()=>state.previews).toBe(2);await expect(page.getByLabel('PR title')).toHaveValue('DEMO-1: Reviewed change');
  await page.getByRole('button',{name:'Create PR and send for review',exact:true}).click();await expect.poll(()=>state.actions.length).toBe(1);expect(state.actions[0].pullRequest).toMatchObject({title:'DEMO-1: Reviewed change',headSha:'a'.repeat(40),base:'main',head:'feature/demo'});
});

test('empty filtered pages are followed and changing site clears selection',async({page})=>{
  const state=await fixture(page,{issues:url=>url.searchParams.get('statusCategory')==='indeterminate'?(url.searchParams.get('cursor')?{issues:[issue(2,{summary:'Review task'})],next:null}:{issues:[],next:'filtered-page'}):{issues:[issue(1)],next:null}});
  await connect(page);await page.getByRole('button',{name:'Select tasks',exact:true}).click();await page.getByLabel('Select DEMO-1',{exact:true}).check();await page.getByLabel('Status category').selectOption('indeterminate');await expect(page.getByRole('button',{name:'Review task',exact:true})).toBeVisible();expect(state.queries.some(url=>url.searchParams.get('cursor')==='filtered-page')).toBe(true);await expect(page.getByText('Selected: 1',{exact:true})).toHaveCount(0);
  await page.locator('.jira-site-picker summary').click();await page.getByLabel('Jira site',{exact:true}).selectOption('site-b');await expect(page.getByText('Selected: 1',{exact:true})).toHaveCount(0);
});

test('interrupted workflow recovery explains consequences and needs a second explicit confirmation',async({page})=>{
  const state=await fixture(page,{view:{issue:issue(1),stage:'development',actions:[{id:'continue_development',label:'Continue development',kind:'start',transitions:[]}],pending:{id:'interrupted-id',action:'start_development',phase:'job_pending',provider:'claude',message:'Check the existing chat before retrying.'}}});
  await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();await expect(page.getByRole('button',{name:'Continue development',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Clear interrupted action',exact:true}).click();await expect(page.getByText(/This does not undo changes in Jira/)).toBeVisible();expect(state.recoveries).toHaveLength(0);
  await page.getByRole('button',{name:'Checked — clear action',exact:true}).click();await expect.poll(()=>state.recoveries.length).toBe(1);expect(state.recoveries[0]).toMatchObject({id:'interrupted-id',confirmed:true,provider:'claude',role:'developer'});await expect(page.getByLabel('Interrupted action')).toHaveCount(0);
});

test('full description loads independently of workflow actions and an empty list preview',async({page})=>{
  await fixture(page,{issues:()=>({issues:[issue(1,{description:''})],next:null}),view:{issue:issue(1,{description:'Full details loaded independently of transitions.'}),stage:'open',actions:[]}});
  await page.route('**/api/jira/workflow?*',route=>route.fulfill({status:503,json:{error:'Synthetic transition outage'}}));
  await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();
  await expect(page.getByText('Full details loaded independently of transitions.',{exact:true})).toBeVisible();await expect(page.getByText('No description',{exact:true})).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('HTTP 503');
});

test('HTML description preserves readable structure without scripts or automatic external resources',async({page})=>{
  const requests:string[]=[];await page.route('https://attachments.example/**',route=>{requests.push(route.request().url());return route.abort();});
  await fixture(page,{view:{issue:issue(1,{descriptionFormat:'html',description:'<h3>Acceptance criteria</h3><ol><li>Keep the first step</li><li><strong>Check the result</strong></li></ol><pre><code>status = ready</code></pre><a href="/browse/DEMO-2" onclick="window.jiraScriptExecuted = true">Related task</a><a href="javascript:alert(1)">Unsafe link text</a><img src="https://attachments.example/diagram.png" alt="Design diagram" onerror="window.jiraScriptExecuted = true"><script>window.jiraScriptExecuted = true</script><iframe src="https://attachments.example/frame"></iframe><style>body {display:none}</style>'}),stage:'open',actions:[]}});
  await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();const description=page.locator('.jira-description');
  await expect(description.getByRole('heading',{name:'Acceptance criteria'})).toBeVisible();await expect(description.locator('ol li')).toHaveCount(2);await expect(description.locator('pre code')).toHaveText('status = ready');
  await expect(description.getByRole('link',{name:'Related task'})).toHaveAttribute('href','https://example.atlassian.net/browse/DEMO-2');await expect(description.getByRole('link',{name:'Design diagram'})).toHaveAttribute('href','https://attachments.example/diagram.png');await expect(description.getByText('Unsafe link text',{exact:true})).toBeVisible();
  await expect(description.locator('script,style,iframe,img,[onclick],[onerror],a[href^="javascript:"]')).toHaveCount(0);expect(await page.evaluate(()=>Boolean((window as any).jiraScriptExecuted))).toBe(false);expect(requests).toEqual([]);
});

test('Markdown description keeps lists code and links with images loaded only on request',async({page})=>{
  const requests:string[]=[];await page.route('https://attachments.example/**',route=>{requests.push(route.request().url());return route.abort();});
  await fixture(page,{view:{issue:issue(1,{descriptionFormat:'markdown',description:'### Test plan\n\n1. Open the screen\n2. Check **the result**\n\n```js\nstatus = ready\n```\n\n[Reference](https://example.com/guide)\n\n![Design diagram](https://attachments.example/diagram.png)'}),stage:'open',actions:[]}});
  await connect(page);await page.getByRole('button',{name:'Task 1',exact:true}).click();const description=page.locator('.jira-description');
  await expect(description.getByRole('heading',{name:'Test plan'})).toBeVisible();await expect(description.locator('ol li')).toHaveCount(2);await expect(description.locator('pre code')).toContainText('status = ready');await expect(description.getByRole('link',{name:'Reference'})).toHaveAttribute('href','https://example.com/guide');await expect(description.getByRole('button',{name:/Load external image.*Design diagram/})).toBeVisible();await expect(description.locator('img')).toHaveCount(0);expect(requests).toEqual([]);
});

for(const profile of [{width:360,height:760,language:'ru',scale:100},{width:320,height:640,language:'en',scale:130}])test(`Jira progressive screens fit ${profile.width}px ${profile.language} at ${profile.scale}%`,async({page})=>{
  await page.setViewportSize(profile);await page.addInitScript(value=>{localStorage.setItem('pocket-code-language-v1',value.language);localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'dark',textSize:14,scale:value.scale,spacing:1.6,compact:false}));},profile);
  const state=await fixture(page,{view:{issue:issue(1),stage:'open',actions:[{id:'start_development',label:'Start development',kind:'start',transitions:[transition('start',{target:{name:'Target version',required:true,schema:{type:'option'},allowedValues:[{id:'version-1',name:'Next release'}]}})]}]}});
  const ru=profile.language==='ru';await connect(page,profile.language);
  await expect(page.locator('.jobs-panel h2',{hasText:'Jobs'})).toHaveCount(0);await expect(page.getByLabel(ru?'Сайт Jira':'Jira site',{exact:true})).toBeHidden();
  const check=async(screen:string)=>{
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const controls=await page.locator('.jobs-panel button,.jobs-panel select,.jobs-panel input:not([type=checkbox]),.jobs-panel summary,.jobs-panel .jira-check').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).map(element=>({label:element.textContent?.slice(0,35),height:element.getBoundingClientRect().height})));
    for(const item of controls)expect(item.height,`${screen}: ${item.label}`).toBeGreaterThanOrEqual(47);
    await page.locator('.jobs-panel').evaluate(element=>{element.scrollTop=0;});await page.screenshot({path:`artifacts/screenshots/jira-${profile.width}-${profile.scale}-${profile.language}-${screen}.png`,fullPage:true});
  };
  await page.getByRole('button',{name:ru?'Выбрать задачи':'Select tasks',exact:true}).click();await page.getByLabel(ru?'Выбрать DEMO-1':'Select DEMO-1',{exact:true}).check();await check('list');
  await page.getByRole('button',{name:'Task 1',exact:true}).click();await expect(page.getByRole('button',{name:ru?'К списку задач':'Back to issues',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:ru?'Начать разработку':'Start development',exact:true})).toBeVisible();await check('detail');
  await page.getByRole('button',{name:ru?'Начать разработку':'Start development',exact:true}).click();await expect(page.getByLabel('Target version *',{exact:true})).toBeVisible();await check('required-fields');
  await page.getByRole('button',{name:ru?'К задаче':'Back to issue',exact:true}).click();state.view={issue:issue(1,{status:'In Development'}),stage:'development',actions:[{id:'submit_review',label:'Send for review',kind:'pr',transitions:[transition('review')]}]};await page.getByRole('button',{name:ru?'Обновить задачу':'Refresh issue',exact:true}).click();await page.getByRole('button',{name:ru?'Отправить на ревью':'Send for review',exact:true}).click();await expect(page.getByLabel(ru?'Название PR':'PR title')).toBeVisible();await check('pr-preview');
});


test('Jira basic filters combine actual project status type and status category',async({page})=>{
 const state=await fixture(page);await connect(page);await page.getByLabel('Status category').selectOption('indeterminate');
 await page.locator('.jira-more-filters summary').click();await page.getByLabel('Jira project',{exact:true}).fill('DEMO');await page.getByLabel('Status',{exact:true}).fill('PR Review');await page.getByLabel('Issue type',{exact:true}).fill('Custom Task');await page.getByRole('button',{name:'Apply filters',exact:true}).click();
 await expect.poll(()=>state.queries.some(url=>url.searchParams.get('project')==='DEMO'&&url.searchParams.get('status')==='PR Review'&&url.searchParams.get('type')==='Custom Task'&&url.searchParams.get('statusCategory')==='indeterminate')).toBe(true);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect.poll(()=>state.queries.at(-1)?.searchParams.has('project')).toBe(false);
});
for(const scale of [60,100,130])test('task typography follows saved scale '+scale,async({page})=>{
 await page.addInitScript(scale=>localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:8})),scale);await fixture(page);await connect(page);
 const font=()=>page.locator('.jira-issue-title').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));const savedFont=await font();expect(savedFont).toBeGreaterThanOrEqual(13);
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Tasks',exact:true}).click();expect(await font()).toEqual(savedFont);
 await page.screenshot({path:'artifacts/screenshots/tasks-scale-'+scale+'.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const scale of [60,100,130])test(`task typography matches settings at ${scale}%`,async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(scale=>localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:9})),scale);
  await fixture(page);await connect(page);
  const title=await page.locator('.jira-issue-title').first().evaluate(el=>getComputedStyle(el).fontSize);
  const detail=await page.locator('.jira-issue-meta').first().evaluate(el=>getComputedStyle(el).fontSize);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/screenshots/task-sizing-${scale}.png`});
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.locator('.settings-category strong').first()).toHaveCSS('font-size',title);
  await expect(page.locator('.settings-category small').first()).toHaveCSS('font-size',detail);
});
