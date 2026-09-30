import {test,expect,type Page} from '@playwright/test';

const root='C:\\Workspace\\chat-recovery';
const busyError='This chat is open in Codex on the PC. Its history is available here, but Codex must release the chat before you can send a message. Finish the task and close Codex on the PC, then try again.';
const message=(id:number)=>({id:`message-${id}`,role:'assistant',blocks:[{type:'text',text:`History message ${id}\n\nA saved reply with enough content to scroll through the conversation.`}]});
function gate(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return{promise,resolve};}
async function host(page:Page){
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api',''),provider=url.searchParams.get('provider')||'claude';
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic chat PC',roots:[root],protocol:1,version:'0.10.1'}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[{sessionId:'saved-chat',provider,summary:`Saved ${provider} chat`,cwd:root,lastModified:Date.now()}]});
    if(endpoint.includes('/messages'))return route.fulfill({json:{messages:[message(1)],previous:null,next:null}});
    if(endpoint==='/jobs')return route.fulfill({json:[]});
    if(endpoint==='/uploads')return route.fulfill({json:{id:'saved-upload',name:'notes.txt',size:4}});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
}
async function connect(page:Page,provider='codex'){
  await page.goto('http://127.0.0.1:5173');
  await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');await page.getByLabel('Connection key').fill('test-only-'.repeat(5));
  await page.getByRole('button',{name:'Connect computer',exact:true}).click();
  await page.locator('.workspace-picker-sidebar select').selectOption(provider);
  await page.getByRole('button',{name:`Saved ${provider} chat`}).click();
  await expect(page.getByText('History message 1',{exact:true})).toHaveCount(1);
}
async function submit(page:Page){
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByRole('button',{name:'Finished on PC — continue'}).click();
}
async function rejectedHost(page:Page){
  await host(page);const reject=gate(),sent:any[]=[];let job:any;
  await page.route('**/api/jobs',route=>{
    if(route.request().method()!=='POST')return route.fulfill({json:[]});
    const body=route.request().postDataJSON();sent.push(body);
    job={id:body.id,provider:'codex',sessionId:'saved-chat',cwd:root,status:'running',messages:[{id:body.id,role:'user',blocks:[{type:'text',text:body.text}]}],partial:'',approvals:[],startedAt:Date.now(),revision:0,baseMessageCount:1};
    return route.fulfill({json:job});
  });
  await page.route('**/api/jobs/*?revision=*',async route=>{
    const current={...job};await reject.promise;
    return route.fulfill({json:sent.length===1?{...current,status:'error',revision:1,errorCode:'codex_thread_busy',error:busyError}:{...current,status:'done',revision:1}});
  });
  return{reject,sent};
}

test('busy Codex restores the rejected draft and attachment without automatic resubmission',async({page})=>{
  const {reject,sent}=await rejectedHost(page);await connect(page);
  await page.getByLabel('Message Codex').fill('Continue my saved task');
  await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('note')});
  await expect(page.locator('.attachment-chip')).toContainText('notes.txt');await submit(page);
  await expect(page.getByLabel('Message Codex')).toHaveValue('');reject.resolve();
  await expect(page.getByRole('alert')).toContainText('Your message and attachments are back in the draft');
  await expect(page.getByLabel('Message Codex')).toHaveValue('Continue my saved task');await expect(page.locator('.attachment-chip')).toContainText('notes.txt');
  await expect(page.locator('.message.user')).toHaveCount(0);expect(sent).toHaveLength(1);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>sent.length).toBe(2);expect(sent[1].id).not.toBe(sent[0].id);expect(sent[1].attachments).toEqual(['saved-upload']);
  await expect(page.locator('.message.user')).toHaveCount(1);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('busy recovery preserves a newer draft and remains isolated when switching workspace',async({page})=>{
  const {reject,sent}=await rejectedHost(page);await connect(page);
  await page.getByLabel('Message Codex').fill('Unsent Codex task');
  await page.locator('input[type=file]').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('note')});
  await expect(page.locator('.attachment-chip')).toContainText('notes.txt');await submit(page);
  await expect(page.getByLabel('Message Codex')).toHaveValue('');await page.getByLabel('Message Codex').fill('Newer Codex draft');
  await page.locator('.workspace-picker-sidebar select').selectOption('claude');await page.getByLabel('Message Claude').fill('Private Claude draft');reject.resolve();
  await expect(page.getByLabel('Message Claude')).toHaveValue('Private Claude draft');await expect(page.locator('.attachment-chip')).toHaveCount(0);
  await page.locator('.workspace-picker-sidebar select').selectOption('codex');
  await expect(page.getByRole('alert')).toContainText('Your newer draft is unchanged');await expect(page.getByLabel('Message Codex')).toHaveValue('Newer Codex draft');
  await page.getByRole('button',{name:'Add unsent message to draft'}).click();
  await expect(page.getByLabel('Message Codex')).toHaveValue('Newer Codex draft\n\nUnsent Codex task');await expect(page.locator('.attachment-chip')).toContainText('notes.txt');
  expect(sent).toHaveLength(1);await page.locator('.workspace-picker-sidebar select').selectOption('claude');await expect(page.getByLabel('Message Claude')).toHaveValue('Private Claude draft');
});

test('scrolling to history edges loads automatically once and preserves the visible message',async({page})=>{
  await host(page);const expansion=gate(),windows:number[]=[];
  await page.route('**/api/sessions/saved-chat/messages?*',async route=>{
    const url=new URL(route.request().url()),window=Number(url.searchParams.get('window')),fromStart=url.searchParams.get('from')==='start';
    windows.push(window);
    if(window===200&&!fromStart)await expansion.promise;
    const start=fromStart?1:window===100?101:1,count=window===100?100:201;
    const messages=Array.from({length:count},(_,i)=>message(start+i));
    if(window===200)messages.push(message(201)); // Repeated server item must not duplicate a bubble.
    return route.fulfill({json:{messages,previous:!fromStart&&window===100?100:null,next:fromStart&&window===100?100:null}});
  });
  await page.goto('http://127.0.0.1:5173');await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');await page.getByLabel('Connection key').fill('test-only-'.repeat(5));await page.getByRole('button',{name:'Connect computer',exact:true}).click();await page.getByRole('button',{name:'Saved claude chat'}).click();
  await expect(page.locator('.message')).toHaveCount(100);
  await expect(page.getByRole('button',{name:/Load earlier messages|Load next messages/})).toHaveCount(0);
  const scroller=page.locator('.conversation');
  await expect.poll(()=>scroller.evaluate(el=>el.scrollTop)).toBeGreaterThan(1000);
  await scroller.evaluate(el=>{el.scrollTo({top:0,behavior:'instant'});el.dispatchEvent(new Event('scroll'));el.dispatchEvent(new Event('scroll'));});
  await expect.poll(()=>windows.filter(window=>window===200).length).toBe(1);
  const oldAnchor=page.locator('.message').filter({has:page.getByText('History message 101',{exact:true})});
  const oldTop=await oldAnchor.evaluate(el=>el.getBoundingClientRect().top);expansion.resolve();
  await expect(page.locator('.message')).toHaveCount(201);
  await expect.poll(()=>oldAnchor.evaluate(el=>el.getBoundingClientRect().top)).toBeCloseTo(oldTop,0);
  expect(windows.filter(window=>window===200)).toHaveLength(1);
  await page.getByRole('button',{name:'Go to beginning'}).click();await expect(page.locator('.message')).toHaveCount(100);
  await expect.poll(()=>scroller.evaluate(el=>el.scrollTop)).toBe(0);
  await scroller.evaluate(el=>{el.scrollTo({top:el.scrollHeight,behavior:'instant'});el.dispatchEvent(new Event('scroll'));});
  await expect(page.locator('.message')).toHaveCount(201);await expect(page.getByText('History message 201',{exact:true})).toHaveCount(1);
});

test('a failed edge load waits for another user scroll before retrying',async({page})=>{
  await host(page);let attempts=0;
  await page.route('**/api/sessions/saved-chat/messages?*',route=>{
    const window=Number(new URL(route.request().url()).searchParams.get('window'));
    if(window>100){attempts++;return route.fulfill({status:503,json:{error:'Synthetic offline history'}});}
    return route.fulfill({json:{messages:Array.from({length:100},(_,i)=>message(i+1)),previous:100,next:null}});
  });
  await connect(page,'claude');const scroller=page.locator('.conversation');await expect.poll(()=>scroller.evaluate(el=>el.scrollTop)).toBeGreaterThan(1000);
  await scroller.evaluate(el=>{el.scrollTo({top:0,behavior:'instant'});el.dispatchEvent(new Event('scroll'));});
  await expect(page.locator('.network-banner')).toContainText('HTTP 503');
  await scroller.evaluate(el=>{el.dispatchEvent(new Event('scroll'));el.dispatchEvent(new Event('scroll'));});expect(attempts).toBe(1);
  await scroller.evaluate(el=>{el.scrollTop=100;el.dispatchEvent(new Event('scroll'));el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  await expect.poll(()=>attempts).toBe(2);await expect(page.locator('.message')).toHaveCount(100);
});

test('reading mode hides controls and preserves the chat, draft and scroll on exit and Back',async({page})=>{
  await host(page);await page.setViewportSize({width:390,height:844});
  await page.route('**/api/sessions/saved-chat/messages?*',route=>route.fulfill({json:{messages:Array.from({length:100},(_,i)=>message(i+1)),previous:null,next:null}}));
  await page.goto('http://127.0.0.1:5173');await page.getByLabel('Computer address').fill('http://127.0.0.1:4319');await page.getByLabel('Connection key').fill('test-only-'.repeat(5));await page.getByRole('button',{name:'Connect computer',exact:true}).click();await page.getByRole('button',{name:'Saved claude chat'}).click();
  await page.getByLabel('Message Claude').fill('Draft kept during reading');
  const anchor=page.getByText('History message 40',{exact:true});await anchor.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  const offset=()=>anchor.evaluate(el=>el.getBoundingClientRect().top-document.querySelector('.conversation')!.getBoundingClientRect().top);
  const before=await offset();await page.getByRole('button',{name:'Reading mode',exact:true}).click();
  await expect(page.locator('.app')).toHaveClass(/reading-mode/);await expect(page.locator('.chat-header')).toBeHidden();await expect(page.locator('.mobile-nav')).toBeHidden();await expect(page.locator('.composer-area')).toBeHidden();
  await expect(page.getByRole('button',{name:'Exit reading mode'})).toBeVisible();await expect.poll(offset).toBeCloseTo(before,0);
  await page.getByRole('button',{name:'Exit reading mode'}).click();await expect(page.getByLabel('Message Claude')).toHaveValue('Draft kept during reading');await expect.poll(offset).toBeCloseTo(before,0);
  await page.getByRole('button',{name:'Reading mode',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));
  await expect(page.locator('.app')).not.toHaveClass(/reading-mode/);await expect(page.locator('.header-title')).toContainText('Saved claude chat');await expect(page.getByLabel('Message Claude')).toHaveValue('Draft kept during reading');await expect.poll(offset).toBeCloseTo(before,0);
});
