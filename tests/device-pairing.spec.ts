import {test,expect} from '@playwright/test';
test('mobile exchanges a v2 QR for a device credential and leaves after revocation',async({page})=>{
 const qr='synthetic-qr-key-'.repeat(3),token='synthetic-device-key-'.repeat(3),deviceId='33333333-3333-4333-8333-333333333333';let pairs=0;
 await page.addInitScript(({qr})=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:qr,pairing:true})),{qr});
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({json:p==='/api/health'?{protocol:1,roots:['C:\\Demo'],name:'Test host'}:p==='/api/providers'?[]:[]});});
 await page.route('**/api/devices/pair',route=>{expect(route.request().headers().authorization).toBe('Bearer '+qr);pairs++;return route.fulfill({json:{deviceId,token}});});
 await page.route('**/api/devices/heartbeat',route=>{expect(route.request().headers().authorization).toBe('Bearer '+token);return route.fulfill({json:{ok:true}});});
 await page.route('**/api/revoked-probe',route=>route.fulfill({status:401,json:{error:'Disconnected by PC'}}));
 await page.goto('http://127.0.0.1:5173');await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('connection')||'{}').deviceId)).toBe(deviceId);expect(pairs).toBe(1);
 const parsed=await page.evaluate(async()=>{const {parsePairingCode}=await import('/src/pairing.ts' as string);return parsePairingCode(JSON.stringify({type:'pocket-code',version:2,url:'http://127.0.0.1:4319',token:'synthetic-qr-key-'.repeat(3)}));});expect(parsed.pairing).toBe(true);
 await page.evaluate(async()=>{const api=await import('/src/api.ts' as string);await api.request(JSON.parse(sessionStorage.getItem('connection')!),'/revoked-probe').catch(()=>{});});
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('connection'))).toBe(null);await expect(page.getByRole('button',{name:'Scan QR code',exact:true})).toBeVisible();
});
