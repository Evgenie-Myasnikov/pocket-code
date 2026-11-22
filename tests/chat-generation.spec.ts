import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {openChatList} from './chat-navigation';

test('switching chats ignores a late metrics read and shows only provider-reported totals',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;
    w.testSessionGeneration=(id:string,query:URLSearchParams)=>{
      if(query.get('provider')!=='claude')return {};
      if(id==='alpha'&&!w.fetchedFirst){
        w.fetchedFirst=true;
        return new Promise(resolve=>{w.releaseMetrics=()=>resolve({generation:{outputTokens:77777}});});
      }
      if(id==='beta')return {generation:{totalTokens:15000,outputTokens:0,contextTokens:500}};
      return {generation:{outputTokens:421,outputTokensPerSecond:55,totalTokens:16200000,contextWindow:100000,contextTokens:68000}};
    };
  });
  await desktop(page);
  const alpha=page.locator('.desktop-sessions > button[data-chat-id="alpha"]'),beta=page.locator('.desktop-sessions > button[data-chat-id="beta"]');
  await alpha.click();await expect.poll(()=>page.evaluate(()=>!!(window as any).releaseMetrics)).toBe(true);
  await beta.click();await page.evaluate(()=>(window as any).releaseMetrics());
  const footer=page.getByRole('group',{name:'Token usage'});
  await expect(footer).toHaveText('Total tokens 15K');await expect(footer).not.toContainText('Generated');
  await alpha.click();
  await expect(footer).toContainText('55 tokens/s· last response');await expect(footer).toContainText('Generated 421');
  await expect(footer).toContainText('Total tokens 16.2M');await expect(footer).toContainText('68% context');
  if(process.env.POCKET_TOKEN_FOOTER_PREVIEW)await footer.screenshot({path:process.env.POCKET_TOKEN_FOOTER_PREVIEW});
});

test('the phone wraps generation statistics and an older unmetered chat omits the footer',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  const cwd='C:\\Docs\\sample';
  await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'fixture-metrics'}));localStorage.setItem('pocket-code-language-v1','ru');});
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname.replace('/api','');
    const data:Record<string,unknown>={
      '/health':{name:'Metrics',roots:[cwd],version:'0.28.63',protocol:1},'/providers':[{id:'claude',available:true}],'/jobs':[],
      '/sessions':['alpha','beta'].map((id,i)=>({sessionId:id,cwd,summary:i?'Legacy sample':'Measured sample',lastModified:2-i})),
      '/sessions/alpha/messages':{messages:[],next:null,previous:null},'/sessions/beta/messages':{messages:[],next:null,previous:null},
      '/sessions/alpha/generation':{generation:{outputTokens:10644,outputTokensPerSecond:55,totalTokens:16200000,contextTokens:68000,contextWindow:100000}},
      '/custom-providers':[],'/updates/latest':{enabled:false},
    };
    return route.fulfill(path in data?{json:data[path]}:{status:404,json:{error:'Fixture endpoint unavailable'}});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');await openChatList(page);
  await page.locator('.sidebar .session-row').filter({hasText:'Measured sample'}).click();
  const footer=page.getByRole('group',{name:'Статистика токенов'});await expect(footer).toContainText('последний ответ');
  await expect(footer).toContainText('68% контекста');expect(await footer.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  const geometry=await footer.locator(':scope > span').evaluateAll(items=>items.map(i=>i.getBoundingClientRect().top));expect(geometry.at(-1)!).toBeGreaterThan(geometry[0]);
  if(process.env.POCKET_TOKEN_PHONE_PREVIEW)await footer.screenshot({path:process.env.POCKET_TOKEN_PHONE_PREVIEW});
  await page.getByRole('button',{name:/К списку чатов|Назад к чатам/}).click();await page.locator('.sidebar .session-row').filter({hasText:'Legacy sample'}).click();
  await expect(footer).toHaveCount(0);
});
