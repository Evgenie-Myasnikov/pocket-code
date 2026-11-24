import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** A host of scheduled tasks kept in the page: every request is recorded in window.scheduledCalls. */
async function scheduledHost(page:Page,tasks:unknown[]=[]){
  await page.addInitScript(initial=>{
    const w=window as any;w.scheduledTasks=initial;w.scheduledCalls=[];
    w.testScheduledRequest=(path:string,data:any)=>{
      w.scheduledCalls.push({path,data});
      if(path==='/scheduled-tasks'&&!data)return {value:w.scheduledTasks};
      if(path==='/scheduled-tasks'){const now=Date.now(),task={id:'33333333-3333-4333-8333-333333333333',...data,paused:false,createdAt:now,updatedAt:now,anchor:now,nextRunAt:now+3600000,unread:false,runs:[]};w.scheduledTasks=[...w.scheduledTasks,task];return {value:task};}
      const [, , id,action]=path.split('/'),task=w.scheduledTasks.find((item:any)=>item.id===id);
      if(!task)return {error:'This scheduled task was deleted.',status:404};
      if(action==='delete'){w.scheduledTasks=w.scheduledTasks.filter((item:any)=>item.id!==id);return {value:{ok:true}};}
      if(action==='read'){task.unread=false;return {value:task};}
      if(action==='run'){task.runs=[{id:crypto.randomUUID(),at:Date.now(),manual:true,sessionId:'beta'},...task.runs];task.unread=true;return {value:task};}
      Object.assign(task,data);return {value:task};
    };
  },tasks);
}
const briefing={id:'44444444-4444-4444-8444-444444444444',name:'Weekday morning brief',prompt:'Summarise the synthetic changes since yesterday.',provider:'claude',model:'',cwd:'C:\\Demo\\Atlas',
  schedule:{kind:'weekdays',time:'09:00'},paused:false,createdAt:1,updatedAt:1,anchor:1,nextRunAt:Date.now()+3600000,unread:true,runs:[{id:'55555555-5555-4555-8555-555555555555',at:Date.now()-60000,sessionId:'alpha'}]};

test('a scheduled task is created from the chat list with a provider, folder and schedule',async({page})=>{
  await scheduledHost(page);
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  const rail=page.locator('.desktop-rail');
  // the Scheduled block is always there, with its own "+" and a line while it is empty; the Chats heading holds the new folder icon
  await expect(rail.locator('.scheduled-tasks .desktop-list-heading')).toContainText('Scheduled chats');
  await expect(rail.locator('.scheduled-tasks')).not.toContainText('No scheduled tasks yet');
  const back=await rail.locator('.scheduled-tasks-body').evaluate(element=>({color:getComputedStyle(element).backgroundColor,rail:getComputedStyle(document.querySelector('.desktop-rail')!).backgroundColor,height:element.getBoundingClientRect().height}));
  expect(back.color).not.toBe(back.rail);expect(back.height).toBeGreaterThan(20);
  await expect(rail.locator('.desktop-list-heading').filter({hasText:'Chats'}).getByRole('button',{name:'New folder'})).toBeVisible();
  await expect(rail.getByRole('button',{name:'New scheduled task'})).toHaveCount(1);
  await rail.getByRole('button',{name:'New scheduled task',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'New scheduled task'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill('Weekday morning brief');
  await dialog.getByLabel('Prompt').fill('Summarise the synthetic changes since yesterday.');
  // The same provider and model menu as the chat header.
  await dialog.getByRole('button',{name:/^Provider and model: Claude/}).click();
  await page.getByRole('menu',{name:'Provider and model'}).getByRole('menuitemradio',{name:'Codex'}).click();
  await expect(dialog.getByRole('button',{name:/^Provider and model: Codex/})).toBeVisible();
  await dialog.getByLabel('Folder').selectOption('C:\\Demo\\Garden');
  await dialog.getByLabel('Repeat').selectOption('weekdays');
  await dialog.getByLabel('Time').fill('08:30');
  await dialog.getByRole('button',{name:'Create',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  const created=await page.evaluate(()=>(window as any).scheduledCalls.find((call:any)=>call.path==='/scheduled-tasks'&&call.data)?.data);
  expect(created).toEqual({name:'Weekday morning brief',prompt:'Summarise the synthetic changes since yesterday.',provider:'codex',account:'',model:'',cwd:'C:\\Demo\\Garden',schedule:{kind:'weekdays',time:'08:30'}});
  const row=rail.locator('.scheduled-task');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('button',{name:/Weekday morning brief/})).toContainText('Weekdays at 08:30');
  await expect(row.locator('.scheduled-task-dot')).toHaveCount(0);
});

test('a scheduled task with an unread run shows a clock and a dot, and opening it opens the run',async({page})=>{
  await scheduledHost(page,[briefing]);
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  const row=page.locator('.desktop-rail .scheduled-task');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.scheduled-task-icon svg')).toBeVisible();
  await expect(row.locator('.scheduled-task-dot')).toBeVisible();
  await expect(row).toHaveAttribute('data-unread','true');
  // The task sits above the chats, as in Claude's sidebar.
  const taskBox=(await row.boundingBox())!,chatBox=(await page.locator('.desktop-sessions>button').first().boundingBox())!;
  expect(taskBox.y).toBeLessThan(chatBox.y);
  await row.getByRole('button',{name:/Weekday morning brief/}).click();
  await expect(page.getByText('The responsive layout is ready.')).toBeVisible();
  await expect(row.locator('.scheduled-task-dot')).toHaveCount(0);
  // A run is read like a chat, named by its task and time, and nothing can be written to it
  await expect(page.locator('.desktop-chat-host header h1')).toContainText('Weekday morning brief · ');
  // it holds one message, the latest answer, and has no message field: the task writes to it on its schedule
  await expect(page.locator('.conversation-inner .message')).toHaveCount(1);
  await expect(page.locator('.conversation-inner .message.assistant')).toContainText('The responsive layout is ready.');
  await expect(page.locator('.composer-area')).toBeHidden();await expect(page.getByRole('textbox',{name:/Message/})).toBeHidden();await page.screenshot({path:'.local/plan-chat.png'});
  expect(await page.evaluate(()=>(window as any).scheduledCalls.some((call:any)=>call.path==='/scheduled-tasks/44444444-4444-4444-8444-444444444444/read'))).toBe(true);
});

test('the "…" menu pauses, runs now and deletes a scheduled task',async({page})=>{
  await scheduledHost(page,[{...briefing,unread:false}]);
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  const row=page.locator('.desktop-rail .scheduled-task'),actions=row.getByRole('button',{name:'Scheduled task actions',exact:true});
  await row.hover();await actions.click();
  const menu=page.getByRole('menu',{name:'Scheduled task actions'});
  await expect(menu.getByRole('menuitem')).toHaveText(['Pause','Edit','Run now','Delete']);
  await menu.getByRole('menuitem',{name:'Pause'}).click();
  await expect(row).toHaveAttribute('data-paused','true');await expect(row).toContainText('Paused');
  await row.hover();await actions.click();
  await expect(menu.getByRole('menuitem',{name:'Resume'})).toBeVisible();
  await menu.getByRole('menuitem',{name:'Run now'}).click();
  await expect(row.locator('.scheduled-task-dot')).toBeVisible();
  await row.hover();await actions.click();await menu.getByRole('menuitem',{name:'Edit'}).click();
  const editor=page.getByRole('dialog',{name:'Edit scheduled task'});
  await expect(editor.getByLabel('Name')).toHaveValue('Weekday morning brief');await expect(editor.getByLabel('Time')).toHaveValue('09:00');
  await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(editor).toHaveCount(0);
  await row.hover();await actions.click();await menu.getByRole('menuitem',{name:'Delete'}).click();
  const confirm=page.getByRole('dialog',{name:'Delete scheduled task'});
  await expect(confirm).toContainText('Weekday morning brief');
  await confirm.getByRole('button',{name:'Delete',exact:true}).click();
  await expect(page.locator('.desktop-rail .scheduled-task')).toHaveCount(0);await expect(page.locator('.desktop-rail .scheduled-tasks-body')).toBeVisible();
  const paths=await page.evaluate(()=>(window as any).scheduledCalls.filter((call:any)=>call.data).map((call:any)=>call.path));
  expect(paths).toEqual(['/scheduled-tasks/44444444-4444-4444-8444-444444444444','/scheduled-tasks/44444444-4444-4444-8444-444444444444/run','/scheduled-tasks/44444444-4444-4444-8444-444444444444/delete']);
  // The chats of earlier runs stay in the list.
  await expect(page.locator('.desktop-sessions>button')).toHaveCount(2);
});
