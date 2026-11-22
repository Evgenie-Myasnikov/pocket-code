import {expect,test,type Page,type Route} from '@playwright/test';
import {newChat,openChatList} from './chat-navigation';

async function chat(page:Page,generate:(route:Route)=>Promise<void>,providers=()=>['claude','copilot']){
  const calls:{endpoint:string;method:string}[]=[];
  await page.setViewportSize({width:320,height:760});
  await page.addInitScript(()=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-fixture-key'}));
    localStorage.setItem('pocket-code-language-v1','en');
  });
  await page.route('**/api/**',route=>{
    const endpoint=new URL(route.request().url()).pathname.slice(4),method=route.request().method();
    calls.push({endpoint,method});
    if(endpoint==='/health')return route.fulfill({json:{name:'Fixture',roots:['C:\\Fixture'],version:'0.28.51',protocol:1}});
    if(endpoint==='/providers')return route.fulfill({json:[{id:'claude',available:true}]});
    if(endpoint==='/sessions'||endpoint==='/jobs'&&method==='GET')return route.fulfill({json:[]});
    if(endpoint==='/updates/latest')return route.fulfill({json:{enabled:false}});
    if(endpoint==='/task-text/providers')return route.fulfill({json:{providers:providers()}});
    if(endpoint==='/task-text/improve')return generate(route);
    return route.fulfill({status:404,json:{error:'Fixture endpoint unavailable'}});
  });
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await newChat(page);
  return {calls,draft:page.getByRole('textbox',{name:'Message Claude'})};
}

test('Improve previews the selected provider response and applies only the reviewed draft',async({page})=>{
  const requests:Record<string,unknown>[]=[];
  const {calls,draft}=await chat(page,route=>{
    requests.push(route.request().postDataJSON());return route.fulfill({json:{text:'Check the sample and report the result.'}});
  });
  await draft.fill('Check the sample.');
  expect(calls.some(c=>c.endpoint.startsWith('/task-text/'))).toBe(false);
  const trigger=page.getByRole('button',{name:'Improve with AI · Instructions',exact:true});
  const send=page.getByRole('button',{name:'Send message',exact:true});
  await expect(trigger).toBeInViewport();await expect(send).toBeInViewport();
  const a=(await trigger.boundingBox())!,b=(await send.boundingBox())!;
  expect(a.x+a.width).toBeLessThanOrEqual(b.x+1);
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Improve with AI · Instructions'});
  await dialog.getByRole('combobox',{name:'Provider',exact:true}).selectOption('copilot');
  await dialog.getByLabel('Drafting guidance').fill('Include a verifiable check.');
  await dialog.getByRole('button',{name:'Generate suggestion'}).click();
  await expect(dialog.getByLabel('Suggested text')).toHaveValue('Check the sample and report the result.');
  await dialog.getByText('Original text',{exact:true}).click();
  await expect(dialog.getByText('Check the sample.',{exact:true})).toBeVisible();
  expect(requests[0]).toMatchObject({provider:'copilot',text:'Check the sample.',context:'Include a verifiable check.',field:'instructions'});
  await dialog.getByLabel('Suggested text').fill('Check the sample and list discrepancies.');
  await dialog.getByRole('button',{name:'Apply',exact:true}).click();
  await expect(draft).toHaveValue('Check the sample and list discrepancies.');
  expect(calls.some(c=>c.endpoint==='/jobs'&&c.method==='POST')).toBe(false);
});

test('an empty field can be filled from guidance and dismissed without changing the composer',async({page})=>{
  let available=false,attempt=0;
  const {draft}=await chat(page,route=>++attempt===1?route.fulfill({status:503,json:{error:'Provider busy'}}):route.fulfill({json:{text:'Review the examples.'}}),()=>available?['copilot']:[]);
  const trigger=page.getByRole('button',{name:'Fill with AI · Instructions',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Fill with AI · Instructions'});
  await expect(dialog.getByRole('alert')).toContainText('No providers');
  available=true;
  await dialog.getByRole('button',{name:'Refresh providers'}).click();
  await expect(dialog.getByRole('combobox',{name:'Provider',exact:true})).toHaveValue('copilot');
  const generate=dialog.getByRole('button',{name:'Generate suggestion'});
  await expect(generate).toBeDisabled();
  await dialog.getByLabel('Drafting guidance').fill('Review the examples.');
  await generate.click();await expect(dialog.getByRole('alert')).toContainText('Provider busy');
  await dialog.getByRole('button',{name:'Generate again'}).click();
  await expect(dialog.getByLabel('Suggested text')).toHaveValue('Review the examples.');
  await dialog.getByRole('button',{name:'Apply',exact:true}).focus();await page.keyboard.press('Tab');
  await expect(dialog.getByRole('combobox',{name:'Provider',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(draft).toHaveValue('');
  await expect(trigger).toBeFocused();
});

test('a late suggestion cannot replace a newer version of the input',async({page})=>{
  let finish!:()=>void;
  const pending=new Promise<void>(resolve=>{finish=resolve;});
  const {draft}=await chat(page,async route=>{await pending;return route.fulfill({json:{text:'Review the initial draft.'}});});
  await draft.fill('Initial draft');
  await page.getByRole('button',{name:'Improve with AI · Instructions'}).click();
  const dialog=page.getByRole('dialog',{name:'Improve with AI · Instructions'});
  await dialog.getByRole('button',{name:'Generate suggestion'}).click();
  await expect(dialog.getByRole('status')).toBeVisible();
  // Simulate a controlled field update from a parent editor while the provider works.
  await page.locator('.prompt-composer textarea').evaluate(element=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(element,'Updated draft');
    element.dispatchEvent(new Event('input',{bubbles:true}));
  });
  finish();
  await expect(dialog.getByRole('alert')).toContainText('field or its context changed');
  await expect(dialog.getByRole('button',{name:'Apply',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(draft).toHaveValue('Updated draft');
});
