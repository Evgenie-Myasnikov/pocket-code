import {test,expect,type Page} from '@playwright/test';
const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
const cwd='C:\\Workspace\\example';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const messages=[
  {id:'source',role:'user',blocks:[{type:'document',title:'Your brief',source:{type:'text',text:'Keep this input separate.'}}]},
  {id:'result',role:'assistant',blocks:[
    {type:'text',text:'[Project report](docs/report.md)\n![Generated chart](artifacts/chart.png)\n![External sample](https://media.example.test/remote.png)\n[Reference](https://example.test/reference)\n```ts\nconst result = 42;\n```'},
    {type:'image',title:'Inline image',source:{type:'base64',media_type:'image/png',data:png}},
    {type:'tool_result',content:'Build completed successfully.'},
  ]},
];
async function setup(page:Page,language='en',scale=100,options:{delay?:Promise<void>;calls?:string[]}={}){
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic PC',roots:[cwd],protocol:1,version:'0.11.0'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true,authenticated:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'output-chat',provider:'codex',summary:'Results example',cwd,lastModified:Date.now()}]});
    if(endpoint==='/sessions/output-chat/messages')return route.fulfill({json:{messages,previous:null,next:null}});
    if(endpoint==='/sessions/output-chat/subagents')return route.fulfill({json:{agents:[]}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(endpoint==='/project-artifact'){
      const path=url.searchParams.get('path')!;options.calls?.push(path);
      expect(route.request().headers().authorization).toBe(`Bearer ${connection.token}`);expect(url.searchParams.get('cwd')).toBe(cwd);
      if(path==='docs/report.md'){if(options.delay)await options.delay;return route.fulfill({json:{name:'report.md',mimeType:'text/markdown',text:'# Project result\n\nA **formatted** project report.'}});}
      return route.fulfill({json:{name:'chart.png',mimeType:'image/png',data:png}});
    }
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });
  await page.addInitScript(({connection,language,scale})=>{sessionStorage.setItem('connection',JSON.stringify(connection));localStorage.setItem('pocket-code-language-v1',language);localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',textSize:14,scale}));},{connection,language,scale});
  await page.goto('http://127.0.0.1:5173');await page.locator('.workspace-picker-sidebar select').selectOption('codex');await page.getByRole('button',{name:/Results example/}).click();
  await expect(page.getByText('const result = 42;', {exact:true})).toBeVisible();
}
const panel=(page:Page)=>page.locator('.chat-outputs-panel');

test('results categories isolate outputs from sources and Back preserves the parent draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);await page.getByLabel('Message Codex').fill('Parent draft remains here');await page.getByRole('button',{name:'Results',exact:true}).click();
  await expect(panel(page)).toBeVisible();await expect(panel(page).getByText('Your brief',{exact:true})).toHaveCount(0);
  await panel(page).getByRole('button',{name:/^Code \d/}).click();await expect(panel(page).locator('.chat-output-row')).toHaveCount(1);
  await panel(page).locator('.chat-output-row').click();await expect(panel(page).getByText('const result = 42;',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:'Your sources',exact:true}).click();await expect(panel(page).locator('.chat-output-row')).toHaveCount(1);
  await panel(page).getByRole('button',{name:/Your brief/}).click();await expect(panel(page).getByText('Keep this input separate.')).toBeVisible();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(panel(page)).toHaveCount(0);await expect(page.getByLabel('Message Codex')).toHaveValue('Parent draft remains here');await expect(page.getByRole('button',{name:'Results',exact:true})).toBeFocused();
});

test('local previews are fetched only on selection and render Markdown while ignoring stale responses',async({page})=>{
  let release!:()=>void;const delay=new Promise<void>(resolve=>{release=resolve;}),calls:string[]=[];
  await page.setViewportSize({width:390,height:844});await setup(page,'en',100,{calls,delay});await page.getByRole('button',{name:'Results',exact:true}).click();expect(calls).toEqual([]);
  await panel(page).getByRole('button',{name:/Project report/}).click();await expect(panel(page).getByText('Loading…')).toBeVisible();
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:/Generated chart/}).click();await expect(panel(page).locator('.image-preview img')).toBeVisible();release();
  await expect(panel(page).getByRole('heading',{name:'Project result'})).toHaveCount(0);
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:/Project report/}).click();await expect(panel(page).getByRole('heading',{name:'Project result'})).toBeVisible();await expect(panel(page).locator('strong').filter({hasText:'formatted'})).toBeVisible();
  // React StrictMode replays mount effects in the development test server.
  expect(calls.filter((path,index)=>path!==calls[index-1])).toEqual(['docs/report.md','artifacts/chart.png','docs/report.md']);
});

test('external media requires an explicit load and nested image Back keeps the Results context',async({page})=>{
  let remoteRequests=0;await page.route('https://media.example.test/**',route=>{remoteRequests++;return route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')});});
  await page.setViewportSize({width:390,height:844});await setup(page);await page.getByRole('button',{name:'Results',exact:true}).click();
  await panel(page).getByRole('button',{name:/^Images \d/}).click();expect(remoteRequests).toBe(0);
  await panel(page).getByRole('button',{name:/External sample/}).click();expect(remoteRequests).toBe(0);
  await panel(page).getByRole('button',{name:/Load external image/}).click();await expect(panel(page).locator('.image-preview img')).toBeVisible();expect(remoteRequests).toBe(1);
  await panel(page).getByRole('button',{name:'Open image',exact:true}).click();await expect(page.locator('.image-overlay')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.image-overlay')).toHaveCount(0);await expect(panel(page).getByRole('heading',{name:'External sample'})).toBeVisible();
});

for(const profile of [{width:320,height:640,language:'en',scale:130},{width:320,height:640,language:'ru',scale:130},{width:844,height:390,language:'en',scale:100}]){
  test(`Results fits ${profile.width}x${profile.height} ${profile.language} ${profile.scale}%`,async({page})=>{
    await page.setViewportSize(profile);await setup(page,profile.language,profile.scale);await page.locator('.outputs-entry').click();
    await expect(panel(page).locator('.chat-output-row').first()).toBeVisible();
    const metrics=await panel(page).evaluate(element=>{const box=element.getBoundingClientRect();return{left:box.left,right:box.right,bottom:box.bottom,spill:element.scrollWidth-element.clientWidth,targets:[...element.querySelectorAll('button')].map(button=>button.getBoundingClientRect().height)};});
    expect(metrics.left).toBeGreaterThanOrEqual(0);expect(metrics.right).toBeLessThanOrEqual(profile.width);expect(metrics.bottom).toBeLessThanOrEqual(profile.height);expect(metrics.spill).toBeLessThanOrEqual(1);expect(metrics.targets.every(height=>height>=48)).toBeTruthy();
    await page.screenshot({path:`artifacts/screenshots/results-${profile.width}-${profile.language}.png`,fullPage:true});
  });
}
