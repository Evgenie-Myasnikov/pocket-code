import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('review an AI suggestion inside the manual Markdown editor and prepare the edited batch',async({page})=>{
  const sample='Сравни названия категорий со справочником. Выпиши несовпадения и укажи ожидаемую категорию для каждой карточки.';
  await page.addInitScript(text=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    (window as any).testTaskTextResponse=text;
  },sample);
  await page.setViewportSize({width:1280,height:940});
  await desktop(page);
  await page.getByRole('button',{name:'Новый чат',exact:true}).click();
  await page.locator('.composer-attach').click();
  await page.getByRole('button',{name:'Задачи из Markdown',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Задачи из Markdown'});
  await editor.getByRole('button',{name:'Ввести задачи вручную'}).click();
  await editor.getByLabel('Название цепочки',{exact:true}).fill('Проверка каталога');
  await editor.getByLabel('Общий контекст',{exact:true}).fill('В учебном каталоге у каждой карточки должна быть категория из справочника.');
  await editor.getByLabel('Название шага',{exact:true}).fill('Сверить категории');
  const body=editor.getByRole('textbox',{name:'Инструкция',exact:true});
  await body.fill('Проверь категории.');
  await editor.getByRole('button',{name:'Улучшить с ИИ · Инструкции'}).click();
  const improve=page.getByRole('dialog',{name:'Улучшить с ИИ · Инструкции'});
  await improve.getByLabel('Провайдер').selectOption('copilot');
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
  expect(generated[0].data).toMatchObject({text:'Проверь категории.',provider:'copilot',field:'instructions'});
  expect(generated[0].data.context).toContain('Сверить категории');
  expect(writes.some((call:any)=>call.endpoint==='/jobs'||call.endpoint==='/task-chains')).toBe(false);
});

test('starting an edited imported chain uses the approved field values and original task order',async({page})=>{
  await page.addInitScript(()=>{
    (window as any).testChainRequest=(_path:string,data:any)=>{
      if(data)(window as any).importedChain={...data,status:'running',steps:data.tasks.map((task:any)=>({...task,status:'pending'}))};
      return {value:(window as any).importedChain};
    };
  });
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  await page.locator('.composer-attach').click();
  await page.getByRole('button',{name:'Markdown tasks',exact:true}).click();
  const importer=page.getByRole('dialog',{name:'Markdown tasks'});
  await importer.getByLabel('Main context (.md)').setInputFiles({
    name:'outline.md',mimeType:'text/markdown',buffer:Buffer.from('# Guide\nUse plain text.\n## Outline\nWrite sections.\n## Verify\nCheck examples.')
  });
  await importer.getByRole('button',{name:'Edit tasks'}).click();
  await importer.getByRole('textbox',{name:'Shared context',exact:true}).fill('Follow the glossary.');
  await importer.getByRole('textbox',{name:'Instructions',exact:true}).nth(1).fill('Check the glossary examples.');
  await importer.getByRole('button',{name:'Start linked chats'}).click();
  await expect(page.getByRole('dialog',{name:'Task chains'})).toBeVisible();
  const plan=await page.evaluate(()=>(window as any).importedChain);
  expect(plan.context).toBe('Follow the glossary.');
  expect(plan.tasks.map((task:any)=>[task.title,task.body])).toEqual([['Outline','Write sections.'],['Verify','Check the glossary examples.']]);
});
