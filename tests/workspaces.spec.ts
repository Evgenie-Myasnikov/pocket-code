import {connectByQr} from './qr-connect';
import { test, expect, type Page } from '@playwright/test';

const roots = ['C:\\Workspace\\first', 'C:\\Workspace\\second'];
const connection = { url:'http://127.0.0.1:4319', token:'test-only-'.repeat(5) };
function gate() { let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve}; }
async function mockHost(page:Page, options:{upload?:ReturnType<typeof gate>;send?:ReturnType<typeof gate>;sent?:any[];legacy?:boolean}={}) {
  await page.route('**/api/**', async route=>{
    const request=route.request(), url=new URL(request.url()), endpoint=url.pathname.replace('/api',''), provider=url.searchParams.get('provider')||'claude';
    if(endpoint==='/health')return route.fulfill({json:{name:'Workspace test PC',roots,protocol:1,version:'0.9.1'}});
    if(endpoint==='/providers')return options.legacy ? route.fulfill({status:404,json:{error:'Not found'}}) : route.fulfill({json:[{id:'claude',name:'Claude',available:true,authenticated:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[{id:'test-codex-model',name:'Model from PC'}]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'same-session-id',provider,summary:provider==='codex'?'Codex thread':'Claude thread',cwd:roots[0],lastModified:Date.now()}]});
    if(endpoint.includes('/messages'))return route.fulfill({json:{messages:[{id:'same-message-id',role:'assistant',blocks:[{type:'text',text:`${provider} history only`}]}],previous:null,next:null}});
    if(endpoint==='/jobs'&&request.method()==='GET')return route.fulfill({json:[]});
    if(endpoint==='/jobs'&&request.method()==='POST'){
      const body=request.postDataJSON();options.sent?.push(body);if(body.provider==='claude'&&options.send)await options.send.promise;
      return route.fulfill({json:{id:body.id,provider:body.provider,cwd:body.cwd,sessionId:'completed-session',status:'done',messages:[{id:'sent-answer',role:'assistant',blocks:[{type:'text',text:`${body.provider} completed reply`}]}],partial:'',approvals:[],startedAt:Date.now(),revision:1,baseMessageCount:0}});
    }
    if(endpoint==='/uploads'){if(options.upload)await options.upload.promise;return route.fulfill({json:{id:'upload-for-claude',name:'draft-note.txt',size:4}});}
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });
}
async function connect(page:Page) {
  await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,connection.url,connection.token);
  await expect(page.locator('.workspace-picker-sidebar select')).toBeVisible();
}
const switchSidebar=(page:Page,provider:string)=>page.locator('.workspace-picker-sidebar select').selectOption(provider);
const switchHeader=(page:Page,provider:string)=>page.locator('.workspace-picker-header select').selectOption(provider);

test('mobile workspaces keep separate histories, drafts, models and in-flight attachments',async({page})=>{
  const upload=gate();await mockHost(page,{upload});await page.setViewportSize({width:390,height:844});await connect(page);
  await page.getByRole('button',{name:/Claude thread/}).click();await expect(page.getByText('claude history only')).toBeVisible();
  await page.getByLabel('Message Claude').fill('Claude draft');await page.getByLabel('Claude model').selectOption('sonnet');await expect(page.getByLabel('Mode',{exact:true})).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({name:'draft-note.txt',mimeType:'text/plain',buffer:Buffer.from('note')});
  await switchHeader(page,'codex');await expect(page.getByRole('button',{name:/Codex thread/})).toBeVisible();await expect(page.getByRole('button',{name:/Claude thread/})).toHaveCount(0);
  await page.getByRole('button',{name:/Codex thread/}).click();await expect(page.getByText('codex history only')).toBeVisible();await expect(page.getByText('claude history only')).toHaveCount(0);
  await page.getByLabel('Message Codex').fill('Codex draft');await page.getByLabel('Codex model').selectOption('test-codex-model');
  upload.resolve();await expect(page.getByText('draft-note.txt')).toHaveCount(0);await expect(page.getByLabel('Message Codex')).toHaveValue('Codex draft');
  await switchHeader(page,'claude');await expect(page.getByLabel('Message Claude')).toHaveValue('Claude draft');await expect(page.getByText('draft-note.txt')).toBeVisible();await expect(page.getByLabel('Claude model')).toHaveValue('sonnet');await expect(page.getByLabel('Mode',{exact:true})).toHaveCount(0);await expect(page.getByText('claude history only')).toBeVisible();
  await switchHeader(page,'codex');await expect(page.getByLabel('Message Codex')).toHaveValue('Codex draft');await expect(page.getByLabel('Codex model')).toHaveValue('test-codex-model');await expect(page.getByLabel('Mode',{exact:true})).toHaveCount(0);
  await page.screenshot({path:'artifacts/screenshots/codex-workspace-mobile.png',fullPage:true});
});

test('a send completing after workspace switch cannot clear or overwrite the other draft',async({page})=>{
  const send=gate(),sent:any[]=[];await mockHost(page,{send,sent});await connect(page);
  await page.locator('.new-chat').click();await page.getByLabel('Message Claude').fill('Run Claude task');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>sent.length).toBe(1);await switchSidebar(page,'codex');await page.locator('.new-chat').click();await page.getByLabel('Message Codex').fill('Run Codex task');
  send.resolve();await expect(page.getByLabel('Message Codex')).toHaveValue('Run Codex task');await expect(page.getByText('claude completed reply')).toHaveCount(0);
  await switchSidebar(page,'claude');await expect(page.getByText('claude completed reply')).toBeVisible();await expect(page.getByLabel('Message Claude')).toHaveValue('');
  await switchSidebar(page,'codex');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText('codex completed reply')).toBeVisible();expect(sent.map(body=>body.provider)).toEqual(['claude','codex']);
  await expect(page.getByRole('button',{name:'Live terminal'})).toHaveCount(0);await expect(page.locator('.terminal-viewport')).toHaveCount(0);
});

test('workspace selection and provider preferences survive reload with Claude legacy migration',async({page})=>{
  await mockHost(page);
  await page.addInitScript(()=>{if(!localStorage.getItem('migration-test-seeded')){localStorage.setItem('migration-test-seeded','true');localStorage.setItem('pocket-code-chat-preferences',JSON.stringify({model:'sonnet',mode:'plan',budget:7}));localStorage.setItem('pocket-code-projects',JSON.stringify({'http://127.0.0.1:4319':'C:\\Workspace\\second'}));}});
  await connect(page);await page.locator('.new-chat').click();await expect(page.getByLabel('Claude model')).toHaveValue('sonnet');await expect(page.locator('.header-title')).toContainText('second');
  await switchSidebar(page,'codex');await page.locator('.new-chat').click();await expect(page.locator('.header-title')).toContainText('first');await page.getByLabel('Codex model').selectOption('test-codex-model');
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'AI & workspace',exact:true}).click();await page.getByLabel('Folder for new chats').selectOption(roots[1]);
  await page.reload();await expect(page.locator('.workspace-picker-sidebar select')).toHaveValue('codex');await expect(page.getByLabel('Codex model')).toHaveValue('test-codex-model');await expect(page.locator('.header-title')).toContainText('second');
  await switchSidebar(page,'claude');await expect(page.getByLabel('Claude model')).toHaveValue('sonnet');await expect(page.getByLabel('Mode',{exact:true})).toHaveCount(0);await expect(page.locator('.header-title')).toContainText('second');
});

test('older bridge remains usable for Claude and cannot mix Claude sessions into Codex',async({page})=>{
  await mockHost(page,{legacy:true});await connect(page);await expect(page.getByRole('button',{name:/Claude thread/})).toBeVisible();
  await switchSidebar(page,'codex');await expect(page.getByRole('button',{name:/Claude thread/})).toHaveCount(0);await page.getByLabel('Message Codex').fill('Wait for bridge update');await expect(page.getByRole('button',{name:'Send message',exact:true})).toBeDisabled();
  await switchSidebar(page,'claude');await expect(page.getByRole('button',{name:/Claude thread/})).toBeVisible();
});

for(const provider of ['claude','codex'] as const) test(`${provider} returns to desktop history syncing after a completed phone turn`,async({page})=>{
  await mockHost(page);let saved=false,desktopReply=false;
  await page.route('**/api/sessions/completed-session/messages?*',route=>route.fulfill({json:{messages:saved?[{id:'sent-answer',role:'assistant',blocks:[{type:'text',text:`${provider} completed reply`}]},...(desktopReply?[{id:'later-desktop-message',role:'assistant',blocks:[{type:'text',text:'Later reply from desktop'}]}]:[])]:[],previous:null,next:null}}));
  await connect(page);if(provider==='codex')await switchSidebar(page,'codex');await page.locator('.new-chat').click();
  const composer=page.getByLabel(`Message ${provider==='claude'?'Claude':'Codex'}`);
  await composer.fill('Phone task');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText(`${provider} completed reply`)).toHaveCount(1);
  await composer.fill('Draft stays while syncing');saved=true;
  await expect(page.locator('.header-title')).toContainText('Current task',{timeout:10000});await expect(page.getByText(`${provider} completed reply`)).toHaveCount(1);await expect(composer).toHaveValue('Draft stays while syncing');
  desktopReply=true;await expect(page.getByText('Later reply from desktop')).toBeVisible({timeout:10000});await expect(composer).toHaveValue('Draft stays while syncing');
});


test('nested project folders stay available across providers and reload without mixing chats', async ({page}) => {
  await mockHost(page);
  const claudeProject = roots[0] + '\\claude-only';
  const codexProject = roots[0] + '\\codex-only';
  await page.route('**/api/projects', route => route.fulfill({json: [...roots, claudeProject, codexProject]}));
  await connect(page);
  const picker = page.locator('.project-picker select');
  await expect(picker.locator('option')).toHaveCount(4);
  await picker.selectOption(claudeProject);
  await switchSidebar(page, 'codex');
  await expect(picker.locator('option')).toHaveCount(4);
  await picker.selectOption(claudeProject);
  await expect(page.getByRole('button', {name:/Codex thread/})).toBeVisible();
  await expect(page.getByRole('button', {name:/Claude thread/})).toHaveCount(0);
  await page.getByRole('button', {name:'Settings', exact:true}).click();await page.getByRole('button',{name:'AI & workspace',exact:true}).click();
  await expect(page.getByLabel('Folder for new chats')).toHaveValue(claudeProject);
  await page.getByLabel('Folder for new chats').selectOption(codexProject);
  await page.reload();
  await expect(picker).toHaveValue(codexProject);
  await switchSidebar(page, 'claude');
  await expect(picker).toHaveValue(claudeProject);
  await expect(picker.locator('option')).toHaveCount(4);
});


test('slow project discovery does not overwrite a folder chosen in the meantime', async ({page}) => {
  await mockHost(page);
  const discovery = gate();
  await page.route('**/api/projects', async route => {
    await discovery.promise;
    await route.fulfill({json:[...roots, roots[0] + '\\nested']});
  });
  await connect(page);
  const picker = page.locator('.project-picker select');
  await expect(picker).toHaveValue(roots[0]);
  await picker.selectOption(roots[1]);
  discovery.resolve();
  await expect(picker.locator('option')).toHaveCount(3);
  await expect(picker).toHaveValue(roots[1]);
  await page.reload();
  await expect(picker).toHaveValue(roots[1]);
});
