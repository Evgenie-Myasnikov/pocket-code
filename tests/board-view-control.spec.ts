import {test,expect} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {spawn} from 'node:child_process';
import {desktop} from './desktop-fixture';

test('real MCP controls the rendered board, receives state, rejects busy/hidden views and preserves the board',async({page})=>{
 test.setTimeout(60000);
 const temp=await mkdtemp(path.join(tmpdir(),'board-view-ui-')),root=path.join(temp,'project'),data=path.join(temp,'data'),token=randomUUID(),id=randomUUID(),file='board-'+randomUUID()+'.json';
 await mkdir(path.join(root,'project-boards'),{recursive:true});await mkdir(data);await writeFile(path.join(data,'connection-key.txt'),token);
 const board={format:'pocket-code-board',version:1,name:'Atlas',versions:[],notes:[],canvas:{version:1,items:[{id,kind:'sticky',text:'Synthetic remote target',x:3000,y:2000,width:240,height:180,color:'mint'}],links:[]}};
 const original=JSON.stringify(board);await writeFile(path.join(root,'project-boards',file),original);
 const host=spawn(process.execPath,['--import','tsx','tests/board-view-host.ts',root,data],{env:{...process.env,BOARD_VIEW_TEST_TOKEN:token},windowsHide:true,stdio:['pipe','pipe','pipe']});host.stderr.on('data',()=>{});
 const port=await new Promise<number>((resolve,reject)=>{let text='';host.stdout.on('data',chunk=>{text+=chunk;const line=text.split('\n')[0];if(text.includes('\n'))try{resolve(JSON.parse(line).port);}catch{reject(Error('Invalid test host response'));}});host.once('exit',()=>reject(Error('Test host exited')));}),base=`http://127.0.0.1:${port}/api`;
 const client=new Client({name:'view-test',version:'1'});
 const invoke=async(name:string,args:Record<string,unknown>={})=>{const r:any=await client.callTool({name,arguments:{project:'demo',...args}});if(r.isError)throw Error(r.content[0].text);return JSON.parse(r.content[0].text);};
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:['scripts/board-mcp.mjs','demo='+root],env:{...process.env,POCKET_DATA_DIR:data,POCKET_PORT:String(port)},stderr:'pipe'}));
  expect((await invoke('read_view_state')).views).toEqual([]);
  await page.exposeFunction('boardHostRequest',async(endpoint:string,input?:any)=>{const url=new URL(base+endpoint);url.searchParams.set('root',root);const response=await fetch(url,{method:input?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(input?{body:JSON.stringify({...input,root})}:{})});const value=await response.json();return response.ok?{value}:{error:value.error||'Host error',status:response.status};});
  await page.setViewportSize({width:1440,height:900});await desktop(page);
  await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').filter({has:page.locator('small').filter({hasText:/^Atlas$/})}).click();
  await expect(page.locator('.whiteboard-item')).toHaveCount(1);
  await expect.poll(async()=>(await invoke('read_view_state')).views.filter((v:any)=>v.visible).length).toBe(1);
  const view=(await invoke('read_view_state')).views.find((v:any)=>v.visible),revision=(await invoke('read_board')).revision;
  const control=(action:unknown)=>invoke('control_view',{viewId:view.id,revision,requestId:randomUUID(),action});
  const focus=await control({type:'focus',ids:[id]});expect(focus.status).toBe('applied');expect(focus.state.inView).toContain(id);
  const rect=await page.locator('.whiteboard-viewport').boundingBox(),target=await page.locator('.whiteboard-item').boundingBox();expect(Math.abs(target!.x+target!.width/2-rect!.x-rect!.width/2)).toBeLessThan(2);
  await expect(page.locator('.wb-ai-cursor')).toHaveAttribute('data-target',id);
  expect((await control({type:'select',ids:[id]})).status).toBe('applied');await expect(page.locator('.whiteboard-item')).toHaveClass(/wb-selected/);
  expect((await control({type:'follow',enabled:true})).status).toBe('applied');await expect(page.getByRole('button',{name:'Pause following AI'})).toHaveAttribute('aria-pressed','true');
  expect((await control({type:'follow',enabled:false})).status).toBe('applied');await expect(page.getByRole('button',{name:'Follow AI',exact:true})).toHaveAttribute('aria-pressed','false');
  expect((await control({type:'camera',x:3120,y:2090,zoom:.5})).status).toBe('applied');expect((await control({type:'fit'})).status).toBe('applied');
  await page.locator('.whiteboard-item').dblclick();await expect.poll(async()=>(await invoke('read_view_state')).views[0].busy).toBe(true);await expect(control({type:'fit'})).rejects.toThrow(/busy/);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Board images',exact:true}).click();await expect.poll(async()=>(await invoke('read_view_state')).views[0].visible).toBe(false);await expect(control({type:'fit'})).rejects.toThrow(/hidden/);
  await page.getByRole('button',{name:'Back to board',exact:true}).click();await expect(page.locator('.board-mcp-state')).toHaveAttribute('data-state','ready');
  const catalog=await invoke('board_mcp_status');expect(catalog.tools).toContain('control_view');expect(catalog.state).toBe('ready');
  const current=await invoke('read_board');expect(current.revision).toBe(revision);expect(current.canvas).toEqual(board.canvas);
  await page.screenshot({path:'.local/02813-board-control.png'});
  await page.locator('.desktop-rail').getByRole('button',{name:'Chats',exact:true}).click();await expect.poll(async()=>(await invoke('read_view_state')).views.length).toBe(0);
 }finally{await page.close();await client.close();host.stdin.end();await new Promise<void>(r=>{const timer=setTimeout(()=>{host.kill();r();},3000);host.once('exit',()=>{clearTimeout(timer);r();});});if(!path.resolve(temp).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected cleanup path');await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
});

test('chat replies have no provider label row and retain accessible authorship and copying',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();
 const messages=page.locator('.message.assistant');await expect(messages.first()).toBeVisible();await expect(messages.locator('.message-label')).toHaveCount(0);await expect(messages.locator('.claude-mark')).toHaveCount(0);
 const answer=page.locator('.message.assistant').filter({hasText:'The responsive layout is ready.'});await expect(answer).toHaveAttribute('aria-label','claude');await answer.hover();await answer.getByRole('button',{name:'Copy',exact:true}).last().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('The responsive layout is ready.');
 await page.screenshot({path:'.local/02813-chat-no-label.png'});
});
