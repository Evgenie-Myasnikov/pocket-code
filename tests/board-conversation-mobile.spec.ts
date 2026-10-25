import {test,expect,type Page} from '@playwright/test';
import {openSection} from './chat-navigation';
const root='C:\\Synthetic\\BoardProject',boardId='11111111-1111-4111-8111-111111111111';
async function openBoardChat(page:Page){await openSection(page,'Board');const card=page.locator('.board-index-item');if(await card.count())await card.first().click();await page.locator('.board-header').getByRole('button',{name:'Chat',exact:true}).click();await expect(page.getByLabel('Message Claude',{exact:true})).toBeVisible();}
test('mobile board chat remains pinned after leaving and restarting the app',async({page})=>{
 await page.setViewportSize({width:390,height:844});let job:any,missing=false;
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'synthetic-board-token'}));localStorage.setItem('pocket-code-language-v1','en');});
 await page.route('**/api/**',route=>{const url=new URL(route.request().url()),p=url.pathname.slice(4);
  if(p==='/health')return route.fulfill({json:{name:'Synthetic board host',roots:[root],version:'0.28.7',protocol:1}});
  if(p==='/providers')return route.fulfill({json:[{id:'claude',available:true,authenticated:true,models:[]}]});
  if(p==='/projects')return route.fulfill({json:[root]});
  if(p==='/workspaces')return route.fulfill({json:{host:true,canManageWorkspaces:true,workspaces:[],boards:[]}});
  if(p==='/project-board')return route.fulfill({json:{board:{id:boardId,name:'Synthetic board',root,repositoryFile:'board-'+boardId+'.json',repositoryRevision:'a'.repeat(64),revision:0,versionSource:'planned',notes:[],versions:[],branches:[]},canEdit:true}});
  if(p==='/sessions')return route.fulfill({json:job?[{sessionId:job.sessionId,summary:'Synthetic board conversation',cwd:root,lastModified:1}]:[]});
  if(p==='/jobs'&&route.request().method()==='POST'){const body=route.request().postDataJSON();job={...body,id:'synthetic-board-job',provider:'claude',sessionId:'synthetic-board-session',cwd:root,status:'done',messages:[{id:'answer',role:'assistant',blocks:[{type:'text',text:'Saved board answer'}]}],partial:'',approvals:[],startedAt:1,revision:1,baseMessageCount:0};return route.fulfill({json:job});}
  if(p==='/jobs')return route.fulfill({json:job?[job]:[]});
  if(p.startsWith('/jobs/')&&missing)return route.fulfill({status:404,json:{error:'Saved chat unavailable'}});
  if(p.startsWith('/jobs/'))return job?route.fulfill({json:job}):route.fulfill({status:404,json:{error:'Not found'}});
  if(p.endsWith('/messages')&&missing)return route.fulfill({status:404,json:{error:'Saved chat unavailable'}});
  if(p.endsWith('/messages'))return route.fulfill({json:{messages:job?.messages||[],previous:null,next:null}});
  if(p==='/uploads')return route.fulfill({json:{id:'synthetic-context',name:'Board context.txt',size:20}});
  if(p==='/updates/latest')return route.fulfill({json:{enabled:false}});
  if(p==='/activity')return route.fulfill({json:[]});
  return route.fulfill({status:404,json:{error:'Synthetic endpoint unavailable'}});
 });
 await page.goto('http://127.0.0.1:5173');await openBoardChat(page);await page.getByLabel('Message Claude',{exact:true}).fill('Synthetic board planning');await page.getByRole('button',{name:'Send message',exact:true}).click();
 const saved=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('pocket-board-conversation-v1:')).map(k=>JSON.parse(localStorage.getItem(k)!))[0]);
 await expect.poll(async()=>(await saved())?.sessionId).toBe('synthetic-board-session');const original=await saved();
 await page.getByRole('button',{name:'Back to chats',exact:true}).click();await openBoardChat(page);expect((await saved()).generation).toBe(original.generation);await expect(page.getByLabel('Message Claude',{exact:true})).toHaveValue('');
 await page.reload();await openBoardChat(page);expect((await saved()).sessionId).toBe(original.sessionId);await expect(page.getByText('Saved board answer',{exact:true}).first()).toBeVisible();
 missing=true;await page.getByRole('button',{name:'Back to chats',exact:true}).click();await openBoardChat(page);await expect(page.getByLabel('Message Claude',{exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Send message',exact:true})).toBeDisabled();expect((await saved()).sessionId).toBe(original.sessionId);
 await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'New board chat',exact:true}).click();await expect.poll(async()=>(await saved()).generation).not.toBe(original.generation);expect((await saved()).sessionId).toBeUndefined();
});
