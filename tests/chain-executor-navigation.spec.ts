import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('Markdown import keeps selected project locations distinct from uploaded copies',async({page})=>{
  await page.setViewportSize({width:1280,height:960});
  await page.addInitScript(()=>{
    (window as any).withSourceFolder=true;
    (window as any).testChainRequest=(_p:string,data:any)=>{
      if(!data)return {value:[]};
      (window as any).acceptedSources=data.sourceFiles;
      return {value:{...data,status:'running',steps:data.tasks.map((step:any)=>({...step,status:'pending'}))}};
    };
  });
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:'Import Markdown',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Markdown tasks'});
  await dialog.getByRole('button',{name:'Context from project'}).click();
  await dialog.getByRole('button',{name:'README.md',exact:true}).click();
  await dialog.getByRole('button',{name:'Task files from project'}).click();
  await dialog.getByRole('button',{name:'docs',exact:true}).click();
  await dialog.getByRole('button',{name:'README.md',exact:true}).click();
  await dialog.getByLabel('Task files (.md)',{exact:true}).setInputFiles({
    name:'summary.md',mimeType:'text/markdown',buffer:Buffer.from('# Summarize\nPrepare an index.')
  });
  await dialog.getByRole('button',{name:'Start linked chats'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).acceptedSources)).toEqual([
    {name:'README.md',projectPath:'README.md'},
    {name:'docs/README.md',projectPath:'docs/README.md'},
    {name:'summary.md',text:'# Summarize\nPrepare an index.'}
  ]);
});

test('a step opens in its assigned provider and links back to the original chain',async({page})=>{
  await page.setViewportSize({width:1280,height:960});
  await page.addInitScript(()=>{
    const owner={provider:'claude',cwd:'C:\\Demo\\Atlas'};
    const stepCwd='C:\\Demo\\Step';
    const summary={id:'00000000-0000-4000-8000-000000000007',name:'Guide review',status:'done',stepsDone:1,stepCount:1};
    const detail={...summary,...owner,context:'Review the guide.',steps:[
      {title:'Review spelling',body:'Check the sample.',source:'guide.md',status:'done',
       executor:{provider:'codex'},sessionId:'alpha',worktreeCwd:stepCwd}
    ]};
    (window as any).testChainRequest=(path:string,_data:unknown,params:URLSearchParams)=>{
      if(params.get('sessionId')==='alpha'&&params.get('provider')==='codex'&&params.get('cwd')===stepCwd)
        return {value:[{...summary,stepIndex:0,owner}]};
      if(params.get('provider')!==owner.provider||params.get('cwd')!==owner.cwd)return {value:[]};
      return {value:path==='/task-chains'?[summary]:detail};
    };
  });
  await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Tasks',exact:true}).click();
  await page.getByRole('button',{name:/Guide review/}).click();
  await page.getByRole('button',{name:'Open chat',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>{
    return (window as any).desktopCalls.some((call:{endpoint?:string})=>{
      const url=new URL(call.endpoint||'/','https://example.invalid');
      return url.pathname==='/sessions/alpha/messages'&&url.searchParams.get('provider')==='codex';
    });
  })).toBe(true);
  await page.getByRole('button',{name:/Guide review.*Step 1/}).click();
  await expect(page.getByRole('heading',{name:'Guide review'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Review spelling'})).toBeVisible();
});
