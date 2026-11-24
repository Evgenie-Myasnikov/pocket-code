import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

const para=(n:number)=>Array.from({length:n},(_,i)=>'Synthetic line '+i+' of a streamed answer that is long enough to wrap in the window.').join('\n\n');
async function openRunningChat(page:Page){
 await desktop(page);
 await page.evaluate(text=>{const base={cwd:'C:\\Demo\\Atlas',sessionId:'alpha',provider:'claude',messages:[],approvals:[],baseMessageCount:0,revision:1};(window as any).testRuns=[{...base,id:'live',startedAt:2,status:'running',partial:text}];},para(40));
 await page.locator('.desktop-sessions button').filter({hasText:'Interface review'}).click();
 await expect(page.getByText('Synthetic line 39',{exact:false})).toBeVisible();
}
const distance=(page:Page)=>page.locator('.conversation').evaluate(el=>Math.round(el.scrollHeight-el.scrollTop-el.clientHeight));
const grow=(page:Page,lines:number)=>page.evaluate(text=>{const run=(window as any).testRuns[0];run.partial=text;run.revision++;},para(lines));

test('the transcript follows a streamed answer while the reader is at the latest message',async({page})=>{
 await openRunningChat(page);
 await expect.poll(()=>distance(page)).toBeLessThan(4);
 await grow(page,60);await expect(page.getByText('Synthetic line 59',{exact:false})).toBeVisible();
 await expect.poll(()=>distance(page)).toBeLessThan(4);
 await grow(page,80);await expect(page.getByText('Synthetic line 79',{exact:false})).toBeVisible();
 await expect.poll(()=>distance(page)).toBeLessThan(4);
});

test('reading back is not interrupted, and the latest-message button returns to following',async({page})=>{
 await openRunningChat(page);
 await expect.poll(()=>distance(page)).toBeLessThan(4);
 const chat=page.locator('.conversation');
 await chat.hover();await page.mouse.wheel(0,-900);
 await expect.poll(()=>distance(page)).toBeGreaterThan(300);
 const top=await chat.evaluate(el=>el.scrollTop);
 await grow(page,70);await expect(chat.getByText('Synthetic line 69',{exact:false})).toHaveCount(1);
 await page.waitForTimeout(400);
 expect(await chat.evaluate(el=>el.scrollTop)).toBe(top);
 await page.getByRole('button',{name:/Jump to latest messages/}).click();
 await expect.poll(()=>distance(page)).toBeLessThan(4);
 await grow(page,90);await expect(page.getByText('Synthetic line 89',{exact:false})).toBeVisible();
 await expect.poll(()=>distance(page)).toBeLessThan(4);
});
