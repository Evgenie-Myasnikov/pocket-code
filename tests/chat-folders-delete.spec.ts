import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** Synthetic chats: six for Claude and two for Codex. */
async function chats(page:Page){
 await page.addInitScript(()=>{
  const rows=(prefix:string,count:number,base:number)=>Array.from({length:count},(_,i)=>({sessionId:prefix+'-'+i,summary:prefix==='claude'&&i===0?'claude · Interface review':prefix+' chat '+i,cwd:'C:\\Demo\\Atlas',lastModified:base-i}));
  (window as any).testChatRowsBy={claude:rows('claude',6,1000),codex:rows('codex',2,2000),copilot:[]};
 });
}
const rail='.desktop-rail-content';
const row=(page:Page,id:string)=>page.locator(rail+' button[data-chat-id="'+id+'"]');
async function menu(page:Page,id:string){await row(page,id).hover();await row(page,id).locator('+ .chat-list-action-slot').getByRole('button',{name:'Chat actions'}).click();}

test('Delete in the row menu removes the chat at once without a dialog',async({page})=>{
 await chats(page);await desktop(page);
 await menu(page,'codex-1');await page.getByRole('menuitem',{name:'Delete'}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(row(page,'codex-1')).toHaveCount(0);
 const call=await page.evaluate(()=>(window as any).desktopCalls.find((c:any)=>c.endpoint?.includes('/sessions/codex-1/manage')));
 expect(call.data).toMatchObject({provider:'codex',action:'erase',eraseOriginals:true});
});

test('a refused delete brings the chat back and says why',async({page})=>{
 await chats(page);await desktop(page);
 await page.evaluate(()=>{(window as any).testEraseError='Stop this chat before deleting it.';});
 await menu(page,'claude-3');await page.getByRole('menuitem',{name:'Delete'}).click();
 await expect(page.getByRole('alert')).toContainText('Stop this chat before deleting it.');
 await expect(row(page,'claude-3')).toBeVisible();
});

test('folders are made, named, filled, collapsed, renamed and deleted',async({page})=>{
 await chats(page);await desktop(page);
 await page.getByRole('button',{name:'New folder',exact:true}).click();
 const name=page.getByRole('textbox',{name:'Folder name'});await name.fill('Release');await name.press('Enter');
 const folder=page.locator(rail+' button.desktop-chat-folder');await expect(folder).toHaveText(/Release\s*0/);
 // a drag moves a chat into the folder (the row menu has no folder items)
 await row(page,'claude-2').dragTo(folder);
 await row(page,'claude-4').dragTo(folder);
 await expect(folder).toHaveText(/Release\s*2/);
 await expect(row(page,'claude-2')).toHaveAttribute('data-nested','true');await expect(row(page,'claude-4')).toHaveAttribute('data-nested','true');
 // a folder does not look like a chat: its chevron, folder icon and count are visible, its chats hang from a guide line
 await expect(folder.locator('svg')).toHaveCount(2);for(const icon of await folder.locator('svg').all())await expect(icon).toBeVisible();
 await expect(folder.locator('small')).toBeVisible();
 expect(await row(page,'claude-2').evaluate(element=>getComputedStyle(element,'::before').width)).toBe('1px');
 await page.locator(rail).screenshot({path:'.local/chat-folders.png'});
 await folder.click();await expect(folder).toHaveAttribute('aria-expanded','false');await expect(row(page,'claude-2')).toHaveCount(0);
 await page.reload();await expect(page.locator(rail+' button.desktop-chat-folder')).toHaveAttribute('aria-expanded','false');
 await folder.click();await expect(row(page,'claude-2')).toBeVisible();
 await folder.hover();await page.locator(rail+' .desktop-folder-actions').getByRole('button',{name:'Folder actions'}).click();
 await page.getByRole('menuitem',{name:'Rename'}).click();await name.fill('Shipped');await name.press('Enter');
 await expect(folder).toHaveText(/Shipped\s*2/);
 await row(page,'claude-2').dragTo(page.locator(rail+' .desktop-sessions > button[data-chat-id]:not([data-nested])').first());
 await expect(row(page,'claude-2')).not.toHaveAttribute('data-nested','true');await expect(folder).toHaveText(/Shipped\s*1/);
 await folder.click({button:'right'});await page.getByRole('menuitem',{name:'Delete folder'}).click();
 await expect(folder).toHaveCount(0);
 // chats of a deleted folder go back to the list, they are not deleted
 await expect(row(page,'claude-4')).toBeVisible();await expect(row(page,'claude-4')).not.toHaveAttribute('data-nested','true');
});

test('a folder is held with the mouse and moved among the chats and the other folders; a right click on the list makes no folder',async({page})=>{
 await chats(page);await desktop(page);
 const make=async(title:string)=>{await page.getByRole('button',{name:'New folder',exact:true}).click();const name=page.getByRole('textbox',{name:'Folder name'});await name.fill(title);await name.press('Enter');};
 await make('First');await make('Second');
 const order=()=>page.locator(rail+' .desktop-sessions > button').evaluateAll(list=>list.map(b=>b.classList.contains('desktop-chat-folder')?(b.querySelector('strong')?.textContent||'folder'):b.getAttribute('data-chat-id')));
 expect((await order()).slice(0,2)).toEqual(['First','Second']);
 // a right click on empty space of the list does not create a folder
 const list=(await page.locator(rail+' .desktop-chat-list').boundingBox())!;
 await page.mouse.click(list.x+list.width/2,list.y+list.height-8,{button:'right'});
 await expect(page.getByRole('textbox',{name:'Folder name'})).toHaveCount(0);expect(await page.locator(rail+' button.desktop-chat-folder').count()).toBe(2);
 // hold "First" and drop it under the second chat outside folders: it takes that place
 const loose=page.locator(rail+' .desktop-sessions > button[data-chat-id]:not([data-nested])');
 const second=(await loose.nth(1).boundingBox())!;
 await page.locator(rail+' button.desktop-chat-folder',{hasText:'First'}).dragTo(loose.nth(1),{targetPosition:{x:20,y:Math.round(second.height-4)}});
 let rows=await order();const first=rows.indexOf('First');
 expect(rows.indexOf('Second')).toBe(0);expect(first).toBe(3);
 // and it stays there after a reload
 await page.reload();await expect.poll(order).toEqual(rows);
 // dropped on the top of the list it goes back above everything
 await page.locator(rail+' button.desktop-chat-folder',{hasText:'First'}).dragTo(page.locator(rail+' button.desktop-chat-folder',{hasText:'Second'}),{targetPosition:{x:20,y:2}});
 rows=await order();expect(rows.slice(0,2)).toEqual(['First','Second']);
});
