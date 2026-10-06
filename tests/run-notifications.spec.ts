import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>{
    const listeners:((event:{data:unknown})=>void)[]=[];
    const state={calls:[] as Record<string,unknown>[],pending:null as Record<string,unknown>|null,emit:()=>listeners.forEach(listener=>listener({data:{chatNotification:true}}))};
    Object.assign(window,{notificationFixture:state,chrome:{webview:{addEventListener:(_name:string,listener:(event:{data:unknown})=>void)=>listeners.push(listener),postMessage:(message:Record<string,unknown>)=>{
      state.calls.push(message);const value=message.action==='notification-pending'?{chat:state.pending}:true;
      if(message.action==='notification-pending')state.pending=null;
      queueMicrotask(()=>listeners.forEach(listener=>listener({data:{id:message.id,value}})));
    }}}});
  });
});

test('desktop notification opens its exact run outside the chat and does not reopen it on refresh',async({page})=>{
  await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+'/tests/fixtures/run-notifications.html?desktop=1');
  await expect(page.getByTestId('section')).toHaveText('board');
  await page.evaluate(()=>{const fixture=(window as any).notificationFixture;fixture.pending={provider:'copilot',sessionId:'session-1',jobId:'run-exact',cwd:'/fixture/project',title:'Synthetic task'};fixture.emit();});
  await expect(page.getByTestId('section')).toHaveText('chat');
  await expect(page.getByTestId('target')).toContainText('run-exact');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.evaluate(()=>(window as any).notificationFixture.emit());
  await expect(page.getByTestId('section')).toHaveText('settings');
});

test('notification opt-out reaches native tracking while a temporary disconnect preserves the preference',async({page})=>{
  await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+'/tests/fixtures/run-notifications.html?desktop=1');
  const latest=()=>page.evaluate(()=>(window as any).notificationFixture.calls.filter((call:any)=>call.action==='run-alerts').at(-1)?.enabled);
  await expect.poll(latest).toBe(true);
  await page.getByRole('checkbox',{name:'Run notifications'}).uncheck();await expect.poll(latest).toBe(false);
  await page.getByRole('checkbox',{name:'Run notifications'}).check();await expect.poll(latest).toBe(true);
  await page.getByRole('button',{name:'Disconnect',exact:true}).click();await expect.poll(latest).toBe(true);
  await page.getByRole('button',{name:'Reconnect',exact:true}).click();await expect.poll(latest).toBe(true);
});

test('notification opt-out still takes effect when local preference storage is unavailable',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('Synthetic unavailable storage');};});
  await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+'/tests/fixtures/run-notifications.html?desktop=1');
  await page.getByRole('checkbox',{name:'Run notifications'}).uncheck();
  await expect.poll(()=>page.evaluate(()=>(window as any).notificationFixture.calls.filter((call:any)=>call.action==='run-alerts').at(-1)?.enabled)).toBe(false);
  await expect(page.getByRole('checkbox',{name:'Run notifications'})).not.toBeChecked();
});

test('desktop shell opens the exact notification job from Settings with its provider',async({page})=>{
  await page.addInitScript(()=>{
    const listeners:((event:{data:unknown})=>void)[]=[];
    const state={online:true,busy:false,status:'Synthetic host',startup:false,autoReconnect:false,internet:false,addresses:[],jira:false};
    const fixture={calls:[] as any[],pending:null as any,emit:()=>listeners.forEach(listener=>listener({data:{chatNotification:true}}))};
    const reply=(id:unknown,value:unknown)=>queueMicrotask(()=>listeners.forEach(listener=>listener({data:{id,value}})));
    Object.assign(window,{notificationFixture:fixture,chrome:{webview:{addEventListener:(_name:string,listener:(event:{data:unknown})=>void)=>listeners.push(listener),postMessage:(message:any)=>{
      fixture.calls.push(message);
      if(message.action==='state'){reply(message.id,state);return;}
      if(message.action==='notification-pending'){const chat=fixture.pending;fixture.pending=null;reply(message.id,{chat});return;}
      if(message.action!=='read'){reply(message.id,true);return;}
      const url=new URL('https://fixture.invalid'+message.endpoint),path=url.pathname;
      let result:any=[];
      if(path==='/health')result={name:'Synthetic host',roots:['/fixture/project'],protocol:1,version:'0.25.11'};
      if(path==='/providers')result=[{id:'claude',available:true,models:[]},{id:'codex',available:true,authenticated:true,models:[]},{id:'copilot',available:true,authenticated:true,models:[]}];
      if(path==='/projects')result=['/fixture/project'];
      if(path==='/board-notifications')result={items:[],unread:0};
      if(path==='/task-runs')result={runs:[]};
      if(path==='/review/availability')result={available:false};
      if(path.endsWith('/messages'))result={messages:[],previous:null,next:null};
      if(path==='/jobs/exact-notification-run')result={id:'exact-notification-run',provider:'codex',sessionId:'target-session',cwd:'/fixture/project',status:'done',startedAt:1700000000000,revision:1,baseMessageCount:0,approvals:[],partial:'',messages:[{id:'result',role:'assistant',blocks:[{type:'text',text:'Exact notification job result'}]}]};
      reply(message.id,result);
    }}}});
  });
  await page.goto((test.info().project.use.baseURL||'http://127.0.0.1:5173')+'/?desktop=1');
  await page.locator('.desktop-rail').getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('.desktop-settings h1')).toHaveText('Settings');
  await page.evaluate(()=>{const fixture=(window as any).notificationFixture;fixture.pending={provider:'codex',sessionId:'target-session',jobId:'exact-notification-run',cwd:'/fixture/project',title:'Synthetic notification target'};fixture.emit();});
  await expect(page.locator('.conversation')).toContainText('Exact notification job result');
  await expect.poll(()=>page.evaluate(()=>(window as any).notificationFixture.calls.some((call:any)=>call.endpoint?.startsWith('/jobs/exact-notification-run')))).toBe(true);
  await expect(page.locator('.desktop-rail').getByRole('combobox',{name:'Provider',exact:true})).toHaveValue('codex');
});
