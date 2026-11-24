import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';
async function openBoard(page:Page,width=1440){
 await page.setViewportSize({width,height:900});await desktop(page);
 await page.evaluate(()=>{const note={id:'11111111-1111-4111-8111-111111111111',title:'Synthetic long card',description:Array.from({length:70},(_,n)=>'Criteria line '+n).join('\n'),branch:'',status:'idea',priority:'normal',x:20,y:20,dependencies:[]};(window as any).projectBoardOverride={id:'22222222-2222-4222-8222-222222222222',name:'Atlas',root:'C:\\Demo\\Atlas',repositoryFile:'board-22222222-2222-4222-8222-222222222222.json',repositoryRevision:'a'.repeat(64),revision:0,versions:[],branches:[],notes:[note],canvas:{version:1,items:[{id:note.id,kind:'card',text:note.title,description:note.description,color:'sand',x:20,y:20,width:280,height:280}],links:[]}};});
 const recentCount=await page.locator('.desktop-sessions>button').count();await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();await expect(page.locator('.board-header').getByRole('button',{name:'Chat',exact:true})).toHaveCount(0);await expect(page.locator('.desktop-board-chat')).toHaveCount(0);await expect(page.locator('.desktop-sessions>button')).toHaveCount(recentCount);
}
test('a card never scrolls inside: the wheel over a card or over empty canvas pans the board',async({page})=>{
 await openBoard(page);const content=page.locator('.wb-card .whiteboard-text'),world=page.locator('.react-flow__viewport'),transform=()=>world.evaluate(el=>getComputedStyle(el).transform);
 for(const part of ['.wb-card .whiteboard-text','.wb-card-meta'])await expect(page.locator(part).first()).toHaveCSS('overflow','hidden');
 const start=await transform();await content.first().hover();await page.mouse.wheel(0,150);await expect.poll(transform).not.toBe(start);expect(await content.first().evaluate(el=>el.scrollTop)).toBe(0);
 const moved=await transform(),r=(await page.locator('.whiteboard-viewport').boundingBox())!;await page.mouse.move(r.x+r.width-70,r.y+Math.min(250,r.height/2));await page.mouse.wheel(0,100);await expect.poll(transform).not.toBe(moved);
});
test('shared divider retains sidebar pointer, keyboard, bounds and reset behavior',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await desktop(page);const rail=page.locator('.desktop-rail'),divider=page.getByRole('separator',{name:'Sidebar width'}),before=(await rail.boundingBox())!.width,r=(await divider.boundingBox())!;await page.mouse.move(r.x+r.width/2,r.y+100);await page.mouse.down();await page.mouse.move(r.x+100,r.y+100,{steps:8});await page.mouse.up();expect((await rail.boundingBox())!.width).toBeGreaterThan(before+80);await divider.focus();await page.keyboard.press('ArrowLeft');await divider.dblclick();expect((await rail.boundingBox())!.width).toBe(before);await divider.focus();for(let n=0;n<15;n++)await page.keyboard.press('Shift+ArrowLeft');expect((await rail.boundingBox())!.width).toBe(220);await page.keyboard.press('Home');expect((await rail.boundingBox())!.width).toBe(before);
});


