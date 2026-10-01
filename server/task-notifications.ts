import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import type {JiraService} from './jira';
export type TaskSnapshot={key:string;summary:string;status:string;updated:string;commentCount?:number};
export type TaskNotification={id:string;provider:string;scope:string;sourceLabel:string;key:string;summary:string;status:string;previousStatus?:string;kind:'updated'|'status'|'comment';at:number;readAt?:number};
export interface TaskNotificationProvider {
 id:string;name:string;
 scopes():Promise<{id:string;name:string}[]>;
 page(scope:string,cursor?:string):Promise<{items:TaskSnapshot[];next:string|null}>;
}
export function jiraNotifications(jira:JiraService):TaskNotificationProvider{return{
 id:'jira',name:'Jira',
 async scopes(){const status=await jira.status();if((status as {error?:string}).error)throw new Error('Jira is unavailable');return status.connected?status.sites.map(s=>({id:s.id,name:s.name})):[];},
 async page(scope,cursor){const result=await jira.issues(scope,cursor,{notifications:true});return{items:result.issues.map(({key,summary,status,updated,commentCount})=>({key,summary,status,updated,...(commentCount!==undefined?{commentCount}:{})})),next:result.next};}
};}
const snapshotSchema=z.object({key:z.string().max(150),summary:z.string().max(1000),status:z.string().max(200),updated:z.string().max(100),commentCount:z.number().nonnegative().optional()});
const notificationSchema=z.object({id:z.string().max(100),provider:z.string().max(100),scope:z.string().max(200),sourceLabel:z.string().max(300),key:z.string().max(150),summary:z.string().max(1000),status:z.string().max(200),previousStatus:z.string().max(200).optional(),kind:z.enum(['updated','status','comment']),at:z.number(),readAt:z.number().optional()});
const scopeSchema=z.object({checkpoint:z.number(),known:z.record(z.string(),snapshotSchema),cursor:z.string().max(4000).optional(),scanMax:z.number().optional()});
const storeSchema=z.object({version:z.literal(1),scopes:z.record(z.string(),scopeSchema),items:z.array(notificationSchema).max(300)});
type Store=z.infer<typeof storeSchema>;
const stamp=(task:TaskSnapshot)=>Date.parse(task.updated)||0;
const signature=(task:TaskSnapshot)=>JSON.stringify([task.key,task.updated,task.status,task.summary,task.commentCount]);
export class TaskNotifications {
 private data:Store={version:1,scopes:{},items:[]};private ready:Promise<void>;private loadError=false;private writes=Promise.resolve();
 private work?:Promise<void>;private busy=false;private attempted=0;private generation=0;private checkedAt=0;private errors:string[]=[];
 constructor(private file:string,private providers:TaskNotificationProvider[],private now=Date.now){
  this.ready=readFile(file,'utf8').then(raw=>{if(raw.length>12000000)throw Error('Inbox too large');this.data=storeSchema.parse(JSON.parse(raw));}).catch(error=>{if(error.code!=='ENOENT')this.loadError=true;});
 }
 private save(){const serialized=JSON.stringify(this.data);this.writes=this.writes.catch(()=>{}).then(async()=>{await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',serialized,{mode:0o600});await rename(this.file+'.tmp',this.file);});return this.writes;}
 async view(){await this.ready;if(this.loadError)return{items:[],unread:0,loading:false,checkedAt:0,error:'Notification history could not be read.'};
  if(!this.busy&&this.now()-this.attempted>=60000)void this.refresh();
  return{items:this.data.items,unread:this.data.items.filter(i=>!i.readAt).length,loading:Boolean(this.work)||this.busy,checkedAt:this.checkedAt,error:this.errors.length?'Task updates could not be refreshed. Saved notifications remain available.':'',sources:this.providers.map(p=>({id:p.id,name:p.name}))};
 }
 async read(ids:string[]){await this.ready;if(this.loadError)throw Error('Notification history could not be read.');const requested=new Set(ids);this.data.items=this.data.items.map(item=>requested.has(item.id)&&!item.readAt?{...item,readAt:this.now()}:item);await this.save();}
 async clear(provider:string){await this.ready;this.generation++;this.data.items=this.data.items.filter(i=>i.provider!==provider);for(const key of Object.keys(this.data.scopes))if(key.startsWith(provider+':'))delete this.data.scopes[key];this.attempted=this.now();await this.save();}
 refresh(){if(this.work)return this.work;this.work=this.poll().finally(()=>{this.work=undefined;});return this.work;}
 private async poll(){await this.ready;if(this.busy||this.loadError)return;this.busy=true;this.attempted=this.now();const generation=this.generation;this.errors=[];
  try{for(const provider of this.providers){try{
    const scopes=await provider.scopes();if(generation!==this.generation)return;
    const allowed=new Set(scopes.map(s=>provider.id+':'+s.id));
    this.data.items=this.data.items.filter(i=>i.provider!==provider.id||allowed.has(provider.id+':'+i.scope));
    for(const key of Object.keys(this.data.scopes))if(key.startsWith(provider.id+':')&&!allowed.has(key))delete this.data.scopes[key];
    for(const scope of scopes){
      const scopeKey=provider.id+':'+scope.id;let state=this.data.scopes[scopeKey];const cursors=new Set<string>();
      for(let page=0;page<5;page++){
        let result:Awaited<ReturnType<TaskNotificationProvider['page']>>;try{result=await provider.page(scope.id,state?.cursor);}catch(error){if(state)delete state.cursor;throw error;}if(generation!==this.generation)return;
        const tasks=result.items.map(item=>snapshotSchema.parse(item));
        if(!state){this.data.scopes[scopeKey]={checkpoint:Math.max(0,...tasks.map(stamp)),known:Object.fromEntries(tasks.map(i=>[i.key,i]))};break;}
        let reachedBoundary=false;state.scanMax=Math.max(state.scanMax||state.checkpoint,...tasks.map(stamp));
        for(const item of tasks){const previous=state.known[item.key],at=stamp(item);if(at<state.checkpoint)reachedBoundary=true;
          if((at>state.checkpoint||previous&&at>=stamp(previous)&&signature(previous)!==signature(item))&&(!previous||signature(previous)!==signature(item))){
            const id=createHash('sha256').update(provider.id+'\0'+scope.id+'\0'+signature(item)).digest('hex');
            if(!this.data.items.some(i=>i.id===id))this.data.items.push({id,provider:provider.id,scope:scope.id,sourceLabel:provider.name+' / '+scope.name,key:item.key,summary:item.summary,status:item.status,...(previous&&previous.status!==item.status?{previousStatus:previous.status}:{}),kind:previous&&item.commentCount!==undefined&&previous.commentCount!==undefined&&item.commentCount>previous.commentCount?'comment':previous&&previous.status!==item.status?'status':'updated',at:at||this.now()});
          }
          if(!previous||at>=stamp(previous))state.known[item.key]=item;
        }
        this.data.items.sort((a,b)=>b.at-a.at);this.data.items=this.data.items.slice(0,300);
        state.known=Object.fromEntries(Object.entries(state.known).sort((a,b)=>stamp(b[1])-stamp(a[1])).slice(0,5000));
        if(!result.next||reachedBoundary){state.checkpoint=state.scanMax;delete state.cursor;delete state.scanMax;break;}
        if(cursors.has(result.next)||result.next===state.cursor){delete state.cursor;throw Error('Repeated task page');}cursors.add(result.next);state.cursor=result.next;
      }
    }
  }catch{if(generation!==this.generation)return;this.errors.push(provider.id);}}
  if(generation===this.generation){await this.save();this.checkedAt=this.now();}
  }catch{this.errors.push('storage');}finally{this.busy=false;}
 }
}
