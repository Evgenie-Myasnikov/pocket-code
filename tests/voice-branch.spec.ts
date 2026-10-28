import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
test('dictation appends to the draft without sending and ignores a late result after changing chat',async({page})=>{
 await desktop(page);
 await page.evaluate(async()=>{
  delete (window as any).chrome.webview;
  (window as any).SpeechRecognition=class {onresult:any;onend:any;start(){(window as any).recognition=this;}stop(){this.onend?.();}abort(){(window as any).aborted=true;}};
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{ChatComposer}=await import('/src/ChatComposer.tsx' as string);
  const el=document.createElement('div');document.body.replaceChildren(el);const root=createRoot(el);
  let text='Draft',scope='one';
  const render=()=>root.render(React.createElement(ChatComposer,{scopeKey:scope,text,label:'Message',placeholder:'Message',uploading:false,canSend:true,attachments:[],controls:null,stopLabel:'Stop',onText:(value:string)=>{text=value;render();},onRemove:()=>{},onFiles:()=>{},onSend:()=>{(window as any).sent=true;}}));
  (window as any).changeChat=()=>{scope='two';render();};render();
 });
 await page.getByRole('button',{name:'Voice input',exact:true}).click();
 await page.evaluate(()=>{const result:any=[{transcript:'spoken words'}];result.isFinal=true;(window as any).recognition.onresult({resultIndex:0,results:[result]});});
 await expect(page.getByRole('textbox',{name:'Message'})).toHaveValue('Draft spoken words');
 expect(await page.evaluate(()=>(window as any).sent)).toBeUndefined();
 await page.evaluate(()=>(window as any).changeChat());
 await expect.poll(()=>page.evaluate(()=>(window as any).aborted)).toBe(true);
 await page.evaluate(()=>{const result:any=[{transcript:'late words'}];result.isFinal=true;(window as any).recognition.onresult({resultIndex:0,results:[result]});});
 await expect(page.getByRole('textbox',{name:'Message'})).toHaveValue('Draft spoken words');
});
for(const regenerate of [false,true])test(`${regenerate?'regenerate':'edit'} sends to a separate native branch`,async({page})=>{
 await page.addInitScript(()=>{(window as any).branchMessages=[{id:'request',role:'user',blocks:[{type:'text',text:'Synthetic original request'}]},{id:'answer',role:'assistant',blocks:[{type:'text',text:'Synthetic answer'}]}];});
 await page.setViewportSize({width:1440,height:900});await desktop(page);await page.locator('.desktop-sessions>button').first().click();
 await page.getByRole('button',{name:regenerate?'Regenerate response':'Edit message',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('original conversation is kept');
 if(!regenerate)await dialog.getByRole('textbox').fill('Synthetic revised request');
 await dialog.getByRole('button',{name:regenerate?'Regenerate':'Save and send',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 const calls=await page.evaluate(()=>(window as any).desktopCalls);
 expect(calls.find((c:any)=>c.endpoint?.endsWith('/branch')).data.messageId).toBe('request');
 const sent=calls.find((c:any)=>c.endpoint==='/jobs'&&c.action==='write');
 expect(sent.data.sessionId).toBe('fork');expect(sent.data.text).toBe(regenerate?'Synthetic original request':'Synthetic revised request');
});
