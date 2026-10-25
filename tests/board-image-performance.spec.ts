import {test,expect} from '@playwright/test';
test('large board images use bounded shared thumbnails and open originals only in the viewer',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first().waitFor();
 const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1536;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#5480b0';ctx.fillRect(0,0,2048,1536);return canvas.toDataURL().split(',')[1];});
 let active=0,peak=0,calls=0;const reads=new Map<string,number>();
 await page.route('**/api/project-board/image?*',async route=>{const path=new URL(route.request().url()).searchParams.get('path')!;reads.set(path,(reads.get(path)||0)+1);active++;calls++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,40));await route.fulfill({json:{mimeType:'image/png',data:png}});active--;});
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{BoardImages}=await import('/src/BoardImages.tsx' as string);
  const root=document.createElement('div');document.body.replaceChildren(root);root.style.cssText='height:100vh;overflow:auto';
  const images=Array.from({length:24},(_,i)=>({path:'project-boards/assets/'+String(i).padStart(64,'0')+'.png',caption:'Synthetic image '+i}));
  createRoot(root).render(React.createElement('div',{},React.createElement(BoardImages,{connection:{url:location.origin,token:'synthetic-images'},root:'synthetic-project',images}),React.createElement(BoardImages,{connection:{url:location.origin,token:'synthetic-images'},root:'synthetic-project',images:[images[0]]})));
 });
 await expect(page.locator('.board-image-thumb img').first()).toBeVisible();await expect.poll(()=>page.locator('.board-image-thumb img').count()).toBeGreaterThan(2);expect(peak).toBeLessThanOrEqual(2);expect(calls).toBeLessThan(24);
 const dimensions=await page.locator('.board-image-thumb img').evaluateAll(images=>images.map(img=>({width:(img as HTMLImageElement).naturalWidth,height:(img as HTMLImageElement).naturalHeight,src:(img as HTMLImageElement).src})));expect(dimensions.every(i=>i.width<=256&&i.height<=256&&i.src.startsWith('blob:'))).toBe(true);
 await expect.poll(()=>active).toBe(0);expect(reads.get('project-boards/assets/'+ '0'.repeat(64)+'.png')).toBe(1);const before=calls;await page.getByRole('button',{name:'Open image: Synthetic image 0',exact:true}).first().click();await expect.poll(()=>calls).toBe(before+1);await expect.poll(()=>page.locator('.image-viewer img').evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBe(2048);
});
