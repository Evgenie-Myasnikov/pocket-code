import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('refreshing Fill instructions preserves a selected API profile and model while local availability changes',async({page})=>{
  const account='00000000-0000-4000-8000-000000000010';
  await page.addInitScript(id=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    const fixture=window as any;
    fixture.testTaskTextCatalog={providers:['copilot'],accounts:[{id,name:'Редактор каталога'}],
      unavailable:[{provider:'claude',reason:'signed_out'},{provider:'codex',reason:'version'}]};
    fixture.testTaskTextModels={[id]:['editor-small','editor-pro']};
  },account);
  await page.setViewportSize({width:1280,height:940});
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Задачи',exact:true}).click();
  await page.getByRole('button',{name:'Создать задачу',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Создать задачу'});
  await editor.getByRole('button',{name:'Заполнить с ИИ · Инструкции'}).click();
  const dialog=page.getByRole('dialog',{name:'Заполнить с ИИ · Инструкции'});
  await expect(dialog.getByRole('radio',{name:'GitHub Copilot'})).toBeChecked();
  await expect(dialog.getByText(/требуется вход на ПК/)).toBeVisible();
  await expect(dialog.getByText(/нужен Codex CLI/)).toBeVisible();
  await dialog.locator('summary',{hasText:'API-подключения'}).click();
  await dialog.getByRole('combobox',{name:'Подключение',exact:true}).selectOption(account);
  await dialog.getByRole('combobox',{name:'Модель',exact:true}).selectOption('editor-pro');
  await dialog.getByLabel('Пожелания к тексту').fill('Сравни обозначения в справочнике. Перечисли расхождения и опиши проверку для каждого исправления.');
  await page.evaluate(()=>{
    const fixture=window as any;
    fixture.testTaskTextCatalog.providers=['codex'];
    fixture.testTaskTextCatalog.unavailable=[{provider:'claude',reason:'signed_out'},{provider:'copilot',reason:'not_detected'}];
  });
  await dialog.getByRole('button',{name:'Обновить список'}).click();
  await expect(dialog.getByRole('radio',{name:'Codex',exact:true})).toBeVisible();
  await expect(dialog.getByRole('combobox',{name:'Подключение',exact:true})).toHaveValue(account);
  await expect(dialog.getByRole('combobox',{name:'Модель',exact:true})).toHaveValue('editor-pro');
  await expect(dialog.getByText(/CLI не обнаружен/)).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Создать вариант'})).toBeEnabled();
  if(process.env.POCKET_PROVIDER_PREVIEW){
    await page.evaluate(()=>document.fonts.ready.then(()=>true));
    await dialog.screenshot({path:process.env.POCKET_PROVIDER_PREVIEW});
  }
});

test('review an AI suggestion inside the manual Markdown editor and prepare the edited batch',async({page})=>{
  const sample='Сравни названия категорий со справочником. Выпиши несовпадения и укажи ожидаемую категорию для каждой карточки.';
  await page.addInitScript(text=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    (window as any).testTaskTextResponse=text;
    const account='00000000-0000-4000-8000-000000000001';
    (window as any).testTaskTextAccounts=[{id:account,name:'Учебный API'}];
    (window as any).testTaskTextModels={[account]:['catalog-general','catalog-editor']};
  },sample);
  await page.setViewportSize({width:1280,height:940});
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Задачи',exact:true}).click();
  await page.getByRole('button',{name:'Создать задачу',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Создать задачу'});
  await expect(editor.getByRole('button',{name:'Заполнить с ИИ · Инструкции'})).toBeVisible();
  await editor.getByText('Другие параметры',{exact:true}).click();
  await editor.getByLabel('Общий контекст',{exact:true}).fill('В учебном каталоге у каждой карточки должна быть категория из справочника.');
  await editor.getByLabel('Название (необязательно)',{exact:true}).fill('Сверить категории');
  const body=editor.getByRole('textbox',{name:'Описание',exact:true});
  await body.fill('Проверь категории.');
  if(process.env.POCKET_INSTRUCTION_PREVIEW){await page.evaluate(()=>document.fonts.ready.then(()=>true));await editor.screenshot({path:process.env.POCKET_INSTRUCTION_PREVIEW});}
  await editor.getByRole('button',{name:'Улучшить с ИИ · Инструкции'}).click();
  const improve=page.getByRole('dialog',{name:'Улучшить с ИИ · Инструкции'});
  await improve.locator('summary',{hasText:'API-подключения'}).click();
  await improve.getByRole('combobox',{name:'Подключение',exact:true}).selectOption({label:'Учебный API'});
  await improve.getByRole('combobox',{name:'Модель',exact:true}).selectOption('catalog-editor');
  await improve.getByLabel('Пожелания к тексту').fill('Уточни, что записать в результат проверки.');
  await improve.getByRole('button',{name:'Создать вариант'}).click();
  await expect(improve.getByLabel('Предложенный текст')).toHaveValue(sample);
  await improve.getByText('Исходный текст',{exact:true}).click();
  if(process.env.POCKET_IMPROVE_PREVIEW){
    await page.evaluate(()=>document.fonts.ready.then(()=>true));
    await improve.screenshot({path:process.env.POCKET_IMPROVE_PREVIEW});
  }
  await improve.getByRole('button',{name:'Применить'}).click();
  await expect(body).toHaveValue(sample);
  await editor.getByRole('button',{name:'Подготовить черновик'}).click();
  await expect(page.getByRole('textbox',{name:'Сообщение Claude'})).toHaveValue(new RegExp(sample));
  const writes=await page.evaluate(()=>(window as any).desktopCalls.filter((call:any)=>call.action==='write'));
  const generated=writes.filter((call:any)=>call.endpoint==='/task-text/improve');
  expect(generated).toHaveLength(1);
  expect(generated[0].data).toMatchObject({text:'Проверь категории.',provider:'custom',account:'00000000-0000-4000-8000-000000000001',model:'catalog-editor',field:'instructions'});
  expect(generated[0].data.context).toContain('Сверить категории');
  expect(writes.some((call:any)=>call.endpoint==='/jobs'||call.endpoint==='/task-chains')).toBe(false);
});

test('starting an edited imported chain uses the approved field values and original task order',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).testTaskTextResponse='Check the glossary examples.';
    (window as any).testChainRequest=(_path:string,data:any)=>{
      if(!data && _path==='/task-chains')return {value:[]};
      if(data)(window as any).importedChain={...data,status:'running',steps:data.tasks.map((task:any)=>({...task,status:'pending'}))};
      return {value:(window as any).importedChain};
    };
  });
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  await page.locator('.desktop-rail').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:'Create chain',exact:true}).click();
  await page.getByRole('button',{name:'Import Markdown',exact:true}).click();
  const importer=page.getByRole('dialog',{name:'Markdown tasks'});
  await importer.getByLabel('Main context (.md)').setInputFiles({
    name:'outline.md',mimeType:'text/markdown',buffer:Buffer.from('# Guide\nUse plain text.\n## Outline\nWrite sections.\n## Verify\nCheck examples.')
  });
  const row=importer.getByRole('region',{name:'Run order'}).getByRole('listitem').nth(1);
  await row.getByRole('button',{name:'Improve with AI · Instructions'}).click();
  const improve=page.getByRole('dialog',{name:'Improve with AI · Instructions'});
  await improve.getByRole('button',{name:'Generate suggestion'}).click();
  await improve.getByRole('button',{name:'Apply',exact:true}).click();
  await importer.getByRole('button',{name:'Edit tasks'}).click();
  await expect(importer.getByRole('button',{name:'Improve with AI · Instructions'})).toHaveCount(2);
  await importer.getByRole('textbox',{name:'Shared context',exact:true}).fill('Follow the glossary.');
  await expect(importer.getByRole('textbox',{name:'Instructions',exact:true}).nth(1)).toHaveValue('Check the glossary examples.');
  await importer.getByRole('button',{name:'Start linked chats'}).click();
  await expect(page.getByRole('region',{name:'Tasks',exact:true})).toBeVisible();
  const plan=await page.evaluate(()=>(window as any).importedChain);
  expect(plan.context).toBe('Follow the glossary.');
  expect(plan.tasks.map((task:any)=>[task.title,task.body])).toEqual([['Outline','Write sections.'],['Verify','Check the glossary examples.']]);
});

test('phone Tasks tab fills a blank step instruction without starting a chat',async({page})=>{
  const root='C:\\Demo\\Atlas',suggestion='Review every glossary entry.';
  await page.setViewportSize({width:360,height:780});
  await page.addInitScript(()=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-token'.repeat(4)}));
    localStorage.setItem('pocket-code-language-v1','en');
  });
  const writes:string[]=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='POST')writes.push(path);
    const values:Record<string,unknown>={
      '/api/health':{protocol:1,name:'Example host',roots:[root]},
      '/api/projects':[root],'/api/providers':[{id:'claude',name:'Claude',available:true,models:[]}],
      '/api/workspaces':{host:true,canManageWorkspaces:true,workspaces:[],boards:[]},
      '/api/task-text/providers':{providers:['claude','codex','copilot']},'/api/task-text/improve':{text:suggestion},
      '/api/updates/status':{enabled:false}
    };
    await route.fulfill({json:values[path]??[]});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');
  await page.locator('.mobile-tabbar').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:'Create task',exact:true}).click();
  const instructions=page.getByRole('textbox',{name:'Description',exact:true});
  await page.getByRole('textbox',{name:'Title (optional)',exact:true}).fill('Review glossary');
  await page.getByRole('button',{name:'Fill with AI · Instructions'}).click();
  const ai=page.getByRole('dialog',{name:'Fill with AI · Instructions'});
  await expect(ai).toBeVisible();
  const codex=ai.getByRole('radio',{name:'Codex',exact:true}),generate=ai.getByRole('button',{name:'Generate suggestion'});
  await codex.check();
  const unicode='Словарь📘"';
  const bytes=Buffer.byteLength(JSON.stringify({currentField:'',brief:'Review glossary\n\n'+unicode}),'utf8');
  const exact=unicode+'a'.repeat(4000-bytes);
  const guidance=ai.getByLabel('Drafting guidance');
  await guidance.fill(exact);
  await expect(ai.getByText('Codex · 0 of 4000 UTF-8 bytes remaining.')).toBeVisible();
  await expect(generate).toBeEnabled();
  await guidance.fill(exact+'я');
  await expect(ai.getByText(/exceeds the 4000 UTF-8 byte limit by 2 bytes/)).toBeVisible();
  await expect(generate).toBeDisabled();
  expect(writes).not.toContain('/api/task-text/improve');
  await ai.getByRole('radio',{name:'GitHub Copilot',exact:true}).check();
  await expect(ai.getByText(/UTF-8 byte/)).toHaveCount(0);
  await expect(generate).toBeEnabled();
  await guidance.fill(unicode);
  await codex.check();
  await generate.click();
  await expect(ai.getByLabel('Suggested text')).toHaveValue(suggestion);
  await ai.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(instructions).toHaveValue(suggestion);
  await expect(page.getByRole('button',{name:'Improve with AI · Instructions'})).toBeVisible();
  expect(writes).toContain('/api/task-text/improve');
  expect(writes).not.toContain('/api/jobs');
  expect(writes).not.toContain('/api/task-chains');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
