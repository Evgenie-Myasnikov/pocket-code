import {expect,test} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';
import type {MarkdownChainDetail} from '../src/markdown-chain';

test('a file can supply the description and AI can name the task before launch',async({page})=>{
  const contents='Check headings and examples in the glossary.';
  const suggestion='Review the glossary';
  await page.setViewportSize({width:1280,height:800});
  await page.addInitScript(generated=>{
    const fixture=window as any;
    fixture.testTaskTextResponse=generated;
    fixture.testChainRequest=(path:string,input?:{tasks:MarkdownChainDetail['steps']})=>{
      if(input)fixture.acceptedTask={...input,status:'running',steps:input.tasks.map(step=>({...step,status:'pending'}))};
      return {value:fixture.acceptedTask??[]};
    };
  },suggestion);
  await desktop(page);
  await desktopSection(page,'Tasks');
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Create task'});
  const start=form.getByRole('button',{name:'Start task',exact:true});
  await expect(start).toBeDisabled();
  await form.getByLabel('From file',{exact:true}).setInputFiles({name:'glossary.md',mimeType:'text/markdown',buffer:Buffer.from(contents)});
  const body=form.getByRole('textbox',{name:'Description',exact:true});
  await expect(body).toHaveValue(contents);
  const refined=contents+' Include cross-references.';
  await body.fill(refined);
  await form.getByRole('button',{name:/with AI · Title$/}).click();
  const ai=page.getByRole('dialog',{name:/with AI · Title$/});
  await ai.getByRole('button',{name:'Generate suggestion'}).click();
  await expect(ai.getByLabel('Suggested text')).toHaveValue(suggestion);
  await ai.getByRole('button',{name:'Apply',exact:true}).click();
  const title=form.getByRole('textbox',{name:'Title (optional)',exact:true});
  await expect(title).toHaveValue(suggestion);
  const calls=await page.evaluate(()=>(window as any).desktopCalls.filter((call:{action:string})=>call.action==='write'));
  expect(calls.find((call:{endpoint:string})=>call.endpoint==='/task-text/improve')?.data).toMatchObject({field:'title',context:expect.stringContaining(refined)});
  expect(calls.filter((call:{endpoint:string})=>call.endpoint==='/task-chains')).toHaveLength(0);
  await title.fill('Review documentation');
  if(process.env.POCKET_COMPACT_TASK_PREVIEW)await form.screenshot({path:process.env.POCKET_COMPACT_TASK_PREVIEW});
  await start.click();
  await expect(form).toBeHidden();
  const accepted=await page.evaluate(()=>(window as any).acceptedTask);
  expect(accepted.name).toBe('Review documentation');
  expect(accepted.tasks).toHaveLength(1);
  expect(accepted.tasks[0]).toMatchObject({title:'Review documentation',body:refined});
});

test('a phone can launch a described task without supplying a title or using AI',async({page})=>{
  const cwd='C:\\Demo\\Atlas',description='Review examples for spelling.';
  let accepted:MarkdownChainDetail|undefined;
  const generationRequests:string[]=[];
  await page.setViewportSize({width:320,height:700});
  await page.addInitScript(()=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-task-host'}));
    localStorage.setItem('pocket-code-language-v1','en');
  });
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    const responses:Record<string,unknown>={
      '/api/health':{name:'Example host',roots:[cwd],protocol:1},
      '/api/projects':[cwd],'/api/providers':[{id:'claude',name:'Claude',available:true,models:[]}],
      '/api/workspaces':{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}
    };
    if(path.startsWith('/api/task-text/'))generationRequests.push(path);
    if(path==='/api/task-chains'&&request.method()==='POST'){
      const input=request.postDataJSON();
      accepted={...input,status:'running',steps:input.tasks.map((step:object)=>({...step,status:'pending'}))};
    }
    await route.fulfill({json:(path.startsWith('/api/task-chains')&&accepted)||responses[path]||[]});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');
  await page.locator('.mobile-tabbar').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Create task'});
  await form.getByRole('textbox',{name:'Description',exact:true}).fill(description);
  expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await form.getByRole('button',{name:'Start task',exact:true}).click();
  await expect(form).toBeHidden();
  expect(accepted?.name.trim()).toBeTruthy();
  expect(accepted?.steps).toHaveLength(1);
  expect(accepted?.steps[0]).toMatchObject({body:description,title:accepted?.name});
  expect(generationRequests).toEqual([]);
});

const trackedChain:MarkdownChainDetail={
  id:'00000000-0000-4000-8000-000000000018',cwd:'C:\\Demo\\Atlas',provider:'claude',
  name:'Review the sample glossary',status:'done',context:'Use short examples.',
  steps:[
    {title:'Check terms',body:'Read the entries.',source:'terms.md',status:'done',sessionId:'sample-terms'},
    {title:'Check references',body:'Inspect the links.',source:'references.md',status:'done',sessionId:'sample-links',
      previousChats:[{attempt:1,provider:'codex',sessionId:'sample-retry',cwd:'C:\\Demo\\Atlas'}]}
  ]
};
for(const phone of [false,true]){
  test('closing the step chat restores the selected step and context tab on '+(phone?'phone':'desktop'),async({page})=>{
    const summary={id:trackedChain.id,name:trackedChain.name,status:'done',stepsDone:2,stepCount:2};
    const transcript='All sample links were verified.';
    const hiddenRun={taskChat:true,id:'sample-hidden-job',cwd:'C:\\Demo\\step-worktree',provider:'claude',sessionId:'sample-hidden-session',status:'running',messages:[],partial:'',approvals:[],revision:1,startedAt:12345,baseMessageCount:0};
    const attention={...hiddenRun,title:'Review step awaiting input',status:'needs_input',version:'1'};
    const history={messages:[{id:'answer',role:'assistant',blocks:[{type:'text',text:transcript}]}],previous:null,next:null};
    const firstReport='A sample reference needs correction.';
    const retryHistory={...history,messages:[{id:'retry-report',role:'assistant',blocks:[{type:'text',text:firstReport}]}]};
    await page.setViewportSize(phone?{width:360,height:780}:{width:1500,height:920});
    if(phone){
      await page.addInitScript(()=>{
        sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-task-host'}));
        localStorage.setItem('pocket-code-language-v1','en');
      });
      await page.route('**/api/**',async route=>{
        const url=new URL(route.request().url());
        const responses:Record<string,unknown>={
          '/api/health':{name:'Example host',roots:[trackedChain.cwd],protocol:1},
          '/api/projects':[trackedChain.cwd],'/api/providers':[{id:'claude',name:'Claude',available:true,models:[]}],
          '/api/workspaces':{host:true,canManageWorkspaces:true,workspaces:[],boards:[]},
          '/api/sessions':[{sessionId:'regular',summary:'Ordinary conversation',cwd:trackedChain.cwd,lastModified:1}],
          '/api/jobs':[hiddenRun],'/api/activity':[attention],
          '/api/task-chains':url.searchParams.has('sessionId')?[]:[summary],
          ['/api/task-chains/'+trackedChain.id]:trackedChain,
          '/api/sessions/sample-links/messages':history,'/api/sessions/sample-retry/messages':retryHistory
        };
        await route.fulfill({json:responses[url.pathname]??[]});
      });
      await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');
      const chats=page.locator('.sidebar');
      await expect(chats.getByRole('button',{name:/Ordinary conversation/}).first()).toBeVisible();
      await expect(chats.getByText('Current task',{exact:true})).toHaveCount(0);
      await expect(chats.getByText(attention.title,{exact:true})).toHaveCount(0);
      await chats.getByRole('textbox',{name:'Find a chat'}).fill('step-worktree');
      await expect(chats.locator('.session-row')).toHaveCount(0);
      await page.locator('.mobile-tabbar').getByRole('button',{name:'Tasks',exact:true}).click();
    }else{
      await page.addInitScript(({chain,summary,history,retryHistory,hiddenRun,attention})=>{
        const fixture=window as any;
        fixture.testRuns=[hiddenRun];fixture.testActivity=[attention];
        fixture.testChainRequest=(path:string,_data:unknown,query:URLSearchParams)=>({
          value:path==='/task-chains'?(query.has('sessionId')?[]:[summary]):chain
        });
        fixture.testHistoryPage=(url:URL)=>url.pathname==='/sessions/sample-links/messages'?history:url.pathname==='/sessions/sample-retry/messages'?retryHistory:{messages:[],previous:null,next:null};
      },{chain:trackedChain,summary,history,retryHistory,hiddenRun,attention});
      await desktop(page);
      await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((call:{endpoint?:string})=>call.endpoint?.startsWith('/jobs')))).toBe(true);
      await expect(page.getByRole('button',{name:/step-worktree/})).toHaveCount(0);
      await desktopSection(page,'Tasks');
    }
    await page.getByRole('button',{name:new RegExp(summary.name)}).click();
    const details=page.locator('.tasks-workspace .tasks-page');
    const step=details.getByRole('listitem').filter({has:page.getByRole('heading',{name:'Check references',exact:true})});
    await step.getByRole('button',{name:'Step context'}).click();
    await step.getByRole('tab',{name:'Paths',exact:true}).click();
    await step.getByRole('button',{name:'Open chat'}).click();
    const chat=page.locator('.tasks-workspace aside.task-chat-drawer');
    await expect(chat.getByText(transcript,{exact:true})).toBeVisible();
    if(!phone){
      const panel=await chat.boundingBox(),list=await details.boundingBox();
      expect(list!.x+list!.width).toBeLessThanOrEqual(panel!.x+1);
      if(process.env.POCKET_TASK_DRAWER_PREVIEW)await page.screenshot({path:process.env.POCKET_TASK_DRAWER_PREVIEW});
    }else{
      const panel=await chat.boundingBox();
      expect(panel!.width).toBeGreaterThanOrEqual(340);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    const draft='Please check the final entry.';
    await chat.locator('.composer textarea').fill(draft);
    await chat.getByRole('button',{name:'Close task chat'}).click();
    await expect(chat).toHaveCount(0);
    await expect(details.getByRole('heading',{name:summary.name})).toBeVisible();
    await expect(step.getByRole('tab',{name:'Paths',selected:true})).toBeVisible();
    await step.locator('summary',{hasText:'Previous attempts'}).click();
    await step.getByRole('button',{name:/Attempt 1 .* Codex/}).click();
    await expect(chat.getByText(firstReport,{exact:true})).toBeVisible();
    await expect(chat.locator('.composer textarea')).toHaveValue('');
    await chat.getByRole('button',{name:'Close task chat'}).click();
    await expect(step.getByRole('tab',{name:'Paths',selected:true})).toBeVisible();
    await step.getByRole('button',{name:'Open chat'}).click();
    await expect(chat.locator('.composer textarea')).toHaveValue(draft);
  });
}
