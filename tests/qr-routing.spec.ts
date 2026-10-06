import {test,expect} from '@playwright/test';
import QRCode from 'qrcode';
test('PC connection rejects workspace QR while legacy join API preserves password, approval and revocation',async({page,request})=>{
 const url='http://127.0.0.1:4319',headers={Authorization:'Bearer '+'test-only-'.repeat(5)};
 const health=await (await request.get(url+'/api/health',{headers})).json();
 const ws=await (await request.post(url+'/api/workspaces',{headers,data:{name:'QR routing '+Date.now(),password:'synthetic-password',roots:[health.roots[0]]}})).json();
 const invitation=await request.post(url+'/api/workspaces/'+ws.id+'/invitation',{headers,data:{role:'viewer'}});expect(invitation.ok()).toBeTruthy();const {token}=await invitation.json();
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'PC connection',exact:true}).click();
 const buffer=await QRCode.toBuffer(JSON.stringify({type:'pocket-workspace',version:1,url,token,workspaceId:ws.id}),{width:640,margin:4});await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer});
 await expect(page.getByRole('alert')).toContainText(/workspace|WorkSpace/i);await expect(page.getByLabel('Workspace password',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>sessionStorage.getItem('connection'))).toBeNull();
 const invitationHeaders={Authorization:'Bearer '+token};expect((await request.post(url+'/api/workspace-join',{headers:invitationHeaders,data:{password:'wrong-password'}})).status()).toBe(401);
 const joined=await request.post(url+'/api/workspace-join',{headers:invitationHeaders,data:{password:'synthetic-password'}});expect(joined.ok()).toBe(true);const access=await joined.json(),memberHeaders={Authorization:'Bearer '+access.token};expect(access.workspaceId).toBe(ws.id);
 expect((await request.get(url+'/api/health',{headers:memberHeaders})).status()).toBe(403);
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/profile',{headers:memberHeaders,data:{name:'Taylor Example',firstName:'Taylor',lastName:'Example'}})).ok()).toBe(true);
 const catalog=await (await request.get(url+'/api/workspaces',{headers})).json();const member=catalog.workspaces.find((w:any)=>w.id===ws.id).members.find((m:any)=>m.name==='Taylor Example');expect(member.approval).toBe('pending');
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/member',{headers,data:{memberId:member.id,approval:'approved'}})).ok()).toBeTruthy();
 expect((await request.get(url+'/api/health',{headers:memberHeaders})).ok()).toBe(true);
 const resumed=await (await request.post(url+'/api/workspace-join',{headers:invitationHeaders,data:{previousToken:access.token}})).json();expect(resumed.token).toBe(access.token);
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/member',{headers,data:{memberId:member.id,remove:true}})).ok()).toBeTruthy();
 expect((await request.get(url+'/api/workspaces',{headers:memberHeaders})).status()).toBe(401);
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/delete',{headers,data:{}})).ok()).toBe(true);
});
test('Pairing retries exchange the QR again after the previous credential is revoked',async({page})=>{
 let attempts=0;await page.route('**/api/devices/pair',route=>route.fulfill({json:{deviceId:'device-'+(++attempts),token:'synthetic-device-token-'.repeat(3)}}));await page.goto('http://127.0.0.1:5173');
 const ids=await page.evaluate(async()=>{const {pairDevice}=await import('/src/api.ts' as string);const c={url:'http://127.0.0.1:4319',token:'synthetic-qr-key-'.repeat(3),pairing:true};return [(await pairDevice(c,'test')).deviceId,(await pairDevice(c,'test')).deviceId];});expect(ids).toEqual(['device-1','device-2']);
});
