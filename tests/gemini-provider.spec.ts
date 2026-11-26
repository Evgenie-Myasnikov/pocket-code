import {expect,test,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

const geminiChat={sessionId:'33333333-3333-4333-8333-333333333333',summary:'Gemini · Release notes draft',cwd:'C:\\Demo\\Atlas',lastModified:3,provider:'gemini'};
const ready={id:'gemini',name:'Gemini',available:true,authenticated:true,access:'ready',error:'',models:[{id:'gemini-3-pro-preview',name:'Gemini 3 Pro',description:'Synthetic pro model'},{id:'gemini-2.5-flash',name:'Gemini 2.5 Flash'}]};
const connection=(gemini:Record<string,unknown>)=>[
  {id:'claude',installed:true,version:'1.0.0',server:'on-demand',authenticated:true,busy:false,login:{state:'idle'},methods:['browser']},
  {id:'gemini',version:'',server:'ready',busy:false,login:{state:'idle'},methods:['browser'],...gemini}];
/** The turns this window asked the host to start. */
const started=(page:Page)=>page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.action==='write'&&call.endpoint==='/jobs').map((call:any)=>call.data));
async function withGemini(page:Page,state:Record<string,unknown>,connections:Record<string,unknown>[]){
  await page.addInitScript(({state,connections,chat})=>{
    localStorage.setItem('pocket-code-language-v1','en');
    (window as any).testProviders=[{id:'claude',available:true,models:[]},{id:'codex',available:true,authenticated:true,models:[]},state];
    (window as any).testProviderConnections=connections;
    (window as any).testChatRowsBy={gemini:[chat]};
  },{state,connections,chat:geminiChat});
}

test('Gemini is a chat provider in the header menu, streams its model choice and resumes its own chats',async({page})=>{
  await withGemini(page,ready,connection({installed:true,version:'0.71.1',authenticated:true,access:'ready'}));
  await desktop(page);
  // Its chats join the one chat list, marked with the Gemini provider.
  const row=page.locator('.desktop-sessions button').filter({hasText:'Release notes draft'});
  await expect(row).toBeVisible();
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const host=page.locator('.desktop-chat-host'),chip=host.locator('header .header-model-chip');
  await chip.click();
  const menu=page.getByRole('menu',{name:'Provider and model'});
  await menu.getByRole('menuitemradio',{name:'Gemini'}).click();
  await expect(chip).toContainText('Gemini');
  await chip.click();
  await expect(menu.getByText('Models · Gemini',{exact:true})).toBeVisible();
  await menu.getByRole('menuitemradio',{name:/Gemini 3 Pro/}).click();
  await expect(chip).toContainText('Gemini · Gemini 3 Pro');
  // Gemini offers its own access modes; no subscription quota is invented for it.
  await expect(host.locator('.access-chip')).toContainText('Edits');
  await expect(host.locator('.usage-indicator')).toHaveCount(0);
  await page.screenshot({path:'artifacts/screenshots/gemini-provider-menu.png'});
  const input=page.getByRole('textbox',{name:'Message Gemini',exact:true});
  await input.fill('Summarise the synthetic changelog');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>started(page).then(calls=>calls.length)).toBe(1);
  const [turn]=await started(page);
  expect(turn).toMatchObject({provider:'gemini',model:'gemini-3-pro-preview',geminiAccess:'auto_edit',mode:'default',text:'Summarise the synthetic changelog'});
  expect(turn.claudeEffort).toBeUndefined();expect(turn.claudeAccess).toBeUndefined();expect(turn.reasoningEffort).toBeUndefined();
  // An existing Gemini chat continues the same CLI session.
  await row.click();
  await expect(page.getByRole('textbox',{name:'Message Gemini',exact:true})).toBeVisible();
  await page.getByRole('textbox',{name:'Message Gemini',exact:true}).fill('Continue the draft');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>started(page).then(calls=>calls.at(-1)?.text)).toBe('Continue the draft');
  expect((await started(page)).at(-1)).toMatchObject({provider:'gemini',sessionId:geminiChat.sessionId});
});

test('Gemini says what to do when the CLI is missing or not signed in',async({page})=>{
  await withGemini(page,{id:'gemini',name:'Gemini',available:true,authenticated:false,access:'sign-in-required',models:[],error:'Sign in to Gemini on the PC: run gemini once in a terminal and choose Sign in with Google.'},
    connection({installed:true,version:'0.71.1',authenticated:false,access:'sign-in-required'}));
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const chip=page.locator('.desktop-chat-host header .header-model-chip');
  await chip.click();await page.getByRole('menu',{name:'Provider and model'}).getByRole('menuitemradio',{name:'Gemini'}).click();
  await expect(page.locator('.network-banner')).toContainText('Sign in to Gemini on the PC');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('.settings-index').getByRole('button',{name:'Providers',exact:true}).click();
  const card=page.getByRole('region',{name:'Gemini',exact:true});
  await expect(card.getByText('Sign-in required',{exact:true})).toBeVisible();
  await expect(card).toContainText('choose Sign in with Google');
  await expect(card.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
  await expect(card.getByRole('button',{name:'Browser sign-in',exact:true})).toBeVisible();
  await page.screenshot({path:'artifacts/screenshots/gemini-sign-in.png'});
});

test('a PC without Gemini CLI shows how to install it',async({page})=>{
  await withGemini(page,{id:'gemini',name:'Gemini',available:false,authenticated:false,access:'not-installed',models:[],error:'Gemini CLI is not installed on the PC. Install it with: npm install -g @google/gemini-cli'},
    connection({installed:false,authenticated:null,server:'unavailable'}));
  await desktop(page);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('.settings-index').getByRole('button',{name:'Providers',exact:true}).click();
  const card=page.getByRole('region',{name:'Gemini',exact:true});
  await expect(card.getByText('Not found',{exact:true})).toBeVisible();
  await expect(card).toContainText('npm install -g @google/gemini-cli');
});
