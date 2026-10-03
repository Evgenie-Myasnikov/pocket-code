import {test,expect} from '@playwright/test';
import QRCode from 'qrcode';
test('Workspace QR scanned from Connection joins the workspace using the real host route',async({page,request})=>{
 const url='http://127.0.0.1:4319',headers={Authorization:'Bearer '+'test-only-'.repeat(5)};
 const health=await (await request.get(url+'/api/health',{headers})).json();
 const ws=await (await request.post(url+'/api/workspaces',{headers,data:{name:'QR routing '+Date.now(),password:'synthetic-password',roots:[health.roots[0]]}})).json();
 const invitation=await request.post(url+'/api/workspaces/'+ws.id+'/invitation',{headers,data:{role:'viewer'}});expect(invitation.ok()).toBeTruthy();const {token}=await invitation.json();
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'PC connection',exact:true}).click();
 const buffer=await QRCode.toBuffer(JSON.stringify({type:'pocket-workspace',version:1,url,token,workspaceId:ws.id}),{width:640,margin:4});await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer});
 await page.getByLabel('Workspace password',{exact:true}).fill('wrong-password');await page.getByRole('button',{name:'Join',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Incorrect workspace password');await page.getByLabel('Workspace password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Join',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('connection')||'{}').workspaceId)).toBe(ws.id);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.getByLabel('What is your name?').fill('Taylor');await page.getByLabel('Last name',{exact:true}).fill('Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Your workspace name'})).not.toBeVisible();
 await expect(page.getByRole('heading',{name:'Waiting for host approval'})).toBeVisible();
 const catalog=await (await request.get(url+'/api/workspaces',{headers})).json();const member=catalog.workspaces.find((w:any)=>w.id===ws.id).members.find((m:any)=>m.name==='Taylor Example');expect(member.approval).toBe('pending');
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/member',{headers,data:{memberId:member.id,approval:'approved'}})).ok()).toBeTruthy();
 await page.getByRole('button',{name:'Check status'}).click();await expect(page.getByRole('heading',{name:'Waiting for host approval'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Participants: 1'})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Workspace password',{exact:true})).toHaveCount(0);await expect(page.getByLabel('What is your name?')).toHaveCount(0);await expect(page.getByRole('button',{name:'Participants: 1'})).toBeVisible();
 expect((await request.post(url+'/api/workspaces/'+ws.id+'/member',{headers,data:{memberId:member.id,remove:true}})).ok()).toBeTruthy();
 const access=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('connection')||'{}'));expect((await request.get(url+'/api/workspaces',{headers:{Authorization:'Bearer '+access.token}})).status()).toBe(401);
});
test('Pairing retries exchange the QR again after the previous credential is revoked',async({page})=>{
 let attempts=0;await page.route('**/api/devices/pair',route=>route.fulfill({json:{deviceId:'device-'+(++attempts),token:'synthetic-device-token-'.repeat(3)}}));await page.goto('http://127.0.0.1:5173');
 const ids=await page.evaluate(async()=>{const {pairDevice}=await import('/src/api.ts' as string);const c={url:'http://127.0.0.1:4319',token:'synthetic-qr-key-'.repeat(3),pairing:true};return [(await pairDevice(c,'test')).deviceId,(await pairDevice(c,'test')).deviceId];});expect(ids).toEqual(['device-1','device-2']);
});
