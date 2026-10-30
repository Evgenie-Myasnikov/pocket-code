import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('opening cached history follows the refreshed latest end',async({page})=>{
 await page.setViewportSize({width:390,height:844});await desktop(page);
 const first=page.locator('.desktop-sessions button').filter({hasText:'Interface review'});
 const second=page.locator('.desktop-sessions button').filter({hasText:'Documentation'});
 await page.evaluate(()=>{(window as any).branchMessages=Array.from({length:30},(_,i)=>({id:'old'+i,role:'assistant',blocks:[{type:'text',text:'Cached paragraph '+i+'\n\n'+'Synthetic history. '.repeat(20)}]}));});
 await first.click();await expect(page.getByText('Cached paragraph 29',{exact:false})).toHaveCount(1);await page.waitForTimeout(900);
 await page.locator('.conversation').evaluate(el=>{el.scrollTop=100;});await page.waitForTimeout(300);await second.click();
 await page.evaluate(()=>{(window as any).branchMessages.push({id:'latest',role:'assistant',blocks:[{type:'text',text:'Latest refreshed reply'}]});});
 await first.click();await expect(page.getByText('Latest refreshed reply',{exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('.conversation').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(5);
});

for(const provider of ['claude','codex'] as const)test(`${provider} saved chats reopen from cache without another health gate or stale navigation`,async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 if(provider==='codex'){await page.locator('.desktop-rail .provider-picker-trigger').click();await page.getByRole('menuitemradio',{name:'Codex',exact:true}).click();await expect(page.locator('.desktop-sessions button').filter({hasText:'codex · Interface review'})).toBeVisible();}
 const first=page.locator('.desktop-sessions button').filter({hasText:'Interface review'}),second=page.locator('.desktop-sessions button').filter({hasText:'Documentation'});
 await first.click();await expect(page.getByText('The responsive layout is ready.',{exact:true})).toBeVisible();const input=page.getByLabel(provider==='claude'?'Message Claude':'Message Codex',{exact:true});await input.fill('Synthetic first draft');await input.evaluate(el=>(window as any).originalChatInput=el);
 await page.waitForTimeout(900);
 await page.evaluate(()=>{const bridge=(window as any).chrome.webview,original=bridge.postMessage.bind(bridge),held:any[]=[];(window as any).extraHealthRequests=0;bridge.postMessage=(message:any)=>{if(message.endpoint==='/health'){(window as any).extraHealthRequests++;held.push(message);return;}if(message.endpoint?.includes('/beta/messages')){held.push(message);return;}original(message);};(window as any).releaseSlowChat=()=>{held.splice(0).forEach(original);};});
 await second.click();await expect(input).toBeVisible({timeout:1000});await input.fill('Synthetic second draft');await first.click();
 await expect(page.getByText('The responsive layout is ready.',{exact:true})).toBeVisible({timeout:1000});await expect(input).toHaveValue('Synthetic first draft');
 expect(await page.evaluate(()=>(window as any).extraHealthRequests)).toBe(0);
 expect(await input.evaluate(el=>el===(window as any).originalChatInput)).toBe(true);
 await page.evaluate(()=>(window as any).releaseSlowChat());await expect(page.getByText('Garden documentation',{exact:true})).toHaveCount(0);await expect(input).toHaveValue('Synthetic first draft');
 await second.click();await page.evaluate(()=>(window as any).releaseSlowChat());await expect(input).toHaveValue('Synthetic second draft');
});
