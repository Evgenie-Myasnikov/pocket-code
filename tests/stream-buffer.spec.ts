import {test,expect} from '@playwright/test';

test('live text buffers bursts and preserves its DOM and progress through final handoff',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{MessageList}=await import('/src/Messages.tsx' as string);
  const element=document.createElement('div');document.body.replaceChildren(element);const root=createRoot(element);
  let messages:any[]=[{id:'request',role:'user',blocks:[{type:'text',text:'Synthetic request'}]}],partialText='',streaming=true;
  const render=()=>root.render(React.createElement(MessageList,{messages,partialText,streaming}));
  Object.assign(window,{bufferAppend:(text:string)=>{partialText=text;render();},bufferFinish:(text:string)=>{messages=[...messages,{id:'finished',role:'assistant',blocks:[{type:'text',text}]}];partialText='';streaming=false;render();}});render();
 });
 await expect(page.locator('[data-message-id="request"]')).toBeVisible();
 const text='A smooth synthetic response with complete words. '.repeat(40);
 await page.evaluate(text=>(window as any).bufferAppend(text),text);
 const partial=page.locator('[data-message-id="partial"] .markdown');await expect(partial).toBeVisible();
 await expect.poll(()=>partial.innerText()).not.toBe('');
 const before=await partial.innerText();expect(before.length).toBeLessThan(text.trimEnd().length);
 await partial.evaluate(el=>(window as any).bufferNode=el);
 await page.evaluate(text=>(window as any).bufferFinish(text),text);
 const final=page.locator('[data-message-id="finished"] .markdown');await expect(final).toBeVisible();
 expect(await final.evaluate(el=>el===(window as any).bufferNode)).toBe(true);
 expect((await final.innerText()).length).toBeGreaterThanOrEqual(before.length);
 await expect(final).toHaveText(text.trimEnd(),{timeout:1200});await expect(page.locator('[data-message-id="partial"]')).toHaveCount(0);
});

test('reduced motion reveals the full buffered response without typing',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{Markdown}=await import('/src/RichBlocks.tsx' as string);const element=document.createElement('div');document.body.replaceChildren(element);createRoot(element).render(React.createElement(Markdown,{text:'Complete reduced motion response',streaming:true,animateInitial:true}));});
 await expect(page.locator('.markdown')).toHaveText('Complete reduced motion response');await expect(page.locator('.stream-glyph')).toHaveCount(0);
});
