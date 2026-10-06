import {test,expect} from '@playwright/test';
import {openConnectionSettings} from './qr-connect';
test('mobile starts offline with repository sections and Connection in Settings, without workspace administration',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');const nav=page.locator('.mobile-nav');
 for(const name of ['Board','Chats','Rules','Changelog','Settings'])await expect(nav.getByRole('button',{name,exact:true})).toBeVisible();
 for(const name of ['WorkSpace','Tasks','Project','Connection','Terminal'])await expect(nav.getByRole('button',{name,exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Create workspace',exact:true})).toHaveCount(0);await expect(page.getByLabel('Participant role')).toHaveCount(0);
 await openConnectionSettings(page);await expect(page.getByRole('button',{name:'Scan QR code',exact:true})).toBeVisible();await expect(page.getByLabel('Server URL')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('repository board survives a network outage; credentials remain scoped and revocation bypasses cache',async({page})=>{
 await page.setViewportSize({width:390,height:844});const root='C:\\Demo\\Atlas',connection={url:'http://127.0.0.1:4319',token:'synthetic-board-key'};
 await page.addInitScript(connection=>sessionStorage.setItem('connection',JSON.stringify(connection)),connection);
 const board={id:'22222222-2222-4222-8222-222222222222',name:'Roadmap',root,revision:0,notes:[],versions:[],branches:[],repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64)};
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p==='/api/project-board'?{board,canEdit:true}:p==='/api/health'?{protocol:1,roots:[root],name:'Synthetic host'}:p==='/api/providers'?[{id:'claude',available:true}]:p==='/api/projects'?[root]:p==='/api/workspaces'?{host:true,workspaces:[],boards:[]}:[]});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:/Roadmap/}).click();await expect(page.locator('.board-header')).toContainText('Roadmap');
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.abort('internetdisconnected'));await page.reload();await page.getByRole('button',{name:/Roadmap/}).click();await expect(page.locator('.board-header')).toContainText('Roadmap');
 const endpoint='/project-board?root='+encodeURIComponent(root);const isolated=await page.evaluate(async({connection,endpoint})=>{const {readOffline}=await import('/src/offline-data.ts' as string);return readOffline({...connection,token:'another-synthetic-token'},endpoint);},{connection,endpoint});expect(isolated).toBeUndefined();
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'Revoked'}}));
 const status=await page.evaluate(async({connection,endpoint})=>{const {request}=await import('/src/api.ts' as string);try{await request(connection,endpoint);return 'cached';}catch(e){return(e as any).status;}},{connection,endpoint});expect(status).toBe(401);
});
test('legacy workspace QR parser still distinguishes joining from PC pairing',async({page})=>{
 await page.goto('http://127.0.0.1:5173');const result=await page.evaluate(async()=>{const {parsePairingCode}=await import('/src/pairing.ts' as string);return parsePairingCode(JSON.stringify({type:'pocket-workspace',version:1,url:'http://192.168.1.10:4318',token:'synthetic-invitation-key-'.repeat(3),workspaceId:'11111111-1111-4111-8111-111111111111'}));});expect(result.workspaceInvite).toBe(true);expect(result.pairing).toBeUndefined();
});
