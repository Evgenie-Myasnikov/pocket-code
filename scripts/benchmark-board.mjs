// Board speed benchmark: a real host, a production UI build and one project folder with a board file.
// It reads the board, saves it through the host API, opens it in Chrome and measures opening, pan, zoom and edits.
// The board in --root is changed by the save and edit scenarios: always point it at a copy, never at a working board.
//   npm run build
//   node scripts/benchmark-board.mjs --root <copy of a project with project-boards/board-*.json> [--dist dist] [--label name] [--out file.json] [--no-images] [--headed]
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';

const arg=name=>{const i=process.argv.indexOf('--'+name);return i<0?undefined:process.argv[i+1];};
if(!arg('root'))throw Error('Pass --root <copy of a project folder with a board>');
const hostDir=path.resolve(arg('host')||fileURLToPath(new URL('..',import.meta.url))),dist=path.resolve(arg('dist')||path.join(hostDir,'dist')),root=path.resolve(arg('root')),data=path.resolve(arg('data')||path.join(tmpdir(),'pocket-board-benchmark-data')),label=arg('label')||'run',out=arg('out');
const headed=process.argv.includes('--headed'),skipImages=process.argv.includes('--no-images');
const token=randomUUID();await mkdir(data,{recursive:true});await writeFile(path.join(data,'connection-key.txt'),token);

const host=spawn(process.execPath,['--import','tsx','tests/board-view-host.ts',root,data],{cwd:hostDir,env:{...process.env,BOARD_VIEW_TEST_TOKEN:token},windowsHide:true,stdio:['pipe','pipe','pipe']});
let hostErr='';host.stderr.on('data',c=>{hostErr+=c;});
const port=await new Promise((resolve,reject)=>{let text='';host.stdout.on('data',chunk=>{text+=chunk;if(text.includes('\n'))try{resolve(JSON.parse(text.split('\n')[0]).port);}catch{reject(Error('Invalid host response '+text));}});host.once('exit',code=>reject(Error('Host exited '+code+' '+hostErr.slice(-2000))));});
const api=`http://127.0.0.1:${port}/api`,auth={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const web=createServer(async(req,res)=>{let file=path.join(dist,decodeURIComponent(new URL(req.url,'http://x').pathname));try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{file=path.join(dist,'index.html');}
 try{const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise((resolve,reject)=>{web.once('error',reject);web.listen(5173,'127.0.0.1',resolve);});

const stats=values=>{const s=[...values].sort((a,b)=>a-b),q=p=>s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:0;return {n:s.length,p50:+q(.5).toFixed(1),p95:+q(.95).toFixed(1),p99:+q(.99).toFixed(1),max:+(s.at(-1)||0).toFixed(1)};};
const result={label,host:hostDir,dist};
async function timed(times,action){const values=[];for(let i=0;i<times;i++){const t=performance.now();await action(i);values.push(performance.now()-t);}return stats(values);}

// ---- Host API ----
const readBoard=async()=>(await (await fetch(api+'/project-board?root='+encodeURIComponent(root),{headers:auth})).json());
let first=performance.now();let board=(await readBoard()).board;result.hostReadCold=+(performance.now()-first).toFixed(1);
if(!board)throw Error('Board did not open: '+JSON.stringify(board));
result.board={notes:board.notes.length,items:board.canvas?.items.length||0,links:board.canvas?.links.length||0,images:board.notes.reduce((n,x)=>n+(x.images?.length||0),0),fileBytes:(await stat(path.join(root,'project-boards',board.repositoryFile))).size};
result.hostRead=await timed(15,readBoard);
result.hostReadBytes=Buffer.byteLength(JSON.stringify(await readBoard()));
let known='';result.hostLiveUnchanged=await timed(15,async()=>{const r=await (await fetch(api+'/project-board/live?'+new URLSearchParams({root,file:board.repositoryFile,...(known?{known}:{})}),{headers:auth})).json();known=r.version;});
result.hostSave=await timed(8,async i=>{const current=(await readBoard()).board,notes=current.notes.map(({owner,assigneeIds,...n})=>n);const canvas=structuredClone(current.canvas);const sticky=canvas.items.find(x=>x.kind==='sticky');sticky.x+=i%2?-8:8;
 const t=performance.now();const response=await fetch(api+'/project-board',{method:'POST',headers:auth,body:JSON.stringify({root,repositoryRevision:current.repositoryRevision,notes:current.notes,versions:current.versions,canvas})});if(!response.ok)throw Error('save failed '+response.status+' '+await response.text());await response.json();result.hostSaveOnly=[...(result.hostSaveOnly||[]),performance.now()-t];});
result.hostSaveOnly=stats(result.hostSaveOnly);

// ---- UI ----
const browser=await chromium.launch({headless:!headed,executablePath:process.env.POCKET_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage();
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
const delta=(a,b)=>({scriptMs:+((b.ScriptDuration-a.ScriptDuration)*1000).toFixed(0),layoutMs:+((b.LayoutDuration-a.LayoutDuration)*1000).toFixed(0),styleMs:+((b.RecalcStyleDuration-a.RecalcStyleDuration)*1000).toFixed(0),taskMs:+((b.TaskDuration-a.TaskDuration)*1000).toFixed(0)});
let imageRequests=0,imageBytes=0,imagePending=0,boardPosts=0,lastImageAt=0;
page.on('request',r=>{if(r.url().includes('/api/project-board/image'))imagePending++;});
page.on('requestfinished',async r=>{if(r.url().includes('/api/project-board/image')){imagePending--;imageRequests++;lastImageAt=Date.now();try{imageBytes+=(await r.sizes()).responseBodySize;}catch{}}if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/project-board')boardPosts++;});
page.on('requestfailed',r=>{if(r.url().includes('/api/project-board/image'))imagePending--;});
if(skipImages)await page.route('**/api/project-board/image?*',route=>route.fulfill({status:404,json:{error:'skipped'}}));
await page.addInitScript(({url,token})=>{sessionStorage.setItem('connection',JSON.stringify({url,token}));localStorage.setItem('pocket-code-language-v1','en');
 window.__frames=[];let last=performance.now();const tick=t=>{window.__frames.push(t-last);last=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
 window.__long=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__long.push(e.duration);}).observe({type:'longtask',buffered:true});}catch{}
},{url:`http://127.0.0.1:${port}`,token});
const frames=async()=>{const v=await page.evaluate(()=>{const f=window.__frames.slice(2),l=window.__long.slice();window.__frames=[];window.__long=[];return {f,l};});return {frame:stats(v.f),slowFrames:v.f.filter(x=>x>25).length,longTasks:v.l.length,longTaskMs:+v.l.reduce((a,b)=>a+b,0).toFixed(0)};};
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,0)))));
async function scenario(name,action){await settle();await frames();const before=await metrics(),t=performance.now();await action();await settle();const wall=performance.now()-t,after=await metrics();result[name]={wallMs:+wall.toFixed(0),...delta(before,after),...await frames()};}

await page.goto('http://127.0.0.1:5173');
const tabs=page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first();await tabs.waitFor({timeout:30000});
const target=tabs.getByRole('button',{name:'Board',exact:true});if(await target.count())await target.click();else{await tabs.getByRole('button',{name:/^More$/}).click();await page.getByRole('dialog',{name:/^More$/}).getByRole('button',{name:'Board',exact:true}).click();}
const card=page.locator('.board-index-item').first();await card.waitFor({timeout:30000});
const expected=result.board.items;
await scenario('open',async()=>{await card.click();await page.waitForFunction(n=>document.querySelectorAll('.whiteboard-item').length>=n,expected,{timeout:60000});});
result.open.domNodes=await page.evaluate(()=>document.querySelectorAll('.whiteboard *').length);
const waitImages=async(limit=180000)=>{const start=Date.now();while(Date.now()-start<limit){await page.waitForTimeout(250);if(imagePending<=0&&Date.now()-lastImageAt>1500)break;}return Date.now()-start;};
if(!skipImages){const t=Date.now();await waitImages();result.imagesInitial={ms:Date.now()-t-1500,requests:imageRequests,megabytes:+(imageBytes/1e6).toFixed(1)};}
const viewport=page.locator('.whiteboard-viewport'),box=await viewport.boundingBox();
const cx=box.x+box.width/2,cy=box.y+box.height/2;
async function pan(steps=90){await page.mouse.move(cx,cy);await page.mouse.down({button:'middle'});for(let i=1;i<=steps;i++){await page.mouse.move(cx+Math.sin(i/steps*Math.PI*2)*300,cy+Math.cos(i/steps*Math.PI*2)*200-200);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}await page.mouse.up({button:'middle'});}
async function zoom(steps=40){await page.mouse.move(cx,cy);for(let i=0;i<steps;i++){await page.keyboard.down('Control');await page.mouse.wheel(0,i<steps/2?-60:60);await page.keyboard.up('Control');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}}
await scenario('panAtOpenZoom',()=>pan());
await scenario('zoomAtOpenZoom',()=>zoom());
await scenario('fit',async()=>{await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await settle();});
if(!skipImages){const before={r:imageRequests,b:imageBytes},t=Date.now();await waitImages();result.imagesAfterFit={ms:Date.now()-t-1500,requests:imageRequests-before.r,megabytes:+((imageBytes-before.b)/1e6).toFixed(1)};}
await scenario('panFitted',()=>pan());
await scenario('zoomFitted',()=>zoom());
// Edit: nudge one sticky with the keyboard (saves the board each time), then drag a card.
await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await settle();
const sticky=page.locator('.whiteboard-item.wb-sticky .whiteboard-text').first();
const saved=async n=>{const start=Date.now();while(boardPosts<n){if(Date.now()-start>30000)throw Error('save did not finish');await page.waitForTimeout(5);}await page.waitForFunction(()=>document.querySelector('.work-boards')?.getAttribute('aria-busy')==='false',null,{timeout:30000});};
await sticky.focus();
const editTimes=[];let editMetrics;{await settle();await frames();const before=await metrics();for(let i=0;i<6;i++){const n=boardPosts,t=performance.now();await page.keyboard.press(i%2?'ArrowLeft':'ArrowRight');await saved(n+1);await settle();editTimes.push(performance.now()-t);}const after=await metrics();editMetrics=delta(before,after);}
result.editNudge={each:stats(editTimes),...editMetrics,...await frames()};
const cardItem=page.locator('.whiteboard-item.wb-card .whiteboard-text').first(),cb=await cardItem.boundingBox();
await scenario('editDragCard',async()=>{const n=boardPosts;await page.mouse.move(cb.x+cb.width/2,cb.y+8);await page.mouse.down();for(let i=1;i<=30;i++){await page.mouse.move(cb.x+cb.width/2+i*3,cb.y+8+i*2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}await page.mouse.up();await saved(n+1);});
result.heapMb=+((await metrics()).JSHeapUsedSize/1e6).toFixed(0);
// Reopen in the same browser profile: previews made once are kept on the device, so originals are not downloaded again.
if(!skipImages){const before={r:imageRequests,b:imageBytes};await page.reload();const again=page.locator('.mobile-tabbar:visible,.desktop-tabs:visible').first();await again.waitFor({timeout:30000});const board=again.getByRole('button',{name:'Board',exact:true});if(await board.count())await board.click();else{await again.getByRole('button',{name:/^More$/}).click();await page.getByRole('dialog',{name:/^More$/}).getByRole('button',{name:'Board',exact:true}).click();}
 const reopened=page.locator('.board-index-item').first();await reopened.waitFor({timeout:30000});await reopened.click();await page.waitForFunction(n=>document.querySelectorAll('.whiteboard-item').length>=n,expected,{timeout:60000});await page.waitForFunction(()=>document.querySelectorAll('.board-image-thumb img').length>0,null,{timeout:30000}).catch(()=>{});await waitImages(30000);
 result.imagesReopen={requests:imageRequests-before.r,megabytes:+((imageBytes-before.b)/1e6).toFixed(1),shown:await page.locator('.board-image-thumb img').count()};}
if(process.argv.includes('--screenshot'))await page.screenshot({path:path.join(path.dirname(out||'.local/x'),label+'.png')});
await browser.close();web.close();host.stdin.end();await new Promise(r=>{const timer=setTimeout(()=>{host.kill();r();},3000);host.once('exit',()=>{clearTimeout(timer);r();});});
console.log(JSON.stringify(result,null,1));if(out)await writeFile(out,JSON.stringify(result,null,1));
