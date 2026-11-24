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
 expect(style).toEqual({name:'sd-fadeIn',duration:'0.24s'});
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
