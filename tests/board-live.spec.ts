import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

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
