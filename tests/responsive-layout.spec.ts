import {test,expect,type Page} from '@playwright/test';

// CSS working areas, not a claim that every phone uses a fixed browser density.
// Native system bars are excluded by the app's SystemBars/adjustResize setup.
const portraits=[
  {name:'compact-320',width:320,height:640},
  {name:'compact-360',width:360,height:760},
  {name:'standard-384',width:384,height:824},
  {name:'standard-393',width:393,height:852},
  {name:'large-412',width:412,height:892},
  {name:'large-440',width:440,height:956},
];
const special=[
  {name:'keyboard-360',width:360,height:380},
  {name:'landscape-844',width:844,height:390},
  {name:'fold-inner-720',width:720,height:740},
  {name:'fold-inner-884',width:884,height:900},
];
type Profile=typeof portraits[number];
const title='A conversation with a long descriptive project title';
const root='C:\\Workspace\\a-project-with-a-long-folder-name';
test.use({hasTouch:true,isMobile:true});

async function openFixture(page:Page,profile:Profile,scale:number,language:'en'|'ru') {
  await page.setViewportSize(profile);
  await page.addInitScript(({scale,language})=>{
    localStorage.setItem('pocket-code-language-v1',language);
    localStorage.setItem('pocket-code-workspace','codex');
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'ocean',theme:'dark',textSize:scale<100?9:14,scale,spacing:1.6,compact:scale<100}));
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
  },{scale,language});
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/health')return route.fulfill({json:{name:'Responsive test computer',roots:[root],protocol:1,version:'0.10.1'}});
    if(path==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[{id:'test-model',name:'Model selected on computer'}]}]});
    if(path==='/api/sessions')return route.fulfill({json:[{sessionId:'responsive-chat',summary:title,cwd:root,lastModified:1}]});
    if(path.endsWith('/messages'))return route.fulfill({json:{messages:Array.from({length:12},(_,i)=>({id:`message-${i}`,role:i%2?'assistant':'user',blocks:[{type:'text',text:i%2?'Here is the project result.\n\n- One clear action\n- More detail when needed':'Please review the project layout.'}]})),previous:null,next:null}});
    if(path==='/api/jobs')return route.fulfill({json:[]});
    if(path==='/api/review/availability')return route.fulfill({json:{available:true,mode:'working'}});
    if(path==='/api/updates/latest')return route.fulfill({json:{enabled:true}});
    if(path==='/api/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(path==='/api/review')return route.fulfill({json:{files:[{path:'src/features/a-long-named-example.ts',added:1,removed:1,binary:false,untracked:false}],current:'feature/readable-interface',base:'main',branches:['main'],patch:'@@ -1 +1 @@\n-old value\n+new value\n',binary:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint'}});
  });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.session-row')).toBeVisible();
}
async function withinViewport(page:Page,selector:string,width:number,height?:number) {
  const failures=await page.locator(selector).evaluateAll((nodes,{width,height})=>nodes.flatMap(node=>{
    if(!(node instanceof HTMLElement)||!node.checkVisibility())return [];
    const r=node.getBoundingClientRect();
    const invalid=r.left<-.5||r.right>width+.5||(height!==undefined&&(r.top<-.5||r.bottom>height+.5));
    return invalid?[{name:node.getAttribute('aria-label')||node.className,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}}]:[];
  }),{width,height});
  expect(failures).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}
async function targets(page:Page,selector:string) {
  const small=await page.locator(selector).evaluateAll(nodes=>nodes.flatMap(node=>{
    if(!(node instanceof HTMLElement)||!node.checkVisibility())return [];
    const r=node.getBoundingClientRect();return r.width<47.9||r.height<47.9?[{name:node.getAttribute('aria-label')||node.className,width:r.width,height:r.height}]:[];
  }));
  expect(small).toEqual([]);
}
async function inspectScreens(page:Page,profile:Profile,scale:number,language:'en'|'ru') {
  const save=(profile.width===360&&scale===65&&language==='ru')||(profile.width===440&&scale===130&&language==='en')||(profile.name==='keyboard-360'&&scale===100&&language==='en');
  await expect(page.locator('.terminal-entry')).toHaveCount(0);
  await expect(page.locator('.search')).toHaveCSS('min-height','48px');
  expect((await page.locator('.search').boundingBox())!.height).toBeLessThanOrEqual(52);
  await withinViewport(page,'.sidebar button,.sidebar select,.sidebar input',profile.width);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-list.png`});
  await page.locator('.session-row').click();
  await expect(page.locator('.message').last()).toBeVisible();
  await withinViewport(page,'.chat-header button,.chat-header select,.chat-header strong,.composer-tools button,.composer-tools select,.mobile-nav',profile.width,profile.height);
  await targets(page,'.chat-header button,.chat-header select,.composer-tools button,.composer-tools select,.mobile-nav button');
  const titleBox=await page.locator('.header-title strong').boundingBox(),projectBox=await page.locator('.project-picker').boundingBox();
  if(profile.width<=760)expect(titleBox!.y+titleBox!.height).toBeLessThanOrEqual(projectBox!.y+1);
  expect((await page.locator('.conversation').boundingBox())!.height).toBeGreaterThan(65);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-chat.png`});
  await page.locator('.reading-entry').click();
  await expect(page.locator('.composer-area')).toBeHidden();
  await withinViewport(page,'.reading-exit',profile.width,profile.height);
  expect((await page.locator('.conversation').boundingBox())!.height).toBeGreaterThan(profile.height-40);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-reading.png`});
  await page.locator('.reading-exit').click();
  await page.getByRole('button',{name:'Review',exact:true}).click();
  await expect(page.locator('.diff-table pre').filter({hasText:/^\+?new value$/})).toBeVisible();
  await expect(page.locator('.diff-table')).toHaveClass(profile.width<600?'diff-table unified':'diff-table split');
  await withinViewport(page,'.review-panel button,.review-panel select,.review-panel h2',profile.width,profile.height);
  expect((await page.locator('.diff-content').boundingBox())!.height).toBeGreaterThan(70);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-review.png`});
  await page.locator('.review-panel header button').click();
  const settings=language==='en'?'Settings':'Настройки';
  await (profile.width<=760?page.locator('.mobile-nav').getByRole('button',{name:settings,exact:true}):page.locator('.desktop-tabs').getByRole('button',{name:settings,exact:true})).click();
  await expect(page.locator('.settings-index .settings-category')).toHaveCount(7);
  await expect(page.locator('.chat-header .review-button')).toHaveCount(0);
  await expect(page.locator('.chat-header .project-picker')).toHaveCount(0);
  await withinViewport(page,'.settings-panel button',profile.width);
  await page.getByRole('button',{name:language==='en'?'Appearance & language':'Оформление и язык',exact:true}).click();
  await expect(page.locator('.appearance-settings .palette-options button').first()).toBeVisible();
  await expect(page.locator('#settings-updates')).toHaveCount(0);
  await withinViewport(page,'.settings-panel button,.settings-panel input,.settings-panel select,.settings-panel h2,.settings-panel h3',profile.width);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-settings.png`});
  await page.getByRole('button',{name:language==='en'?'All settings':'Все настройки',exact:true}).click();
  await page.getByRole('button',{name:language==='en'?'Updates':'Обновления',exact:true}).click();
  await expect(page.locator('.settings-panel #settings-updates .update-panel')).toBeVisible();
  await expect(page.locator('.appearance-settings')).toHaveCount(0);
  const bounds=await page.locator('.settings-panel').evaluate(panel=>{
    const content=panel.querySelector('.settings-content')!.getBoundingClientRect(),footer=panel.querySelector('.settings-exit')!.getBoundingClientRect();
    return {contentBottom:content.bottom,footerTop:footer.top};
  });
  expect(bounds.contentBottom).toBeLessThanOrEqual(bounds.footerTop+1);
  if(save)await page.screenshot({path:`artifacts/screenshots/${profile.name}-${scale}-${language}-updates.png`});

}
for(const profile of portraits)for(const scale of [60,65,100,130])for(const language of ['en','ru'] as const)
  test(`${profile.name} ${scale}% ${language}: chat, review and settings fit`,async({page})=>{await openFixture(page,profile,scale,language);await inspectScreens(page,profile,scale,language);});
for(const profile of special)for(const scale of [100,130])for(const language of ['en','ru'] as const)
  test(`${profile.name} ${scale}% ${language}: short and wide working areas fit`,async({page})=>{await openFixture(page,profile,scale,language);await inspectScreens(page,profile,scale,language);});
