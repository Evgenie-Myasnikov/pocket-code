import {test,expect,type Page} from '@playwright/test';

test.use({hasTouch:true,isMobile:true});
async function openChat(page:Page,scale:number) {
  await page.addInitScript(scale=>{
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'dark',textSize:8,scale,spacing:1.1,compact:true}));
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
  },scale);
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname;
    if(endpoint==='/api/health')return route.fulfill({json:{name:'Usability test PC',roots:['C:\\Workspace\\first'],protocol:1,version:'0.10.0'}});
    if(endpoint==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true},{id:'codex',name:'Codex',available:true,models:[{id:'model-from-pc',name:'Model from computer'}]}]});
    if(endpoint==='/api/sessions')return route.fulfill({json:[{sessionId:'usability-session',summary:'A chat with a long project title',cwd:'C:\\Workspace\\first',lastModified:1}]});
    if(endpoint.endsWith('/messages'))return route.fulfill({json:{messages:[{id:'answer',role:'assistant',blocks:[{type:'text',text:'A readable project response with compact text.'},{type:'tool_use',name:'Read',input:{path:'example.ts'}}]}],previous:null,next:null}});
    if(endpoint==='/api/jobs')return route.fulfill({json:[]});
    if(endpoint==='/api/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/api/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint'}});
  });
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:/A chat with a long project title/}).click();
  await expect(page.getByLabel('Message Claude')).toBeVisible();
}
async function checkTargets(page:Page,selectors:string) {
  const small=await page.locator(selectors).evaluateAll(elements=>elements.flatMap(element=>{
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
    if(!rect.width||!rect.height||style.visibility==='hidden'||style.display==='none')return [];
    return rect.width<47.9||rect.height<47.9?[{name:element.getAttribute('aria-label')||element.textContent,width:rect.width,height:rect.height}]:[];
  }));
  expect(small).toEqual([]);
}
for(const width of [320,390])for(const scale of [60,100])test(`touch targets stay usable at ${width}px and ${scale}% without enlarging chat text`,async({page})=>{
  await page.setViewportSize({width,height:844});await openChat(page,scale);
  await checkTargets(page,'.chat-header button,.chat-header select,.composer-tools button,.composer-tools select,.mobile-nav button,.copy-button,.tool-card summary');
  const edges=await page.locator('.chat-header button,.chat-header select,.composer-tools button,.composer-tools select').evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right};}));
  for(const rect of edges){expect(rect.left).toBeGreaterThanOrEqual(0);expect(rect.right).toBeLessThanOrEqual(width);}
  expect(await page.locator('.message').first().evaluate(element=>getComputedStyle(element).fontSize)).toBe('8px');
  await page.getByLabel('Message Claude').fill('Draft before navigation');await page.keyboard.press('Tab');
  await expect(page.getByLabel('Attach files')).toBeFocused();
  expect(await page.getByLabel('Attach files').evaluate(element=>getComputedStyle(element).outlineStyle)).not.toBe('none');
  if(width===390&&scale===60)await page.screenshot({path:'artifacts/screenshots/mobile-touch-60-percent.png',fullPage:true});
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();
  await checkTargets(page,'.settings-panel button,.settings-panel select,.settings-panel input[type=range]');
  await expect(page.getByLabel('Interface scale',{exact:true})).toHaveValue(String(scale));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
