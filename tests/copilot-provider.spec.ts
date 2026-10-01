import {connectByQr} from './qr-connect';
import {test,expect} from '@playwright/test';
test('Copilot is a separate workspace, sends auto model and offers detected GitHub sign-in',async({page})=>{
 let sent:any;const root='C:\\Projects\\sample';
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),endpoint=url.pathname.replace('/api','');
  if(endpoint==='/health')return route.fulfill({json:{name:'Test PC',roots:[root],version:'0.20.0',protocol:1}});
  if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true},{id:'copilot',available:true,authenticated:true,models:[]}]});
  if(endpoint==='/copilot/status')return route.fulfill({json:{available:true,authenticated:true,models:[]}});
  if(endpoint==='/copilot/login')return route.fulfill({json:{state:'connected',error:''}});
  if(endpoint==='/sessions')return route.fulfill({json:url.searchParams.get('provider')==='copilot'?[{sessionId:'11111111-1111-4111-8111-111111111111',summary:'Copilot example',cwd:root,lastModified:Date.now(),provider:'copilot'}]:[]});
  if(endpoint.includes('/messages'))return route.fulfill({json:{messages:[],previous:null,next:null,total:0}});
  if(endpoint==='/jobs'&&route.request().method()==='POST'){sent=route.request().postDataJSON();return route.fulfill({json:{...sent,provider:'copilot',status:'done',messages:[{id:'reply',role:'assistant',blocks:[{type:'text',text:'Copilot response'}]}],partial:'',approvals:[],revision:1,baseMessageCount:0,startedAt:Date.now()}});}
  if(endpoint==='/jobs'||endpoint==='/activity')return route.fulfill({json:[]});
  if(endpoint==='/projects')return route.fulfill({json:[root]});
  if(endpoint==='/review/availability')return route.fulfill({json:{available:false}});
  if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
  return route.fulfill({status:404,json:{error:'Not available in fixture'}});
 });
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await connectByQr(page,'http://127.0.0.1:4319','fixture-'.repeat(6));
 await page.getByLabel('Workspace',{exact:true}).first().selectOption('copilot');await page.getByRole('button',{name:/Copilot example/}).click();await page.getByLabel('Message Copilot').fill('Hello');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:'Finished on PC — continue',exact:true}).click();
 await expect.poll(()=>sent?.provider).toBe('copilot');expect(sent.model).toBe('auto');expect(sent.reasoningEffort).toBeUndefined();await expect(page.getByText('Copilot response',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).last().click();await page.locator('[data-settings-category="workspace"]').click();await expect(page.getByText('Connected through GitHub on your PC',{exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/copilot-connection.png',fullPage:true});
});
