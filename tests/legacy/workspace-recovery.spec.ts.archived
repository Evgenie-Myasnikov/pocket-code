import {test,expect} from '@playwright/test';
const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';
test('mobile switches saved workspaces from the header and restores selection',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const accesses=[{url:'http://127.0.0.1:4319',token:'synthetic-atlas-token',workspaceId:first,name:'Atlas team'},{url:'http://127.0.0.1:4319',token:'synthetic-garden-token',workspaceId:second,name:'Garden team'}];
 await page.addInitScript(accesses=>{if(!sessionStorage.getItem('connection'))sessionStorage.setItem('connection',JSON.stringify({...accesses[0],workspaceOnly:true,workspaceAccesses:accesses}));},accesses);
 await page.route('**/api/**',route=>{const url=new URL(route.request().url()),id=url.searchParams.get('workspaceId')||first;return route.fulfill({json:url.pathname==='/api/workspaces'?{host:false,workspaces:[{id,name:id===first?'Atlas team':'Garden team',roots:[],role:'viewer',me:{id:'person',name:'Alex Example',needsName:false},people:[{id:'person',name:'Alex Example',role:'viewer'}]}],boards:[]}:url.pathname==='/api/health'?{protocol:1,roots:[],name:'Synthetic PC'}:[]});});
 await page.goto('http://127.0.0.1:5173');
 const picker=page.locator('.mobile-workspace-header select');await expect(picker).toHaveValue(accesses[0].url+'|'+first);
 await picker.selectOption(accesses[1].url+'|'+second);await expect(page.getByRole('button',{name:'Participants: 1',exact:true})).toHaveCount(1);
 await page.reload();await expect(picker).toHaveValue(accesses[1].url+'|'+second);
 await page.getByRole('button',{name:'Participants: 1',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Alex Example');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/workspace-header.png'});
});

test('a member can rename their own profile from the participant list',async({page})=>{
 let name='Alex Example';const connection={url:'http://127.0.0.1:4319',token:'synthetic-profile-token',workspaceId:first,workspaceOnly:true};
 await page.addInitScript(c=>sessionStorage.setItem('connection',JSON.stringify(c)),connection);
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/profile')){name=route.request().postDataJSON().name;return route.fulfill({json:{ok:true}});}return route.fulfill({json:url.pathname==='/api/workspaces'?{host:false,workspaces:[{id:first,name:'Atlas team',roots:[],role:'viewer',me:{id:'person',name,needsName:false},people:[{id:'person',name,role:'viewer'}]}],boards:[]}:url.pathname==='/api/health'?{protocol:1,roots:[],name:'Synthetic PC'}:[]});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Participants: 1'}).click();await page.getByRole('button',{name:'Rename yourself'}).click();await page.getByLabel('First name',{exact:true}).fill('Alex');await page.getByRole('dialog',{name:'Your name',exact:true}).getByLabel('Last name',{exact:true}).fill('Updated');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('dialog',{name:'Your name',exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Participants',exact:true})).toContainText('Alex Updated');expect(name).toBe('Alex Updated');
});

test('cached personal chats survive failed health and provider discovery on startup',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
  const connection={url:'http://127.0.0.1:4319',token:'synthetic-offline-personal-token'};
  sessionStorage.setItem('connection',JSON.stringify(connection));
  const {chatCacheScope,writeChatCache}=await import('/src/chat-cache.ts' as string);const scope=await chatCacheScope(connection);
  writeChatCache(scope,'claude','sessions',[{sessionId:'cached-chat',summary:'Cached planning conversation',cwd:'C:\\Demo\\Atlas',lastModified:1}]);
 });
 await page.route('**/api/**',route=>route.abort('internetdisconnected'));await page.reload();
 await page.locator('.mobile-nav').getByRole('button',{name:'Chats',exact:true}).click();
 await expect(page.getByText('Cached planning conversation',{exact:true})).toBeVisible();
});

for(const reuse of [false,true])test('workspace name requires both fields; saved profile reuse='+reuse,async({page})=>{
 let profile:any={id:'person',name:'',needsName:true};const connection={url:'http://127.0.0.1:4319',token:'synthetic-identity-token',workspaceId:first,workspaceOnly:true};
 await page.addInitScript(({connection,reuse})=>{sessionStorage.setItem('connection',JSON.stringify(connection));if(reuse)localStorage.setItem('pocket-own-profile',JSON.stringify({firstName:'Alex',lastName:'Example'}));},{connection,reuse});
 await page.route('**/api/**',route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/profile')){profile={...profile,...route.request().postDataJSON(),needsName:false};return route.fulfill({json:{ok:true}});}return route.fulfill({json:url.pathname==='/api/workspaces'?{host:false,workspaces:[{id:first,name:'Atlas team',roots:[],role:'viewer',me:profile,people:profile.needsName?[]:[{id:'person',name:profile.name,role:'viewer'}]}],boards:[]}:url.pathname==='/api/health'?{protocol:1,roots:[],name:'Synthetic PC'}:[]});});
 await page.goto('http://127.0.0.1:5173');
 if(!reuse){await page.getByLabel('What is your name?').fill('Alex');await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();await page.getByLabel('Last name',{exact:true}).fill('Example');await page.getByRole('button',{name:'Continue',exact:true}).click();}
 await expect.poll(()=>profile.firstName).toBe('Alex');expect(profile.lastName).toBe('Example');await expect(page.getByRole('dialog',{name:'Your workspace name'})).not.toBeVisible();
});

test('mobile notification opens its board and highlights the original note',async({page})=>{
 const connection={url:'http://127.0.0.1:4319',token:'synthetic-notice-token',workspaceId:first,workspaceOnly:true};const boardId='33333333-3333-4333-8333-333333333333',noteId='44444444-4444-4444-8444-444444444444';let read=false;
 await page.setViewportSize({width:390,height:844});await page.addInitScript(c=>sessionStorage.setItem('connection',JSON.stringify(c)),connection);
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p==='/api/workspaces'?{host:false,workspaces:[{id:first,name:'Example team',roots:['C:\\Demo\\Atlas'],role:'viewer',me:{id:'person',name:'Alex Example',needsName:false},people:[]}],boards:[]}:p==='/api/health'?{protocol:1,roots:[],name:'Synthetic PC'}:p==='/api/board-notifications'?{items:[{id:'notice',boardId,noteId,kind:'question',title:'Check acceptance',message:'Which output format?',at:1}]}:p==='/api/board-notifications/read'?(read=true,{ok:true}):p==='/api/boards/'+boardId?{id:boardId,name:'Source board',root:'C:\\Demo\\Atlas',revision:1,versionSource:'planned',versions:[],notes:[{id:noteId,title:'Check acceptance',description:'Expected result',branch:'',status:'questions',owner:'',x:20,y:900,dependencies:[]}]}:[]});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Board notifications',exact:true}).click();await page.getByRole('button',{name:/Clarification requested.*Check acceptance/}).click();await expect(page.getByRole('dialog',{name:'Note details'})).toContainText('Which output format?');await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Check acceptance');await expect.poll(()=>read).toBe(true);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.board-note-highlight')).toBeInViewport();
});
