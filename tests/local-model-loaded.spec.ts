import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

const account='5b7c0d3e-0000-4000-8000-00000000a001';
async function strataChat(page:import('@playwright/test').Page,running:boolean){
  await page.addInitScript(({account,running})=>{
    localStorage.setItem('pocket-claude-account',account);
    const w=window as any;w.testTaskTextAccounts=[{id:account,name:'Strata · flash-iq3_s'}];
    w.testChatRowsBy={claude:[{sessionId:'alpha',summary:'claude · Interface review',cwd:'C:\Demo\Atlas',lastModified:2,account}],codex:[],copilot:[]};
    w.localState={running};
    w.testLocalModels=(path:string)=>{
      if(path!=='/local-models')return {error:'unexpected',status:404};
      const job=w.localState.running?{state:'ready',model:'coder-iq1_m',port:18600}:{state:'stopped'};
      return {value:{available:true,version:'9.9.9',port:18600,models:[{id:'iq3_s',name:'flash-iq3_s',ready:true},{id:'coder-iq1_m',name:'flash-coder-iq1_m',ready:true}],running:w.localState.running?[{name:'coder-iq1_m',state:'ready',port:18600}]:[],busy:false,job}};
    };
  },{account,running});
  await desktop(page);
  await page.locator('.desktop-sessions>button').first().click();
}

test('a chat through the local Strata connection shows the model that is loaded now',async({page})=>{
  await strataChat(page,true);
  await expect(page.locator('.desktop-chat-host .header-model-chip')).toContainText('Strata · flash-coder-iq1_m');
});

test('with no local model loaded the chip says so',async({page})=>{
  await strataChat(page,false);
  await expect(page.locator('.desktop-chat-host .header-model-chip')).toContainText('Strata · no model loaded');
});

test('the rail shows which local model is loaded, and that none is once it stops',async({page})=>{
  await strataChat(page,true);
  const card=page.locator('.desktop-rail .local-model-card');
  await expect(card).toContainText('flash-coder-iq1_m');
  await expect(card).toHaveAttribute('data-state','loaded');
  await page.evaluate(()=>{(window as any).localState.running=false;window.dispatchEvent(new Event('pocket-custom-providers'));});
  await expect(card).toContainText('No model loaded');
  await expect(card).toHaveAttribute('data-state','none');
  await card.click();
  await expect(page.locator('.settings-page, .desktop-settings').first()).toBeVisible();
});
