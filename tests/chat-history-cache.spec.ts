import {test,expect} from '@playwright/test';
import {ChatPageSync} from '../server/chat-page-sync';

test('persistent history retains older messages and synchronizes only changes',async({page})=>{
 const sync=new ChatPageSync();let messages=Array.from({length:250},(_,i)=>({id:String(i),role:'assistant' as const,blocks:[{type:'text' as const,text:'Saved reply '+i}]})),offline=false,forbidden=false;
 const responses:any[]=[];
 await page.route('**/api/sessions/cache-test/messages?*',route=>{
  if(offline)return route.abort();if(forbidden)return route.fulfill({status:403,json:{error:'Access denied'}});
  const known=new URL(route.request().url()).searchParams.get('known')||undefined,response=sync.respond('test-page',{messages,previous:null,total:messages.length},known);responses.push(response);return route.fulfill({json:response});
 });
 await page.goto('http://127.0.0.1:5173');
 const read=()=>page.evaluate(async()=>{const {chatHistoryRequest}=await (import('/src/'+'chat-history-cache.ts') as Promise<typeof import('../src/chat-history-cache')>);return chatHistoryRequest({url:location.origin,token:'synthetic-cache-token'},'/sessions/cache-test/messages?provider=claude&window=250','synthetic-scope');});
 expect((await read()).messages).toHaveLength(250);
 await page.reload();expect((await read()).messages).toHaveLength(250);expect(responses.at(-1).messages).toHaveLength(0);expect(responses.at(-1).unchanged).toBe(true);
 messages=[...messages.slice(1),{id:'250',role:'assistant',blocks:[{type:'text',text:'New reply'}]}];messages[12]={...messages[12],blocks:[{type:'text',text:'Edited reply'}]};
 const updated=await read();expect(updated.messages.map(m=>m.id)).toEqual(messages.map(m=>m.id));expect(updated.messages[12].blocks).toEqual(messages[12].blocks);expect(responses.at(-1).messages).toHaveLength(2);
 offline=true;expect((await read()).messages).toHaveLength(250);
 offline=false;forbidden=true;await expect(read()).rejects.toThrow();
 await page.evaluate(async()=>{const {writeHistoryView}=await (import('/src/'+'chat-history-cache.ts') as Promise<typeof import('../src/chat-history-cache')>);await writeHistoryView('synthetic-scope','claude','saved',{messages:Array.from({length:250},(_,i)=>({id:String(i),role:'assistant',blocks:[]})),window:250,fromStart:false,hasMore:null});});
 await page.reload();expect(await page.evaluate(async()=>{const {readHistoryView}=await (import('/src/'+'chat-history-cache.ts') as Promise<typeof import('../src/chat-history-cache')>);return (await readHistoryView('synthetic-scope','claude','saved'))?.messages.length;})).toBe(250);
 expect(await page.evaluate(async()=>{const {readHistoryView,clearHistoryCache}=await (import('/src/'+'chat-history-cache.ts') as Promise<typeof import('../src/chat-history-cache')>);const other=await readHistoryView('another-scope','claude','saved');await clearHistoryCache();return {other,removed:await readHistoryView('synthetic-scope','claude','saved')};})).toEqual({other:undefined,removed:undefined});
});

test('text anchors preserve the reading line after wrapping and an inserted prefix',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {captureTextAnchor,restoreTextAnchor}=await (import('/src/'+'chat-text-anchor.ts') as Promise<typeof import('../src/chat-text-anchor')>);
  document.body.innerHTML='<div id="scroll" style="height:220px;width:380px;overflow:auto;font:16px/24px monospace"><article></article></div>';
  const container=document.querySelector<HTMLElement>('#scroll')!,message=container.querySelector<HTMLElement>('article')!;
  message.textContent=Array.from({length:180},(_,i)=>'Unique sentence '+i+' with saved text. ').join('');container.scrollTop=840;
  const anchor=captureTextAnchor(container,message)!;container.style.width='245px';message.prepend(document.createTextNode('Inserted introduction. '));
  container.scrollTop=restoreTextAnchor(container,message,anchor)!;const restored=captureTextAnchor(container,message)!;
  return {quote:anchor.quote,restored:message.textContent!.includes(anchor.quote),drift:restoreTextAnchor(container,message,anchor)!-container.scrollTop,top:container.scrollTop};
 });
 expect(result.restored).toBe(true);expect(Math.abs(result.drift)).toBeLessThan(2);expect(result.top).toBeGreaterThan(840);
});
