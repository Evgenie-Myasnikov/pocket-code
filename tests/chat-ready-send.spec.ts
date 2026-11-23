import {expect,test,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** Texts of the turns this window asked the host to start. */
const startedTurns=(page:Page)=>page.evaluate(()=>(window as any).desktopCalls
  .filter((call:any)=>call.action==='write'&&call.endpoint==='/jobs').map((call:any)=>[call.data.provider,call.data.text,call.data.sessionId||'']));
/** Keeps the host silent on the matching reads until `window.releaseHeld()` lets every held request through. */
const hold=(page:Page,endpoints:string[])=>page.evaluate(names=>{
  const host=(window as any).chrome.webview,send=host.postMessage.bind(host),held:any[]=[];
  host.postMessage=(call:any)=>{if(names.some(name=>call.endpoint?.includes(name)))held.push(call);else send(call);};
  (window as any).releaseHeld=()=>{host.postMessage=send;held.splice(0).forEach(send);};
},endpoints);

test('a message sent while the chat history is still loading waits beside the composer and leaves by itself',async({page})=>{
  await desktop(page);
  await hold(page,['/alpha/messages']);
  await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true}),send=page.getByRole('button',{name:'Send message',exact:true});
  await input.fill('Synthetic early message');
  await expect(send).toBeEnabled();
  await send.click();
  const waiting=page.locator('.outbox-shelf');
  await expect(waiting).toContainText('Synthetic early message');
  await expect(waiting).toContainText('Will be sent as soon as the chat opens');
  await expect(input).toHaveValue('');
  // The field stays free for the next thought; a second message waits its turn until the first one has left.
  await input.fill('Synthetic second thought');
  await expect(send).toBeDisabled();
  expect(await startedTurns(page)).toEqual([]);
  await page.evaluate(()=>(window as any).releaseHeld());
  await expect.poll(()=>startedTurns(page)).toEqual([['claude','Synthetic early message','alpha']]);
  await expect(waiting).toHaveCount(0);
  await expect(input).toHaveValue('Synthetic second thought');
});

test('a waiting message returns to the field when it is edited, and nothing is sent',async({page})=>{
  await desktop(page);
  await hold(page,['/alpha/messages']);
  await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true});
  await input.fill('Synthetic message to rethink');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.locator('.outbox-shelf').getByRole('button',{name:'Edit',exact:true}).click();
  await expect(input).toHaveValue('Synthetic message to rethink');
  await expect(page.locator('.outbox-shelf')).toHaveCount(0);
  await page.evaluate(()=>(window as any).releaseHeld());
  await expect(page.getByText('The responsive layout is ready.',{exact:true})).toBeVisible();
  expect(await startedTurns(page)).toEqual([]);
});

test('a chat opened after the PC has answered once sends without waiting for another health or provider check',async({page})=>{
  await desktop(page);
  await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
  await expect(page.getByText('The responsive layout is ready.',{exact:true})).toBeVisible();
  // From here the host never answers /health or /providers again: the new chat must not depend on them.
  await hold(page,['/health','/providers']);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Claude',exact:true});
  await input.fill('Synthetic message without waiting');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>startedTurns(page)).toEqual([['claude','Synthetic message without waiting','']]);
  await expect(page.getByText('Working on your request',{exact:true})).toBeVisible();
});

test('a provider whose sign-in is still being checked takes the message and starts the turn once it is confirmed',async({page})=>{
  await desktop(page);
  await hold(page,['/providers']);
  await page.locator('.desktop-rail .provider-picker-trigger').click();
  await page.getByRole('menuitemradio',{name:'Codex',exact:true}).click();
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Codex',exact:true});
  await input.fill('Synthetic message for a provider being checked');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.locator('.outbox-shelf')).toContainText('Synthetic message for a provider being checked');
  expect(await startedTurns(page)).toEqual([]);
  await page.evaluate(()=>(window as any).releaseHeld());
  await expect.poll(()=>startedTurns(page)).toEqual([['codex','Synthetic message for a provider being checked','']]);
  await expect(page.locator('.outbox-shelf')).toHaveCount(0);
});
