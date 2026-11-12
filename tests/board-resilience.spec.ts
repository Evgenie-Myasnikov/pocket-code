import {test,expect,type Page} from '@playwright/test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {desktop} from './desktop-fixture';
import {file,longText,paragraph,brokenBoard} from './board-broken-fixture';
import {boardSnapshot,historyPath} from '../src/board-contract';

/** A real host on a synthetic project; the desktop fixture forwards every project-board call to it. */
async function open(page:Page,board:unknown){
 const temp=await mkdtemp(path.join(tmpdir(),'board-resilience-ui-')),root=path.join(temp,'project'),data=path.join(temp,'data'),token=randomUUID();
 await mkdir(path.join(root,'project-boards'),{recursive:true});await mkdir(data);await writeFile(path.join(data,'connection-key.txt'),token);await writeFile(path.join(root,'project-boards',file),JSON.stringify(board,null,2));
 const host=spawn(process.execPath,['--import','tsx','tests/board-view-host.ts',root,data],{env:{...process.env,BOARD_VIEW_TEST_TOKEN:token},windowsHide:true,stdio:['pipe','pipe','pipe']});host.stderr.on('data',()=>{});
 const port=await new Promise<number>((resolve,reject)=>{let text='';host.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n'))try{resolve(JSON.parse(text.split('\n')[0]).port);}catch{reject(Error('Invalid test host response'));}});host.once('exit',()=>reject(Error('Test host exited')));}),base=`http://127.0.0.1:${port}/api`;
 await page.exposeFunction('boardHostRequest',async(endpoint:string,input?:any)=>{const url=new URL(base+endpoint);url.searchParams.set('root',root);const response=await fetch(url,{method:input?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(input?{body:JSON.stringify({...input,root})}:{})});const value=await response.json();return response.ok?{value}:{error:value.error||'Host error',status:response.status};});
 await page.setViewportSize({width:1440,height:900});await desktop(page);
 await page.locator('.desktop-rail').getByRole('button',{name:'Board',exact:true}).click();await page.locator('.board-index-item').first().click();await expect(page.locator('.whiteboard-viewport')).toBeVisible();
 const stored=async()=>JSON.parse(await readFile(path.join(root,'project-boards',file),'utf8'));
 const close=async()=>{await page.close();host.stdin.end();await new Promise<void>(r=>{const timer=setTimeout(()=>{host.kill();r();},3000);host.once('exit',()=>{clearTimeout(timer);r();});});if(!path.resolve(temp).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unexpected cleanup path');await rm(temp,{recursive:true,force:true,maxRetries:10,retryDelay:200});};
 return {root,stored,close};
}
const note=(id:string,title:string,extra:Record<string,unknown>={})=>({id,title,description:'Synthetic card',branch:'',status:'ready',priority:'normal',x:200,y:160,dependencies:[],...extra});

test('a damaged board opens read-only with the reason, is repaired without losing text and can be rolled back',async({page})=>{
 test.setTimeout(90000);
 const {ids,board}=brokenBoard(),{root,stored,close}=await open(page,board);
 try{
  await expect(page.locator('.whiteboard-item')).toHaveCount(5);
  const health=page.locator('.board-health');
  await expect(health).toContainText('The board is read-only: 3 record(s) are outside the board format.');await expect(health).toContainText('Card «Long history»');
  await expect(page.locator('.whiteboard-item.wb-issue-error')).toHaveCount(3);await expect(page.locator(`[data-canvas-id="${ids.good}"]`)).not.toHaveClass(/wb-issue-error/);
  await health.getByRole('button',{name:'Details',exact:true}).click();
  await expect(health.locator('.board-health-list li')).toHaveCount(3);await expect(health).toContainText('description is 34,');await expect(health).toContainText('the limit is 20,000');await expect(health).toContainText('image caption is 170 characters; the limit is 160.');await expect(health).toContainText('priority "medium" is not allowed');
  // Read-only: no editor opens while the file is outside the format.
  await page.locator(`[data-canvas-id="${ids.sticky}"] .whiteboard-text`).dblclick();await expect(page.locator('.wb-editor')).toHaveCount(0);
  await page.screenshot({path:'.local/board-health-damaged.png'});
  await health.getByRole('button',{name:'Repair',exact:true}).click();
  await expect(health).toContainText('Repaired records: 3.');await expect(page.locator('.board-health-error')).toHaveCount(0);await expect(page.locator('.whiteboard-item.wb-issue-error')).toHaveCount(0);
  const repaired=boardSnapshot.parse(await stored());expect(repaired.notes.find(n=>n.id===ids.priority)!.priority).toBe('normal');
  const history=await readFile(path.join(root,historyPath(ids.long)),'utf8');for(const index of [0,20,59])expect(repaired.notes.find(n=>n.id===ids.long)!.description.includes(paragraph(index))||history.includes(paragraph(index))).toBe(true);
  expect(longText.length).toBeGreaterThan(20000);
  // Editing works again.
  await page.locator(`[data-canvas-id="${ids.sticky}"] .whiteboard-text`).dblclick();await page.locator('.wb-editor textarea').first().fill('Edited after repair');await page.keyboard.press('Control+Enter');
  await expect.poll(async()=>(await stored()).canvas.items.find((item:any)=>item.id===ids.sticky).text).toBe('Edited after repair');
  // A direct file edit that breaks JSON: the last good cards stay visible and the board can be rolled back.
  await writeFile(path.join(root,'project-boards',file),'{"format":"pocket-code-board", broken');
  await expect(health).toContainText('The board file is damaged. Showing the last good snapshot',{timeout:15000});await expect(page.locator('.whiteboard-item')).toHaveCount(5);
  await expect(page.locator(`[data-canvas-id="${ids.sticky}"]`)).toContainText('Edited after repair');
  await health.getByRole('button',{name:'Restore…',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Restore board',exact:true});await expect(dialog.locator('.board-restore-list li').first()).toBeVisible();await page.screenshot({path:'.local/board-health-restore.png'});
  await dialog.getByRole('button',{name:'Restore',exact:true}).click();
  await expect(page.locator('.board-health-error')).toHaveCount(0);await expect(health).toContainText('The board was restored from a saved snapshot.');
  expect(boardSnapshot.parse(await stored()).canvas!.items.find(item=>item.id===ids.sticky)!.text).toBe('Edited after repair');
 }finally{await close();}
});

test('a refused write names the card and the limit; a card near its limit is flagged before that',async({page})=>{
 const near=randomUUID(),other=randomUUID(),{stored,close}=await open(page,{format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[note(near,'Almost full',{description:'d'.repeat(18600)}),note(other,'Plain card',{x:600})]});
 try{
  await expect(page.locator('.board-health-warning')).toContainText('Close to a limit: 1');await expect(page.locator(`[data-canvas-id="${near}"]`)).toHaveClass(/wb-issue-warning/);
  await page.locator('.board-health').getByRole('button',{name:'Details',exact:true}).click();await expect(page.locator('.board-health-list')).toContainText('The card description uses 18,600 of 20,000.');
  // Warnings do not block editing; the editor counts characters near the limit.
  await page.locator(`[data-canvas-id="${near}"] .whiteboard-text`).dblclick();await expect(page.locator('.wb-editor-count')).toHaveText('18,600 / 20,000');await page.keyboard.press('Escape');
  // The host is the last line of defence: a title over the limit is refused with the card and the numbers.
  const refused=await page.evaluate(async({other})=>{const w=window as any,current=(await w.boardHostRequest('/project-board')).value.board;return w.boardHostRequest('/project-board',{repositoryRevision:current.repositoryRevision,notes:current.notes.map((n:any)=>n.id===other?{...n,title:'t'.repeat(161)}:n),versions:current.versions});},{other});
  expect(refused.status).toBe(400);expect(refused.error).toContain('Card "Plain card"');expect(refused.error).toContain('title is 161 characters; the limit is 160.');
  expect((await stored()).notes[1].title).toBe('Plain card');
 }finally{await close();}
});

test('a bar chart is drawn from stored data, edited as a table and created from the canvas menu',async({page})=>{
 const card=randomUUID(),chart=randomUUID();
 const {stored,close}=await open(page,{format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[note(card,'Frame pacing')],canvas:{version:1,items:[{id:chart,kind:'chart',text:'Frame time, ms',x:560,y:140,width:560,height:360,color:'sand',chart:{type:'bar',categories:['P50','P95','P99'],series:[{name:'Before',values:[9.8,16.2,24.5]},{name:'After',values:[6.1,9.4,13]}],unit:'ms',lowerIsBetter:true,reference:{value:16.7,label:'60 fps'}}}],links:[]}});
 try{
  const node=page.locator(`[data-canvas-id="${chart}"]`);
  await expect(node.locator('.wb-chart-bar')).toHaveCount(6);await expect(node.locator('.wb-chart-legend li')).toHaveText(['Before','After']);
  await expect(node.locator('.wb-chart-value')).toHaveText(['9.8','6.1','16.2','9.4','24.5','13']);await expect(node.locator('.wb-chart-delta text')).toHaveText(['−38%','−42%','−47%']);await expect(node.locator('.wb-chart-delta-good')).toHaveCount(3);
  await expect(node.locator('.wb-chart-reference-label')).toHaveText('60 fps · 16.7');
  // Bars grow from one baseline and never exceed 24 px; taller values are taller bars.
  const bars=await node.locator('.wb-chart-bar').evaluateAll(list=>list.map(bar=>{const r=bar.getBoundingClientRect();return {width:r.width,height:r.height,bottom:r.bottom};}));
  expect(bars.every(bar=>bar.width<=24.5&&Math.abs(bar.bottom-bars[0].bottom)<1)).toBe(true);expect(bars[4].height).toBeGreaterThan(bars[2].height);expect(bars[2].height).toBeGreaterThan(bars[0].height);expect(bars[0].height).toBeGreaterThan(bars[1].height);
  await node.locator('.wb-chart-hit').nth(4).hover();await expect(node.locator('.wb-chart-tooltip')).toContainText('24.5 ms');await expect(node.locator('.wb-chart-tooltip')).toContainText('Before · P99');
  await page.screenshot({path:'.local/board-chart-dark.png'});
  await node.locator('.wb-chart-body').dblclick();const editor=page.getByRole('dialog',{name:'Chart data',exact:true});await expect(editor).toBeVisible();
  await editor.getByLabel('After · P99',{exact:true}).fill('11,5');await editor.getByLabel('Unit',{exact:true}).fill('ms');await editor.getByRole('button',{name:'Save',exact:true}).click();
  await expect(editor).toHaveCount(0);await expect.poll(async()=>(await stored()).canvas.items.find((item:any)=>item.id===chart).chart.series[1].values[2]).toBe(11.5);await expect(node.locator('.wb-chart-delta text').nth(2)).toHaveText('−53%');
  // New chart from the canvas menu opens its data table with a before/after template.
  await page.locator('.whiteboard-viewport').click({button:'right',position:{x:300,y:600}});await page.getByRole('menuitem',{name:'Chart',exact:true}).click();
  const created=page.getByRole('dialog',{name:'Chart data',exact:true});await expect(created).toBeVisible();await created.getByLabel('Title',{exact:true}).fill('GPU passes');await created.getByLabel('Stack the series').check();await created.getByLabel('Before · P50',{exact:true}).fill('4');await created.getByLabel('After · P50',{exact:true}).fill('2.5');await created.getByRole('button',{name:'Save',exact:true}).click();
  await expect(created).toHaveCount(0);await expect.poll(async()=>(await stored()).canvas.items.filter((item:any)=>item.text==='GPU passes').length).toBe(1);
  const second=(await stored()).canvas.items.find((item:any)=>item.text==='GPU passes');expect(second.chart.stacked).toBe(true);expect(second.chart.series[0].values[0]).toBe(4);boardSnapshot.parse(await stored());
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await page.mouse.move(5,5);await page.screenshot({path:'.local/board-chart-light.png'});
 }finally{await close();}
});

test('board search finds text and status; a checklist is edited in the card sheet and counted on the card',async({page})=>{
 const a=randomUUID(),b=randomUUID(),sticky=randomUUID();
 const {stored,close}=await open(page,{format:'pocket-code-board',version:1,name:'Synthetic board',versions:[],notes:[note(a,'Water rendering',{status:'working',statusHistory:[{status:'working',at:new Date(Date.now()-3*86400000).toISOString().slice(0,19)+'Z'}]}),note(b,'Terrain shading',{x:600,description:'Uses the water depth buffer'})],canvas:{version:1,items:[{id:sticky,kind:'sticky',text:'Far away note about water',x:9000,y:7000,width:240,height:160,color:'mint'}],links:[]}});
 try{
  // Hidden connection ports no longer exist on every object.
  await expect(page.locator('.wb-port')).toHaveCount(0);expect(await page.locator('.whiteboard-world').getAttribute('style')).not.toContain('--wb-handle-scale');
  await page.locator('.whiteboard-viewport').focus();await page.keyboard.press('Control+f');
  const finder=page.getByRole('search',{name:'Find on board',exact:true});await finder.getByLabel('Text to find',{exact:true}).fill('water');
  await expect(page.locator('.whiteboard-item.wb-found')).toHaveCount(3);await expect(finder.locator('output')).toHaveText('3');
  await page.keyboard.press('Enter');await expect(finder.locator('output')).toHaveText('1 / 3');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await expect(finder.locator('output')).toHaveText('3 / 3');
  // The third match is far off-screen: stepping to it moves the camera there.
  await expect(page.locator(`[data-canvas-id="${sticky}"]`)).toBeInViewport();
  await finder.getByLabel('Card status',{exact:true}).selectOption('working');await expect(page.locator('.whiteboard-item.wb-found')).toHaveCount(1);await expect(page.locator(`[data-canvas-id="${a}"]`)).toHaveClass(/wb-found/);
  await page.screenshot({path:'.local/board-finder.png'});await page.keyboard.press('Escape');await expect(finder).toHaveCount(0);await expect(page.locator('.wb-found')).toHaveCount(0);
  // Status age comes from the host-recorded history.
  await expect(page.locator(`[data-canvas-id="${a}"] .task-age`)).toHaveText('3 d');
  await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await page.locator(`[data-canvas-id="${b}"] .whiteboard-text`).click();await page.getByRole('button',{name:'Card properties',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'Note details',exact:true});await sheet.getByRole('button',{name:'Add criterion',exact:true}).click();await sheet.getByLabel('Criterion 1',{exact:true}).fill('Frame time is measured');await sheet.getByRole('button',{name:'Add criterion',exact:true}).click();await sheet.getByLabel('Criterion 2',{exact:true}).fill('Screenshots attached');await sheet.locator('.board-checklist li').first().getByRole('checkbox').check();
  await sheet.getByRole('combobox',{name:'Status',exact:true}).selectOption('review');await page.screenshot({path:'.local/board-checklist.png'});await sheet.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator(`[data-canvas-id="${b}"] .task-checklist`)).toHaveText('☑ 1/2');await expect(page.locator(`[data-canvas-id="${b}"] .task-age`)).toHaveText('today');
  const saved=(await stored()).notes.find((n:any)=>n.id===b);expect(saved.checklist).toEqual([{text:'Frame time is measured',done:true},{text:'Screenshots attached',done:false}]);expect(saved.statusHistory.at(-1).status).toBe('review');
 }finally{await close();}
});
