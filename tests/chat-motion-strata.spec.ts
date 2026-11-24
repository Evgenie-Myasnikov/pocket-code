import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('a streamed answer fades in word by word and new blocks rise in, as in Strata; reduced motion turns it off',async({page})=>{
 await page.addInitScript(()=>{
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}],partial:'The layout keeps one column and a side panel for files.',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 const words=page.locator('.conversation-inner [data-sd-animate]');
 await expect(words.first()).toBeAttached({timeout:10000});
 expect(await words.count()).toBeGreaterThan(3);
 const style=await words.first().evaluate(element=>{const c=getComputedStyle(element);return {name:c.animationName,duration:c.animationDuration};});
 expect(style).toEqual({name:'sd-chatWord',duration:'0.26s'});
 // a block that enters during the stream rises in over 240 ms
 const entering=await page.locator('.conversation-inner .message[data-enter=true]').evaluateAll(list=>list.map(element=>getComputedStyle(element).animationDuration));
 for(const duration of entering)expect(duration).toBe('0.24s');
});

test('reduced motion shows streamed text without word animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\\Demo\\Atlas',status:'running',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}],partial:'The layout keeps one column and a side panel for files.',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 await expect(page.locator('.conversation-inner')).toContainText('a side panel for files');
 await expect(page.locator('.conversation-inner [data-sd-animate]')).toHaveCount(0);
});

test('as in Strata, a blinking accent caret follows the text being written and every message rises in',async({page})=>{
 await page.addInitScript(()=>{
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'running',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}],partial:'The layout keeps one column and a side panel for files.',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 await expect(page.locator('.conversation-inner .markdown[data-caret]')).toHaveCount(1);
 const caret=await page.locator('.conversation-inner .markdown[data-caret] p').last().evaluate(element=>{const c=getComputedStyle(element,'::after');return {name:c.animationName,width:c.width,display:c.display};});
 expect(caret).toEqual({name:'chat-caret-blink',width:'7px',display:'inline-block'});
 for(const name of await page.locator('.conversation-inner .message').evaluateAll(list=>list.map(element=>getComputedStyle(element).animationName)))expect(name).toBe('chat-content-enter');
});

test('a finished chat shows no caret',async({page})=>{
 await desktop(page);
 await page.locator('.desktop-sessions > button').first().click();
 await expect(page.locator('.conversation-inner .message').first()).toBeVisible();
 await expect(page.locator('.conversation-inner .markdown[data-caret]')).toHaveCount(0);
});

test('a block of text that arrives at once is written into the chat word by word over the smoothing window, and Off shows it at once',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
   (window as any).testHistoryPage=()=>({messages:[],previous:null,next:null});
   (window as any).testRuns=[{id:'turn-fixture',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'running',startedAt:Date.now(),baseMessageCount:0,approvals:[],revision:1,partial:'',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}]}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 await expect(page.locator('.conversation-inner')).toContainText('Explain the layout.');
 const words=(prefix:string)=>prefix+' '+Array.from({length:90},(_,i)=>prefix+i).join(' ');
 const first=words('alpha'),second=words('bravo');
 const answer=page.locator('.conversation-inner .message.assistant .markdown');
 const push=(id:string,value:string)=>page.evaluate(({id,value})=>{const run=(window as any).testRuns[0];run.messages.push({id,role:'assistant',blocks:[{type:'text',text:value}]});run.revision++;},{id,value});
 const watch=async(index:number)=>{const seen:number[]=[];for(let i=0;i<150;i++){const count=await answer.count();seen.push(count>index?((await answer.nth(index).textContent())||'').length:0);await page.waitForTimeout(40);}return seen;};
 await push('first',first);
 const seen=await watch(0);
 // the block grows in steps, never beyond what was written, and is complete when the window is over
 expect(seen.some(length=>length>0&&length<first.length)).toBe(true);expect(seen.at(-1)).toBe(first.length);
 for(let i=1;i<seen.length;i++)expect(seen[i]).toBeGreaterThanOrEqual(seen[i-1]);
 // Off: the next block is in the chat whole as soon as it is there
 await page.evaluate(()=>{document.documentElement.dataset.textDelay='0';});
 await push('second',second);
 const off=await watch(1);
 expect(off.filter(length=>length>0)[0]).toBe(second.length);
});
