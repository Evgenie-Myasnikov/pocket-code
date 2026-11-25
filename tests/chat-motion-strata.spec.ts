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
 expect(style).toEqual({name:'sd-chatWord',duration:'0.45s'});
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

test('live assistant text has no typing caret and every message rises in',async({page})=>{
 await page.addInitScript(()=>{
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'running',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}],partial:'The layout keeps one column and a side panel for files.',approvals:[],revision:1,startedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 await expect(page.locator('.conversation-inner .markdown[data-caret]')).toHaveCount(0);
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

test('a reasoning writes itself word by word, each new character coming down from above into place while it fades in',async({page})=>{
 await page.addInitScript(()=>{
   localStorage.setItem('pocket-code-language-v1','en');localStorage.setItem('pocket-code-background-v1',JSON.stringify({enabled:false}));
   (window as any).testHistoryPage=()=>({messages:[],previous:null,next:null});
   (window as any).testRuns=[{id:'turn-fixture',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'running',startedAt:Date.now(),baseMessageCount:0,approvals:[],revision:1,partial:'',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'Explain the layout.'}]}]}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 await expect(page.locator('.conversation-inner')).toContainText('Explain the layout.');
 const thought='Inspect '+Array.from({length:90},(_,i)=>'thought'+i).join(' ');
 await page.evaluate(value=>{const run=(window as any).testRuns[0];run.messages.push({id:'think',role:'assistant',blocks:[{type:'thinking',thinking:value}]});run.revision++;},thought);
 const body=page.locator('details.thinking .reasoning-content');
 const seen:number[]=[];let animation='';const places=new Set<string>();let first:number|undefined;
 // where the 40th character stands: it must not move while later characters are written or when its own animation ends
 const place=()=>body.first().evaluate(element=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let left=40,node:Node|null;while((node=walker.nextNode())){const length=node.textContent!.length;if(left<length){const range=document.createRange();range.setStart(node,left);range.setEnd(node,left+1);const box=range.getBoundingClientRect(),rail=element.getBoundingClientRect();return Math.round(box.left-rail.left)+','+Math.round(box.top-rail.top+element.scrollTop);}left-=length;}return '';});
 for(let i=0;i<150;i++){
   seen.push(await body.count()?((await body.first().textContent())||'').length:0);
   if(await body.count()&&seen.at(-1)!>60){first??=i;if(i>=first+20&&i%5===0){const at=await place();if(at)places.add(at);}}
   if(!animation&&await body.locator('.rc').count())animation=await body.locator('.rc').first().evaluate(element=>{const c=getComputedStyle(element);return c.animationName+' '+c.display;});
   await page.waitForTimeout(40);
 }
 expect(seen.some(length=>length>0&&length<thought.length)).toBe(true);expect(seen.at(-1)).toBe(thought.length);
 for(let i=1;i<seen.length;i++)expect(seen[i]).toBeGreaterThanOrEqual(seen[i-1]);
 // each character is its own box that fades in and comes down into place
 expect(animation).toBe('chat-reasoning-char inline');
 // a character that is written stays where it is (only its own short entrance moves it, and that does not move the text)
 await page.waitForTimeout(800);places.add(await place());
 const spots=[...places].map(value=>value.split(',').map(Number));
 for(const [x,y] of spots){expect(Math.abs(x-spots[0][0])).toBeLessThanOrEqual(1);expect(Math.abs(y-spots[0][1])).toBeLessThanOrEqual(1);}
});


test('under the chat the transcript passes beneath the message field through an edge blur',async({page})=>{
 await desktop(page);
 await page.locator('.desktop-sessions>button').first().click();
 const blur=page.locator('.workspace.chat-canvas>.chat-edge-blur');
 await expect(blur).toHaveCount(1);
 const layers=await blur.locator('span').evaluateAll(list=>list.map(element=>getComputedStyle(element).backdropFilter));
 expect(layers).toEqual(['blur(4px)','blur(12px)']);
 // the band ends where the message field starts: nothing above the field is blurred
 const band=(await blur.boundingBox())!,field=(await page.locator('.chat-overlay-bottom').boundingBox())!;
 expect(Math.abs(band.y-field.y)).toBeLessThanOrEqual(2);
 expect(await blur.evaluate(element=>getComputedStyle(element).pointerEvents)).toBe('none');
 await page.screenshot({path:'.local/edge-blur.png'});
});
