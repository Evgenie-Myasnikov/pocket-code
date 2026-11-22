import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
import {newChat} from './chat-navigation';

test('a saved Windows chat opens directly to its messages',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('pocket-code-language-v1','ru');});
  await desktop(page);
  await page.evaluate(()=>{
    (window as any).testHistoryPage=()=>({messages:[
      {id:'u1',role:'user',blocks:[{type:'text',text:'Как устроен каталог примеров?'}]},
      {id:'a1',role:'assistant',blocks:[{type:'text',text:'Каждая папка содержит пример и README с инструкциями по запуску.'}]}
    ],previous:null,next:null});
  });
  await page.locator('.desktop-rail').getByRole('button',{name:/claude · Interface review/i}).click();
  const conversation=page.locator('.conversation-inner:visible');
  await expect(conversation.getByText('Каждая папка содержит пример и README с инструкциями по запуску.')).toBeVisible();
  await expect(conversation.getByText(/Продолжение на ПК|Начало чата|Claude Desktop/)).toHaveCount(0);
  await expect(conversation.locator('.history-page-status')).toHaveCount(0);
  await page.screenshot({path:'docs/images/clean-chat.ru.png'});
});

test('a new phone conversation shows the active reply without a device marker',async({page})=>{
  await page.setViewportSize({width:370,height:780});
  await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));});
  const root='C:\\Demo\\Studio';
  let run:Record<string,unknown>|undefined;
  await page.route('**/api/**',route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==='/api/jobs'&&req.method()==='POST'){
      const input=req.postDataJSON();
      run={...input,status:'running',sessionId:'new-session',revision:1,startedAt:Date.now(),baseMessageCount:0,approvals:[],messages:[{id:'u1',role:'user',blocks:[{type:'text',text:input.text}]}],partial:'Working on the example.'};
      return route.fulfill({json:run});
    }
    if(path.startsWith('/api/jobs/')&&run)return route.fulfill({json:run});
    const values:Record<string,unknown>={'/api/projects':[root],'/api/health':{protocol:1,roots:[root],name:'Demo PC'},
      '/api/providers':[{id:'claude',available:true}],'/api/workspaces':{host:true,workspaces:[],boards:[]},'/api/jobs':run?[run]:[]};
    return route.fulfill({json:values[path]??[]});
  });
  await page.goto(test.info().project.use.baseURL||'http://127.0.0.1:5173');await newChat(page);
  await page.getByRole('textbox',{name:'Message Claude'}).fill('Review the example.');
  await page.getByRole('button',{name:'Send message'}).click();
  const conversation=page.locator('.conversation-inner:visible');
  await expect(conversation.getByText('Review the example.')).toBeVisible();
  await expect(conversation.locator('.history-meta,.history-page-status')).toHaveCount(0);
});
