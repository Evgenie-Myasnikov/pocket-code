import {test,expect} from '@playwright/test';
import {openChatList} from './chat-navigation';

for(const width of [390,1280])test(`public reasoning opens in one click and failed commands keep their place at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:1080});
 await page.addInitScript(()=>{
  sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
  localStorage.setItem('pocket-code-language-v1','ru');
  localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale:100,textSize:16,palette:'sage',theme:'dark'}));
 });
 const project='C:/Example/guide',sessionId='activity-demo',reasoning=[
  'Для проверки руководства нужны оглавление и список разделов. Начну с оглавления, затем сверю ссылки на примеры.',
  'В оглавлении три раздела. Ссылки из введения и справочника ведут к существующим страницам. Осталось проверить пример из раздела о поиске.',
  'Проверю пример в каталоге документации. Если файл перемещён, результат команды поможет найти ссылку, которую нужно обновить.'
 ].join('\n\n');
 const command='npm run check:links -- --root docs/guide --include examples --format detailed',diagnostic='docs/guide/search.md → examples/search.md';
 const error=diagnostic+'\nФайл примера не найден.';
 const output=width===390?Array.from({length:60},(_,i)=>'Проверена ссылка '+(i+1)).join('\n')+'\n'+error:error;
 const messages=[
  {id:'request',role:'user',blocks:[{type:'text',text:'Проверь ссылки в руководстве.'}]},
  {id:'work',role:'assistant',blocks:[
   {type:'thinking',thinking:reasoning+'\n\n'+Array.from({length:12},(_,i)=>'Проверяю ссылку на пример '+(i+1)+'.').join('\n')},
   {type:'tool_use',id:'cmd',name:'Command',input:{command}},
   {type:'tool_result',tool_use_id:'cmd',is_error:true,content:output},
   {type:'tool_use',id:'read-page',name:'Read',input:{file_path:'docs/guide/search.md',status:'completed'}},
   {type:'tool_use',id:'read-index',name:'Read',input:{file_path:'docs/guide/index.md',status:'completed'}},
  ]},
  {id:'answer',role:'assistant',blocks:[
   {type:'text',text:'В руководстве одна недействительная ссылка на пример поиска.'},
   {type:'image',source:{media_type:'image/png',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFz0AAAAASUVORK5CYII='}},
  ]},
 ];
 await page.route('**/api/**',route=>{
  const endpoint=new URL(route.request().url()).pathname;
  const json=endpoint==='/api/health'?{name:'Demo',roots:[project],protocol:1}:endpoint==='/api/providers'?[{id:'claude',name:'Claude',available:true,authenticated:true,models:[]}]:
   endpoint==='/api/projects'?[project]:endpoint==='/api/sessions'?[{sessionId,summary:'Проверка ссылок',cwd:project,lastModified:1}]:
   endpoint.endsWith('/messages')?{messages,previous:null,next:null}:endpoint==='/api/jobs'||endpoint.endsWith('/subagents')?[]:undefined;
  return typeof json==='undefined'?route.fulfill({status:404,json:{error:'Synthetic route'}}):route.fulfill({json});
 });
 await page.goto('http://127.0.0.1:5173');await openChatList(page);
 await page.getByRole('button',{name:/Проверка ссылок/}).click();
 const work=page.locator('[data-message-id="work"]'),reason=work.locator('details.thinking'),failed=work.locator('.activity-row.failed');
 await expect(reason.locator('summary')).toHaveText('Рассуждения');
 await expect(reason.locator('p')).toHaveCount(0);
 await expect(failed.locator('summary')).toContainText(command);await expect(failed.locator('summary')).toContainText('Команда не выполнилась');
 await expect(failed.locator('summary .tool-state')).toHaveText('Не удалось');
 await expect(failed.locator('summary')).toHaveCSS('color',await reason.locator('summary').evaluate(el=>getComputedStyle(el).color));
 await expect(page.locator('[data-message-id="answer"] .markdown')).toBeVisible();await expect(page.locator('.image-preview img')).toBeVisible();
 expect(await work.locator('details').evaluateAll(elements=>elements.map(el=>el.classList.contains('thinking')))).toEqual([true,false,false]);
 await expect(work.locator('.activity-group>summary')).toHaveText('Изучил 2 файла');
 await reason.locator('summary').click();const text=reason.getByRole('region',{name:'Рассуждения'});
 await expect(text).toContainText('Для проверки руководства');await text.focus();await page.keyboard.press('End');
 await expect.poll(()=>text.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);await page.keyboard.press('Home');
 await failed.locator('summary').click();const result=failed.getByRole('region',{name:'Результат инструмента'});
 await expect(result).toContainText(diagnostic);
 for(const pre of [failed.locator('.tool-command'),result]){
  await expect(pre).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(pre).toHaveCSS('border-top-width','0px');
  await expect(pre).toHaveCSS('user-select','text');
 }
 if(width===390){
  await failed.locator('.tool-output-more').click();await result.focus();await page.keyboard.press('End');
  await expect.poll(()=>result.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 }
 expect(await work.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 if(width===1280){
  await work.scrollIntoViewIfNeeded();await text.evaluate(el=>el.scrollTop=0);await page.mouse.move(2,2);
  await page.evaluate(()=>(document.activeElement as HTMLElement)?.blur());
  await expect(failed.locator('.tool-output-actions')).toHaveCSS('opacity','0');
  const box=await work.boundingBox();
  if(!box)throw Error('Transcript is not visible');
  await page.screenshot({path:'docs/images/chat-activity.ru.png',animations:'disabled',clip:{x:Math.floor(box.x)-36,y:Math.floor(box.y)-14,width:Math.ceil(box.width)+72,height:Math.ceil(box.height)+28}});
 }
});
