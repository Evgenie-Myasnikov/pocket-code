import {test,expect} from '@playwright/test';
const ws='11111111-1111-4111-8111-111111111111',board='22222222-2222-4222-8222-222222222222';
test('mobile starts offline with separate Connection and WorkSpace, without administration',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
 const nav=page.locator('.mobile-nav');await nav.getByRole('button',{name:'WorkSpace',exact:true}).click();await expect(page.getByRole('button',{name:'Scan QR code',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Create workspace',exact:true})).toHaveCount(0);await expect(page.getByLabel('Participant role')).toHaveCount(0);
 await nav.getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('.settings-index')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'artifacts/screenshots/mobile-offline-settings.png'});
 await expect(nav.getByRole('button',{name:'Connection',exact:true})).toHaveCount(0);
 await page.locator('.settings-index').getByRole('button',{name:/PC connection/i}).click();
 await expect(page.getByRole('button',{name:'Scan QR code',exact:true})).toBeVisible();
});
test('workspace catalog and board survive a network outage; credentials remain scoped',async({page})=>{
 await page.setViewportSize({width:390,height:844});const access={url:'http://127.0.0.1:4319',token:'synthetic-workspace-key-'.repeat(3),workspaceId:ws,workspaceOnly:true};
 await page.addInitScript(access=>sessionStorage.setItem('connection',JSON.stringify(access)),access);
 const catalog={host:false,activeWorkspaceId:ws,canManageWorkspaces:false,workspaces:[{id:ws,name:'Atlas team',roots:['C:\\Demo\\Atlas'],role:'viewer',me:{id:'member',name:'Alex Morgan',needsName:false},people:[{id:'member',name:'Alex Morgan',role:'viewer'}]}],boards:[{id:board,workspaceId:ws,name:'Roadmap',root:'C:\\Demo\\Atlas',noteCount:0}]};
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p==='/api/workspaces'?catalog:p==='/api/boards/'+board?{id:board,workspaceId:ws,name:'Roadmap',root:'C:\\Demo\\Atlas',revision:0,notes:[],versions:[],branches:[]}:p==='/api/health'?{protocol:1,roots:[],name:'Synthetic host'}:[]});});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'WorkSpace',exact:true}).click();await page.getByRole('button',{name:/Roadmap/}).click();await expect(page.locator('.board-header')).toContainText('Roadmap');
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.abort('internetdisconnected'));await page.reload();
 await expect(page.getByRole('button',{name:/Roadmap/})).toBeVisible();await page.getByRole('button',{name:/Roadmap/}).click();await expect(page.locator('.board-header')).toContainText('Roadmap');await expect(page.getByText('Offline · saved data, read-only')).toBeVisible();
 const isolated=await page.evaluate(async access=>{const {readOffline}=await import('/src/offline-data.ts' as string);return readOffline({...access,token:'another-synthetic-token'},'/workspaces?workspaceId='+access.workspaceId);},access);expect(isolated).toBeUndefined();
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'Revoked'}}));
 const status=await page.evaluate(async access=>{const {request}=await import('/src/api.ts' as string);try{await request(access,'/workspaces?workspaceId='+access.workspaceId);return 'cached';}catch(e){return (e as any).status;}},access);expect(status).toBe(401);
});
test('workspace QR parser distinguishes joining from PC pairing',async({page})=>{
 await page.goto('http://127.0.0.1:5173');const result=await page.evaluate(async()=>{const {parsePairingCode}=await import('/src/pairing.ts' as string);return parsePairingCode(JSON.stringify({type:'pocket-workspace',version:1,url:'http://192.168.1.10:4318',token:'synthetic-invitation-key-'.repeat(3),workspaceId:'11111111-1111-4111-8111-111111111111'}));});expect(result.workspaceInvite).toBe(true);expect(result.pairing).toBeUndefined();
});
