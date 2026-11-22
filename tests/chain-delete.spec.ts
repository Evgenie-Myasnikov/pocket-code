import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('task deletion reviews original chats, keeps a partial task and retries only the remaining IDs',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(()=>{
    const w=window as any;
    const summary={id:'00000000-0000-4000-8000-000000000043',name:'Guide review',status:'done',stepsDone:1,stepCount:1};
    const chain={...summary,provider:'claude',cwd:'C:\\Demo\\Atlas',context:'Review.',steps:[{title:'Check spelling',source:'guide.md',body:'Review text.',sessionId:'run-two',status:'done',executor:{provider:'codex'}}]};
    const first={provider:'claude',sessionId:'run-one'},second={provider:'codex',sessionId:'run-two'};
    let view=0,exists=true;
    const body=(chats:unknown[],rest={})=>({chats,running:[],unavailable:[],unsupported:[],failed:[],eraseOriginals:true,...rest});
    w.eraseRequests=[];
    w.testChainRequest=(path:string,data:any,q:URLSearchParams)=>{
      if(path==='/task-chains')return {value:exists?[summary]:[]};
      if(q.get('deletePreview')==='1'){
        if(q.get('eraseOriginals')!=='1')return {error:'Expected permanent preview'};
        return {value:body(view?[second]:[first,second],view?{}:{unknownCount:1})};
      }
      if(path.endsWith('/delete-chats')){
        w.eraseRequests.push(data);
        if(!view++){return {value:{ok:false,...body([first],{failed:[second]})}};}
        exists=false;return {value:{ok:true,...body([second])}};
      }
      if(path.endsWith('/delete'))return {error:'Unexpected chain-only call'};
      return {value:chain};
    };
  });
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:/Guide review/}).click();
  await page.getByRole('button',{name:'Delete task',exact:true}).click();
  const dialog=page.getByRole('alertdialog',{name:'Delete task'});
  await expect(dialog.getByRole('radio',{name:'Task only'})).toBeChecked();
  await dialog.getByRole('radio',{name:'Task, original chats and cache'}).check();
  await expect(dialog).toContainText('Original chats to delete · 2');
  await expect(dialog).toContainText('Attempts without a known chat ID · 1');
  await dialog.getByText('Review chats',{exact:true}).click();
  await expect(dialog.getByText('run-two')).toBeVisible();
  if(process.env.POCKET_CHAIN_DELETE_PREVIEW){
    await page.evaluate(async()=>(await import('/src/i18n.ts' as string)).setLanguage('ru'));
    const translated=page.getByRole('alertdialog',{name:'Удалить задачу'});
    await expect(translated).toContainText('Оригиналов чатов к удалению · 2');
    if(!await translated.getByText('run-two').isVisible())await translated.getByText('Посмотреть чаты').click();
    await translated.screenshot({path:process.env.POCKET_CHAIN_DELETE_PREVIEW});
    await page.evaluate(async()=>(await import('/src/i18n.ts' as string)).setLanguage('en'));
  }
  await dialog.getByRole('button',{name:'Cancel'}).click();
  expect(await page.evaluate(()=>(window as any).eraseRequests)).toEqual([]);
  await page.getByRole('button',{name:'Delete task',exact:true}).click();
  await dialog.getByRole('radio',{name:'Task, original chats and cache'}).check();
  await dialog.getByRole('button',{name:'Erase permanently'}).click();
  await expect(dialog).toContainText('Original chats deleted · 1');
  await expect(dialog).toContainText('Failed to erase · 1');
  await expect(dialog.getByRole('button',{name:'Erase permanently'})).toBeDisabled();
  await dialog.getByRole('button',{name:'Check again'}).click();
  await expect(dialog).toContainText('Original chats to delete · 1');
  await dialog.getByRole('button',{name:'Erase permanently'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Guide review/})).toHaveCount(0);
  const calls=await page.evaluate(()=>(window as any).eraseRequests);
  expect(calls.map((r:any)=>r.chats)).toEqual([[{provider:'claude',sessionId:'run-one'},{provider:'codex',sessionId:'run-two'}],[{provider:'codex',sessionId:'run-two'}]]);
  expect(calls.every((r:any)=>r.eraseOriginals===true&&r.provider==='claude'&&r.cwd==='C:\\Demo\\Atlas')).toBe(true);
});

test('bulk erasure requires a capable host and retries only after an explicit review',async({page})=>{
  await page.setViewportSize({width:1440,height:960});
  await page.addInitScript(()=>{
    const w=window as any;
    w.erased=[];
    w.testBulkHost=(b:any)=>{
      const response={ids:b.ids||['alpha','beta'],running:[],unavailable:[]};
      if(!b.eraseOriginals)return response;
      if(!w.hostUpdated)return response;
      if(b.action==='delete'){w.erased.push(b.ids);return {...response,ids:[],failed:b.ids,unsupported:[],eraseOriginals:true};}
      return {...response,failed:[],unsupported:[],eraseOriginals:true};
    };
  });
  await desktop(page);
  await page.getByRole('button',{name:/Folder actions/}).first().click();
  await page.getByRole('menuitem',{name:'Delete all chats in this folder'}).click();
  const dialog=page.getByRole('dialog',{name:'Delete chats'}),choice=dialog.getByRole('radio',{name:'Original chats and local cache'});
  await expect(choice).toBeChecked();
  await expect(dialog.getByRole('alert')).toContainText('Update the PC host');
  await dialog.getByRole('radio',{name:'Only remove from the Pocket Code list'}).check();
  await expect(dialog.getByRole('button',{name:'Remove from list · 2'})).toBeVisible();
  await choice.check();
  await expect(dialog.getByRole('alert')).toContainText('Update the PC host');
  expect(await page.evaluate(()=>(window as any).erased)).toEqual([]);
  await page.evaluate(()=>{(window as any).hostUpdated=true;});
  await dialog.getByRole('button',{name:'Retry'}).click();
  await dialog.getByRole('button',{name:'Erase permanently · 2'}).click();
  await expect(dialog).toContainText('Failed to erase · 2');
  expect(await page.evaluate(()=>(window as any).erased)).toEqual([['alpha','beta']]);
});
