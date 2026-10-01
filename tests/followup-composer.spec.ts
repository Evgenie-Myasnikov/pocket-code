import {test,expect} from '@playwright/test';
for(const provider of ['claude','codex'])test(`${provider} accepts clarification while running and preserves a rejected draft`,async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(provider=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace',provider);},provider);
  let job:any=null,fail=false;const sent:any[]=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(),endpoint=new URL(req.url()).pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.17.0',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'codex',available:true,models:[{id:'test',name:'Test',isDefault:true,reasoningEfforts:['low'],defaultReasoningEffort:'low'}]}]});
    if(endpoint==='/sessions')return route.fulfill({json:[]});
    if(endpoint==='/jobs'&&req.method()==='GET')return route.fulfill({json:job?[job]:[]});
    if(endpoint==='/jobs'&&req.method()==='POST'){
      const input=req.postDataJSON();job={id:input.id,provider,cwd:'C:\\Fixture',sessionId:'session',status:'running',messages:[{id:'first',role:'user',blocks:[{type:'text',text:input.text}]}],partial:'Working',approvals:[],startedAt:1,revision:1,baseMessageCount:0};return route.fulfill({json:job});
    }
    if(endpoint===`/jobs/${job?.id}/messages`){
      const input=req.postDataJSON();sent.push(input);
      if(fail)return route.fulfill({status:409,json:{error:'The active turn has ended. Your draft is preserved.'}});
      job={...job,revision:2,messages:[...job.messages,{id:input.id,role:'user',blocks:[{type:'text',text:input.text}]}],pendingInputIds:provider==='claude'?[input.id]:[]};return route.fulfill({json:job});
    }
    if(endpoint===`/jobs/${job?.id}`)return route.fulfill({json:job});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/jira/status')return route.fulfill({json:{connected:false,sites:[]}});
    return route.fulfill({status:404,json:{error:'Fixture endpoint unavailable'}});
  });
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'New chat',exact:false}).click();
  const draft=page.getByRole('textbox',{name:provider==='codex'?'Message Codex':'Message Claude'}),send=page.getByRole('button',{name:'Send message',exact:true});
  await draft.fill('Start work');await send.click();
  await expect(page.getByRole('button',{name:provider==='codex'?'Stop Codex':'Stop Claude',exact:true})).toBeVisible();
  await draft.fill('Focus on tests');await expect(send).toBeEnabled();await send.click();await expect(draft).toHaveValue('');
  expect(sent[0].text).toBe('Focus on tests');await expect(page.locator('.conversation')).toContainText('Focus on tests');
  const fits=await page.locator('.composer-tools').evaluate(el=>Array.from(el.querySelectorAll('button,select')).every(child=>{const r=child.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.width>=40;}));expect(fits).toBe(true);
  fail=true;await draft.fill('Keep this clarification');await send.click();await expect(page.getByRole('alert')).toContainText('draft is preserved');await expect(draft).toHaveValue('Keep this clarification');
  await page.locator('.mobile-nav').getByRole('button',{name:'Tasks',exact:true}).click();await expect(page.locator('.chat-header')).toContainText('Developer');await expect(page.getByText('Assigned to me',{exact:true})).toHaveCount(0);
});
