import {test,expect,type Page} from '@playwright/test';

const first='C:\\Workspace\\demo-a',second='C:\\Workspace\\demo-b';
const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
const rule={path:'AGENTS.md',name:'AGENTS.md',kind:'rules',source:'Project root',appliesTo:'all',bytes:120};
const claude={path:'.claude/rules/testing.md',name:'testing.md',kind:'rules',source:'.claude/rules',appliesTo:'claude',bytes:80};
const changelog={path:'CHANGELOG.md',name:'CHANGELOG.md',kind:'changelog',source:'Project root',appliesTo:'all',bytes:90};
type State={calls:URL[];listFailure:boolean;contentFailure:boolean;empty:boolean;truncated:boolean;content:string;delayed?:{promise:Promise<void>;resolve:()=>void}};
async function host(page:Page){
  const state:State={calls:[],listFailure:false,contentFailure:false,empty:false,truncated:false,content:'# Project conventions\n\n- Keep changes focused\n- Add **useful checks**\n\n```ts\nconst safe = true;\n```\n\n[Reference](https://example.com/rules)\n\n![Diagram](https://assets.example/diagram.png)'};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname.replace('/api','');state.calls.push(url);
    if(path==='/health')return route.fulfill({json:{name:'Synthetic PC',protocol:1,version:'0.11.0',roots:[first,second]}});
    if(path==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(path==='/sessions'||path==='/jobs')return route.fulfill({json:[]});
    if(path==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(path==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(path==='/project-docs')return state.listFailure?route.fulfill({status:503,json:{error:'Synthetic outage'}}):route.fulfill({json:{project:url.searchParams.get('cwd'),documents:state.empty?[]:[rule,claude,changelog],truncated:state.truncated}});
    if(path==='/project-doc'){
      const old=url.searchParams.get('cwd')===first,docPath=url.searchParams.get('path');
      if(state.delayed&&old&&docPath===rule.path)await state.delayed.promise;
      if(state.contentFailure)return route.fulfill({status:503,json:{error:'Synthetic outage'}});
      const metadata=docPath===changelog.path?changelog:docPath===claude.path?claude:rule;
      return route.fulfill({json:{...metadata,content:!old?'# Second project rules':docPath===changelog.path?'## 2026-09-30\n\n- Improved navigation':docPath===claude.path?'# Testing rules\n\nRun relevant checks.':state.content}});
    }
    if(path==='/files')return route.fulfill({json:{path:first,parent:null,entries:[{name:'example.txt',path:first+'\\example.txt',directory:false},{name:'notes.md',path:first+'\\notes.md',directory:false}]}});
    if(path==='/file')return route.fulfill({json:url.searchParams.get('path')?.endsWith('notes.md')?{name:'notes.md',text:'# Rendered file notes\n\n- Use readable Markdown'}:{name:'example.txt',text:'File preview stays available.'}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });return state;
}
async function openProject(page:Page,language='en',scale=100){
  await page.addInitScript(({connection,language,scale})=>{sessionStorage.setItem('connection',JSON.stringify(connection));localStorage.setItem('pocket-code-language-v1',language);localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'dark',textSize:14,scale}));},{connection,language,scale});
  await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:language==='ru'?'Проект':'Project',exact:true}).click();await expect(page.locator('.project-overview-cards')).toBeVisible();await page.locator('.project-overview-card').filter({hasText:language==='ru'?'Инструкции для AI':'Instructions for AI'}).click();await expect(page.getByRole('tab',{name:language==='ru'?'Правила':'Rules',exact:true})).toBeVisible();
}
const panel=(page:Page)=>page.locator('.project-docs');
const openRule=async(page:Page)=>{await panel(page).getByRole('button',{name:/^AGENTS.md/}).click();};
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});});

test('project rules and changelog render safe Markdown and Files remains available',async({page})=>{
  const resources:string[]=[];await page.route('https://assets.example/**',route=>{resources.push(route.request().url());return route.abort();});await host(page);await openProject(page);
  await expect(panel(page).locator('.project-docs-item')).toHaveCount(2);await expect(panel(page).getByText('Shared · Project root')).toBeVisible();await openRule(page);
  await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();await expect(panel(page).locator('li')).toHaveCount(2);await expect(panel(page).locator('pre code')).toHaveText('const safe = true;\n');await expect(panel(page).getByRole('link',{name:'Reference'})).toHaveAttribute('href','https://example.com/rules');await expect(panel(page).getByRole('link',{name:'Open image link · Diagram'})).toBeVisible();await expect(panel(page).locator('img')).toHaveCount(0);expect(resources).toEqual([]);
  await page.keyboard.press('Escape');await expect(panel(page).getByRole('button',{name:/^AGENTS.md/})).toBeFocused();await page.getByRole('tab',{name:'Changelog',exact:true}).click();await panel(page).getByRole('button',{name:/^CHANGELOG.md/}).click();await expect(panel(page).getByRole('heading',{name:'2026-09-30'})).toBeVisible();
  await panel(page).getByRole('button',{name:'Back to documents'}).click();await page.getByRole('tab',{name:'Files',exact:true}).click();await panel(page).getByRole('button',{name:'example.txt'}).click();await expect(page.locator('.file-preview')).toContainText('File preview stays available.');
  await page.keyboard.press('Escape');await expect(page.locator('.file-preview')).toHaveCount(0);await expect(panel(page).getByRole('button',{name:'example.txt'})).toBeFocused();await panel(page).getByRole('button',{name:'notes.md'}).click();await expect(page.getByRole('dialog',{name:'notes.md'}).getByRole('heading',{name:'Rendered file notes'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('tab',{name:'Files',exact:true})).toHaveAttribute('aria-selected','true');
});

test('late document responses cannot cross document or project selection',async({page})=>{
  let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});const state=await host(page);state.delayed={promise,resolve};await openProject(page);await openRule(page);await expect(panel(page).getByText('Loading document…')).toBeVisible();
  await panel(page).getByRole('button',{name:'Back to documents'}).click();await panel(page).getByRole('button',{name:/^testing.md/}).click();await expect(panel(page).getByRole('heading',{name:'Testing rules'})).toBeVisible();
  await page.getByLabel('Project folder',{exact:true}).selectOption(second);await panel(page).getByRole('button').filter({hasText:'Instructions for AI in this project'}).click();await expect(panel(page).getByRole('tab',{name:'Rules',exact:true})).toBeVisible();await openRule(page);await expect(panel(page).getByRole('heading',{name:'Second project rules'})).toBeVisible();resolve();
  await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toHaveCount(0);await expect(panel(page).getByRole('heading',{name:'Second project rules'})).toBeVisible();
});

test('selected document refreshes every 15 seconds and polling stops on Back',async({page})=>{
  await page.clock.install();const state=await host(page);await openProject(page);await openRule(page);await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.content='# Updated on the PC';await page.clock.fastForward(15010);await expect(panel(page).getByRole('heading',{name:'Updated on the PC'})).toBeVisible();
  await panel(page).getByRole('button',{name:'Back to documents'}).click();const calls=state.calls.filter(url=>url.pathname==='/api/project-doc').length;await page.clock.fastForward(45000);expect(state.calls.filter(url=>url.pathname==='/api/project-doc')).toHaveLength(calls);
});

test('document errors retain the previous copy and can be retried explicitly',async({page})=>{
  const state=await host(page);await openProject(page);await openRule(page);await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.contentFailure=true;await panel(page).getByRole('button',{name:'Refresh document',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('The last loaded copy remains below.');await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();
  state.contentFailure=false;state.content='# Recovered document';await panel(page).getByRole('button',{name:'Try again'}).click();await expect(panel(page).getByRole('heading',{name:'Recovered document'})).toBeVisible();await expect(panel(page).getByRole('alert')).toHaveCount(0);
});

test('list error, recognized empty paths and truncation have clear states',async({page})=>{
  const state=await host(page);state.listFailure=true;await openProject(page);await expect(panel(page).getByRole('alert')).toContainText('Could not refresh documents.');await expect(panel(page).getByText('No project rules found.')).toHaveCount(0);state.listFailure=false;state.empty=true;await panel(page).getByRole('button',{name:'Try again'}).click();await expect(panel(page).getByText('No project rules found.')).toBeVisible();await expect(panel(page).getByText(/Recognized files: AGENTS.md/)).toBeVisible();
  await page.getByRole('tab',{name:'Changelog',exact:true}).click();await expect(panel(page).getByText('No changelog found.')).toBeVisible();state.empty=false;state.truncated=true;await panel(page).getByRole('button',{name:'Refresh documents'}).click();await expect(panel(page).getByText(/Some documents are not listed/)).toBeVisible();
});

for(const profile of [{width:320,height:640,language:'en',scale:130},{width:360,height:760,language:'ru',scale:100}])test(`project documents fit ${profile.width}px ${profile.language} ${profile.scale}%`,async({page})=>{
  await page.setViewportSize(profile);const state=await host(page);state.content='# Project rules\n\n'+('Readable project guidance. '.repeat(30))+'\n\n```text\n'+('a'.repeat(250))+'\n```';await openProject(page,profile.language,profile.scale);
  async function check(name:string){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const height of await panel(page).locator('button').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).map(element=>element.getBoundingClientRect().height)))expect(height).toBeGreaterThanOrEqual(47);await page.screenshot({path:`artifacts/screenshots/project-docs-${profile.width}-${profile.language}-${name}.png`,fullPage:true});}
  await expect(panel(page).locator('.project-docs-item')).toHaveCount(2);await check('list');await openRule(page);await expect(panel(page).getByRole('heading',{name:'Project rules'})).toBeVisible();await check('document');await expect(panel(page).getByRole('button',{name:profile.language==='ru'?'К документам':'Back to documents'})).toBeVisible();
});

for(const scale of [60,100,130])test('project text follows saved interface scale '+scale,async({page})=>{
 await page.setViewportSize({width:360,height:760});await host(page);await openProject(page,'en',scale);
 const font=()=>page.locator('.project-docs-item strong').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
 expect(await font()).toBeCloseTo(15*scale/100,1);
 await page.reload();await page.locator('.mobile-nav').getByRole('button',{name:'Project',exact:true}).click();
 await expect(page.locator('.project-overview-cards')).toBeVisible();await page.screenshot({path:'artifacts/screenshots/project-overview-'+scale+'.png'});
 expect(await page.locator('.workspace-picker-header select').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 expect(await page.locator('.project-picker select').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await page.locator('.project-overview-card').filter({hasText:'Instructions for AI'}).click();expect(await font()).toBeCloseTo(15*scale/100,1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
