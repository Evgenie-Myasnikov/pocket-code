import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('Windows selection uses expanded visual order and folder actions count the complete scoped snapshot',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;
    const rows=['one','two','three','four','five'].map((id,i)=>({sessionId:id,summary:i===0?'claude · Interface review':id,cwd:i<2?'C:\\A':i===2?'C:\\B':'C:\\C',lastModified:20-i}));
    w.testChatRows=rows;
    w.testBulkHost=(body:any)=>{
      const candidates=body.ids||[...rows,{sessionId:'outside-ui',cwd:'C:\\B'}].filter(r=>r.cwd===body.folder).map(r=>r.sessionId);
      const eligible=candidates.filter((id:string)=>id!=='five');
      if(body.action==='delete')for(const id of eligible){w.chatChanges={...w.chatChanges,['claude:'+id]:{action:'delete'}};}
      return {...(body.eraseOriginals?{eraseOriginals:true,failed:[],unsupported:[]}:{}),ids:eligible,running:candidates.includes('five')?['five']:[],unavailable:[]};
    };
  });
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  const row=(id:string)=>page.locator('.desktop-sessions > [data-chat-id="'+id+'"]');
  const group=(folder:string)=>page.locator('.rail-chat-folder').filter({has:page.locator('summary[title="C:\\\\'+folder+'"]')});
  const folderB=group('B');await folderB.locator('summary').click();
  await row('one').click();
  await row('four').click({modifiers:['Shift']});
  await expect(page.locator('[data-marked=true]')).toHaveCount(3);
  await expect(row('three')).not.toHaveAttribute('data-marked','true');
  await row('two').click({modifiers:['Control']});await expect(page.locator('[data-marked=true]')).toHaveCount(2);
  await row('four').click({button:'right'});await page.getByRole('menuitem',{name:'Delete selected chats'}).click();
  const dialog=page.getByRole('dialog',{name:'Delete chats'});await expect(dialog.getByRole('button',{name:'Erase permanently · 2'})).toBeVisible();
  if(process.env.POCKET_BULK_PREVIEW){
    await page.evaluate(async()=>(await import('/src/i18n.ts' as string)).setLanguage('ru'));
    await expect(page.getByRole('button',{name:'Стереть безвозвратно · 2'})).toBeVisible();
    await page.screenshot({path:process.env.POCKET_BULK_PREVIEW});
    await page.evaluate(async()=>(await import('/src/i18n.ts' as string)).setLanguage('en'));
  }
  await dialog.getByRole('button',{name:'Cancel'}).click();
  await row('four').focus();await page.keyboard.press('Escape');await expect(page.locator('[data-marked=true]')).toHaveCount(0);
  await page.keyboard.press('Shift+ArrowDown');await expect(page.locator('[data-marked=true]')).toHaveCount(2);
  await page.keyboard.press('Delete');await expect(dialog).toContainText('Running chats kept');await dialog.getByRole('button',{name:'Erase permanently · 1'}).click();
  await expect(row('four')).toHaveCount(0);await expect(row('five')).toBeVisible();
  await folderB.getByRole('button',{name:/Folder actions/}).click();await page.getByRole('menuitem',{name:'Delete all chats in this folder'}).click();
  await expect(dialog.getByRole('button',{name:'Erase permanently · 2'})).toBeVisible();
  await dialog.getByRole('button',{name:'Erase permanently · 2'}).click();await expect(folderB).toHaveCount(0);
  await expect(row('one')).toBeVisible();
});
