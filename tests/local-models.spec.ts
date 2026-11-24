import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** A synthetic host for /local-models: two installed models, a start that becomes ready on the next read, and stop. */
async function localHost(page:Page,options:{available?:boolean;busy?:boolean}={}){
 await page.addInitScript(options=>{
  const host={job:{state:'stopped'} as any,reads:0,started:null as any,stopped:0};(window as any).localHost=host;
  (window as any).testLocalModels=(path:string,data:any)=>{
   if(path==='/local-models'){
    if(options.available===false)return {value:{available:false,models:[],running:[],busy:false,job:host.job}};
    if(host.job.state==='starting'&&++host.reads>=2)host.job={state:'ready',model:host.started.model,url:'http://127.0.0.1:18600/v1',port:18600};
    return {value:{available:true,version:'9.9.9',port:18600,models:[{id:'iq3_s',name:'flash-iq3_s',context:131072,ready:true},{id:'coder-iq1_m',name:'flash-coder-iq1_m',context:131072,ready:true}],running:host.job.state==='ready'?[{name:'synthetic',state:'ready',port:18600}]:[],busy:!!options.busy,job:host.job}};
   }
   if(path==='/local-models/start'){host.started=data;host.reads=0;host.job={state:'starting',model:data.model,port:18600};return {value:host.job};}
   if(path==='/local-models/stop'){host.stopped++;host.job={state:'stopped'};return {value:host.job};}
   return {error:'unexpected '+path,status:404};
  };
 },options);
}
async function openProviders(page:Page){
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Providers',exact:true}).first().click();
}

test('a local Strata model starts and stops from the PC provider settings',async({page})=>{
 await localHost(page);await desktop(page);await openProviders(page);
 const card=page.getByRole('region',{name:'Local model (Strata)'});await expect(card).toBeVisible();
 await expect(card.getByRole('status').first()).toContainText('Stopped');
 await card.getByRole('combobox',{name:'Model'}).selectOption('coder-iq1_m');
 await card.getByRole('combobox',{name:'Context'}).selectOption('65536');
 await card.getByRole('combobox',{name:'Drafting (speed-up)'}).selectOption('dflash2');
 await card.screenshot({path:'.local/local-models-stopped.png'});
 await card.getByRole('button',{name:'Start',exact:true}).click();
 await expect(card).toContainText('Starting');
 expect(await page.evaluate(()=>(window as any).localHost.started)).toEqual({model:'coder-iq1_m',context:65536,drafting:'dflash2'});
 await expect(card).toContainText('Running',{timeout:10000});await expect(card).toContainText('http://127.0.0.1:18600/v1');
 await expect(card.getByRole('button',{name:'Start',exact:true})).toHaveCount(0);
 await card.screenshot({path:'.local/local-models-running.png'});
 await card.getByRole('button',{name:'Stop',exact:true}).click();
 await expect(card.getByRole('button',{name:'Start',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).localHost.stopped)).toBe(1);
 await page.reload();await openProviders(page);
 await expect(page.getByRole('region',{name:'Local model (Strata)'}).getByRole('combobox',{name:'Model'})).toHaveValue('coder-iq1_m');
});

test('the Strata window holding the GPU blocks a start, and a PC without Strata gets a hint',async({page})=>{
 await localHost(page,{busy:true});await desktop(page);await openProviders(page);
 const card=page.getByRole('region',{name:'Local model (Strata)'});
 await expect(card).toContainText('already holds the GPU');await expect(card.getByRole('button',{name:'Start',exact:true})).toBeDisabled();
});

test('a PC without Strata shows an install hint instead of controls',async({page})=>{
 await localHost(page,{available:false});await desktop(page);await openProviders(page);
 await expect(page.getByText('Strata was not found on this PC.',{exact:false})).toBeVisible();
 await expect(page.getByRole('region',{name:'Local model (Strata)'})).toHaveCount(0);
});
