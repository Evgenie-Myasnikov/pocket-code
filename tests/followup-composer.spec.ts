import {openChatList,newChat,openSection} from './chat-navigation';
import {test,expect,type Page} from '@playwright/test';
type Fixture={job:any;fail:boolean;sent:any[];started:any[];cancelled:string[];stops:number;approvals:any[];modes:string[]};
async function setup(page:Page,provider:string,options:{queue?:boolean}={}){
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(provider=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace',provider);},provider);
  const f:Fixture={job:null,fail:false,sent:[],started:[],cancelled:[],stops:0,approvals:[],modes:[]};
  await page.route('**/api/**',async route=>{
    const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.17.0',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,models:[{id:'test',name:'Test',isDefault:true,reasoningEfforts:['low'],defaultReasoningEffort:'low'}]}]});
    if(endpoint==='/repository-boards'||endpoint==='/projects')return route.fulfill({json:[]});
    if(endpoint==='/sessions')return route.fulfill({json:[]});
    if(endpoint==='/jobs'&&req.method()==='GET')return route.fulfill({json:f.job?[f.job]:[]});
    if(endpoint==='/jobs'&&req.method()==='POST'){
      const input=req.postDataJSON();f.started.push(input);f.job={id:input.id,provider,cwd:'C:\\Fixture',sessionId:'session',status:'running',messages:[{id:'first-'+f.started.length,role:'user',blocks:[{type:'text',text:input.text}]}],partial:'Working',approvals:[],startedAt:1,revision:1,baseMessageCount:0};return route.fulfill({json:f.job});
    }
    const cancel=endpoint.match(/^\/jobs\/[^/]+\/messages\/([^/]+)\/cancel$/);
    if(cancel){f.cancelled.push(cancel[1]);f.job={...f.job,revision:f.job.revision+1,queued:(f.job.queued||[]).filter((item:any)=>item.id!==cancel[1])};return route.fulfill({json:f.job});}
    if(endpoint===`/jobs/${f.job?.id}/messages`){
      const input=req.postDataJSON();f.sent.push(input);
      if(f.fail)return route.fulfill({status:409,json:{error:'The active turn has ended. Your draft is preserved.'}});
      // Claude queues a follow-up beside the composer; Codex steers it into the turn at once.
      f.job=provider==='claude'&&options.queue?{...f.job,revision:f.job.revision+1,queued:[...(f.job.queued||[]),{id:input.id,text:input.text,attachments:0}],pendingInputIds:[input.id]}
        :{...f.job,revision:f.job.revision+1,messages:[...f.job.messages,{id:input.id,role:'user',blocks:[{type:'text',text:input.text}]}],pendingInputIds:[]};
      return route.fulfill({json:f.job});
    }
    if(endpoint===`/jobs/${f.job?.id}/stop`){f.stops++;f.job={...f.job,status:'stopped',partial:'',revision:f.job.revision+1};return route.fulfill({json:{ok:true}});}
    if(endpoint===`/jobs/${f.job?.id}/mode`){f.modes.push(req.postDataJSON().mode);return route.fulfill({json:f.job});}
    const approval=endpoint.match(/^\/jobs\/[^/]+\/approvals\/([^/]+)$/);
    if(approval){f.approvals.push(req.postDataJSON());f.job={...f.job,approvals:[],revision:f.job.revision+1};return route.fulfill({json:{ok:true}});}
    if(endpoint===`/jobs/${f.job?.id}`)return route.fulfill({json:f.job});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    return route.fulfill({status:404,json:{error:'Fixture endpoint unavailable'}});
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await newChat(page);
  const draft=page.getByRole('textbox',{name:provider==='codex'?'Message Codex':'Message Claude'});
  await draft.fill('Start work');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByRole('button',{name:provider==='codex'?'Stop Codex':'Stop Claude',exact:true})).toBeVisible();
  return {f,draft};
}
for(const provider of ['claude','codex'])test(`${provider} accepts clarification while running and keeps a refused message apart from the draft`,async({page})=>{
  const {f,draft}=await setup(page,provider);
  // With an empty draft the Send slot holds one filled Stop; with text, Send says what it does and Stop sits beside it.
  const stop=page.locator('.stop-button'),send=page.locator('.send-button');
  await expect(send).toHaveCount(0);await expect(stop).toHaveClass(/stop-primary/);
  // Compact assistant-ui desktop control; touch uses a separate 44px target.
  expect((await stop.boundingBox())!.width).toBeGreaterThanOrEqual(36);
  expect(await stop.evaluate(el=>parseFloat(getComputedStyle(el,'::before').width))).toBeLessThanOrEqual(36);
  await draft.fill('Focus on tests');await expect(send).toHaveAccessibleName(provider==='codex'?'Steer':'Queue');await expect(send).toBeEnabled();
  expect(await stop.evaluate(el=>parseFloat(getComputedStyle(el,'::before').width))).toBeLessThan(await send.evaluate(el=>parseFloat(getComputedStyle(el,'::before').width)));
  await send.click();await expect(draft).toHaveValue('');
  // The field never becomes disabled while sending, so the phone keyboard stays open.
  await expect(draft).toBeEnabled();await expect(draft).toBeFocused();
  expect(f.sent[0].text).toBe('Focus on tests');await expect(page.locator('.conversation')).toContainText('Focus on tests');
  const fits=await page.locator('.composer-tools').evaluate(el=>Array.from(el.querySelectorAll('button,select')).filter(child=>child.checkVisibility()).map(child=>{const r=child.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.width>=40?'':child.className+':'+Math.round(r.x)+'/'+Math.round(r.right)+'/'+Math.round(r.width);}).filter(Boolean));expect(fits).toEqual([]);
  f.fail=true;await draft.fill('Keep this clarification');await send.click();
  if(provider==='claude'){
    // The refused message waits as a chip and the field is free at once; new typing is never sent in its place.
    const shelf=page.getByRole('region',{name:'Waiting to send'});
    await expect(shelf).toContainText('Keep this clarification');await expect(shelf).toContainText('Will be sent when Claude finishes the turn');await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(draft).toHaveValue('');await draft.fill('half-typed second thou');
    f.job={...f.job,status:'done',partial:'',revision:f.job.revision+1};f.fail=false;
    await expect.poll(()=>f.started.length).toBe(2);
    expect(f.started[1].text).toBe('Keep this clarification');expect(f.started[1].takeoverConfirmed).toBe(true);
    await expect(draft).toHaveValue('half-typed second thou');await expect(shelf).toHaveCount(0);
    await expect(page.locator('.conversation')).toContainText('Keep this clarification');
  }else{
    await expect(page.getByRole('alert')).toContainText('draft is preserved');await expect(draft).toHaveValue('Keep this clarification');
  }
  await openSection(page,'Board');await expect(page.getByRole('textbox',{name:'Find board',exact:true})).toBeVisible();await expect(page.getByText('Assigned to me',{exact:true})).toHaveCount(0);
});
test('a refused message can be edited back into the draft or cancelled',async({page})=>{
  const {f,draft}=await setup(page,'claude');
  f.fail=true;await draft.fill('First idea');await page.locator('.send-button').click();
  const shelf=page.getByRole('region',{name:'Waiting to send'});await expect(shelf).toContainText('First idea');
  await draft.fill('Typed meanwhile');await shelf.getByRole('button',{name:'Edit'}).click();
  await expect(draft).toHaveValue('Typed meanwhile\n\nFirst idea');await expect(shelf).toHaveCount(0);
  await draft.fill('Second idea');await page.locator('.send-button').click();await expect(shelf).toContainText('Second idea');
  await shelf.getByRole('button',{name:"Don't send"}).click();await expect(shelf).toHaveCount(0);
  f.job={...f.job,status:'done',partial:'',revision:f.job.revision+1};f.fail=false;
  await page.waitForTimeout(1500);expect(f.started).toHaveLength(1);
});
test('queued follow-ups wait above the composer and can be edited, removed or sent now',async({page})=>{
  const {f,draft}=await setup(page,'claude',{queue:true});
  await draft.fill('Also update the docs');await page.locator('.send-button').click();
  const shelf=page.getByRole('region',{name:'Waiting to send'});
  await expect(shelf).toContainText('Also update the docs');await expect(shelf).toContainText('After the current response');
  // A queued message is not in the transcript until the agent takes it.
  await expect(page.locator('.conversation')).not.toContainText('Also update the docs');
  await shelf.getByRole('button',{name:'Edit'}).click();await expect(draft).toHaveValue('Also update the docs');await expect(shelf).toHaveCount(0);
  expect(f.cancelled).toHaveLength(1);
  await page.locator('.send-button').click();await expect(shelf).toContainText('Also update the docs');
  await shelf.getByRole('button',{name:'Delete'}).click();await expect(shelf).toHaveCount(0);expect(f.cancelled).toHaveLength(2);
  await draft.fill('Run the linter first');await page.locator('.send-button').click();await expect(shelf).toContainText('Run the linter first');
  await shelf.getByRole('button',{name:'Send now'}).click();
  await expect.poll(()=>f.stops).toBe(1);await expect.poll(()=>f.started.length).toBe(2);expect(f.started[1].text).toBe('Run the linter first');
});
test('Stop shows its state once and the access chip changes a running Claude turn',async({page})=>{
  const {f}=await setup(page,'claude');
  const chip=page.getByRole('button',{name:'Access mode: Ask'});await chip.click();
  await page.getByRole('menuitemradio',{name:/Edits/}).click();await expect(page.getByRole('button',{name:'Access mode: Edits'})).toBeVisible();
  await expect.poll(()=>f.modes).toEqual(['acceptEdits']);
  // Full access asks for a second tap the first time and applies from the next message.
  await page.getByRole('button',{name:'Access mode: Edits'}).click();const full=page.getByRole('menuitemradio',{name:/Full/});await full.click();
  await expect(full).toContainText('Tap again');await full.click();await expect(page.getByRole('button',{name:'Access mode: Full'})).toBeVisible();expect(f.modes).toEqual(['acceptEdits']);
  f.job={...f.job,approvals:[{id:'a1',tool:'Bash',input:{command:'npm publish',description:'Publish the package'},expiresAt:0,suggestions:[{type:'addRules',rules:[{toolName:'Bash',ruleContent:'npm publish:*'}],behavior:'allow',destination:'localSettings'}]}],revision:f.job.revision+1};
  const card=page.getByRole('region',{name:'Run this command?'});await expect(card).toContainText('npm publish');await expect(card).toContainText('Publish the package');
  await expect(card.getByRole('button',{name:/Allow these in this project/})).toBeVisible();
  await card.getByRole('button',{name:'Deny…'}).click();await card.getByRole('textbox').fill('Run the tests first');await card.getByRole('button',{name:'Deny',exact:true}).click();
  await expect.poll(()=>f.approvals).toEqual([{allow:false,message:'Run the tests first'}]);
  await page.getByRole('button',{name:'Stop Claude',exact:true}).click();
  await expect.poll(()=>f.stops).toBe(1);
});
