import {readProjectRoadmap} from './project-roadmap.js';
import {boardExample,pocketCodeExample} from './board-example.js';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import type {Express} from 'express';
import {allowedPath,HttpError} from './security.js';

const id=z.string().uuid(),name=z.string().trim().min(1).max(160);
const note=z.object({id,title:name,description:z.string().max(20000),branch:z.string().max(300),status:z.enum(['idea','questions','ready','working','review','done']),owner:z.string().max(160),assigneeId:z.string().max(200).optional(),assigneeIds:z.array(z.string().min(1).max(200)).max(100).optional(),priority:z.enum(['critical','high','normal','low']).optional(),x:z.number().min(0).max(20000),y:z.number().min(0).max(20000),dependencies:z.array(id).max(100),chat:z.object({provider:z.enum(['claude','codex','copilot']),sessionId:z.string().max(200)}).optional()});
const board=z.object({id,workspaceId:id.optional(),name,root:z.string(),revision:z.number().int().nonnegative(),versionSource:z.enum(['planned','git']).default('git'),source:z.literal('project-changelog').optional(),notes:z.array(note).max(500),versions:z.array(z.string().min(1).max(300)).max(40).default([])});
const role=z.enum(['host','viewer','developer','reviewer','qa']);
const member=z.object({id,name,role,tokenHash:z.string(),needsName:z.boolean().optional()});
const workspace=z.object({id,name,roots:z.array(z.string()).max(100),password:z.string().default(''),invite:z.object({hash:z.string(),role}).optional(),members:z.array(member).default([]),hostPeople:z.array(z.object({id:z.string(),name})).default([])});
const invitation=z.object({role:z.enum(['host','viewer','developer','reviewer','qa']).default('host'),workspaceId:id.nullish().transform(value=>value||undefined)});
const database=z.object({workspaces:z.array(workspace),boards:z.array(board),invitation:invitation.default({role:'host',workspaceId:undefined})});
export type BoardNote=z.infer<typeof note>;
export type ProjectBoard=z.infer<typeof board>;
export type ProjectWorkspace=Omit<z.infer<typeof workspace>,'password'|'invite'|'members'|'hostPeople'>&{role:'host'|z.infer<typeof role>;me?:{id:string;name:string;needsName:boolean};people?:{id:string;name:string;role:string}[];members?:{id:string;name:string;role:z.infer<typeof role>}[]};
type Data=z.infer<typeof database>;

// Private host state; serialized, atomic writes and optimistic board revisions protect two devices.
export class BoardStore{
  private data:Data={workspaces:[],boards:[],invitation:{role:'host',workspaceId:undefined}};private queue=Promise.resolve();
  constructor(private file:string){}
  async load(){try{this.data=database.parse(JSON.parse(await readFile(this.file,'utf8')));}catch(e:any){if(e.code!=='ENOENT')throw e;}return this;}
  snapshot(){return structuredClone(this.data);}
  workspaces(){return structuredClone(this.data.workspaces);}
  invitation(){return {...this.data.invitation,workspaceId:this.data.invitation.workspaceId||this.data.workspaces.at(-1)?.id};}
  getBoard(id:string){const found=this.data.boards.find(b=>b.id===id);return found?structuredClone(found):undefined;}
  boardList(){return this.data.boards.map(({id,workspaceId,name,root,notes})=>({id,workspaceId,name,root,noteCount:notes.length}));}
  mutate<T>(change:(data:Data)=>T|Promise<T>):Promise<T>{const run=this.queue.then(async()=>{const next=this.snapshot(),result=await change(next);database.parse(next);await mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,this.file);this.data=next;return structuredClone(result);});this.queue=run.then(()=>{},()=>{});return run;}
  save(id:string,revision:number,notes:BoardNote[],versions:string[]=[]){return this.mutate(data=>{const found=data.boards.find(b=>b.id===id);if(!found)throw new HttpError(404,'Board not found');if(found.revision!==revision)throw new HttpError(409,'This board changed on another device. Reload before saving.');validateDependencies(notes);found.notes=notes;found.versions=[...new Set(versions)];found.revision++;return found;});}
}
export function validateDependencies(notes:BoardNote[]){
  const map=new Map(notes.map(n=>[n.id,n]));if(map.size!==notes.length)throw new HttpError(400,'Duplicate note');
  const seen=new Set<string>(),active=new Set<string>();
  function visit(id:string){if(active.has(id))throw new HttpError(400,'Dependencies cannot form a cycle');if(seen.has(id))return;const n=map.get(id);if(!n)throw new HttpError(400,'Dependency not found');active.add(id);for(const dep of n.dependencies)visit(dep);active.delete(id);seen.add(id);}
  for(const n of notes)visit(n.id);
}
const exec=promisify(execFile);
export const workspaceRequest=new AsyncLocalStorage<{workspaceId:string;memberId:string}>();
function hashPassword(value:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(value,salt,64).toString('hex');}
const tokenHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function boardBranches(root:string):Promise<{branches:string[];error?:string}>{
  try{const options={cwd:root,windowsHide:true,timeout:10000,maxBuffer:1024*1024};const {stdout:top}=await exec('git',['rev-parse','--show-toplevel'],options);if(path.resolve(top.trim()).toLowerCase()!==path.resolve(root).toLowerCase())return {branches:[],error:'Select the Git repository root to read its branches.'};const {stdout}=await exec('git',['for-each-ref','--format=%(refname:short)','refs/heads','refs/remotes'],options);return {branches:[...new Set(stdout.trim().split(/\r?\n/).filter(v=>v&&!v.endsWith('/HEAD')))].sort()};}catch{return {branches:[],error:'Git branches are unavailable for this folder.'};}
}
export async function createWorkspaceAccess(file:string){
  const store=await new BoardStore(file).load();
  function identity(token:string){const hash=tokenHash(token);for(const ws of store.workspaces()){const person=ws.members.find(m=>m.tokenHash===hash);if(person)return {workspaceId:ws.id,memberId:person.id};}return undefined;}
  function current(){const ctx=workspaceRequest.getStore();if(!ctx)return undefined;const ws=store.workspaces().find(w=>w.id===ctx.workspaceId);const person=ws?.members.find(m=>m.id===ctx.memberId);if(!ws||!person)throw new HttpError(401,'Workspace access revoked');return {ws,person};}
  function catalog(hostId='host',boundWorkspaceId?:string){const ctx=current();return {host:!ctx,activeWorkspaceId:ctx?.ws.id||boundWorkspaceId||store.invitation().workspaceId,workspaces:store.workspaces().filter(w=>ctx?w.id===ctx.ws.id:!boundWorkspaceId||w.id===boundWorkspaceId).map(w=>({id:w.id,name:w.name,roots:w.roots,role:ctx?ctx.person.role:'host',me:ctx?{id:ctx.person.id,name:ctx.person.name,needsName:!!ctx.person.needsName}:{id:hostId,name:w.hostPeople.find(p=>p.id===hostId)?.name||'',needsName:!w.hostPeople.some(p=>p.id===hostId)},people:[...w.hostPeople.map(p=>({...p,role:'host'})),...w.members.filter(m=>!m.needsName).map(({id,name,role})=>({id,name,role}))],...(!ctx?{members:w.members.map(({tokenHash,...m})=>m)}:{})})),boards:store.boardList().filter(b=>ctx?b.workspaceId===ctx.ws.id:!boundWorkspaceId||b.workspaceId===boundWorkspaceId)};}
  const attempts=new Map<string,{at:number;count:number}>();
  function publicLogin(app:Express){app.post('/api/workspace-login',async(req,res)=>{const input=z.object({name,password:z.string().min(1).max(256),displayName:name}).parse(req.body);const key=req.ip||'unknown',now=Date.now();let attempt=attempts.get(key);if(!attempt||now-attempt.at>60000){attempt={at:now,count:0};if(attempts.size>1000)attempts.clear();attempts.set(key,attempt);}if(++attempt.count>5)throw new HttpError(429,'Too many attempts. Try again in a minute.');const ws=store.workspaces().find(w=>w.name.toLowerCase()===input.name.toLowerCase());const encoded=ws?.password||hashPassword('unused');const actual=hashPassword(input.password,encoded.split(':')[0]);if(!ws?.password||!timingSafeEqual(Buffer.from(actual),Buffer.from(encoded)))throw new HttpError(401,'Incorrect workspace name or password');const token=randomBytes(32).toString('base64url');const person={id:randomUUID(),name:input.displayName,role:'viewer' as const,tokenHash:tokenHash(token)};await store.mutate(data=>{data.workspaces.find(w=>w.id===ws!.id)!.members.push(person);});res.json({token,workspaceId:ws.id,memberId:person.id,role:'viewer'});});}
  async function pairMember(displayName:string){const invite=store.invitation();if(invite.role==='host')throw new HttpError(400,'Use host pairing');const token=randomBytes(32).toString('base64url'),person={id:randomUUID(),name:displayName,role:invite.role,tokenHash:tokenHash(token),needsName:true};await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===invite.workspaceId);if(!ws)throw new HttpError(409,'Select a workspace before sharing this QR');ws.members.push(person);});return {token,workspaceId:invite.workspaceId,memberId:person.id,role:person.role};}
  function parseInvitation(value:unknown){const result=invitation.parse(value);if(result.role!=='host'&&!store.workspaces().some(w=>w.id===result.workspaceId))throw new HttpError(400,'Select a workspace for this invitation');return result;}
  function invitationIdentity(token:string){const hash=tokenHash(token);return store.workspaces().find(w=>w.invite?.hash===hash);}
  async function joinInvitation(token:string){const ws=invitationIdentity(token);if(!ws?.invite)throw new HttpError(401,'Workspace QR expired');const accessToken=randomBytes(32).toString('base64url'),person={id:randomUUID(),name:'Participant',role:ws.invite.role,tokenHash:tokenHash(accessToken),needsName:true};await store.mutate(data=>{const target=data.workspaces.find(w=>w.id===ws.id);if(target?.invite?.hash!==tokenHash(token))throw new HttpError(401,'Workspace QR expired');target.members.push(person);});return {token:accessToken,workspaceId:ws.id,memberId:person.id};}
  return {store,identity,current,catalog,publicLogin,pairMember,parseInvitation,invitationIdentity,joinInvitation};
}
export async function mountBoards(app:Express,roots:string[],access:Awaited<ReturnType<typeof createWorkspaceAccess>>,onWorkspaceCreated?:()=>Promise<void>){
  const {store,current,catalog}=access;
  // Only seed this app's own repository; do not inspect unrelated project content.
  for(const root of roots){let appRoot=false;try{appRoot=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).name==='pocket-code';}catch{}if(!appRoot)continue;
    const existing=store.boardList().find(b=>!b.workspaceId&&b.root===root&&b.name==='Pocket Code');
    const legacy=existing&&store.getBoard(existing.id)?.notes.every(n=>n.description.startsWith('Illustrative Pocket Code roadmap.'));
    if(!existing||legacy){const roadmap=await readProjectRoadmap(root);await store.mutate(data=>{if(existing){const found=data.boards.find(b=>b.id===existing.id)!;Object.assign(found,roadmap,{source:'project-changelog'});found.revision++;}else data.boards.push({id:randomUUID(),name:'Pocket Code',root,revision:0,versionSource:'planned',source:'project-changelog',...roadmap});});}
  }

  const visibleBoard=(value:ProjectBoard)=>current()?{...value,notes:value.notes.map(({chat,...n})=>n)}:value;
  function check(board:ProjectBoard,write=false){const ctx=current();if(ctx&&(board.workspaceId!==ctx.ws.id||write&&ctx.person.role==='viewer'))throw new HttpError(403,'Your role does not allow this board action');}
  app.post('/api/workspace-logout',async(_req,res)=>{const ctx=current();if(!ctx)throw new HttpError(400,'No workspace session');await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===ctx.ws.id)!;ws.members=ws.members.filter(m=>m.id!==ctx.person.id);});res.json({ok:true});});
  const hostIdentity=(_res:any)=>'host';
  app.post('/api/workspaces/:id/invitation',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Manage workspace invitations on the PC.');
    const workspaceId=id.parse(req.params.id),input=z.object({role:role.default('host')}).parse(req.body),token=randomBytes(32).toString('base64url');
    await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===workspaceId);if(!ws)throw new HttpError(404,'Workspace not found');ws.invite={hash:tokenHash(token),role:input.role};});res.json({token,workspaceId,role:input.role});
  });
  app.get('/api/workspaces',(_req,res)=>{const data=catalog(hostIdentity(res),typeof _req.query.workspaceId==='string'?_req.query.workspaceId:res.locals.deviceWorkspaceId);if(res.locals.deviceId)for(const ws of data.workspaces)ws.me.needsName=false;res.json({...data,canManageWorkspaces:!!res.locals.deviceAdmin&&!current()});});
  app.post('/api/workspaces',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Create and manage workspaces on the host PC.');
    const input=z.object({id:id.optional(),name,password:z.string().min(10).max(256).optional(),roots:z.array(z.string()).length(1,'A workspace uses exactly one repository')}).parse(req.body);
    const folders=[...new Set(await Promise.all(input.roots.map(root=>allowedPath(roots,root,true))))];
    const result=await store.mutate(data=>{const existing=input.id?data.workspaces.find(w=>w.id===input.id):undefined;if(input.id&&!existing)throw new HttpError(404,'Workspace not found');if(!existing&&!input.password)throw new HttpError(400,'Set a workspace password (at least 10 characters)');if(data.workspaces.some(w=>w.id!==input.id&&w.name.toLowerCase()===input.name.toLowerCase()))throw new HttpError(409,'Workspace name already exists');if(existing&&data.boards.some(b=>b.workspaceId===existing.id&&!folders.includes(b.root)))throw new HttpError(409,'A project with a board cannot be removed from this workspace.');const value={id:existing?.id||randomUUID(),name:input.name,roots:folders,password:input.password?hashPassword(input.password):existing!.password,members:existing?.members||[],hostPeople:existing?.hostPeople||[],invite:existing?.invite};if(existing)Object.assign(existing,value);else data.workspaces.push(value);data.invitation.workspaceId=value.id;return {id:value.id};});res.json(result);
  });
  app.post('/api/workspaces/:id/profile',async(req,res)=>{
    const input=z.object({name}).parse(req.body),workspaceId=id.parse(req.params.id),ctx=current();
    if(ctx&&ctx.ws.id!==workspaceId)throw new HttpError(403,'Workspace access denied');
    await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===workspaceId);if(!ws)throw new HttpError(404,'Workspace not found');
      if(ctx){const person=ws.members.find(p=>p.id===ctx.person.id)!;person.name=input.name;person.needsName=false;}
      else{const personId=hostIdentity(res),person=ws.hostPeople.find(p=>p.id===personId);if(person)person.name=input.name;else ws.hostPeople.push({id:personId,name:input.name});}
    });res.json({ok:true});
  });
  app.post('/api/workspaces/:id/member',async(req,res)=>{if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Manage workspace members on the host PC.');const input=z.object({memberId:id,role:role.optional(),remove:z.boolean().optional()}).parse(req.body);await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===req.params.id),person=ws?.members.find(m=>m.id===input.memberId);if(!ws||!person)throw new HttpError(404,'Member not found');if(input.remove)ws.members=ws.members.filter(m=>m.id!==person.id);else if(input.role)person.role=input.role;});res.json({ok:true});});
  app.post('/api/boards',async(req,res)=>{const input=z.object({workspaceId:id.optional(),name,root:z.string(),example:z.boolean().default(true),versionSource:z.enum(['planned','git']).default('planned'),language:z.enum(['en','ru']).default('en')}).parse(req.body);if(current())throw new HttpError(403,'Only the host creates boards');const root=await allowedPath(roots,input.root,true);res.json(await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===input.workspaceId);if(input.workspaceId&&!ws?.roots.includes(root))throw new HttpError(400,'Select a project from this workspace');const value:ProjectBoard={id:randomUUID(),workspaceId:ws?.id,name:input.name,root,revision:0,versionSource:input.versionSource,...(input.example?boardExample(input.language):{notes:[],versions:[]})};data.boards.push(value);return value;}));});
  app.post('/api/boards/:id/branch',async(req,res)=>{
    if(current())throw new HttpError(403,'Only the host manages Git branches');
    const input=z.object({name:z.string().min(1).max(200),previous:z.string().min(1).max(200).optional(),revision:z.number().int().nonnegative()}).parse(req.body);
    const boardId=id.parse(req.params.id);
    const result=await store.mutate(async data=>{
      const found=data.boards.find(b=>b.id===boardId);if(!found)throw new HttpError(404,'Board not found');
      if(found.source)throw new HttpError(403,'This board is generated from CHANGELOG.md.');
      if(found.revision!==input.revision)throw new HttpError(409,'This board changed. Reload before changing a branch.');
      if(found.versionSource==='planned'){
        const next=input.name.trim();if(!next||found.versions.includes(next)&&input.previous!==next)throw new HttpError(409,'Choose a unique version name');if(input.previous&&!found.versions.includes(input.previous))throw new HttpError(404,'Version not found');if(!input.previous&&found.versions.length>=40)throw new HttpError(400,'Version limit reached');
        if(input.previous){found.versions=found.versions.map(v=>v===input.previous?next:v);found.notes=found.notes.map(n=>n.branch===input.previous?{...n,branch:next}:n);}else found.versions.push(next);found.revision++;return found;
      }
      await allowedPath(roots,found.root,true);
      const options={cwd:found.root,windowsHide:true,timeout:10000,maxBuffer:1024*1024};
      const git=async(args:string[])=>exec('git',args,options);
      const {stdout:top}=await git(['rev-parse','--show-toplevel']);
      if(path.resolve(top.trim()).toLowerCase()!==path.resolve(found.root).toLowerCase())throw new HttpError(400,'Select the repository root.');
      for(const value of [input.name,input.previous].filter((v):v is string=>!!v)){
        if(value.startsWith('-'))throw new HttpError(400,'Invalid branch name');
        try{await git(['check-ref-format','refs/heads/'+value]);}catch{throw new HttpError(400,'Invalid branch name');}
      }
      if(input.previous===input.name)return found;
      if(!input.previous&&found.versions.length>=40)throw new HttpError(400,'The board version limit was reached');
      try{await git(input.previous?['branch','-m',input.previous,input.name]:['branch',input.name]);}catch{throw new HttpError(409,'Git could not change the branch. Check that the name is unused, the source is a local branch, and the repository has a commit.');}
      if(input.previous){for(const b of data.boards.filter(b=>b.root===found.root)){b.versions=[...new Set(b.versions.map(v=>v===input.previous?input.name:v))];b.notes=b.notes.map(n=>n.branch===input.previous?{...n,branch:input.name}:n);b.revision++;}}
      else{found.versions=[...new Set([...found.versions,input.name])];found.revision++;}
      return found;
    });res.json({...result,...(result.versionSource==='planned'?{branches:[]}:await boardBranches(result.root))});
  });
  app.get('/api/boards/:id',async(req,res)=>{const found=store.getBoard(id.parse(req.params.id));if(!found)throw new HttpError(404,'Board not found');check(found,req.method==='POST');await allowedPath(roots,found.root,true);res.json({...visibleBoard(found),...(found.source?await readProjectRoadmap(found.root):{}),...(found.versionSource==='planned'?{branches:[]}:await boardBranches(found.root))});});
  app.post('/api/boards/:id',async(req,res)=>{const input=z.object({revision:z.number().int().nonnegative(),notes:z.array(note).max(500),versions:z.array(z.string().min(1).max(300)).max(40)}).parse(req.body);const found=store.getBoard(id.parse(req.params.id));if(!found)throw new HttpError(404,'Board not found');check(found,req.method==='POST');if(found.source)throw new HttpError(403,'This board is generated from CHANGELOG.md.');await allowedPath(roots,found.root,true);const notes=current()?input.notes.map(n=>({...n,chat:found.notes.find(old=>old.id===n.id)?.chat})):input.notes;res.json(visibleBoard(await store.save(found.id,input.revision,notes,input.versions)));});
}
