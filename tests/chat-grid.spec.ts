import {test,expect,type Page} from '@playwright/test';

// Synthetic chats only: two projects, every date group, with and without images and AI replies.
const day=86400000;
function synthetic(now=Date.now()){
  const start=new Date(now);start.setHours(0,0,0,0);const today=start.getTime();
  const at=(offset:number)=>Math.max(today+60000,now-offset);
  return [
    {sessionId:'11111111-1111-4111-8111-111111111111',summary:'Atlas chart review',cwd:'C:/Synthetic/atlas',lastModified:at(20*60000),image:'Result chart',text:'The **chart** now uses the shared palette. Bars are sorted by value and the legend moved below the plot so labels never overlap on a phone.'},
    {sessionId:'22222222-2222-4222-8222-222222222222',summary:'Garden onboarding copy',cwd:'C:/Synthetic/garden',lastModified:at(50*60000),image:null,text:'Three shorter onboarding steps are ready. Each step has one action and a plain sentence explaining why it matters.'},
    {sessionId:'33333333-3333-4333-8333-333333333333',summary:'Untitled sketch',cwd:'',lastModified:at(80*60000),image:null,text:''},
    {sessionId:'44444444-4444-4444-8444-444444444444',summary:'Atlas layout pass',cwd:'C:/Synthetic/atlas',lastModified:today-3*3600000,image:'Layout screenshot',text:'The settings page now wraps at narrow widths and keeps the save button visible.'},
    {sessionId:'55555555-5555-4555-8555-555555555555',summary:'Garden release notes',cwd:'C:/Synthetic/garden',lastModified:today-3*day,image:null,text:'Release notes are grouped into features, fixes and validation, with synthetic examples only.'},
    {sessionId:'66666666-6666-4666-8666-666666666666',summary:'Atlas performance check',cwd:'C:/Synthetic/atlas',lastModified:today-30*day,image:null,text:'Startup reads were reduced from five to two; the list renders before previews arrive.'},
  ];
}
async function pictures(page:Page){
  await page.goto('about:blank');
  return page.evaluate(()=>['#5b7fb8','#7aa37a'].map((colour,index)=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;const c=canvas.getContext('2d')!;c.fillStyle=colour;c.fillRect(0,0,320,200);c.fillStyle='rgba(255,255,255,.85)';for(let i=0;i<5;i++)c.fillRect(30+i*56,170-(index?30+i*18:120-i*20),36,index?30+i*18:120-i*20);return canvas.toDataURL('image/png').split(',')[1];}));
}
const plain=(text:string)=>text.replace(/\*\*/g,'');

async function phone(page:Page,width:number,theme:'dark'|'light'){
  const chats=synthetic(),[chart,layout]=await pictures(page);let hold=true,release=()=>{};const previewReads:string[][]=[];
  await page.setViewportSize({width,height:844});
  await page.addInitScript(theme=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-grid-key-'.repeat(3)}));localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({theme,palette:'neutral',scale:100,textSize:16}));},theme);
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),p=url.pathname;
    if(p==='/api/health')return route.fulfill({json:{protocol:1,name:'Synthetic PC',roots:['C:/Synthetic/atlas','C:/Synthetic/garden'],version:'0.27.0'}});
    if(p==='/api/projects')return route.fulfill({json:['C:/Synthetic/atlas','C:/Synthetic/garden']});
    if(p==='/api/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true,models:[]}]});
    if(p==='/api/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
    if(p==='/api/sessions')return route.fulfill({json:chats.map(({image:_i,text:_t,...chat})=>chat)});
    if(p==='/api/sessions/previews'){
      const ids=(url.searchParams.get('ids')||'').split(',');previewReads.push(ids);
      if(hold)await new Promise<void>(resolve=>release=resolve);
      return route.fulfill({json:{previews:ids.map(id=>{const chat=chats.find(c=>c.sessionId===id)!;return {sessionId:id,lastModified:chat.lastModified,text:plain(chat.text),image:chat.image?{name:chat.image}:null};})}});
    }
    const image=/^\/api\/sessions\/([^/]+)\/preview-image$/.exec(p);
    if(image)return route.fulfill({json:{name:'synthetic.png',mimeType:'image/png',data:image[1].startsWith('1111')?chart:layout}});
    if(/\/messages$/.test(p)){const chat=chats.find(c=>p.includes(c.sessionId));return route.fulfill({json:{messages:[{id:'q',role:'user',blocks:[{type:'text',text:'Please continue the synthetic task.'}]},...Array.from({length:6},(_,i)=>({id:'a'+i,role:'assistant',blocks:[{type:'text',text:(chat?.text||'Synthetic answer.')+'\n\n'+'Additional synthetic paragraph for scrolling. '.repeat(6)}]}))],previous:null,next:null,total:7}});}
    if(p.endsWith('notifications'))return route.fulfill({json:{items:[],unread:0}});
    return route.fulfill({json:[]});
  });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('.session-row').filter({hasText:'Atlas chart review'})).toBeVisible();
  return {chats,previewReads,release:()=>{hold=false;release();}};
}
const columns=(page:Page,group:string)=>page.getByRole('region',{name:group,exact:true}).locator('.chat-tile').evaluateAll(tiles=>new Set(tiles.map(tile=>Math.round(tile.getBoundingClientRect().left))).size);

for(const [width,theme] of [[390,'dark'],[390,'light'],[320,'dark']] as const)test(`phone chat grid by date and project at ${width}px ${theme}`,async({page})=>{
  const state=await phone(page,width,theme);
  // The list view is unchanged and reads no previews.
  expect(state.previewReads).toHaveLength(0);
  const view=page.getByRole('group',{name:'Chat list view'});
  await expect(view.getByRole('button',{name:'List',exact:true})).toHaveAttribute('aria-pressed','true');
  await view.getByRole('button',{name:'Grid',exact:true}).click();
  await expect(page.locator('.chat-tile-skeleton').first()).toBeVisible();
  state.release();
  for(const heading of ['Today','Yesterday','This week','Earlier'])await expect(page.getByRole('region',{name:heading,exact:true})).toBeVisible();
  const chart=page.getByRole('button',{name:'Atlas chart review',exact:true});
  await expect(chart.locator('.chat-tile-text')).toHaveText(/^The chart now uses the shared palette/);
  await expect(chart.locator('img')).toBeVisible();
  await expect(page.getByRole('button',{name:'Garden onboarding copy',exact:true}).locator('img')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Untitled sketch',exact:true}).locator('.chat-tile-text')).toHaveText('No AI reply yet');
  expect(await columns(page,'Today')).toBe(width>=390?2:1);
  for(const tile of await page.locator('.chat-tile').all()){const box=(await tile.boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(48);expect(box.x+box.width).toBeLessThanOrEqual(width);}
  for(const button of await page.locator('.chat-view-switch button').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(state.previewReads.flat().length).toBeLessThanOrEqual(6);
  await page.screenshot({path:`.local/chat-grid-date-${width}-${theme}.png`});
  const grouping=page.getByRole('group',{name:'Group chats'});
  await grouping.getByRole('button',{name:'By project',exact:true}).click();
  await expect(page.locator('.chat-grid-group>h2')).toHaveText([/^atlas3$/,/^garden2$/,/^No project1$/]);
  await page.screenshot({path:`.local/chat-grid-project-${width}-${theme}.png`});
  // Both choices are remembered on this device.
  await page.reload();
  await expect(page.getByRole('group',{name:'Chat list view'}).getByRole('button',{name:'Grid',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('group',{name:'Group chats'}).getByRole('button',{name:'By project',exact:true})).toHaveAttribute('aria-pressed','true');
  // Keyboard: a tile opens the chat exactly like a list row.
  const tile=page.getByRole('button',{name:'Atlas chart review',exact:true});await tile.focus();
  expect(await tile.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chat-header-conversation h1')).toHaveText('Atlas chart review');
  await expect(page.locator('.message').first()).toBeVisible();
  // Round floating header buttons over a transparent top edge.
  const conversation=page.locator('.conversation');await conversation.evaluate(el=>{el.scrollTop=360;el.dispatchEvent(new Event('scroll'));});
  const look=await page.locator('.chat-header-conversation').evaluate(header=>{const style=(selector:string)=>{const el=header.querySelector(selector);return el?{bg:getComputedStyle(el).backgroundColor,radius:parseFloat(getComputedStyle(el).borderTopLeftRadius),height:el.getBoundingClientRect().height}:null;};return {band:getComputedStyle(header.closest('.chat-overlay-top')!).backgroundColor,header:getComputedStyle(header).backgroundColor,back:style('.mobile-back'),title:style('.header-title'),inbox:style('.board-notifications-trigger')};});
  expect(look.band).toBe('rgba(0, 0, 0, 0)');expect(look.header).toBe('rgba(0, 0, 0, 0)');
  for(const part of [look.back,look.title])if(part){expect(part.bg).not.toBe('rgba(0, 0, 0, 0)');expect(part.radius).toBeGreaterThanOrEqual(20);expect(part.height).toBeGreaterThanOrEqual(48);}
  expect(look.back).not.toBeNull();
  expect(await conversation.evaluate(el=>getComputedStyle(el).maskImage)).toContain('linear-gradient');
  await page.screenshot({path:`.local/chat-header-${width}-${theme}.png`});
  await page.getByRole('button',{name:'Back to chats',exact:true}).click();
  await expect(page.getByRole('button',{name:'Atlas chart review',exact:true})).toBeVisible();
});

test('reduced transparency and forced colours keep solid header pills',async({page})=>{
  await phone(page,390,'dark').then(state=>state.release());
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const back=page.locator('.chat-header-conversation .mobile-back');
  await page.emulateMedia({forcedColors:'active'});
  expect(await back.evaluate(el=>getComputedStyle(el).backdropFilter)).toBe('none');
  await page.emulateMedia({forcedColors:'none'});
  expect(await back.evaluate(el=>getComputedStyle(el).backdropFilter)).toContain('blur');
});

async function desktop(page:Page){
  const chats=synthetic(),[chart,layout]=await pictures(page);
  await page.addInitScript(({chats,chart,layout})=>{
    localStorage.setItem('pocket-code-language-v1','en');
    const listeners:((event:{data:unknown})=>void)[]=[];const state={online:true,busy:false,status:'Pocket Code · connected',startup:false,autoReconnect:true,internet:true,addresses:[]};
    const reply=(id:number,value:unknown)=>setTimeout(()=>listeners.forEach(listener=>listener({data:{id,value:structuredClone(value)}})),10);
    (window as any).previewReads=0;
    (window as any).chrome={webview:{addEventListener(_type:string,fn:(event:{data:unknown})=>void){listeners.push(fn);},postMessage(message:any){
      const {id,action}=message;if(action==='state'||action==='pairing-role'||action==='settings'){reply(id,state);return;}
      const url=new URL('https://example.invalid'+(message.endpoint||'/')),p=url.pathname;
      if(p==='/health'){reply(id,{name:'Synthetic PC',roots:['C:/Synthetic/atlas','C:/Synthetic/garden'],version:'0.27.0',protocol:1});return;}
      if(p==='/providers'){reply(id,[{id:'claude',available:true,models:[]}]);return;}
      if(p==='/workspaces'){reply(id,{host:true,canManageWorkspaces:true,workspaces:[],boards:[]});return;}
      if(p==='/sessions'){reply(id,chats.map(({image:_i,text:_t,...chat}:any)=>chat));return;}
      if(p==='/sessions/previews'){(window as any).previewReads++;const ids=(url.searchParams.get('ids')||'').split(',');reply(id,{previews:ids.map(sessionId=>{const chat=chats.find((c:any)=>c.sessionId===sessionId)!;return {sessionId,lastModified:chat.lastModified,text:chat.text.replace(/\*\*/g,''),image:chat.image?{name:chat.image}:null};})});return;}
      const image=/^\/sessions\/([^/]+)\/preview-image$/.exec(p);if(image){reply(id,{name:'synthetic.png',mimeType:'image/png',data:image[1].startsWith('1111')?chart:layout});return;}
      if(p.endsWith('/messages')){const chat=chats.find((c:any)=>p.includes(c.sessionId));reply(id,{messages:[{id:'q',role:'user',blocks:[{type:'text',text:'Please continue the synthetic task.'}]},...Array.from({length:6},(_,i)=>({id:'a'+i,role:'assistant',blocks:[{type:'text',text:(chat?.text||'Synthetic answer.')+'\n\n'+'Additional synthetic paragraph for scrolling. '.repeat(8)}]}))],previous:null,next:null,total:7});return;}
      if(p==='/projects'){reply(id,['C:/Synthetic/atlas','C:/Synthetic/garden']);return;}
      if(['/jobs','/activity','/devices'].includes(p)){reply(id,[]);return;}
      if(p.endsWith('notifications')){reply(id,{items:[],unread:0});return;}
      reply(id,{});
    }}};
  },{chats,chart,layout});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:5173/?desktop=1');
  await expect(page.getByRole('button',{name:/Atlas chart review/})).toBeVisible();
}
for(const theme of ['dark','light'] as const)test(`desktop chat grid fills the main area at 1440px ${theme}`,async({page})=>{
  await desktop(page);
  if(theme==='light')await page.evaluate(()=>{const value=JSON.parse(localStorage.getItem('pocket-code-appearance-v1')||'{}');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({...value,theme:'light'}));});
  if(theme==='light')await page.reload();
  await page.locator('.desktop-rail').getByRole('group',{name:'Chat list view'}).getByRole('button',{name:'Grid',exact:true}).click();
  const grid=page.locator('.desktop-chat-grid');await expect(grid).toBeVisible();
  await expect(grid.getByRole('button',{name:'Atlas chart review',exact:true}).locator('img')).toBeVisible();
  await expect(grid.getByRole('button',{name:'Garden onboarding copy',exact:true}).locator('.chat-tile-text')).toContainText('Three shorter onboarding steps');
  expect(await columns(page,'Today')).toBe(3);
  expect(await grid.locator('.chat-grid').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBeGreaterThanOrEqual(3);
  await page.screenshot({path:`.local/chat-grid-desktop-date-1440-${theme}.png`});
  await page.locator('.desktop-rail').getByRole('group',{name:'Group chats'}).getByRole('button',{name:'By project',exact:true}).click();
  await expect(grid.locator('.chat-grid-group>h2')).toHaveText([/^atlas3$/,/^garden2$/,/^No project1$/]);
  await page.screenshot({path:`.local/chat-grid-desktop-project-1440-${theme}.png`});
  const reads=await page.evaluate(()=>(window as any).previewReads);
  await grid.getByRole('button',{name:'Atlas layout pass',exact:true}).click();
  await expect(page.locator('.chat-header-conversation h1')).toHaveText('Atlas layout pass');
  await page.locator('.conversation').evaluate(el=>{el.scrollTop=420;el.dispatchEvent(new Event('scroll'));});
  expect(await page.locator('.chat-header-conversation .mobile-back').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({path:`.local/chat-header-desktop-1440-${theme}.png`});
  await page.getByRole('button',{name:'Back to chats',exact:true}).click();
  await expect(grid.getByRole('button',{name:'Atlas chart review',exact:true}).locator('img')).toBeVisible();
  // Returning to the grid reuses cached previews.
  expect(await page.evaluate(()=>(window as any).previewReads)).toBe(reads);
});
