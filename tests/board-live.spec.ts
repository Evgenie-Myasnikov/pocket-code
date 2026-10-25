import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

async function openSynthetic(page:import('@playwright/test').Page){
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.evaluate(()=>{const id='11111111-1111-4111-8111-111111111111';(window as any).projectBoardOverride={id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:'C:\\Demo\\Atlas',repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versions:[],notes:[],canvas:{version:1,items:[{id,kind:'sticky',text:'Synthetic focus target',color:'mint',x:0,y:0,width:300,height:240}],links:[]}};});
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
 await expect(page.locator('.whiteboard-item')).toBeVisible();
}
async function signal(page:import('@playwright/test').Page,x:number,phase='editing'){
 await page.evaluate(({x,phase})=>{const w=window as any,b=w.projectBoardOverride,item=b.canvas.items[0];item.x=x;item.y=1200;b.repositoryRevision=(x===3000?'b':x===5000?'c':'d').repeat(64);w.testBoardActivity={id:crypto.randomUUID(),ids:[item.id],targets:[{id:item.id,x,y:1200,width:300,height:240}],action:'move',phase,expiresAt:Date.now()+8000};},{x,phase});
}
async function centered(page:import('@playwright/test').Page){
 await expect.poll(()=>page.evaluate(()=>{const viewport=document.querySelector('.whiteboard-viewport')!.getBoundingClientRect(),item=document.querySelector('.whiteboard-item')!.getBoundingClientRect();return Math.abs(item.x+item.width/2-viewport.x-viewport.width/2)+Math.abs(item.y+item.height/2-viewport.y-viewport.height/2);})).toBeLessThan(3);
}

test('one real operation cursor follows offscreen targets and yields to manual navigation',async({page})=>{
 await openSynthetic(page);await signal(page,3000);
 await expect(page.locator('.wb-ai-cursor')).toHaveText('AI · moving');await expect(page.locator('.wb-ai-cursor')).toHaveCount(1);await centered(page);
 await expect(page.locator('.whiteboard-item')).toHaveClass(/wb-ai-active/);
 const viewport=page.locator('.whiteboard-viewport'),r=(await viewport.boundingBox())!;
 await page.mouse.move(r.x+50,r.y+50);await page.mouse.down({button:'middle'});await page.mouse.move(r.x+130,r.y+90,{steps:5});await page.mouse.up({button:'middle'});
 await expect(page.getByRole('button',{name:'Follow AI',exact:true})).toHaveAttribute('aria-pressed','false');
 const manual=await page.locator('.whiteboard-world').getAttribute('style');await signal(page,5000,'saved');await expect(page.locator('.wb-ai-cursor')).toHaveText('AI · updated');
 await expect(page.locator('.whiteboard-world')).toHaveAttribute('style',manual!);
 await page.getByRole('button',{name:'Follow AI',exact:true}).click();await centered(page);
 await signal(page,6000,'failed');await expect(page.locator('.wb-ai-cursor')).toHaveText('AI · failed');await centered(page);
 await page.screenshot({path:'.local/ai-follow-preview.png'});
});

test('reduced motion focuses without an animated cursor and expired activity disappears',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await openSynthetic(page);await signal(page,3000,'reading');
 await expect(page.locator('.wb-ai-cursor')).toHaveText('AI · reading');await centered(page);
 expect(await page.locator('.wb-ai-cursor').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
 await page.evaluate(()=>{(window as any).testBoardActivity={...(window as any).testBoardActivity,id:crypto.randomUUID(),expiresAt:Date.now()+400};});
 await expect(page.locator('.wb-ai-cursor')).toHaveCount(0);await expect(page.locator('.wb-ai-active')).toHaveCount(0);
});

test('open canvas receives external edits and MCP activity while preserving an inline draft',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.evaluate(()=>{const id='11111111-1111-4111-8111-111111111111';(window as any).projectBoardOverride={id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:'C:\\Demo\\Atlas',repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',versions:[],branches:[],notes:[{id,title:'Synthetic card',description:'Initial criteria',branch:'',status:'idea',priority:'normal',x:0,y:0,dependencies:[]}],canvas:{version:1,items:[{id,kind:'card',text:'Synthetic card',description:'Initial criteria',color:'sand',x:0,y:0,width:300,height:260}],links:[]}};});
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
 const card=page.locator('.whiteboard-item.wb-card');await expect(card).toContainText('Synthetic card');
 await page.evaluate(()=>{const w=window as any,b=w.projectBoardOverride;b.notes[0].title=b.canvas.items[0].text='Updated by MCP';b.repositoryRevision='b'.repeat(64);w.testBoardActivity={id:'actual-mcp-write',ids:[b.notes[0].id],phase:'saved',expiresAt:Date.now()+8000};});
 await expect(card).toContainText('Updated by MCP');await expect(card).toHaveClass(/wb-remote-updated/);await expect(page.locator('.wb-ai-cursor')).toHaveText('AI · updated');
 await card.locator('.whiteboard-text').dblclick();await page.getByRole('textbox',{name:'Text',exact:true}).fill('Local unsaved draft');
 await page.evaluate(()=>{const w=window as any,b=w.projectBoardOverride;b.notes[0].title=b.canvas.items[0].text='External file update';b.repositoryRevision='c'.repeat(64);w.testBoardActivity=null;});
 await expect(page.getByRole('status').filter({hasText:'Board updates are waiting'})).toBeVisible();await expect(page.getByRole('textbox',{name:'Text',exact:true})).toHaveValue('Local unsaved draft');await expect(page.locator('.wb-ai-cursor')).toHaveCount(0);
 await page.keyboard.press('Escape');await expect(card).toContainText('External file update');await expect(page.getByRole('textbox',{name:'Text',exact:true})).toHaveCount(0);
});
