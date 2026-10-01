import {test,expect,type Page} from '@playwright/test';

const root='C:\\Workspace\\effort-demo';
const standard={id:'reasoning-standard',name:'Standard',reasoningEfforts:['low','medium','high','xhigh','max','ultra'],defaultReasoningEffort:'low',isDefault:true};
const small={id:'reasoning-small',name:'Small',reasoningEfforts:['low','high'],defaultReasoningEffort:'low',isDefault:false};
type Model={id:string;name:string;reasoningEfforts?:string[];defaultReasoningEffort?:string;isDefault?:boolean};
async function host(page:Page){
  const state:{models:Model[];sent:Record<string,unknown>[]}={models:[standard,small],sent:[]};
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
    if(endpoint==='/health')return route.fulfill({json:{name:'Synthetic effort PC',roots:[root],version:'0.14.1',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',name:'Claude',available:true},{id:'codex',name:'Codex',available:true,authenticated:true,models:state.models}]});
    if(endpoint==='/sessions')return route.fulfill({json:[]});
    if(endpoint==='/jobs'){
      if(route.request().method()!=='POST')return route.fulfill({json:[]});
      const body=route.request().postDataJSON();state.sent.push(body);
      return route.fulfill({json:{id:body.id,provider:body.provider,cwd:root,status:'done',messages:[{id:'sent-'+body.id,role:'user',blocks:[{type:'text',text:body.text}]}],partial:'',approvals:[],startedAt:Date.now(),revision:1,baseMessageCount:0}});
    }
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/review/availability')return route.fulfill({json:{available:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
  });
  return state;
}
async function open(page:Page,{language='en',scale=100,choices}:{language?:string;scale?:number;choices?:Record<string,string>}={}){
  await page.addInitScript(({language,scale,choices})=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
    localStorage.setItem('pocket-code-language-v1',language);localStorage.setItem('pocket-code-workspace','codex');
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale,textSize:14}));
    if(choices&&!localStorage.getItem('pocket-code-codex-effort-v1'))localStorage.setItem('pocket-code-codex-effort-v1',JSON.stringify(choices));
  },{language,scale,choices});
  await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:language==='ru'?'Новый чат':'New chat',exact:false}).click();
  await expect(page.getByLabel(language==='ru'?'Сообщение Codex':'Message Codex')).toBeVisible();
}
const effort=(page:Page)=>page.getByLabel('Codex reasoning effort',{exact:true});

test('Codex effort uses advertised options and sends the selected model and effort',async({page})=>{
  const state=await host(page);await open(page);
  await expect(page.getByLabel('Codex model').locator('option:checked')).toHaveText('Standard');await expect(effort(page)).toHaveValue('low');await expect(effort(page).locator('option')).toHaveText(['Low','Medium','High','Extra high','Maximum','Ultra']);
  await effort(page).selectOption('ultra');await page.getByLabel('Message Codex').fill('Inspect the example');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>state.sent.length).toBe(1);expect(state.sent[0]).toMatchObject({provider:'codex',model:standard.id,reasoningEffort:'ultra'});
  await effort(page).selectOption('low');await page.getByLabel('Message Codex').fill('Use the displayed default');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>state.sent.length).toBe(2);expect(state.sent[1]).toMatchObject({model:standard.id,reasoningEffort:'low'});
});

test('Codex effort is remembered per model across reload and remains absent from Claude',async({page})=>{
  await host(page);await open(page);await effort(page).selectOption('ultra');
  await page.getByLabel('Codex model').selectOption(small.id);await expect(effort(page).locator('option')).toHaveText(['Low','High']);await expect(effort(page)).toHaveValue('low');
  await effort(page).selectOption('high');await page.getByLabel('Codex model').selectOption(standard.id);await expect(effort(page)).toHaveValue('ultra');
  await page.reload();await page.getByRole('button',{name:'New chat',exact:false}).click();await expect(effort(page)).toHaveValue('ultra');
  await page.getByLabel('Codex model').selectOption(small.id);await expect(effort(page)).toHaveValue('high');
  await page.locator('.workspace-picker-sidebar select').selectOption('claude');await expect(effort(page)).toHaveCount(0);
  await page.locator('.workspace-picker-sidebar select').selectOption('codex');await expect(effort(page)).toHaveValue('high');
});

test('an effort removed by a model update falls back to its advertised default',async({page})=>{
  const state=await host(page);state.models=[{...standard,reasoningEfforts:['low','high']}];
  await open(page,{choices:{[standard.id]:'ultra'}});await expect(effort(page)).toHaveValue('low');await expect(effort(page).locator('option')).toHaveText(['Low','High']);
  await page.getByLabel('Message Codex').fill('Use a supported effort');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>state.sent.length).toBe(1);expect(state.sent[0].reasoningEffort).toBe('low');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pocket-code-codex-effort-v1')||'{}'))).toEqual({});
});

test('older hosts without model effort metadata preserve their existing request behavior',async({page})=>{
  const state=await host(page);state.models=[{id:standard.id,name:standard.name}];await open(page);await expect(effort(page)).toHaveCount(0);
  await page.getByLabel('Message Codex').fill('Use the host configuration');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(()=>state.sent.length).toBe(1);expect(state.sent[0]).not.toHaveProperty('reasoningEffort');
});

for(const scale of [60,130])test(`model, effort and send controls fit a Russian 320px phone at ${scale}%`,async({page})=>{
  await host(page);await page.setViewportSize({width:320,height:700});await open(page,{language:'ru',scale});
  const picker=page.getByLabel('Глубина рассуждений Codex',{exact:true});await picker.selectOption('ultra');await expect(picker).toBeVisible();
  const layout=await page.locator('.composer-tools').evaluate(element=>{
    const controls=Array.from(element.querySelectorAll<HTMLElement>('button,select')).map(item=>item.getBoundingClientRect());
    return{within:controls.every(box=>box.x>=0&&box.right<=innerWidth+1),sized:controls.every(box=>box.width>=40&&box.height>=40),pageFits:document.documentElement.scrollWidth<=innerWidth};
  });expect(layout).toEqual({within:true,sized:true,pageFits:true});
  await page.screenshot({path:`artifacts/screenshots/codex-effort-ru-${scale}-320.png`,fullPage:true});
});
