import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

const studio='C:\\Demo\\Студия';
const nested=studio+'\\Библиотеки\\Каталог';
const projects=[studio+'\\Библиотеки',nested,studio+'\\Мобильные\\Клиент',
  studio+'\\Инструменты\\Сборка',studio+'\\Примеры',studio+'\\Сайт',studio+'\\Эксперименты\\Редактор'];

test('browse a large project library and select a nested authorized project in Tasks',async({page})=>{
  await page.setViewportSize({width:1366,height:860});
  await page.addInitScript(paths=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    (window as any).testProjectPaths=paths;
  },[...projects,...Array.from({length:240},(_,i)=>'C:\\Demo\\Архив\\Проект-'+i)]);
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Задачи',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Проект',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Проект',exact:true});
  await dialog.getByRole('button',{name:'Открыть папку Студия'}).click();
  await expect(dialog.getByRole('button',{name:projects[0],exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Открыть папку Библиотеки'})).toBeVisible();
  await page.screenshot({path:'artifacts/project-folder-picker.ru.png'});
  await dialog.getByRole('button',{name:'Открыть папку Библиотеки'}).press('Enter');
  await expect(dialog.getByRole('button',{name:nested,exact:true})).toBeVisible();
  await dialog.getByRole('navigation',{name:'Путь к папке'}).getByRole('button',{name:'Студия'}).click();
  const search=dialog.getByRole('searchbox',{name:'Найти проект'});
  await search.fill('Проект-216');
  await expect(dialog.getByRole('button',{name:'C:\\Demo\\Архив\\Проект-216',exact:true})).toBeVisible();
  await search.fill('no match for this input');await expect(dialog.getByText('Проекты не найдены')).toBeVisible();
  await search.fill('Библиотеки/Каталог');await search.press('ArrowDown');
  const result=dialog.getByRole('button',{name:nested,exact:true});
  await expect(result).toBeFocused();await result.press('Enter');
  await expect(dialog).toBeHidden();await expect(trigger).toContainText('Каталог');await expect(trigger).toBeFocused();
});

test('phone folder browsing keeps the selected Tasks project on cancel',async({page})=>{
  const root='/work/studio',child=root+'/apps/catalog';
  await page.setViewportSize({width:360,height:740});
  await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)})));
  await page.route('**/api/**',route=>{
    const values:Record<string,unknown>={
      '/api/health':{protocol:1,name:'Studio',roots:[root]},
      '/api/providers':[{id:'claude',available:true}],'/api/projects':[root,child],
      '/api/workspaces':{host:true,workspaces:[],boards:[]}
    };
    return route.fulfill({json:values[new URL(route.request().url()).pathname]??[]});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');
  await page.locator('.mobile-tabbar').getByRole('button',{name:'Tasks'}).click();
  const trigger=page.getByRole('button',{name:'Project',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Project',exact:true});
  await dialog.getByRole('button',{name:'Open folder apps'}).click();
  await expect(dialog.getByRole('button',{name:child,exact:true})).toBeInViewport();
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('pocket-code-back')));
  await expect(dialog).toBeHidden();
  await expect(trigger).toContainText('studio');
  await expect(trigger).toBeFocused();
});
