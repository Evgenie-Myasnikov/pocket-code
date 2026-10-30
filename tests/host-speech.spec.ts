import {test,expect} from '@playwright/test';
test('stopping local read-aloud ignores audio returned after cancellation',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);let calls=0;
 await page.route('**/api/speech/synthesize',async route=>{calls++;await gate;await route.fulfill({json:{audio:'AAAA',mime:'audio/wav'}});});
 await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
  (window as any).audioStarts=0;(window as any).Audio=class{play(){(window as any).audioStarts++;return Promise.resolve();}pause(){}};
  const {HostSpeechAdapter}=await import('/src/host-speech.ts' as string);(window as any).speechUtterance=new HostSpeechAdapter({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)},3).speak('Speech example');
 });
 await expect.poll(()=>calls).toBe(1);await page.evaluate(()=>(window as any).speechUtterance.cancel());release();
 await expect.poll(()=>page.evaluate(()=>(window as any).speechUtterance.status.reason)).toBe('cancelled');await page.waitForTimeout(100);expect(await page.evaluate(()=>(window as any).audioStarts)).toBe(0);
});
