import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {openChatList} from './chat-navigation';

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
 await expect(card).toContainText('Результат в src');await expect(card).toContainText('Рабочая папка Atlas');
 await expect(card).toContainText('+3');await expect(card).toContainText('−2');
 await card.getByRole('button',{name:'Файлов: 3'}).focus();await page.keyboard.press('Enter');
 await expect(card.getByText('Удалён')).toBeVisible();await expect(card.getByRole('button',{name:'src/legacy.ts'})).toHaveCount(0);
 if(process.env.POCKET_TURN_RESULT_PREVIEW){
   await card.getByText('Результат в src',{exact:true}).click();
   await card.screenshot({path:process.env.POCKET_TURN_RESULT_PREVIEW,animations:'disabled'});
 }
 const explorer=card.getByRole('button',{name:/В Проводнике/}),root='C:\\Demo\\Atlas';
 await page.evaluate(()=>{(window as any).folderOpenError='Путь не найден на ПК';});
 await explorer.first().click();await expect(card.getByRole('alert')).toContainText('Не удалось открыть папку в Проводнике');
 await page.evaluate(()=>{delete (window as any).folderOpenError;});
 await explorer.first().click();await expect(card.getByRole('alert')).toHaveCount(0);await explorer.last().click();
 const folders=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.action==='open-project-folder').map(({cwd,path}:any)=>({cwd,path})));
 expect(folders.slice(-2)).toEqual([{cwd:root,path:root+'\\src'},{cwd:root,path:root}]);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // on the PC a file opens as a tab of the side panel beside the chat, not as a dialog
 await card.getByRole('button',{name:'src/catalog.ts'}).click();const side=page.locator('.chat-side-panel');await expect(side.getByRole('tab',{name:'catalog.ts'})).toHaveAttribute('aria-selected','true');await expect(side).toContainText('Synthetic readme');await expect(page.getByRole('dialog')).toHaveCount(0);
 const calls=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>/^\/files?\?/.test(c.endpoint)).map((c:any)=>c.endpoint) as string[]);
 expect(calls.some(p=>p.includes('cwd=')&&decodeURIComponent(p).includes('src\\catalog.ts'))).toBe(true);
 await page.setViewportSize({width:390,height:844});
 const box=await card.boundingBox();expect(box!.width).toBeLessThanOrEqual(390);
 // the PC window has no diff link here: files open in the side panel instead
 await expect(card.getByRole('button',{name:'Посмотреть diff'})).toHaveCount(0);
});

test('a phone browses result folders on the connected PC inside Files',async({page})=>{
 await page.setViewportSize({width:320,height:640});
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','en');
   sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-result-folder'}));
 });
 const root='C:\\Demo\\Atlas',listed:string[]=[];
 await page.route('**/api/**',route=>{
   const url=new URL(route.request().url()),path=url.pathname.slice(4);
   if(path==='/files'){
     const directory=url.searchParams.get('path')!;
     expect(url.searchParams.get('cwd')).toBe(root);listed.push(directory);
     return route.fulfill({json:{path:directory,parent:directory===root?null:root,entries:[]}});
   }
   const data:Record<string,unknown>={
     '/health':{name:'Example',roots:[root],version:'0.28.54',protocol:1},'/projects':[],
     '/providers':[{id:'claude',available:true}],'/sessions':[{sessionId:'alpha',summary:'Folder test',cwd:root,lastModified:2}],
     '/jobs':[],'/custom-providers':[],'/updates/latest':{enabled:false},'/sessions/alpha/messages':{messages:[
       {id:'u',role:'user',blocks:[{type:'text',text:'Create the file.'}]},
       {id:'a',role:'assistant',blocks:[{type:'tool_use',id:'edit',name:'File changes',input:{status:'completed',changes:[{path:'src/index.ts',kind:'add',diff:'+export {}'}]}}]},
     ],previous:null,next:null},
   };
   return route.fulfill(path in data?{json:data[path]}:{status:404,json:{error:'No fixture'}});
 });
 await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');await openChatList(page);
 await page.locator('.sidebar .session-row').first().click();
 const card=page.getByRole('region',{name:'Turn result'}),folders=card.getByRole('button',{name:/Browse PC files/});
 for(const [index,path] of [root+'\\src',root].entries()){
   await folders.nth(index).click();const dialog=page.getByRole('dialog',{name:'Project folder'});
   await expect(dialog).toBeVisible();await expect.poll(()=>listed.at(-1)).toBe(path);
   await dialog.getByRole('button',{name:'Close'}).click();
 }
 await expect(card.getByRole('button',{name:/Explorer/})).toHaveCount(0);
});
