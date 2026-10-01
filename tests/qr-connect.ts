import type {Page} from '@playwright/test';
import QRCode from 'qrcode';

/** Exercise actual QR decoding with synthetic credentials, never private pairing data. */
export async function connectByQr(page:Page,url='http://127.0.0.1:4319',token='test-only-'.repeat(5)){
  const buffer=await QRCode.toBuffer(JSON.stringify({type:'pocket-code',version:1,url,token}),{width:640,margin:4});
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({name:'synthetic-pairing.png',mimeType:'image/png',buffer});
}
