import {test,expect} from '@playwright/test';

const first='11111111-1111-4111-8111-111111111111',second='22222222-2222-4222-8222-222222222222';

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

test('mobile notification opens its board and highlights the original note',async({page})=>{
 const connection={url:'http://127.0.0.1:4319',token:'synthetic-notice-token'};const boardId='33333333-3333-4333-8333-333333333333',noteId='44444444-4444-4444-8444-444444444444';let read=false;
 await page.setViewportSize({width:390,height:844});await page.addInitScript(c=>sessionStorage.setItem('connection',JSON.stringify(c)),connection);
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p==='/api/workspaces'?{host:false,workspaces:[{id:first,name:'Example team',roots:['C:\\Demo\\Atlas'],role:'viewer',me:{id:'person',name:'Alex Example',needsName:false},people:[]}],boards:[]}:p==='/api/health'?{protocol:1,roots:['C:\\Demo\\Atlas'],name:'Synthetic PC'}:p==='/api/board-notifications'?{items:[{id:'notice',boardId,noteId,kind:'question',title:'Check acceptance',message:'Which output format?',at:1}]}:p==='/api/board-notifications/read'?(read=true,{ok:true}):p==='/api/boards/'+boardId?{id:boardId,name:'Source board',root:'C:\\Demo\\Atlas',revision:1,versionSource:'planned',versions:[],notes:[{id:noteId,title:'Check acceptance',description:'Expected result',branch:'',status:'questions',owner:'',x:20,y:900,dependencies:[]}]}:[]});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Board notifications',exact:true}).click();await page.getByRole('button',{name:/Clarification requested.*Check acceptance/}).click();await expect(page.getByRole('dialog',{name:'Note details'})).toContainText('Which output format?');await expect(page.getByLabel('Title',{exact:true})).toHaveValue('Check acceptance');await expect.poll(()=>read).toBe(true);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.board-note-highlight')).toBeInViewport();
});
