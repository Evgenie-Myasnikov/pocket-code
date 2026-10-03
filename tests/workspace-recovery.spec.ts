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
