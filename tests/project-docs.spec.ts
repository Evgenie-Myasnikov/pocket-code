import {test,expect,type Page} from '@playwright/test';
import {openSection} from './chat-navigation';

const first='C:\\Workspace\\demo-a',second='C:\\Workspace\\demo-b';
const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
const rule={path:'AGENTS.md',name:'AGENTS.md',kind:'rules',source:'Project root',appliesTo:'all',bytes:120};
const claude={path:'.claude/rules/testing.md',name:'testing.md',kind:'rules',source:'.claude/rules',appliesTo:'claude',bytes:80};
const builtIn={path:'pocket-code:board-maintenance',name:'Board maintenance',kind:'rules',source:'Pocket Code',appliesTo:'all',bytes:40,builtIn:true};
const changelog={path:'CHANGELOG.md',name:'CHANGELOG.md',kind:'changelog',source:'Project root',appliesTo:'all',bytes:90};
type State={boardMaintenance?:boolean;calls:URL[];listFailure:boolean;contentFailure:boolean;empty:boolean;truncated:boolean;documents:typeof rule[];content:string;delayed?:{promise:Promise<void>;resolve:()=>void}};
async function host(page:Page){
  const state:State={boardMaintenance:true,calls:[],listFailure:false,contentFailure:false,empty:false,truncated:false,documents:[rule,claude,changelog],content:'# Project conventions\n\n- Keep changes focused\n- Add **useful checks**\n\n```ts\nconst safe = true;\n```\n\n[Reference](https://example.com/rules)\n\n![Diagram](https://assets.example/diagram.png)'};
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname.replace('/api','');state.calls.push(url);
    if(path==='/health')return route.fulfill({json:{name:'Synthetic PC',protocol:1,version:'0.11.0',roots:[first,second]}});
    if(path==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(path==='/sessions'||path==='/jobs')return route.fulfill({json:[]});
    if(path==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(path==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(path==='/project-rules'){if(route.request().method()==='POST')state.boardMaintenance=route.request().postDataJSON().boardMaintenance;return route.fulfill({json:{boardMaintenance:state.boardMaintenance,canEdit:true}});}
    if(path==='/document-projects')return route.fulfill({json:[{root:first,name:'demo-a',documents:[rule,changelog]},{root:second,name:'demo-b',documents:[rule,changelog]}]});
    if(path==='/project-docs')return state.listFailure?route.fulfill({status:503,json:{error:'Synthetic outage'}}):route.fulfill({json:{project:url.searchParams.get('cwd'),documents:state.empty?[]:state.documents,truncated:state.truncated}});
    if(path==='/project-doc'){
      const old=url.searchParams.get('cwd')===first,docPath=url.searchParams.get('path');
      if(state.delayed&&old&&docPath===rule.path)await state.delayed.promise;
      if(state.contentFailure)return route.fulfill({status:503,json:{error:'Synthetic outage'}});
      if(docPath===builtIn.path)return route.fulfill({json:{...builtIn,content:'# Board maintenance\n\nKeep cards current.'}});
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
 await page.goto('http://127.0.0.1:5173');await openSection(page,language==='ru'?'Правила':'Rules');
}
const panel=(page:Page)=>page.locator('.project-docs');
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});});
test('Rules render safe Markdown, preserve list focus and Changelog opens directly',async({page})=>{
 const resources:string[]=[];await page.route('https://assets.example/**',route=>{resources.push(route.request().url());return route.abort();});await host(page);await openRules(page);
 await expect(panel(page).locator('.project-docs-item')).toHaveCount(2);await panel(page).getByRole('button',{name:/^AGENTS.md/}).click();await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();await expect(panel(page).locator('pre code')).toHaveText('const safe = true;\n');await expect(panel(page).getByRole('link',{name:'Reference'})).toHaveAttribute('href','https://example.com/rules');await expect(panel(page).locator('img')).toHaveCount(0);expect(resources).toEqual([]);
 await page.keyboard.press('Escape');await expect(panel(page).getByRole('button',{name:/^AGENTS.md/})).toBeFocused();await openSection(page,'Changelog');await expect(panel(page).getByRole('heading',{name:'2026-09-30'})).toBeVisible();await expect(page.getByRole('button',{name:'Project overview',exact:true})).toHaveCount(0);
});
test('document refresh keeps the last copy on failure and recovers',async({page})=>{
 const state=await host(page);state.documents=[rule];await openRules(page);await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.contentFailure=true;await page.getByRole('button',{name:'Refresh document',exact:true}).click();await expect(panel(page).getByRole('alert')).toContainText('last loaded copy');await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();state.contentFailure=false;state.content='# Updated rules';await panel(page).getByRole('button',{name:'Retry'}).click();await expect(panel(page).getByRole('heading',{name:'Updated rules'})).toBeVisible();
});
test('list errors and empty documents remain distinct',async({page})=>{
 const state=await host(page);state.listFailure=true;await openRules(page);await expect(panel(page).getByRole('alert')).toContainText('Could not refresh documents.');state.listFailure=false;state.empty=true;await panel(page).getByRole('button',{name:'Retry'}).click();await expect(panel(page).getByText('No project rules found.')).toBeVisible();state.empty=false;state.truncated=true;await page.getByRole('button',{name:'Refresh documents'}).click();await expect(panel(page).getByText(/Some documents are not listed/)).toBeVisible();
});
for(const profile of [{width:320,height:640,language:'en',scale:130},{width:360,height:760,language:'ru',scale:100},{width:390,height:844,language:'en',scale:60}])test('document layout at '+profile.width+' '+profile.language+' '+profile.scale,async({page})=>{
 await page.setViewportSize(profile);const state=await host(page);state.documents=[rule];state.content='# Project rules\n\n'+('Readable guidance. '.repeat(30))+'\n\n~~~text\n'+('a'.repeat(250))+'\n~~~';await openRules(page,profile.language,profile.scale);await expect(panel(page).locator('.project-docs-markdown')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByLabel(profile.language==='ru'?'Git-проект':'Git project')).toBeVisible();await page.screenshot({path:'artifacts/screenshots/direct-docs-'+profile.width+'.png'});
});
test('Rules without authored files show the supported names and an AI action instead of opening the built-in rule',async({page})=>{
 const state=await host(page);state.documents=[builtIn,changelog];await openRules(page);
 await expect(panel(page).getByText('No project rules found.')).toBeVisible();await expect(panel(page).getByText(/\.github\/copilot-instructions\.md/)).toBeVisible();
 await expect(panel(page).getByRole('switch')).toHaveCount(0);await expect(panel(page).locator('.project-docs-markdown')).toHaveCount(0);
 await panel(page).getByRole('button',{name:'Create AGENTS.md with AI'}).click();await expect(page.locator('.composer textarea')).toHaveValue(/Create an AGENTS\.md file/);
});
test('the built-in rule is one card with a switch, saved with feedback, and per-provider chips label authored files',async({page})=>{
 const state=await host(page);state.documents=[builtIn,{...rule,readers:[{provider:'claude',status:'shadowed',reason:'claude-md'},{provider:'codex',status:'loaded'},{provider:'copilot',status:'loaded'}]} as never,claude,changelog];await openRules(page);
 await expect(panel(page).locator('.project-docs-item')).toHaveCount(2);await expect(panel(page).getByText('pocket-code:board-maintenance')).toHaveCount(0);
 const toggle=panel(page).getByRole('switch',{name:'Board maintenance'});await expect(toggle).toHaveCount(1);await expect(toggle).toHaveAttribute('aria-checked','true');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');await expect(panel(page).getByRole('status').filter({hasText:/Saving…|Saved/})).toBeVisible();expect(state.boardMaintenance).toBe(false);
 await expect(panel(page).getByRole('button',{name:/^AGENTS.md/})).toContainText('Claude: not read (CLAUDE.md exists)');await expect(panel(page).getByRole('button',{name:/^AGENTS.md/})).toContainText('Codex: reads');
 await expect(panel(page).getByRole('heading',{name:'What the agent sees'})).toBeVisible();
 await panel(page).getByRole('button',{name:'What this rule does'}).click();await expect(panel(page).getByRole('heading',{name:'Board maintenance'})).toBeVisible();await expect(panel(page).getByRole('switch')).toHaveCount(0);
});
test('relative links open project documents with Back to the source, anchors scroll and other files open in the preview',async({page})=>{
 const state=await host(page);state.content='# Project conventions\n\nSee [testing](.claude/rules/testing.md), [notes](docs/notes.md) and [the end](#final-section).\n\n'+('Filler line.\n\n'.repeat(80))+'## Final section\n\nDone.';await openRules(page);
 await panel(page).getByRole('button',{name:/^AGENTS.md/}).click();await panel(page).getByRole('link',{name:'the end'}).click();await expect(panel(page).locator('#final-section')).toBeInViewport();
 await panel(page).getByRole('link',{name:'testing'}).click();await expect(panel(page).getByRole('heading',{name:'Testing rules'})).toBeVisible();
 await panel(page).getByRole('button',{name:'Back to AGENTS.md'}).click();await expect(panel(page).getByRole('heading',{name:'Project conventions'})).toBeVisible();
 await panel(page).getByRole('link',{name:'notes'}).click();const preview=page.getByRole('dialog',{name:'notes.md'});await expect(preview.getByRole('heading',{name:'Rendered file notes'})).toBeVisible();
 expect(state.calls.some(url=>url.pathname==='/api/file'&&/docs[\\/]notes\.md$/.test(url.searchParams.get('path')||''))).toBe(true);
});
test('Files is a document tab with a themed preview, raw view and find in file',async({page})=>{
 await host(page);await openRules(page);await page.getByRole('button',{name:'Files',exact:true}).click();
 await page.getByRole('button',{name:'notes.md'}).click();const preview=page.getByRole('dialog',{name:'notes.md'});await expect(preview.getByRole('heading',{name:'Rendered file notes'})).toBeVisible();
 await preview.getByRole('button',{name:'Raw'}).click();await expect(preview.locator('pre')).toContainText('# Rendered file notes');await preview.getByRole('searchbox',{name:'Find in file'}).fill('readable');await expect(preview.getByRole('status')).toHaveText('1 of 1');
 const colors=await preview.evaluate(element=>{const style=getComputedStyle(element);return {background:style.backgroundColor,panel:getComputedStyle(document.documentElement).getPropertyValue('--panel').trim()};});expect(colors.background).not.toBe('rgb(27, 36, 24)');
 await page.keyboard.press('Escape');await expect(preview).toHaveCount(0);
});
test('document errors use the danger token, not the text color',async({page})=>{
 const state=await host(page);state.listFailure=true;await openRules(page);const alert=panel(page).locator('.project-docs-error');await expect(alert).toBeVisible();
 const style=await alert.evaluate(element=>{const css=getComputedStyle(element);return {edge:css.borderLeftColor,width:css.borderLeftWidth,text:css.color};});expect(style.width).toBe('4px');expect(style.edge).not.toBe(style.text);
});

