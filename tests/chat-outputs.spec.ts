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
async function sampleImage(page:Page){return page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const context=canvas.getContext('2d')!;
  context.fillStyle='#d9e8db';context.fillRect(0,0,960,640);context.fillStyle='#204944';context.fillRect(64,64,832,512);
  context.fillStyle='#eabd83';context.beginPath();context.arc(726,210,74,0,Math.PI*2);context.fill();
  context.fillStyle='#7fad9b';context.beginPath();context.moveTo(64,510);context.lineTo(318,225);context.lineTo(638,576);context.lineTo(64,576);context.fill();
  context.fillStyle='#4b776c';context.beginPath();context.moveTo(300,576);context.lineTo(560,310);context.lineTo(896,576);context.fill();
  context.fillStyle='#ffffff';context.font='bold 44px sans-serif';context.fillText('Project preview',104,142);
  return canvas.toDataURL('image/png').split(',')[1];
});}
async function setup(page:Page,language='en',scale=100,options:{delay?:Promise<void>;calls?:string[];image?:string}={}){
  const fixtureMessages=JSON.parse(JSON.stringify(messages));if(options.image)fixtureMessages[1].blocks.find((block:any)=>block.type==='image').source.data=options.image;
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic PC',roots:[cwd],protocol:1,version:'0.11.0'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true,authenticated:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'output-chat',provider:'codex',summary:'Results example',cwd,lastModified:Date.now()}]});
    if(endpoint==='/sessions/output-chat/messages')return route.fulfill({json:{messages:fixtureMessages,previous:null,next:null}});
    if(endpoint==='/sessions/output-chat/subagents')return route.fulfill({json:{agents:[]}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    if(endpoint==='/project-artifact'){
      const path=url.searchParams.get('path')!;options.calls?.push(path);
      expect(route.request().headers().authorization).toBe(`Bearer ${connection.token}`);expect(url.searchParams.get('cwd')).toBe(cwd);
      if(path==='docs/report.md'){if(options.delay)await options.delay;return route.fulfill({json:{name:'report.md',mimeType:'text/markdown',text:'# Project result\n\nA **formatted** project report.'}});}
      return route.fulfill({json:{name:'chart.png',mimeType:'image/png',data:options.image||png}});
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
  await expect(panel(page)).toBeVisible();await expect(panel(page).getByText('Your brief',{exact:true})).toHaveCount(1);
  await panel(page).getByRole('button',{name:'Assistant results',exact:true}).click();await expect(panel(page).getByText('Your brief',{exact:true})).toHaveCount(0);
  await panel(page).getByRole('button',{name:/^Code \d/}).click();await expect(panel(page).locator('.chat-output-row')).toHaveCount(1);
  await panel(page).locator('.chat-output-row').click();await expect(panel(page).getByText('const result = 42;',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:'Your sources',exact:true}).click();await expect(panel(page).locator('.chat-output-row')).toHaveCount(1);
  await panel(page).getByRole('button',{name:/Your brief/}).click();await expect(panel(page).getByText('Keep this input separate.')).toBeVisible();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');await expect(panel(page)).toHaveCount(0);await expect(page.getByLabel('Message Codex')).toHaveValue('Parent draft remains here');await expect(page.getByRole('button',{name:'Results',exact:true})).toBeFocused();
});

test('documents load on selection while visible local image cards load authenticated thumbnails and ignore stale documents',async({page})=>{
  let release!:()=>void;const delay=new Promise<void>(resolve=>{release=resolve;}),calls:string[]=[];
  await page.setViewportSize({width:390,height:844});await setup(page,'en',100,{calls,delay});await page.getByRole('button',{name:'Results',exact:true}).click();expect(calls).not.toContain('docs/report.md');
  await panel(page).getByRole('button',{name:/Project report/}).click();await expect(panel(page).getByText('Loading…')).toBeVisible();
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:/Generated chart/}).click();await expect(panel(page).locator('.image-viewer-image')).toBeVisible();release();
  await expect(panel(page).getByRole('heading',{name:'Project result'})).toHaveCount(0);
  await page.keyboard.press('Escape');await panel(page).getByRole('button',{name:/Project report/}).click();await expect(panel(page).getByRole('heading',{name:'Project result'})).toBeVisible();await expect(panel(page).locator('strong').filter({hasText:'formatted'})).toBeVisible();
  // React StrictMode replays mount effects in the development test server.
  expect(calls.filter(path=>path==='docs/report.md').length).toBeGreaterThanOrEqual(2);expect(calls).toContain('artifacts/chart.png');
});

test('external media requires an explicit load and nested image Back keeps the Results context',async({page})=>{
  let remoteRequests=0;await page.route('https://media.example.test/**',route=>{remoteRequests++;return route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')});});
  await page.setViewportSize({width:390,height:844});await setup(page);await page.getByRole('button',{name:'Results',exact:true}).click();
  await panel(page).getByRole('button',{name:/^Images \d/}).click();expect(remoteRequests).toBe(0);
  await panel(page).getByRole('button',{name:/External sample/}).click();expect(remoteRequests).toBe(0);
  await expect(page.locator('.image-overlay')).toBeVisible();
  await panel(page).getByRole('button',{name:/Load external image/}).click();await expect(panel(page).locator('.image-viewer-image')).toBeVisible();expect(remoteRequests).toBe(1);
  await panel(page).getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.image-viewer-stage')).toHaveAttribute('data-zoom','1.50');
  await panel(page).getByRole('button',{name:'Fit to screen',exact:true}).click();await expect(page.locator('.image-viewer-stage')).toHaveAttribute('data-zoom','1.00');
  await page.keyboard.press('Escape');await expect(page.locator('.image-overlay')).toHaveCount(0);await expect(panel(page).getByRole('button',{name:'External sample',exact:true})).toBeFocused();
});

test('image gallery decodes only nearby authenticated thumbnails with bounded reads and releases them',async({page})=>{
  const image=await sampleImage(page);await page.setViewportSize({width:390,height:844});await setup(page);
  const many=[{id:'gallery',role:'assistant',blocks:[{type:'text',text:Array.from({length:30},(_,index)=>`![Asset ${index}](images/${index}.png)`).join('\n')}]}];
  await page.route('**/api/sessions/output-chat/messages?*',route=>route.fulfill({json:{messages:many,previous:null,next:null}}));
  let release!:()=>void;const hold=new Promise<void>(done=>release=done);let active=0,peak=0;const calls:string[]=[];
  await page.route('**/api/project-artifact?*',async route=>{
    expect(route.request().headers().authorization).toBe(`Bearer ${connection.token}`);
    calls.push(new URL(route.request().url()).searchParams.get('path')!);active++;peak=Math.max(peak,active);await hold;
    await route.fulfill({json:{name:'image.png',mimeType:'image/png',data:image}});active--;
  });
  await page.addInitScript(()=>{(window as any).__releasedThumbnails=0;const revoke=URL.revokeObjectURL;URL.revokeObjectURL=function(url){(window as any).__releasedThumbnails++;revoke.call(URL,url);};});
  await page.reload();await page.getByRole('button',{name:/Results example/}).click();await page.getByRole('button',{name:'Results',exact:true}).click();await panel(page).getByRole('button',{name:/^Images \d/}).click();
  await expect.poll(()=>calls.length).toBe(2);await page.waitForTimeout(150);expect(calls.length).toBe(2);release();
  await expect(panel(page).getByRole('button',{name:'Asset 0',exact:true}).locator('img')).toBeVisible();
  await expect(panel(page).getByRole('button',{name:'Asset 29',exact:true}).locator('img')).toHaveCount(0);
  expect(peak).toBeLessThanOrEqual(2);expect(new Set(calls).size).toBeLessThan(12);
  await page.screenshot({path:'artifacts/screenshots/results-image-gallery.png',fullPage:true});
  await page.keyboard.press('Escape');await expect(panel(page)).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__releasedThumbnails)).toBeGreaterThan(0);
});

test('a gallery image opens directly, supports touch pinch and pan, and returns to its focused card',async({page})=>{
  const image=await sampleImage(page);await page.setViewportSize({width:390,height:844});await setup(page,'en',100,{image});await page.getByRole('button',{name:'Results',exact:true}).click();await panel(page).getByRole('button',{name:/^Images \d/}).click();
  const card=panel(page).getByRole('button',{name:'Inline image',exact:true});await expect(card.locator('img')).toBeVisible();await expect(panel(page).getByRole('button',{name:'Generated chart',exact:true}).locator('img')).toBeVisible();
  await page.screenshot({path:'docs/images/results-images.png',fullPage:true});await card.click();
  const viewer=page.locator('.image-viewer'),stage=viewer.locator('.image-viewer-stage');await expect(viewer.locator('img')).toBeVisible();
  const box=(await stage.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2,cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-70,y,id:1},{x:x+70,y,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Number(await stage.getAttribute('data-zoom'))).toBeGreaterThan(2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+55,y:y+25,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(()=>viewer.locator('img').evaluate(element=>new DOMMatrix(getComputedStyle(element).transform).m41)).toBeGreaterThan(30);
  await page.screenshot({path:'artifacts/screenshots/results-image-zoom.png',fullPage:true});
  await viewer.getByRole('button',{name:'Fit to screen',exact:true}).click();await expect(stage).toHaveAttribute('data-zoom','1.00');
  await page.screenshot({path:'docs/images/image-viewer.png',fullPage:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));await expect(viewer).toHaveCount(0);await expect(card).toBeFocused();
  await card.click();await expect(viewer.locator('img')).toBeVisible();await expect(stage).toHaveAttribute('data-zoom','1.00');await page.keyboard.press('Escape');await cdp.detach();
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

test('results scan every history page independently of the visible chat',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);
 const before=await page.locator('.conversation').evaluate(el=>el.scrollTop);let release!:()=>void;
 const wait=new Promise<void>(resolve=>{release=resolve;});const offsets:number[]=[];
 await page.route('**/api/sessions/output-chat/messages?*',async route=>{
  const offset=new URL(route.request().url()).searchParams.get('offset');
  if(offset===null)return route.fulfill({json:{messages,previous:100,next:null}});
  offsets.push(Number(offset));if(offset==='100')await wait;
  return route.fulfill({json:{messages:offset==='0'?[{id:'old',role:'assistant',blocks:[{type:'text',text:'[Older report](old/report.md)'}]}]:[{id:'old-source',role:'user',blocks:[{type:'document',title:'Earlier source',source:{type:'text',text:'Archived input'}}]}],next:offset==='0'?100:null}});
 });
 await page.getByRole('button',{name:'Results',exact:true}).click();
 await expect(panel(page).getByText(/Searching the full history/)).toBeVisible();
 await expect(panel(page).getByRole('button',{name:/Older report/})).toBeVisible();release();
 await expect(panel(page).getByText(/History scanned/)).toBeVisible();
 await expect(panel(page).getByRole('button',{name:/Earlier source/})).toBeVisible();
 expect(offsets).toContain(0);expect(offsets).toContain(100);
 await expect(panel(page).getByRole('button',{name:'Load more messages'})).toHaveCount(0);
 await page.keyboard.press('Escape');
 expect(await page.locator('.conversation').evaluate(el=>el.scrollTop)).toBe(before);
 await expect(page.locator('.conversation').getByText('Older report')).toHaveCount(0);
});
