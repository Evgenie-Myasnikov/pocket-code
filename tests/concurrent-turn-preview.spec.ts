import {expect,test,type Page} from '@playwright/test';
import {openChatList} from './chat-navigation';
import {desktop} from './desktop-fixture';

async function phone(page:Page){
  await page.addInitScript(()=>sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)})));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    let value:unknown=[];
    if(path==='/api/health')value={name:'Demo',roots:['C:/Demo/Atlas'],protocol:1};
    else if(path==='/api/providers')value=[{id:'claude',name:'Claude',available:true,authenticated:true}];
    else if(path==='/api/sessions')value=[{sessionId:'alpha',summary:'Каталог',cwd:'C:/Demo/Atlas',lastModified:1}];
    else if(path==='/api/jobs')value=await page.evaluate(()=>(window as any).testRuns.map((run:any)=>({...run,messages:[],reasoningPreviews:undefined,writePreviews:undefined})));
    else if(path==='/api/jobs/concurrent-preview'){
      const run=await page.evaluate(()=>(window as any).testRuns[0]);
      if(String(run.revision)===url.searchParams.get('revision'))value=null;
      else if(String(run.messagesRevision)===url.searchParams.get('messages'))value={...run,messages:[],messagesUnchanged:true};
      else value=run;
    }
    else if(path.endsWith('/messages'))value=await page.evaluate(()=>(window as any).testHistoryPage());
    await route.fulfill({json:value});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');
}

for(const client of ['desktop','phone'])test(`${client} keeps reasoning and two live writes in one turn through completion and reopening`,async({page})=>{
  await page.setViewportSize(client==='phone'?{width:390,height:844}:{width:1440,height:1024});
  await page.addInitScript(()=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
    const messages=JSON.parse(sessionStorage.getItem('preview-fixture-history')||'[]');
    (window as any).testHistoryPage=()=>({messages,previous:null,next:null});
    const committed=[
      {id:'request',role:'user',blocks:[{type:'text',text:'Добавь форматирование цены и тест для рублей.'}]},
      {id:'initial',role:'assistant',blocks:[{type:'thinking',thinking:'Проверю, как каталог показывает цены.'}]},
      {id:'inspect',role:'assistant',blocks:[{type:'tool_use',id:'list',name:'Bash',input:{command:'git status'}}]},
      {id:'listed',role:'user',blocks:[{type:'tool_result',tool_use_id:'list',content:'Clean.'}]},
      {id:'resumed',role:'assistant',blocks:[{type:'thinking',thinking:'Форматирование и тест находятся в разных файлах.'}]},
      {id:'inspect-again',role:'assistant',blocks:[{type:'tool_use',id:'inspect-again',name:'Bash',input:{command:'git diff --stat'}}]},
      {id:'inspected-again',role:'user',blocks:[{type:'tool_result',tool_use_id:'inspect-again',content:'No edits yet.'}]},
    ];
    (window as any).testRuns=messages.length?[]:[{
      id:'concurrent-preview',provider:'claude',cwd:'C:\\Demo\\Atlas',sessionId:'alpha',
      status:'running',startedAt:Date.now(),baseMessageCount:0,revision:1,messagesRevision:1,
      approvals:[],partial:'',messages:committed,
    }];
  });
  if(client==='desktop')await desktop(page);
  else await phone(page);
  const open=async()=>{
    if(client==='phone')await openChatList(page);
    await page.getByRole('button',{name:client==='desktop'?/claude · Interface review/:/Каталог/}).click();
  };
  await open();
  const reasoning=page.locator('details.thinking');
  await expect(reasoning).toHaveCount(1);
  const commands=page.locator('[data-command-history=true]');
  await expect(commands).toContainText('Выполнил 2 команды');
  await reasoning.evaluate(node=>{(window as any).reasoningNode=node;});
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0];
    run.reasoningPreviews=[{id:'thinking-delta',role:'assistant',blocks:[{type:'thinking',thinking:'Пишу функцию формата цены'}]}];
    run.writePreviews=[
      {id:'format',path:'format-price.ts',content:'export function formatPrice(value: number) {\n  return new Intl.NumberFormat("ru-RU", {'},
      {id:'test',path:'format-price.test.ts',content:'test("формат рубля", () => {\n  const price = formatPrice(250);'},
    ].map(file=>({...file,tool:'Write',totalBytes:new TextEncoder().encode(file.content).length,totalLines:2}));
    run.revision++;
  });
  const context=reasoning.locator('.reasoning-content');
  await expect(context).toHaveText('Проверю, как каталог показывает цены. Форматирование и тест находятся в разных файлах. Пишу функцию формата цены',{useInnerText:true});
  const files=page.locator('.edit-activity');
  const snippets=files.locator('.edit-live-snippet');
  await expect(snippets).toHaveText([/new Intl.NumberFormat/,/const price = formatPrice/]);
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0];
    run.reasoningPreviews[0].blocks[0].thinking+=' и проверяю символ валюты.';
    for(const file of run.writePreviews){
      file.content+=file.id==='format'?'\n    style: "currency", currency: "RUB"':'\n  expect(price).toContain("₽");';
      file.totalBytes=new TextEncoder().encode(file.content).length;file.totalLines++;
    }
    run.revision++;
  });
  await expect(snippets).toHaveText([/currency: "RUB"/,/expect\(price\).toContain/]);
  await expect(context).toContainText('Пишу функцию формата цены и проверяю символ валюты.');
  expect(await reasoning.evaluate(node=>node===(window as any).reasoningNode)).toBe(true);
  if(client==='phone')expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const capture=client==='desktop'?process.env.POCKET_PARALLEL_TURN_CAPTURE:process.env.POCKET_PARALLEL_PHONE_CAPTURE;
  if(capture){
    const top=await reasoning.boundingBox(),bottom=await files.last().boundingBox();
    if(client==='desktop'&&top&&bottom){
      const clip={x:top.x-24,y:top.y-20,width:top.width+48,height:bottom.y+bottom.height-top.y+44};
      await page.screenshot({path:capture,animations:'disabled',clip});
    }else await page.screenshot({path:capture,animations:'disabled'});
  }
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0];
    run.messages.push({id:'verified',role:'assistant',blocks:[{type:'thinking',thinking:'Оба файла готовы.'}]});
    for(const file of run.writePreviews){
      run.messages.push({id:'saved-'+file.id,role:'assistant',blocks:[{type:'tool_use',id:file.id,name:'Write',input:{file_path:file.path,content:file.content}}]},
        {id:'result-'+file.id,role:'user',blocks:[{type:'tool_result',tool_use_id:file.id,content:'Saved.'}]});
    }
    run.messages.push({id:'response',role:'assistant',blocks:[{type:'text',text:'Updated both examples.'}]});
    delete run.reasoningPreviews;delete run.writePreviews;
    run.messagesRevision++;run.revision++;run.status='done';
    sessionStorage.setItem('preview-fixture-history',JSON.stringify(run.messages));
    (window as any).testHistoryPage=()=>({messages:run.messages,previous:null,next:null});
  });
  const checkCompleted=async()=>{
    await expect(page.getByText('Updated both examples.',{exact:true})).toBeVisible();
    await expect(reasoning).toHaveCount(1);
    if(!await reasoning.evaluate(node=>(node as HTMLDetailsElement).open))await reasoning.locator('summary').click();
    await expect(context).toHaveText('Проверю, как каталог показывает цены. Форматирование и тест находятся в разных файлах. Оба файла готовы.',{useInnerText:true});
    await expect(commands).toHaveCount(1);
    const edits=page.locator('.activity-group').filter({has:page.locator('summary').filter({hasText:'Изменил 2 файла'})});
    await expect(edits).toHaveCount(1);
    if(!await edits.evaluate(node=>(node as HTMLDetailsElement).open))await edits.locator(':scope > summary').click();
    await expect(edits).toContainText('format-price.ts');
    await expect(edits).toContainText('format-price.test.ts');
    await expect(snippets).toHaveCount(0);
  };
  await checkCompleted();
  await page.reload();
  await open();
  await checkCompleted();
});
