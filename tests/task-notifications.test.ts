import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {TaskNotifications,jiraNotifications,type TaskNotificationProvider,type TaskSnapshot} from '../server/task-notifications';
const task=(key:string,time:number,status='Open',commentCount=0):TaskSnapshot=>({key,summary:'Synthetic task',status,updated:new Date(time).toISOString(),commentCount});
async function fixture(){const dir=await mkdtemp(path.join(tmpdir(),'pocket-inbox-'));let tasks=[task('DEMO-1',1000)],fail=false,enabled=true,calls=0;const provider:TaskNotificationProvider={id:'jira',name:'Jira',scopes:async()=>{if(fail)throw Error('Offline');return enabled?[{id:'site',name:'Test site'}]:[];},page:async()=>{calls++;return{items:tasks,next:null};}};const file=path.join(dir,'notifications.json');const inbox=new TaskNotifications(file,[provider]);return{dir,file,inbox,provider,set:(value:TaskSnapshot[])=>tasks=value,fail:()=>fail=true,disable:()=>enabled=false,calls:()=>calls};}
test('notifications baseline is quiet; updates/status/comments deduplicate, persist and read independently',async()=>{
 const f=await fixture();try{await f.inbox.refresh();assert.equal((await f.inbox.view()).unread,0);
 f.set([task('DEMO-1',2000,'In Progress')]);await f.inbox.refresh();let view=await f.inbox.view();assert.equal(view.unread,1);assert.equal(view.items[0].kind,'status');assert.equal(view.items[0].previousStatus,'Open');
 await f.inbox.refresh();assert.equal((await f.inbox.view()).items.length,1);const oldId=view.items[0].id;
 f.set([task('DEMO-1',3000,'In Progress',1)]);await f.inbox.refresh();view=await f.inbox.view();assert.equal(view.items[0].kind,'comment');assert.equal(view.unread,2);
 await f.inbox.read([oldId]);assert.equal((await f.inbox.view()).unread,1);const restored=new TaskNotifications(f.file,[f.provider]);assert.equal((await restored.view()).unread,1);
 await restored.refresh();assert.equal((await restored.view()).unread,1);await f.inbox.clear('jira');assert.equal((await f.inbox.view()).items.length,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('transient provider failures retain unread history; confirmed disconnect removes it',async()=>{
 const f=await fixture();try{await f.inbox.refresh();f.set([task('DEMO-1',2000)]);await f.inbox.refresh();f.fail();await f.inbox.refresh();const view=await f.inbox.view();assert.equal(view.unread,1);assert.ok(view.error);
 const clean=new TaskNotifications(f.file,[{...f.provider,scopes:async()=>[]}]);await clean.refresh();assert.equal((await clean.view()).items.length,0);
 }finally{await rm(f.dir,{recursive:true,force:true});}
});
test('provider-neutral scopes do not mix issue keys; pagination resumes without dropping changes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'pocket-inbox-pages-'));let baseline=true;const page:TaskNotificationProvider['page']=async(_scope,cursor)=>{if(baseline)return{items:[task('D-0',1000)],next:null};const n=Number(cursor||'0');return{items:[task('D-'+n,9000-n*1000)],next:n<7?String(n+1):null};};
 const p:TaskNotificationProvider={id:'jira',name:'Jira',scopes:async()=>[{id:'one',name:'One'}],page};const other={...p,id:'other',name:'Other'};const inbox=new TaskNotifications(path.join(dir,'inbox.json'),[p,other]);
 try{await inbox.refresh();baseline=false;await inbox.refresh();assert.equal((await inbox.view()).items.length,10);await inbox.refresh();const view=await inbox.view();assert.equal(view.items.length,16);assert.equal(new Set(view.items.map(i=>i.id)).size,16);assert.deepEqual(new Set(view.items.map(i=>i.provider)),new Set(['jira','other']));}finally{await rm(dir,{recursive:true,force:true});}
});
test('disconnect during an in-flight read cannot repopulate the inbox',async()=>{
 const f=await fixture();try{await f.inbox.refresh();let release!:(v:any)=>void;f.provider.page=()=>new Promise(resolve=>{release=resolve;});const work=f.inbox.refresh();while(!release)await new Promise(r=>setTimeout(r,1));await f.inbox.clear('jira');release({items:[task('DEMO-1',2000)],next:null});await work;assert.equal((await f.inbox.view()).items.length,0);}finally{await rm(f.dir,{recursive:true,force:true});}
});
test('Jira notification adapter requests compact fields and never mutates Jira',async()=>{
 const calls:any[]=[];const adapter=jiraNotifications({status:async()=>({connected:true,sites:[{id:'site',name:'Example',url:'https://example.atlassian.net'}]}),issues:async(...args:any[])=>{calls.push(args);return{issues:[{...task('D-1',1000),description:'not retained',url:'',priority:''}],next:null};}} as any);
 assert.equal((await adapter.scopes())[0].id,'site');const result=await adapter.page('site');assert.equal((result.items[0] as any).description,undefined);assert.deepEqual(calls[0],['site',undefined,{notifications:true}]);
});
