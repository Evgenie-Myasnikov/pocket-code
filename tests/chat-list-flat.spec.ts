import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** Synthetic chats: 40 for Claude and 3 newer ones for Codex, each provider with its own ids. */
async function manyChats(page:Page){
 await page.addInitScript(()=>{
  const rows=(prefix:string,count:number,base:number)=>Array.from({length:count},(_,i)=>({sessionId:prefix+'-'+i,summary:prefix==='claude'&&i===0?'claude · Interface review':prefix+' chat '+i,cwd:'C:\\Demo\\Atlas',lastModified:base-i}));
  (window as any).testChatRowsBy={claude:rows('claude',40,1000),codex:rows('codex',3,2000),copilot:[]};
 });
}
const rail='.desktop-rail-content';

test('the sidebar is one list of chats of every provider that ends with Show more',async({page})=>{
 await manyChats(page);await desktop(page);
 const list=page.locator(rail+' .desktop-sessions > button[data-chat-id]');
 await expect(list).toHaveCount(30);
 await expect(page.locator(rail).getByText('Pocket Code',{exact:true})).toHaveCount(0);
 await expect(page.locator(rail+' .provider-picker-trigger')).toHaveCount(0);
 await expect(page.locator(rail+' .rail-chat-folder')).toHaveCount(0);
 await expect(page.locator(rail).getByText('Projects',{exact:true})).toHaveCount(0);
 // newest first across providers: the three Codex chats lead
 await expect(list.nth(0)).toHaveAttribute('data-provider','codex');await expect(list.nth(3)).toHaveAttribute('data-provider','claude');
 const more=page.getByRole('button',{name:/Show more chats · 13/});await expect(more).toBeVisible();
 await expect(page.locator(rail).getByText('Chats',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'.local/chat-list-flat.png'});
 await more.click();await expect(list).toHaveCount(43);await expect(page.getByRole('button',{name:/Show more chats/})).toHaveCount(0);
});

test('a chat of another provider opens from the list and stays open',async({page})=>{
 await manyChats(page);await desktop(page);
 const codex=page.locator(rail+' button[data-chat-id="codex-1"]');
 await codex.click();
 await expect(codex).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.desktop-chat-host')).toBeVisible();
 // the list keeps both providers after the switch
 await expect(page.locator(rail+' button[data-chat-id="claude-0"]')).toBeVisible();
 await page.waitForTimeout(500);await expect(codex).toHaveAttribute('aria-pressed','true');
});

test('the provider is chosen inside a new chat',async({page})=>{
 await manyChats(page);await desktop(page);
 await page.getByRole('button',{name:'New chat',exact:true}).click();
 const picker=page.locator('.desktop-chat-host .provider-picker-trigger:visible');await expect(picker).toHaveCount(1);
 await expect(picker).toBeVisible();await expect(picker).toContainText('Claude');
 await picker.click();await page.getByRole('menuitemradio',{name:/Codex/}).or(page.getByRole('option',{name:/Codex/})).or(page.locator('.provider-picker-menu').getByText('Codex',{exact:true})).first().click();
 await expect(page.locator('.desktop-chat-host .provider-picker-trigger:visible')).toContainText('Codex');
 await expect(page.locator('.desktop-chat-host')).toBeVisible();
 await page.locator('.desktop-chat-host').screenshot({path:'.local/new-chat-provider.png'});
});

test('appearance is a few flat rows with four themes',async({page})=>{
 await manyChats(page);await desktop(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('.settings-category').filter({hasText:'Appearance & language'}).click();
 const themes=page.getByRole('group',{name:'Theme'});
 await expect(themes.getByRole('button')).toHaveText([/Carbon/,/Emerald/,/Graphite/,/Slate/,/Ink/]);
 await expect(page.locator('html')).toHaveAttribute('data-palette','carbon');
 await themes.getByRole('button',{name:/Emerald/}).click();await expect(page.locator('html')).toHaveAttribute('data-palette','emerald');
 await expect(page.getByText('Chat font')).toHaveCount(0);await expect(page.getByText('Show background')).toHaveCount(0);
 await themes.getByRole('button',{name:/Carbon/}).click();
 await page.screenshot({path:'.local/settings-appearance.png'});
});

test('all providers are on one settings page',async({page})=>{
 await manyChats(page);await desktop(page);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('.settings-category').filter({hasText:'Providers'}).click();
 for(const name of ['Claude','Codex','GitHub Copilot'])await expect(page.getByRole('region',{name,exact:true})).toBeVisible();
 await expect(page.locator('.provider-section')).toHaveCount(4);
 await page.screenshot({path:'.local/settings-providers.png',fullPage:false});
});

test('the row menu renames, pins, archives and deletes',async({page})=>{
 await manyChats(page);await desktop(page);
 const list=page.locator(rail+' .desktop-sessions > button[data-chat-id]');
 const menu=async(id:string)=>{const row=page.locator(rail+' button[data-chat-id="'+id+'"]');await row.hover();await row.locator('+ .chat-list-action-slot').getByRole('button',{name:'Chat actions'}).click();};
 await menu('claude-5');
 await expect(page.getByRole('menuitem')).toHaveText(['Rename','Pin','Archive','Delete']);
 await page.waitForTimeout(400);await page.screenshot({path:'.local/chat-row-menu.png',clip:{x:0,y:0,width:560,height:420}});
 await page.getByRole('menuitem',{name:'Pin'}).click();
 await expect(list.first()).toHaveAttribute('data-chat-id','claude-5');
 await menu('codex-0');await page.getByRole('menuitem',{name:'Archive'}).click();
 await expect(page.locator(rail+' button[data-chat-id="codex-0"]')).toHaveCount(0);
 await page.reload();await expect(list.first()).toHaveAttribute('data-chat-id','claude-5');
 await page.getByRole('button',{name:'Archived · 1'}).click();await expect(list).toHaveCount(1);
 await menu('codex-0');await page.getByRole('menuitem',{name:'Unarchive'}).click();
 await expect(page.locator(rail+' button[data-chat-id="codex-0"]')).toBeVisible();await expect(page.getByRole('button',{name:/Archived/})).toHaveCount(0);
 await menu('claude-5');await page.getByRole('menuitem',{name:'Unpin'}).click();await expect(list.first()).toHaveAttribute('data-chat-id','codex-0');
});
