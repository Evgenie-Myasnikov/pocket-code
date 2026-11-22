import {expect,test,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';
import type {MarkdownChainDetail,MarkdownChainStep} from '../src/markdown-chain';

function markdown(name:string,text:string){
  return {name,mimeType:'text/markdown',buffer:Buffer.from(text)};
}

async function openTaskDialog(page:Page){
  await page.getByRole('button',{name:'Attach files',exact:true}).click();
  await page.getByRole('button',{name:'Markdown tasks',exact:true}).click();
  return page.getByRole('dialog',{name:'Markdown tasks'});
}

function sentPrompts(page:Page){
  return page.evaluate(()=>{
    const {desktopCalls}=window as unknown as {desktopCalls:{action:string;endpoint:string;data?:{text:string}}[]};
    return desktopCalls.filter(call=>call.action==='write'&&call.endpoint==='/jobs').map(call=>call.data?.text);
  });
}

test('a Markdown batch keeps the draft and sends all tasks in manifest order',async({page})=>{
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const draft=page.getByRole('textbox',{name:'Message Claude',exact:true});
  await draft.fill('Use the sample workspace.');
  const dialog=await openTaskDialog(page);
  await dialog.getByLabel('Main context (.md)',{exact:true}).setInputFiles(markdown('queue.md',[
    '# Example queue',
    'Use the shared formatting rules.',
    '- [Outline](outline.md)',
    '- [Proofread](proofread.md)',
  ].join('\n')));
  const prepare=dialog.getByRole('button',{name:'Prepare draft'});
  await expect(dialog).toContainText('outline.md');
  await expect(prepare).toBeDisabled();
  await expect(draft).toHaveValue('Use the sample workspace.');

  // Select in reverse order: the manifest determines what the agent receives.
  await dialog.getByLabel('Task files (.md)',{exact:true}).setInputFiles([
    markdown('proofread.md','# Proofread\n\n```text\nCheck the section names.\n```'),
    markdown('outline.md','# Outline\n\n```text\nWrite a sample outline.\n```'),
  ]);
  await expect(prepare).toBeEnabled();
  await prepare.click();
  await expect(dialog).toBeHidden();
  await expect(draft).toHaveValue(/Use the sample workspace\./);
  expect(await sentPrompts(page)).toEqual([]);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>sentPrompts(page)).toHaveLength(1);
  const [sent]=await sentPrompts(page);
  expect(sent).toContain('Use the sample workspace.');
  expect(sent).toContain('Use the shared formatting rules.');
  expect(sent).toMatch(/Write a sample outline\.[\s\S]+Check the section names\./);
});

test('a long task under a Markdown heading reaches the job as a complete attachment',async({page})=>{
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const dialog=await openTaskDialog(page);
  const body='Keep each line in this sample.\n'.repeat(2300)+'End of the task.';
  await dialog.getByLabel('Main context (.md)',{exact:true}).setInputFiles(markdown('brief.md',
    '# Common rules\nUse compact examples.\n\n## Review the sample\n'+body));
  const order=dialog.getByRole('region',{name:'Run order'});
  await expect(order.getByText('Review the sample',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Prepare draft'}).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>sentPrompts(page)).toHaveLength(1);
  const payload=await page.evaluate(()=>{
    type Call={action:string;endpoint:string;data?:{base64?:string;name?:string;text?:string;attachments?:string[]}};
    const {desktopCalls}=window as unknown as {desktopCalls:Call[]};
    const writes=desktopCalls.filter(call=>call.action==='write');
    return {upload:writes.find(call=>call.endpoint==='/uploads')?.data,job:writes.find(call=>call.endpoint==='/jobs')?.data};
  });
  expect(payload.upload?.name).toBe('markdown-tasks.md');
  const uploaded=Buffer.from(payload.upload!.base64!,'base64').toString('utf8');
  expect(uploaded).toContain('Use compact examples.');
  expect(uploaded).toContain(body);
  expect(payload.job?.text).toContain('markdown-tasks.md');
  expect(payload.job?.attachments).toEqual(['pasted-image']);
});

test('linked chats show execution order, per-step context and project history',async({page})=>{
  await page.setViewportSize({width:1280,height:960});
  await page.addInitScript(()=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    let chain:MarkdownChainDetail|undefined;
    type Start={id:string;name:string;cwd:string;provider:'claude';context:string;tasks:MarkdownChainStep[]};
    (window as any).testChainRequest=(path:string,data:Start|undefined,params:URLSearchParams)=>{
      if(path==='/task-chains'&&data){
        if(!chain){
          chain={id:data.id,name:data.name,cwd:data.cwd,provider:data.provider,context:data.context,status:'running',
            steps:data.tasks.map((task,i)=>({...task,status:i===0?'done':i===1?'running':'pending'}))};
          Object.assign(chain.steps[0],{sessionId:'alpha',handoff:'Собраны 12 карточек. Для каждой записаны название и категория.'});
          chain.steps[1].sessionId='beta';
          return {error:'Ответ хоста потерян',status:503};
        }
        if(data.id!==chain.id)return {error:'Duplicate chain created',status:409};
        return {value:chain};
      }
      if(path==='/task-chains')return {value:chain?[{id:chain.id,name:chain.name,status:chain.status,stepsDone:1,stepCount:3,stepIndex:chain.steps.findIndex(step=>step.sessionId===params.get('sessionId'))}]:[]};
      if(path.endsWith('/stop')&&chain){chain.status='stopped';chain.steps[1].status='stopped';}
      return {value:chain};
    };
  });
  await desktop(page);
  await page.getByRole('button',{name:'Новый чат',exact:true}).click();
  const draft=page.getByRole('textbox',{name:'Сообщение Claude'});
  await draft.fill('Черновик сообщения');
  const menu=page.locator('.composer-attach');
  await menu.click();
  await page.getByRole('button',{name:'Задачи из Markdown',exact:true}).click();
  const importer=page.getByRole('dialog',{name:'Задачи из Markdown'});
  await importer.getByLabel('Основной контекст (.md)').setInputFiles(markdown('Обновление каталога.md',[
    'Используй учебный каталог. Сохрани названия и порядок разделов.',
    '## Собрать карточки','Составь список карточек и укажи категорию каждой.',
    '## Проверить категории','Сверь категории со справочником. Перечисли расхождения.',
    '## Подготовить отчёт','Собери результаты проверки в короткий отчёт.',
  ].join('\n')));
  const start=importer.getByRole('button',{name:'Запустить связанные чаты'});
  await start.click();
  await expect(importer.getByRole('alert')).toHaveText('Ответ хоста потерян');
  await start.click();
  const panel=page.getByRole('dialog',{name:'Цепочки задач'});
  await expect(panel.getByText('Готово 1 / 3')).toBeVisible();
  const steps=panel.locator('.chain-steps > li');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toHaveAttribute('data-status','running');
  await expect(steps.nth(2).getByRole('button',{name:'Открыть чат'})).toHaveCount(0);
  const capture=process.env.POCKET_CHAIN_PREVIEW;
  if(capture){await page.evaluate(()=>document.fonts.ready.then(()=>true));await panel.screenshot({path:capture});}
  await steps.nth(1).getByRole('button',{name:'Контекст шага'}).click();
  const context=steps.nth(1).locator('.chain-context');
  await expect(context.getByText('Собраны 12 карточек.',{exact:false}).first()).toBeVisible();
  await expect(context.getByText('Используй учебный каталог.',{exact:false}).first()).toBeVisible();
  if(capture)await panel.screenshot({path:capture.replace(/\.png$/,'-context.png')});
  await context.locator('summary').click();
  await expect(context.locator('details pre')).toContainText('Проверить категории');
  await panel.getByRole('button',{name:'Закрыть',exact:true}).click();
  await expect(draft).toHaveValue('Черновик сообщения');
  await menu.click();await page.getByRole('button',{name:'Цепочки задач',exact:true}).click();
  await panel.getByRole('button',{name:/Обновление каталога/}).click();
  await panel.getByRole('button',{name:'Остановить цепочку'}).click();
  await expect(steps.nth(1)).toHaveAttribute('data-status','stopped');
  await steps.first().getByRole('button',{name:'Открыть чат'}).click();
  await expect(panel).toBeHidden();
  await expect.poll(()=>page.evaluate(()=>(window as any).desktopCalls.some((call:any)=>call.endpoint?.includes('/sessions/alpha/messages')))).toBe(true);
  await page.getByRole('button',{name:/Шаг 1 \/ 3/}).click();
  await expect(panel.getByRole('heading',{name:'Обновление каталога.md'})).toBeVisible();
});
