import {test,expect,type Page} from '@playwright/test';

const first='C:\\Workspace\\demo-a',second='C:\\Workspace\\demo-b';
const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
const rule={path:'AGENTS.md',name:'AGENTS.md',kind:'rules',source:'Project root',appliesTo:'all',bytes:120};
const claude={path:'.claude/rules/testing.md',name:'testing.md',kind:'rules',source:'.claude/rules',appliesTo:'claude',bytes:80};
const changelog={path:'CHANGELOG.md',name:'CHANGELOG.md',kind:'changelog',source:'Project root',appliesTo:'all',bytes:90};
type State={calls:URL[];listFailure:boolean;contentFailure:boolean;empty:boolean;truncated:boolean;documents:typeof rule[];content:string;delayed?:{promise:Promise<void>;resolve:()=>void}};
async function host(page:Page){
  const state:State={calls:[],listFailure:false,contentFailure:false,empty:false,truncated:false,documents:[rule,claude,changelog],content:'# Project conventions\n\n- Keep changes focused\n- Add **useful checks**\n\n```ts\nconst safe = true;\n```\n\n[Reference](https://example.com/rules)\n\n![Diagram](https://assets.example/diagram.png)'};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname.replace('/api','');state.calls.push(url);
    if(path==='/health')return route.fulfill({json:{name:'Synthetic PC',protocol:1,version:'0.11.0',roots:[first,second]}});
    if(path==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(path==='/sessions'||path==='/jobs')return route.fulfill({json:[]});
    if(path==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(path==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(path==='/project-rules')return route.fulfill({json:{boardMaintenance:true,canEdit:true}});
    if(path==='/document-projects')return route.fulfill({json:[{root:first,name:'demo-a',documents:[rule,changelog]},{root:second,name:'demo-b',documents:[rule,changelog]}]});
    if(path==='/project-docs')return state.listFailure?route.fulfill({status:503,json:{error:'Synthetic outage'}}):route.fulfill({json:{project:url.searchParams.get('cwd'),documents:state.empty?[]:state.documents,truncated:state.truncated}});
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
async function openRules(page:Page,language='en',scale=100){
 await page.addInitScript(({connection,language,scale})=>{sessionStorage.setItem('connection',JSON.stringify(connection));localStorage.setItem('pocket-code-language-v1',language);localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'dark',textSize:14,scale}));},{connection,language,scale});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:language==='ru'?'Правила':'Rules',exact:true}).click();
}
const panel=(page:Page)=>page.locator('.project-docs');
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});});
test('Rules render safe Markdown, preserve list focus and Changelog opens directly',async({page})=>{
 const resources:string[]=[];await page.route('https://assets.example/**',route=>{resources.push(route.request().url());return route.abort();});await host(page);await openRules(page);
 await expect(panel(page).locator('.project-docs-item')).toHaveCount(2);await panel(page).getByRole('button',{name:/^AGENTS.md/}).click();await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();await expect(panel(page).locator('pre code')).toHaveText('const safe = true;\n');await expect(panel(page).getByRole('link',{name:'Reference'})).toHaveAttribute('href','https://example.com/rules');await expect(panel(page).locator('img')).toHaveCount(0);expect(resources).toEqual([]);
 await page.keyboard.press('Escape');await expect(panel(page).getByRole('button',{name:/^AGENTS.md/})).toBeFocused();await page.locator('.mobile-nav').getByRole('button',{name:'Changelog',exact:true}).click();await expect(panel(page).getByRole('heading',{name:'2026-09-30'})).toBeVisible();await expect(page.getByRole('button',{name:'Project overview',exact:true})).toHaveCount(0);
});
test('document refresh keeps the last copy on failure and recovers',async({page})=>{
 const state=await host(page);state.documents=[rule];await openRules(page);await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.contentFailure=true;await page.getByRole('button',{name:'Refresh projects',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('last loaded copy');await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.contentFailure=false;state.content='# Updated rules';await panel(page).getByRole('button',{name:'Try again'}).click();await expect(panel(page).getByRole('heading',{name:'Updated rules'})).toBeVisible();
});
test('list errors and empty documents remain distinct',async({page})=>{
 const state=await host(page);state.listFailure=true;await openRules(page);await expect(panel(page).getByRole('alert')).toContainText('Could not refresh documents.');state.listFailure=false;state.empty=true;await panel(page).getByRole('button',{name:'Try again'}).click();await expect(panel(page).getByText('No project rules found.')).toBeVisible();state.empty=false;state.truncated=true;await page.getByRole('button',{name:'Refresh projects'}).click();await expect(panel(page).getByText(/Some documents are not listed/)).toBeVisible();
});
for(const profile of [{width:320,height:640,language:'en',scale:130},{width:360,height:760,language:'ru',scale:100},{width:390,height:844,language:'en',scale:60}])test('document layout at '+profile.width+' '+profile.language+' '+profile.scale,async({page})=>{
 await page.setViewportSize(profile);const state=await host(page);state.documents=[rule];state.content='# Project rules\n\n'+('Readable guidance. '.repeat(30))+'\n\n~~~text\n'+('a'.repeat(250))+'\n~~~';await openRules(page,profile.language,profile.scale);await expect(panel(page).locator('.project-docs-markdown')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByLabel(profile.language==='ru'?'Git-проект':'Git project')).toBeVisible();await page.screenshot({path:'artifacts/screenshots/direct-docs-'+profile.width+'.png'});
});
