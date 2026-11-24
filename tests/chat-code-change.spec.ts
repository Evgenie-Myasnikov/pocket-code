import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {openChatList} from './chat-navigation';

test('live file writes display received code and resolve into one completed edit',async({page})=>{
  const source=['export function formatPrice(value: number) {','  const decimals = 2;','  const amount = value.toFixed(decimals);','','  return amount + " ₽";'].join('\n');
  await page.addInitScript(({source})=>{
    localStorage.setItem('pocket-code-language-v1','ru');
    localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
    (window as any).testHistoryPage=()=>({messages:[],previous:null,next:null});
    (window as any).testRuns=[{id:'edit-fixture',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',startedAt:Date.now(),baseMessageCount:0,approvals:[],revision:1,partial:'',
      messages:[{id:'request',role:'user',blocks:[{type:'text',text:'Добавь форматирование цены в учебный каталог.'}]}],
      generation:{outputTokens:111,outputTokensPerSecond:55,totalTokens:16200000,contextTokens:68000,contextWindow:100000},
      writePreviews:[{id:'edit-1',tool:'Write',path:'src/catalog/price.ts',content:source,totalBytes:new TextEncoder().encode(source).length,totalLines:5}]}];
  },{source});
  await page.setViewportSize({width:1280,height:800});await desktop(page);
  await page.locator('.desktop-sessions>button').first().click();
  const row=page.locator('.edit-activity');
  await expect(row).toHaveCount(1);await expect(row.locator('summary')).toContainText('Записываю файл · price.ts');
  await expect(row.locator('.edit-metrics')).toContainText(Buffer.byteLength(source)+' Б · 5 строк');
  await expect(row.locator('.edit-live-snippet')).toHaveText(source.split('\n').slice(-4).join('\n'),{useInnerText:false});
  const snippet=row.locator('.edit-live-snippet'),title=row.locator('.edit-summary-line');
  expect(await snippet.locator('.edit-live-line').evaluateAll(lines=>lines.map(line=>line.getAttribute('data-number')))).toEqual(['2','3','4','5']);
  const metrics=page.getByRole('group',{name:'Статистика токенов'});
  await expect(metrics).toContainText('55ток/с');
  await expect(metrics).toContainText('68% контекста');
  if(process.env.POCKET_LIVE_TOKENS_PREVIEW)await page.screenshot({path:process.env.POCKET_LIVE_TOKENS_PREVIEW,animations:'disabled'});
  expect(await snippet.evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/mono|Consolas/i);
  expect((await snippet.boundingBox())!.y).toBeGreaterThanOrEqual((await title.boundingBox())!.y+(await title.boundingBox())!.height);
  const capture=process.env.POCKET_CODE_CHANGE_PREVIEW;
  if(capture){
    await page.evaluate(()=>document.fonts.ready.then(()=>true));
    const r=(await row.boundingBox())!;
    await page.screenshot({path:capture,animations:'disabled',clip:{x:Math.max(0,r.x-14),y:r.y-12,width:r.width+28,height:r.height+24}});
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  const suffix=' // '+('received code '.repeat(8))+'end';
  await snippet.evaluate((el,suffix)=>{
    const w=window as any,seen:string[]=[];
    w.receivedFileText=seen;
    const observer=new MutationObserver(()=>{seen.push(el.textContent||'');if(el.textContent?.endsWith(suffix))observer.disconnect();});
    observer.observe(el,{subtree:true,characterData:true,childList:true});
    const run=w.testRuns[0],p=run.writePreviews[0];p.content+=suffix;p.totalBytes+=suffix.length;run.revision++;
  },suffix);
  await expect(snippet).toContainText('received code end');
  const seen=await page.evaluate(()=>(window as any).receivedFileText as string[]);
  const complete=source.split('\n').slice(-4).join('\n')+suffix;
  expect(seen.some(frame=>frame.length>complete.length-suffix.length&&frame.length<complete.length)).toBe(true);
  expect(seen.every(frame=>complete.startsWith(frame))).toBe(true);
  await row.locator('summary').focus();await page.keyboard.press('Enter');
  await expect(row.locator('.edit-file header')).toContainText('src/catalog/price.ts');
  await expect(row.locator('.edit-source-line code').nth(1)).toHaveText('  const decimals = 2;',{useInnerText:false});
  await row.evaluate(element=>{(window as any).liveEditNode=element;});
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0],p=run.writePreviews[0];p.content+='\n}';p.totalBytes+=2;p.totalLines++;run.generation.outputTokens=135;run.revision++;
  });
  await expect(row.locator('.edit-metrics')).toContainText('6 строк');
  await expect(metrics).toContainText('Сгенерировано 135');
  expect(await row.evaluate(element=>(window as any).liveEditNode===element)).toBe(true);await expect(row).toHaveJSProperty('open',true);
  await page.evaluate(()=>{
    const run=(window as any).testRuns[0],p=run.writePreviews[0];run.writePreviews=[];
    run.messages.push({id:'committed',role:'assistant',blocks:[{id:p.id,type:'tool_use',name:'Write',input:{file_path:p.path,content:p.content}},{type:'tool_result',tool_use_id:p.id,content:'File created successfully at: '+p.path}]});run.revision++;
  });
  await expect(row).toHaveCount(1);await expect(row).toHaveAttribute('data-status','done');
  await expect(row.locator('.tool-diffstat')).toHaveText('+6−0');await expect(row.locator('.edit-live-snippet')).toHaveCount(0);
});

test('phone file activity keeps multi-file patches scrollable and failed edits truthful',async({page})=>{
  const content='*** Begin Patch\n*** Update File: src/first.ts\n@@\n-  oldValue\n+  '+('newValue'.repeat(35))+'\n*** Add File: src/second.ts\n+export const ready = true;\n*** End Patch';
  const messages=[{id:'u',role:'user',blocks:[{type:'text',text:'Review the example patch.'}]},{id:'a',role:'assistant',blocks:[
    {type:'tool_use',name:'apply_patch',id:'patch-1',input:{patch:content}},{type:'tool_result',tool_use_id:'patch-1',is_error:true,content:'The first file has changed.'}]}];
  await page.setViewportSize({width:360,height:800});
  await page.addInitScript(()=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-code-view'}));
    localStorage.setItem('pocket-code-language-v1','en');
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).testCopied=text;}}});
  });
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname.slice(4);
    const responses:Record<string,unknown>={
      '/health':{name:'Example',roots:['C:\\Demo'],version:'0.28.51',protocol:1},
      '/providers':[{id:'claude',available:true}],'/sessions':[{sessionId:'alpha',summary:'Sample patch',cwd:'C:\\Demo',lastModified:2}],
      '/jobs':[],'/custom-providers':[],'/sessions/alpha/messages':{messages,previous:null,next:null},'/updates/latest':{enabled:false},
    };
    return route.fulfill(path in responses?{json:responses[path]}:{status:404,json:{error:'No fixture'}});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');await openChatList(page);
  await page.locator('.sidebar .session-row').first().click();
  const row=page.locator('.edit-activity');await expect(row).toHaveAttribute('data-status','failed');
  await expect(row.locator('summary')).toContainText('File change failed');await expect(row.locator('.tool-diffstat')).toHaveText('+2−1');
  await row.locator('summary').click();await expect(row.locator('.edit-file')).toHaveCount(2);
  await expect(row.locator('.edit-file header').nth(1)).toContainText('src/second.ts');
  await expect(row.locator('.tool-result-content')).toContainText('The first file has changed.');
  const diff=row.locator('.edit-diff').first();expect(await diff.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await row.getByRole('button',{name:'Copy diff'}).nth(1).click();await expect.poll(()=>page.evaluate(()=>(window as any).testCopied)).toBe('+export const ready = true;');
});
