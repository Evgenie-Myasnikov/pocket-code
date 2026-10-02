import {connectByQr} from './qr-connect';
import {test,expect,type Page} from '@playwright/test';

const version='99.1.0',sha256='c'.repeat(64);
const manifest={applicationId:'app.pocketcode.mobile',version,versionCode:99100,apk:`Pocket-Code-${version}.apk`,size:100,sha256};
const release={id:55,tag_name:`v${version}`,draft:false,prerelease:false,assets:[{name:'update.json',size:400,state:'uploaded'},{name:manifest.apk,size:100,state:'uploaded',digest:`sha256:${sha256}`}]};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET'};

/** Synthetic Android bridge: releases come from mocked GitHub routes, never the network. */
async function android(page:Page,published:{release:unknown;manifest:unknown}={release,manifest}){
  await page.addInitScript(()=>{
    const state=window as any;state.nativeCalls=[];state.CapacitorCustomPlatform={name:'android'};
    state.Capacitor={
      PluginHeaders:[
        {name:'AppUpdate',methods:['info','download','downloadRelease','install','allowInstall'].map(name=>({name,rtype:'promise'}))},
        {name:'ConnectionVault',methods:['load','save','clear'].map(name=>({name,rtype:'promise'}))},
        {name:'CapacitorHttp',methods:[{name:'request',rtype:'promise'}]},
      ],
      nativePromise:async(plugin:string,method:string,options:any)=>{
        if(plugin==='CapacitorHttp'){const response=await fetch(options.url,{method:options.method,headers:options.headers,body:options.data===undefined?undefined:JSON.stringify(options.data)});return {status:response.status,data:response.status===204?null:await response.json()};}
        if(plugin==='AppUpdate'){state.nativeCalls.push({method,options});if(method==='info')return {version:'99.0.0',versionCode:99000};if(method==='install')return {needsPermission:false};}
        return {};
      },
    };
  });
  const github:string[]=[];
  const reply=(body:unknown)=>(route:any)=>{if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors});github.push(route.request().url());return route.fulfill({json:body,headers:cors});};
  await page.route('https://api.github.com/**',reply(published.release));
  await page.route('https://github.com/**',reply(published.manifest));
  return github;
}
const calls=(page:Page,method:string)=>page.evaluate(name=>(window as any).nativeCalls.filter((call:any)=>call.method===name).map((call:any)=>call.options),method);

test('without a PC the phone checks GitHub, downloads the verified release and opens the installer',async({page})=>{
  const github=await android(page);
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button',{name:'Install update',exact:true})).toBeVisible();
  expect(github).toEqual(['https://api.github.com/repos/Evgenie-Myasnikov/pocket-code/releases/latest',`https://github.com/Evgenie-Myasnikov/pocket-code/releases/download/v${version}/update.json`]);
  expect(await calls(page,'downloadRelease')).toEqual([{version,sha256,size:100,versionCode:99100}]);
  expect(await calls(page,'download')).toEqual([]);
  expect((await calls(page,'install')).at(-1)).toEqual({sha256,versionCode:99100});
});

test('a manifest that does not match its release asset is never downloaded',async({page})=>{
  const github=await android(page,{release,manifest:{...manifest,sha256:'d'.repeat(64)}});
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
  await expect.poll(()=>github.length).toBe(2);
  await page.waitForTimeout(500);
  expect(await calls(page,'downloadRelease')).toEqual([]);
  await expect(page.getByRole('button',{name:'Install update',exact:true})).toHaveCount(0);
});

test('a reachable PC stays the update source and GitHub is not contacted',async({page})=>{
  const github=await android(page,{release:{...release,tag_name:'v99.0.0'},manifest});
  await page.route('**/api/updates/**',route=>route.fulfill({json:{enabled:true,state:'idle'}}));
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Updates',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Updates from PC'})).toBeVisible();
  const before=github.length;await page.waitForTimeout(6000);
  expect(github.length).toBe(before);
  expect(await calls(page,'downloadRelease')).toEqual([]);
});

test('a paired PC that does not answer leaves the phone updating itself',async({page})=>{
  const github=await android(page);
  await page.route('**/api/updates/**',route=>route.fulfill({status:503,json:{error:'Synthetic outage'}}));
  await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');
  await connectByQr(page,'http://127.0.0.1:4319','test-only-'.repeat(5));
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Updates',exact:true}).click();
  await expect(page.getByRole('region',{name:'Updates',exact:true}).getByRole('heading',{name:'Updates',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Check for updates',exact:true})).toBeVisible();
  await expect.poll(()=>calls(page,'downloadRelease').then(list=>list.length)).toBeGreaterThan(0);
  expect(github.every(url=>url.startsWith('https://api.github.com/repos/Evgenie-Myasnikov/pocket-code/')||url.startsWith('https://github.com/Evgenie-Myasnikov/pocket-code/releases/download/'))).toBe(true);
});
