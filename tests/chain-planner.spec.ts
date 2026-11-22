import {test,expect,type Page} from '@playwright/test';
import {desktop,desktopSection} from './desktop-fixture';

async function openTasks(page:Page){
  await page.addInitScript(()=>{
    const fixture=window as any;
    const account='00000000-0000-4000-8000-000000000011';
    fixture.testPlanCatalog={providers:['claude','codex'],accounts:[{id:account,name:'Guide API'}],
      executors:[{provider:'codex',label:'Codex'},{provider:'claude',account,model:'guide-editor',label:'Guide API'}]};
    fixture.testTaskTextModels={[account]:['guide-planner']};
    fixture.testPlanResponse={name:'Glossary review',context:'Keep examples runnable.',
      tasks:[{title:'Check definitions',body:'Review the public glossary.',source:'guide.md',executor:{provider:'codex'}},
        {title:'Check references',body:'Validate the links.',source:'checks.txt',executor:{provider:'claude',account,model:'guide-editor'}}]};
    fixture.testChainRequest=(path:string,data:any)=>{
      if(!data&&path==='/task-chains')return {value:[]};
      if(data)fixture.launchedPlan={...data,status:'running',steps:data.tasks.map((s:any)=>({...s,status:'pending'}))};
      return {value:fixture.launchedPlan};
    };
  });
  await desktop(page);
  await desktopSection(page,'Tasks');
}
async function openPlanner(page:Page){
  await openTasks(page);
  await page.getByRole('button',{name:'Create chain',exact:true}).click();
  await page.getByRole('button',{name:'Plan with AI',exact:true}).click();
  return page.getByRole('dialog');
}
const sources=[
  {name:'guide.md',mimeType:'text/markdown',buffer:Buffer.from('# Glossary\nReview the definitions.')},
  {name:'checks.txt',mimeType:'text/plain',buffer:Buffer.from('Check the links.')}
];

test('import a prose plan once and choose AI or manual splitting with the same document',async({page})=>{
  await openTasks(page);
  await page.getByRole('button',{name:'Create chain',exact:true}).click();
  await page.getByRole('button',{name:'Import Markdown',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Main context (.md)').setInputFiles(sources[0]);
  await dialog.getByLabel('Allow parallel subtasks').uncheck();
  await dialog.getByRole('button',{name:'Split with AI'}).click();
  await expect(dialog.getByText('guide.md',{exact:true})).toBeVisible();
  await page.evaluate(()=>{(window as any).testPlanResponse.tasks.pop();});
  await dialog.getByRole('button',{name:'Generate plan'}).click();
  await expect(dialog.getByLabel('Shared context')).toHaveValue(sources[0].buffer.toString('utf8'));
  await expect(dialog.getByLabel('Allow parallel subtasks')).not.toBeChecked();
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Markdown tasks'});
  await expect(dialog.getByText('guide.md',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'Split manually'}).click();
  await expect(dialog.getByLabel('Shared context')).toHaveValue(sources[0].buffer.toString('utf8'));
  await dialog.getByLabel('Step title',{exact:true}).fill('Read definitions');
  await dialog.getByLabel('Instructions',{exact:true}).fill('Check glossary entries.');
  await dialog.getByRole('button',{name:'Start linked chats'}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).launchedPlan)).toMatchObject({parallelSubtasks:false,
    context:sources[0].buffer.toString('utf8'),sourceFiles:[{name:'guide.md',text:sources[0].buffer.toString('utf8')}],
    tasks:[{title:'Read definitions',source:'guide.md'}]});
});

test('an unresolved plan reference blocks AI and automatic execution while allowing explicit manual editing',async({page})=>{
  await openTasks(page);
  await page.getByRole('button',{name:'Create chain',exact:true}).click();
  await page.getByRole('button',{name:'Import Markdown',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Main context (.md)').setInputFiles({name:'guide.md',mimeType:'text/markdown',buffer:Buffer.from('# Guide\n- [Review](review.md)')});
  await expect(dialog.getByRole('alert')).toContainText('review.md');
  await expect(dialog.getByRole('button',{name:'Start linked chats'})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'Split with AI'})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'Split manually'})).toBeEnabled();
});

test('available planners stay usable while unavailable providers explain how to recover',async({page})=>{
  await openTasks(page);
  await page.evaluate(()=>{
    const catalog=(window as any).testPlanCatalog;
    catalog.providers=['claude'];
    catalog.warnings=['executors'];
    catalog.unavailable=[{provider:'codex',reason:'signed_out'}];
  });
  await page.getByRole('button',{name:'Create chain',exact:true}).click();
  await page.getByRole('button',{name:'Plan with AI',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Source files').setInputFiles(sources);
  await expect(dialog.getByRole('alert')).toHaveText('Some task executors could not be checked.');
  await expect(dialog.getByRole('button',{name:'Generate plan'})).toBeEnabled();
  await dialog.getByText('Unavailable providers',{exact:true}).click();
  await expect(dialog.getByText('Codex · sign-in required on this PC')).toBeVisible();
  await page.evaluate(()=>{
    const catalog=(window as any).testPlanCatalog;
    catalog.providers.push('codex');catalog.warnings=[];catalog.unavailable=[];
  });
  await dialog.getByRole('button',{name:'Refresh providers'}).click();
  await dialog.getByLabel('Planning provider').selectOption('codex');
  await expect(dialog.getByRole('button',{name:'Generate plan'})).toBeEnabled();
  expect(await page.evaluate(()=>(window as any).desktopCalls.some((c:any)=>c.endpoint==='/task-text/plan/providers?refresh=1'))).toBe(true);
});

test('plan from selected files, review AI revisions and launch only the edited executor sequence',async({page})=>{
  const planner=await openPlanner(page);
  await planner.getByLabel('Source files').setInputFiles(sources);
  await planner.getByRole('combobox',{name:'Planning provider'}).selectOption({label:'Guide API'});
  await expect(planner.getByRole('combobox',{name:'Model'})).toHaveValue('guide-planner');
  await planner.getByLabel('Planning instructions').fill('Start with the glossary.');
  await planner.getByRole('button',{name:'Generate plan'}).click();
  await expect(planner.getByLabel('Chain name')).toHaveValue('Glossary review');
  await planner.getByLabel('Step title',{exact:true}).first().fill('Edited definitions');
  await planner.getByRole('button',{name:'Step 1 down'}).click();
  await planner.getByRole('button',{name:'Add step'}).click();
  await expect(planner.getByLabel('Step title',{exact:true})).toHaveCount(3);
  await planner.getByRole('button',{name:'Remove step 3'}).click();
  await planner.getByLabel('Step executor').first().selectOption({label:'Codex'});
  await planner.getByLabel('Allow parallel subtasks').uncheck();
  const edited=await planner.getByLabel('Step title',{exact:true}).allTextContents();
  expect(edited).toHaveLength(2);
  await planner.getByRole('button',{name:'Revise plan with AI'}).click();
  await planner.getByLabel('What should change?').fill('Shorten the examples.');
  await page.evaluate(()=>{(window as any).testPlanResponse.name='Short glossary review';});
  await planner.getByRole('button',{name:'Suggest revision'}).click();
  await expect(planner.getByRole('heading',{name:'Short glossary review'})).toBeVisible();
  await planner.getByRole('button',{name:'Keep current plan'}).click();
  await expect(planner.getByLabel('Chain name')).toHaveValue('Glossary review');
  await expect(planner.getByLabel('Step title',{exact:true}).nth(1)).toHaveValue('Edited definitions');
  const request=await page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.endpoint==='/task-text/plan').at(-1).data);
  expect(request).toMatchObject({provider:'custom',model:'guide-planner',brief:'Shorten the examples.',
    files:[{name:'guide.md',text:'# Glossary\nReview the definitions.'},{name:'checks.txt',text:'Check the links.'}],
    draft:{tasks:[{title:'Check references',executor:{provider:'codex'}},{title:'Edited definitions'}]}});
  await planner.getByRole('button',{name:'Revise plan with AI'}).click();
  await planner.getByLabel('What should change?').fill('Review all links first.');
  await planner.getByRole('button',{name:'Suggest revision'}).click();
  await planner.getByRole('button',{name:'Apply revision'}).click();
  await expect(planner.getByLabel('Chain name')).toHaveValue('Short glossary review');
  await planner.getByRole('button',{name:'Step 1 down'}).click();
  await expect(planner.getByLabel('Allow parallel subtasks')).not.toBeChecked();
  expect(await page.evaluate(()=>(window as any).launchedPlan)).toBeUndefined();
  await planner.getByRole('button',{name:'Start chain'}).click();
  await expect(planner).toHaveCount(0);
  const launched=await page.evaluate(()=>(window as any).launchedPlan);
  expect(launched).toMatchObject({name:'Short glossary review',parallelSubtasks:false,tasks:[
    {title:'Check references',executor:{provider:'claude',account:'00000000-0000-4000-8000-000000000011',model:'guide-editor'}},
    {title:'Check definitions',executor:{provider:'codex'}}]});
  expect(launched.sourceFiles).toEqual(sources.map(source=>({name:source.name,text:source.buffer.toString('utf8')})));
});

test('project and uploaded sources keep distinct paths and launch bindings',async({page})=>{
  const planner=await openPlanner(page);
  await page.evaluate(()=>{
    const fixture=window as any;
    fixture.withSourceFolder=true;
    fixture.testPlanResponse.tasks[0].source='README.md';
    fixture.testPlanResponse.tasks[1].source='docs/README.md';
  });
  await planner.getByLabel('Source files').setInputFiles({name:'README.md',mimeType:'text/markdown',buffer:Buffer.from('# Uploaded notes')});
  await planner.getByRole('button',{name:'Project files'}).click();
  await planner.getByRole('button',{name:'docs',exact:true}).click();
  await expect(planner.getByRole('button',{name:'Parent folder'})).toBeVisible();
  await planner.getByRole('button',{name:'README.md',exact:true}).click();
  await expect(planner.getByText('docs/README.md',{exact:true})).toBeVisible();
  await planner.getByRole('button',{name:'Generate plan'}).click();
  await expect(planner.getByLabel('Chain name')).toHaveValue('Glossary review');
  const files=await page.evaluate(()=>(window as any).desktopCalls.find((call:any)=>call.endpoint==='/task-text/plan').data.files);
  expect(files).toEqual([{name:'README.md',text:'# Uploaded notes'},{name:'docs/README.md',text:'Synthetic readme'}]);
  await planner.getByRole('button',{name:'Start chain'}).click();
  await expect(planner).toHaveCount(0);
  const bindings=await page.evaluate(()=>(window as any).launchedPlan.sourceFiles);
  expect(bindings).toEqual([{name:'README.md',text:'# Uploaded notes'},{name:'docs/README.md',projectPath:'docs/README.md'}]);
});

test('the planner validates files before sending and keeps the narrow-screen dialog keyboard accessible',async({page})=>{
  const planner=await openPlanner(page);
  await page.setViewportSize({width:390,height:844});
  await planner.getByLabel('Source files').setInputFiles([sources[0],sources[0]]);
  await expect(planner.getByRole('alert')).toHaveText(/distinct names/);
  await expect(planner.getByRole('button',{name:'Generate plan'})).toBeDisabled();
  await planner.getByLabel('Source files').setInputFiles(sources[0]);
  await expect(planner.getByRole('alert')).toHaveCount(0);
  await planner.getByRole('button',{name:'Generate plan'}).focus();
  await page.keyboard.press('Tab');
  await expect(planner.getByLabel('Source files')).toBeFocused();
  expect(await planner.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(planner).toHaveCount(0);
  const sent=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint==='/task-text/plan'||c.endpoint==='/task-chains'&&c.action==='write'));
  expect(sent).toHaveLength(0);
});
