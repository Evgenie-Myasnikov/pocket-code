import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a finished turn opens its own output folder and files, exposes deletions and links Review',async({page})=>{
 await page.setViewportSize({width:1150,height:820});
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','ru');
   (window as any).branchMessages=[
     {id:'ask',role:'user',blocks:[{type:'text',text:'Обнови оформление каталога.'}]},
     {id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'change',name:'File changes',input:{status:'completed',changes:[
       {path:'src/layout.ts',kind:'update',diff:'@@\n-old\n+adaptive\n+responsive'},
       {path:'src/catalog.ts',kind:'add',diff:'export const pages = [];'},
       {path:'src/legacy.ts',kind:'delete',diff:'@@\n-obsolete'}
     ]}}]},
     {id:'done',role:'assistant',blocks:[{type:'text',text:'Обновил компоновку каталога и удалил устаревший файл.'}]}
   ];
 });
 await desktop(page);await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 const card=page.getByRole('region',{name:'Результат работы'});
 await expect(card).toContainText('Результат в src');await expect(card).toContainText('Рабочая папка · Atlas');
 await expect(card).toContainText('+3');await expect(card).toContainText('−2');
 await card.getByRole('button',{name:'Файлов: 3'}).focus();await page.keyboard.press('Enter');
 await expect(card.getByText('Удалён')).toBeVisible();await expect(card.getByRole('button',{name:'src/legacy.ts'})).toHaveCount(0);
 if(process.env.POCKET_TURN_RESULT_PREVIEW){
   await card.getByText('Результат в src',{exact:true}).click();
   await card.screenshot({path:process.env.POCKET_TURN_RESULT_PREVIEW,animations:'disabled'});
 }
 await card.getByRole('button',{name:/Открыть папку.*Atlas.*src/}).click();
 const folder=page.getByRole('dialog',{name:'Папка проекта'});await expect(folder).toBeVisible();await expect(folder.locator('.breadcrumb')).toContainText('Atlas/src');
 await page.keyboard.press('Escape');await expect(folder).toHaveCount(0);
 await card.getByRole('button',{name:'src/catalog.ts'}).click();await expect(page.getByRole('dialog')).toContainText('Synthetic readme');await page.keyboard.press('Escape');
 const calls=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>/^\/files?\?/.test(c.endpoint)).map((c:any)=>c.endpoint) as string[]);
 expect(calls.some(p=>p.includes('cwd=')&&decodeURIComponent(p).includes('src\\catalog.ts'))).toBe(true);
 await page.setViewportSize({width:390,height:844});
 const box=await card.boundingBox();expect(box!.width).toBeLessThanOrEqual(390);
 await card.getByRole('button',{name:'Посмотреть diff'}).click();await expect(page.locator('.review-file').first()).toContainText('layout.ts');
});
