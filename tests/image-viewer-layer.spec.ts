import {test,expect} from '@playwright/test';
for(const width of [390,1280])for(const fade of [0,100])test(`image viewer covers chat at ${width}px with fade ${fade}`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async({fade})=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {RichBlock}=await import('/src/RichBlocks.tsx' as string);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#7b91bd';ctx.fillRect(0,0,600,300);
  const app=document.createElement('div');app.className='app show-chat';app.innerHTML='<main class="workspace chat-canvas" style="height:100vh"><div class="chat-overlay chat-overlay-top"><button>Underlying header</button></div><div class="conversation"><div class="conversation-inner"><p>Underlying conversation</p><div id="image-mount"></div></div></div><div class="chat-overlay chat-overlay-bottom"><textarea aria-label="Underlying input"></textarea></div></main>';document.body.replaceChildren(app);
  document.documentElement.dataset.chatEdgeFade=fade===0?'off':'on';
  createRoot(document.getElementById('image-mount')!).render(React.createElement(RichBlock,{block:{type:'image',data:canvas.toDataURL('image/png').split(',')[1],mimeType:'image/png'}}));
 },{fade});
 const thumbnail=page.getByRole('button',{name:'Open image',exact:true});await thumbnail.click();
 const viewer=page.getByRole('dialog',{name:'Image',exact:true});await expect(viewer.locator('img')).toBeVisible();
 const coverage=await viewer.evaluate(el=>{
  const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
  const points=[[2,2],[innerWidth-2,2],[2,innerHeight-2],[innerWidth-2,innerHeight-2],[innerWidth/2,40],[innerWidth/2,innerHeight-40]];
  let masked=false;for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(s.maskImage!=='none'||Number(s.opacity)<1)masked=true;}
  return {full:rect.x===0&&rect.y===0&&rect.width===innerWidth&&rect.height===innerHeight,top:points.every(([x,y])=>el.contains(document.elementFromPoint(x,y))),masked,background:style.backgroundColor};
 });
 expect(coverage.full).toBe(true);expect(coverage.top).toBe(true);expect(coverage.masked).toBe(false);expect(coverage.background).toMatch(/^rgb\(/);
 expect(await page.getByLabel('Underlying input').evaluate(el=>!!el.closest('[inert]'))).toBe(true);
 await viewer.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(viewer.getByLabel('Zoom',{exact:true})).toHaveText('1.5×');
 await page.screenshot({path:`.local/image-viewer-layer-${width}-${fade}.png`});
 await viewer.getByRole('button',{name:'Close',exact:true}).click();await expect(viewer).toHaveCount(0);await expect(thumbnail).toBeFocused();
 expect(await page.getByLabel('Underlying input').evaluate(el=>!!el.closest('[inert]'))).toBe(false);
});
