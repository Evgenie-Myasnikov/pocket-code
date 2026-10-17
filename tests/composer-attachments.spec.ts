import {openChatList,newChat} from './chat-navigation';
import {test,expect} from '@playwright/test';
async function fixture(page:import('@playwright/test').Page,width:number,height:number,stored?:unknown){
  await page.setViewportSize({width,height});
  await page.addInitScript(stored=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));if(stored)localStorage.setItem('pocket-code-composer',JSON.stringify(stored));},stored);
  const started:any[]=[];let sequence=0;
  await page.route('**/api/**',route=>{const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.17.2',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true}]});
    if(endpoint==='/sessions'||endpoint==='/jobs'&&req.method()==='GET')return route.fulfill({json:[]});
    if(endpoint==='/uploads'){const body=req.postDataJSON();return route.fulfill({json:{id:'upload-'+(++sequence),name:body.name,size:4}});}
    if(endpoint==='/jobs'&&req.method()==='POST'){const input=req.postDataJSON();started.push(input);return route.fulfill({json:{id:input.id,provider:'claude',cwd:'C:\\Fixture',sessionId:'session',status:'done',messages:[{id:'u'+started.length,role:'user',blocks:[{type:'text',text:input.text}]}],partial:'',approvals:[],startedAt:1,revision:1,baseMessageCount:0}});}
    if(endpoint.startsWith('/jobs/'))return route.fulfill({json:{id:endpoint.split('/')[2],provider:'claude',cwd:'C:\\Fixture',sessionId:'session',status:'done',messages:[],partial:'',approvals:[],startedAt:1,revision:1,baseMessageCount:0}});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    return route.fulfill({status:404,json:{error:'Fixture'}});
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await newChat(page);
  return started;
}
test('Enter can send when chosen in settings, Shift+Enter keeps a new line and Up brings back the last message',async({page})=>{
  const started=await fixture(page,390,844,{enterSends:true});
  const draft=page.getByRole('textbox',{name:'Message Claude'});
  await draft.fill('First line');await draft.press('Shift+Enter');await draft.press('KeyX');await expect(draft).toHaveValue('First line\nx');
  await draft.press('Enter');await expect.poll(()=>started.length).toBe(1);expect(started[0].text).toBe('First line\nx');
  await expect(draft).toHaveValue('');await draft.press('ArrowUp');await expect(draft).toHaveValue('First line\nx');
});
test('on a short screen the files fold into a chip and Send stays visible',async({page})=>{
  await fixture(page,390,420);
  await page.locator('input[type=file]').setInputFiles([{name:'one.md',mimeType:'text/markdown',buffer:Buffer.from('1')},{name:'two.md',mimeType:'text/markdown',buffer:Buffer.from('2')}]);
  const chip=page.getByRole('button',{name:/2 files/});await expect(chip).toBeVisible();await expect(page.locator('.attachment-tray')).toHaveCount(0);
  const send=page.getByRole('button',{name:'Send message',exact:true});const box=(await send.boundingBox())!;expect(box.y+box.height).toBeLessThanOrEqual(420);
  await expect(page.locator('.welcome')).toBeHidden();
  await chip.click();await expect(page.locator('.attachment-tray .draft-attachment')).toHaveCount(2);
});
test('each file has its own card: a failed upload names the file and retries, a long paste becomes text that can be put back',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
  let failures=1,sequence=0;const started:any[]=[];
  await page.route('**/api/**',route=>{const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.17.2',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true}]});
    if(endpoint==='/sessions'||endpoint==='/jobs'&&req.method()==='GET')return route.fulfill({json:[]});
    if(endpoint==='/uploads'){const body=req.postDataJSON();if(body.name==='flaky.md'&&failures-->0)return route.fulfill({status:400,json:{error:'Synthetic upload failure'}});return route.fulfill({json:{id:'upload-'+(++sequence),name:body.name,size:Buffer.from(body.base64,'base64').length}});}
    if(endpoint==='/jobs'&&req.method()==='POST'){const input=req.postDataJSON();started.push(input);return route.fulfill({json:{id:input.id,provider:'claude',cwd:'C:\\Fixture',status:'done',messages:[],partial:'',approvals:[],startedAt:1,revision:1,baseMessageCount:0}});}
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    return route.fulfill({status:404,json:{error:'Fixture'}});
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await newChat(page);
  await page.locator('input[type=file]').setInputFiles([{name:'notes.md',mimeType:'text/markdown',buffer:Buffer.from('# Notes')},{name:'flaky.md',mimeType:'text/markdown',buffer:Buffer.from('# Flaky')}]);
  const tray=page.locator('.attachment-tray'),flaky=tray.locator('.draft-attachment',{hasText:'flaky.md'});
  await expect(flaky).toContainText('Upload failed');await expect(flaky).toHaveAttribute('title',/flaky\.md: Synthetic upload failure/);
  const draft=page.getByRole('textbox',{name:'Message Claude'}),send=page.getByRole('button',{name:'Send message',exact:true});
  await draft.fill('Review these');await expect(send).toBeDisabled();
  await flaky.getByRole('button',{name:'Retry'}).click();await expect(flaky).not.toContainText('Upload failed');await expect(send).toBeEnabled();
  // A long paste is attached as text and can be inserted back into the message.
  const long='Synthetic log line\n'.repeat(700);
  await draft.focus();await page.evaluate(text=>{const data=new DataTransfer();data.setData('text/plain',text);document.querySelector('.prompt-composer textarea')!.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},long);
  const pasted=tray.locator('.draft-attachment',{hasText:'Pasted text'});await expect(pasted.getByRole('button',{name:'Insert as text'})).toBeVisible();
  await expect(page.locator('.attachment-count')).toContainText('3 files');
  await pasted.getByRole('button',{name:'Insert as text'}).click();await expect(pasted).toHaveCount(0);await expect(draft).toHaveValue(/^Review these\n\nSynthetic log line/);
  await send.click();await expect.poll(()=>started.length).toBe(1);expect(started[0].attachments).toEqual(['upload-1','upload-2']);
});
