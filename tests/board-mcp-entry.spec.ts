import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('opening and revisiting a board refresh MCP, ordinary refresh and gallery navigation do not',async({page})=>{
 await desktop(page);const rail=page.locator('.desktop-rail');
 const count=()=>page.evaluate(()=>new Set((window as any).desktopCalls.filter((c:any)=>c.endpoint==='/project-board/mcp'&&c.action==='write').map((c:any)=>c.data.opening)).size);
 await rail.getByRole('button',{name:'Board',exact:true}).click();
 await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
 await expect.poll(count).toBe(1);
 const first=await page.evaluate(()=>(window as any).desktopCalls.find((c:any)=>c.endpoint==='/project-board/mcp').data.opening);
 await page.getByRole('button',{name:'Refresh board',exact:true}).click();
 await page.getByRole('button',{name:'Board images',exact:true}).click();await page.getByRole('button',{name:'Back to board',exact:true}).click();
 expect(await count()).toBe(1);
 await rail.getByRole('button',{name:'Chats',exact:true}).click();await rail.getByRole('button',{name:'Board',exact:true}).click();
 await expect.poll(count).toBe(2);
 const second=await page.evaluate(()=>(window as any).desktopCalls.filter((c:any)=>c.endpoint==='/project-board/mcp').at(-1).data.opening);expect(second).not.toBe(first);
 await page.getByRole('button',{name:'Back to boards',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();await expect.poll(count).toBe(3);
});
