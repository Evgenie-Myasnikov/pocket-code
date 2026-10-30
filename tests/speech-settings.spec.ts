import {test,expect} from '@playwright/test';
test('Speech settings persist the selected engine and speaker and preview that speaker',async({page})=>{
 await page.route('**/api/speech/status',r=>r.fulfill({json:{ready:true,installing:false,voices:10}}));
 const requests:any[]=[];await page.route('**/api/speech/synthesize',r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{audio:'AAAA',mime:'audio/wav'}});});
 await page.addInitScript(()=>{(window as any).Audio=class{onended:(()=>void)|undefined;onerror:(()=>void)|undefined;play(){setTimeout(()=>this.onended?.(),100);return Promise.resolve();}pause(){}};});
 await page.goto('http://127.0.0.1:5173');
 const mount=()=>page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{SpeechSettingsPanel}=await import('/src/SpeechSettings.tsx' as string);const host=document.createElement('div');document.body.replaceChildren(host);createRoot(host).render(React.createElement(SpeechSettingsPanel,{connection:{url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}}));});
 await mount();await expect(page.getByText('Local voices installed',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Supertonic 3 voice').locator('option')).toHaveCount(10);
 await page.getByLabel('Speech engine').selectOption('supertonic');await page.getByLabel('Supertonic 3 voice').selectOption('7');await page.getByRole('button',{name:'Preview voice',exact:true}).click();await expect.poll(()=>requests.length).toBe(1);expect(requests[0]).toMatchObject({voice:7,language:'en'});await expect(page.getByRole('button',{name:'Preview voice',exact:true})).toBeVisible();
 await page.reload();await mount();await expect(page.getByLabel('Speech engine')).toHaveValue('supertonic');await expect(page.getByLabel('Supertonic 3 voice')).toHaveValue('7');
});
