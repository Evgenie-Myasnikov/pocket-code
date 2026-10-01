import {test,expect,type Page,type Route} from '@playwright/test';
import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {version:string};

const connection={url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)};
type State='idle'|'checking'|'downloading'|'installing'|'waiting'|'restarting'|'updated'|'failed';
const status=(state:State)=>({supported:true,currentVersion:state==='updated'?pkg.version:'0.11.0',targetVersion:pkg.version,state});
async function setup(page:Page,handle:(route:Route)=>Promise<void>,options:{native?:boolean;ru?:boolean}={native:true}){
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(({connection,native,ru})=>{
    localStorage.setItem('pocket-code-auto-updates-v1','false');
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'dark',textSize:14,scale:130}));
    if(ru)localStorage.setItem('pocket-code-language-v1','ru');
    const state=window as any;state.hostRestartEvents=[];state.mockConnection=JSON.stringify(connection);
    window.addEventListener('pocket-code-host-update-restarting',(event:any)=>state.hostRestartEvents.push(event.detail.active));
    if(!native){sessionStorage.setItem('connection',JSON.stringify(connection));return;}
    state.CapacitorCustomPlatform={name:'android'};
    state.Capacitor={
      PluginHeaders:[
        {name:'AppUpdate',methods:['info','download','install','allowInstall'].map(name=>({name,rtype:'promise'}))},
        {name:'ConnectionVault',methods:['load','save','clear'].map(name=>({name,rtype:'promise'}))},
        {name:'CapacitorHttp',methods:[{name:'request',rtype:'promise'}]},
      ],
      nativePromise:async(plugin:string,method:string,options:any)=>{
        if(plugin==='ConnectionVault'){
          if(method==='load')return{value:state.mockConnection};
          if(method==='clear')state.mockConnection=undefined;
          if(method==='save')state.mockConnection=options.value;
          return{};
        }
        if(plugin==='AppUpdate'&&method==='info')return{version:'99.0.0',versionCode:99000};
        if(plugin==='CapacitorHttp'){
          const response=await fetch(options.url,{method:options.method,headers:options.headers,body:options.data===undefined?undefined:JSON.stringify(options.data)});
          return{status:response.status,data:response.status===204?null:await response.json()};
        }
        return{};
      },
    };
  },{connection,native:options.native!==false,ru:options.ru||false});
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.includes('/host-update/'))return handle(route);
    let body:unknown={};
    if(path.endsWith('/health'))body={name:'Update test computer',roots:['C:\\Workspace\\example'],version:'0.11.0',protocol:1};
    else if(path.endsWith('/projects'))body=['C:\\Workspace\\example'];
    else if(path.endsWith('/providers'))body=[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}];
    else if(path.endsWith('/sessions')||path.endsWith('/jobs'))body=[];
    else if(path.endsWith('/review/availability'))body={available:false,mode:'working'};
    else if(path.endsWith('/updates/latest'))body={enabled:false};
    else if(path.endsWith('/jira/status'))body={connected:false,sites:[]};
    return route.fulfill({json:body});
  });
  await page.goto('http://127.0.0.1:5173');await expect(page.locator('.new-chat')).toBeVisible();
}
async function openUpdates(page:Page,ru=false){
  await page.locator('.mobile-nav').getByRole('button',{name:ru?'Настройки':'Settings',exact:true}).click();
  await page.getByRole('button',{name:ru?'Обновления':'Updates',exact:true}).click();
}

test('Android submits one compatible check and Settings changes never repeat it',async({page})=>{
  const posts:unknown[]=[];let gets=0;
  await setup(page,async route=>{
    if(route.request().method()==='POST')posts.push(route.request().postDataJSON());else gets++;
    return route.fulfill({json:status('idle')});
  });
  await expect.poll(()=>posts.length).toBe(1);expect(posts[0]).toEqual({appVersion:pkg.version});
  await expect(page.locator('.host-update-card')).toHaveCount(0);
  await openUpdates(page);await expect(page.locator('.host-update-card')).toContainText('No compatible update is needed');
  await page.getByRole('button',{name:'All settings',exact:true}).click();await expect(page.locator('.host-update-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Updates',exact:true}).click();await expect(page.locator('.host-update-card')).toBeVisible();
  expect(posts).toHaveLength(1);expect(gets).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('a planned restart reconnects using status and succeeds only after the host confirms',async({page})=>{
  let posts=0,gets=0;let finish=false;
  await setup(page,async route=>{
    if(route.request().method()==='POST'){posts++;return route.fulfill({json:status('restarting')});}
    gets++;return finish?route.fulfill({json:status('updated')}):route.fulfill({status:503,json:{error:'Synthetic restart'}});
  });
  await openUpdates(page);await expect(page.locator('.host-update-card')).toContainText('restarting');
  await expect.poll(()=>gets,{timeout:8000}).toBeGreaterThan(0);
  await expect(page.locator('.host-update-card')).toContainText('Waiting to reconnect');
  await expect(page.locator('.host-update-card')).not.toContainText('PC server updated.');
  expect(await page.evaluate(()=>(window as any).hostRestartEvents)).toContain(true);
  finish=true;await expect(page.locator('.host-update-card')).toContainText('PC server updated.',{timeout:10000});
  expect(posts).toBe(1);expect(await page.evaluate(()=>(window as any).hostRestartEvents.at(-1))).toBe(false);
});

test('old hosts expose an unavailable state without retrying an unsupported endpoint',async({page})=>{
  let requests=0;
  await setup(page,async route=>{requests++;return route.fulfill({status:404,json:{error:'Not found'}});});
  await openUpdates(page);await expect(page.locator('.host-update-card')).toContainText('does not support automatic updates yet');
  await expect(page.getByRole('button',{name:'Retry server update',exact:true})).toHaveCount(0);
  await page.waitForTimeout(2800);expect(requests).toBe(1);
});

test('failure permits exactly one explicit retry and preserves the Russian layout',async({page})=>{
  let posts=0;
  await setup(page,async route=>{if(route.request().method()==='POST')posts++;return route.fulfill({json:status(posts>1?'updated':'failed')});},{native:true,ru:true});
  await openUpdates(page,true);const retry=page.getByRole('button',{name:'Повторить обновление сервера',exact:true});
  await expect(retry).toBeVisible();expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await retry.click();await expect(page.locator('.host-update-card')).toContainText('Сервер ПК обновлён.');expect(posts).toBe(2);
  await page.getByRole('button',{name:'Все настройки',exact:true}).click();await page.getByRole('button',{name:'Обновления',exact:true}).click();expect(posts).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('ordinary browsers never request host installation',async({page})=>{
  let requests=0;await setup(page,async route=>{requests++;return route.fulfill({json:status('idle')});},{native:false});
  await openUpdates(page);await expect(page.locator('.host-update-card')).toContainText('The Android app checks for a server update');
  expect(requests).toBe(0);
});

test('disconnect clears planned restart state and ignores a late response',async({page})=>{
  let statusRoute:Route|undefined;
  await setup(page,async route=>{if(route.request().method()==='POST')return route.fulfill({json:status('restarting')});statusRoute=route;});
  await openUpdates(page);await expect(page.locator('.host-update-card')).toContainText('restarting');
  await expect.poll(()=>Boolean(statusRoute),{timeout:8000}).toBe(true);
  await page.getByRole('button',{name:'All settings',exact:true}).click();
  await page.getByRole('button',{name:'Disconnect and forget',exact:true}).click();
  await expect(page.getByRole('button',{name:'Connect computer',exact:true})).toBeVisible();
  await statusRoute!.fulfill({json:status('updated')});
  expect(await page.evaluate(()=>(window as any).hostRestartEvents.at(-1))).toBe(false);
  await expect(page.locator('.host-update-card')).toHaveCount(0);
});
