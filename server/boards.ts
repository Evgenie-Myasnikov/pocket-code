import {miroLink} from '../src/miro-link.js';
import {boardImages,saveBoardImage,readBoardImage} from './board-images.js';
import {versionBranches} from './board-version-links.js';
import {projectBoard,createProjectBoard,updateProjectBoard,deleteProjectBoard} from './project-board.js';
import {boardNotice,assignmentNotices,allowedRecipients,addNotice,assignees} from './board-attention.js';
import {saveBoardSnapshot,listBoardSnapshots,readBoardSnapshot} from './board-snapshots.js';
import {profileName,completeName} from '../src/profile-name.js';
import {readProjectRoadmap} from './project-roadmap.js';
import {boardExample,pocketCodeExample} from './board-example.js';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,randomBytes,createHmac,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import type {Express} from 'express';
import {allowedPath,HttpError} from './security.js';

const id=z.string().uuid(),name=z.string().trim().min(1).max(160);
const note=z.object({id,images:boardImages,title:name,description:z.string().max(20000),branch:z.string().max(300),status:z.enum(['idea','questions','ready','working','review','done']),owner:z.string().max(160),assigneeId:z.string().max(200).optional(),assigneeIds:z.array(z.string().min(1).max(200)).max(100).optional(),priority:z.enum(['critical','high','normal','low']).optional(),x:z.number().min(0).max(20000),y:z.number().min(0).max(20000),dependencies:z.array(id).max(100),chat:z.object({provider:z.enum(['claude','codex','copilot']),sessionId:z.string().max(200)}).optional()});
const board=z.object({id,versionBranches,workspaceId:id.optional(),name,root:z.string(),revision:z.number().int().nonnegative(),versionSource:z.enum(['planned','git']).default('git'),source:z.literal('project-changelog').optional(),notes:z.array(note).max(500),versions:z.array(z.string().min(1).max(300)).max(40).default([])});
const role=z.enum(['host','viewer','developer','reviewer','qa']);
const member=z.object({id,name,firstName:z.string().optional(),lastName:z.string().optional(),role,tokenHash:z.string(),needsName:z.boolean().optional(),approval:z.enum(['pending','approved','rejected']).optional()});
const workspace=z.object({id,name,roots:z.array(z.string()).max(100),password:z.string().default(''),invite:z.object({hash:z.string(),role}).optional(),members:z.array(member).default([]),hostPeople:z.array(z.object({id:z.string(),name,firstName:z.string().optional(),lastName:z.string().optional()})).default([])});
const invitation=z.object({role:z.enum(['host','viewer','developer','reviewer','qa']).default('host'),workspaceId:id.nullish().transform(value=>value||undefined)});
const database=z.object({miroBoards:z.array(z.object({root:z.string(),url:z.string()})).max(100).default([]),notices:z.array(boardNotice).default([]),workspaces:z.array(workspace),boards:z.array(board),hiddenSourceRoots:z.array(z.string()).default([]),invitation:invitation.default({role:'host',workspaceId:undefined})});
export type BoardNote=z.infer<typeof note>;
export type ProjectBoard=z.infer<typeof board>;
export type ProjectWorkspace=Omit<z.infer<typeof workspace>,'password'|'invite'|'members'|'hostPeople'>&{role:'host'|z.infer<typeof role>;me?:{id:string;name:string;firstName?:string;lastName?:string;needsName:boolean;approval?:'pending'|'approved'|'rejected'};people?:{id:string;name:string;role:string}[];members?:{id:string;name:string;role:z.infer<typeof role>;needsName?:boolean;approval?:'pending'|'approved'|'rejected'}[]};
type Data=z.infer<typeof database>;

// Private host state; serialized, atomic writes and optimistic board revisions protect two devices.
export class BoardStore{
  private data:Data={miroBoards:[],notices:[],workspaces:[],boards:[],hiddenSourceRoots:[],invitation:{role:'host',workspaceId:undefined}};private queue=Promise.resolve();
  constructor(private file:string){}
  async load(){try{this.data=database.parse(JSON.parse(await readFile(this.file,'utf8')));}catch(e:any){if(e.code!=='ENOENT')throw e;}return this;}
  snapshot(){return structuredClone(this.data);}
  workspaces(){return structuredClone(this.data.workspaces);}
  invitation(){return {...this.data.invitation,workspaceId:this.data.invitation.workspaceId||this.data.workspaces.at(-1)?.id};}
  getBoard(id:string){const found=this.data.boards.find(b=>b.id===id);return found?structuredClone(found):undefined;}
  boardList(){return this.data.boards.map(({id,workspaceId,name,root,notes})=>({id,workspaceId,name,root,noteCount:notes.length}));}
  mutate<T>(change:(data:Data)=>T|Promise<T>):Promise<T>{const run=this.queue.then(async()=>{const next=this.snapshot(),result=await change(next);database.parse(next);await mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,this.file);this.data=next;return structuredClone(result);});this.queue=run.then(()=>{},()=>{});return run;}
  save(id:string,revision:number,notes:BoardNote[],versions:string[]=[]){return this.mutate(data=>{const found=data.boards.find(b=>b.id===id);if(!found)throw new HttpError(404,'Board not found');if(found.revision!==revision)throw new HttpError(409,'This board changed on another device. Reload before saving.');validateDependencies(notes);assignmentNotices(data,found,notes);found.notes=structuredClone(notes);found.versions=[...new Set(versions)];found.revision++;return found;});}
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
  if(store.workspaces().some(w=>w.hostPeople.some(p=>p.id!=='host')||w.members.some(m=>m.role==='host')||w.invite?.role==='host'))await store.mutate(data=>{
    for(const ws of data.workspaces){
      const canonical=ws.hostPeople.find(p=>p.id==='host')||ws.hostPeople[0],legacy=new Set(ws.hostPeople.filter(p=>p.id!=='host').map(p=>p.id));
      ws.hostPeople=canonical?[{...canonical,id:'host'}]:[];
      for(const member of ws.members)if(member.role==='host')member.role='developer';
      if(ws.invite?.role==='host')ws.invite.role='developer';
      for(const board of data.boards.filter(b=>b.workspaceId===ws.id)){let changed=false;for(const note of board.notes){if(note.assigneeId&&legacy.has(note.assigneeId)){note.assigneeId='host';changed=true;}if(note.assigneeIds?.some(id=>legacy.has(id))){note.assigneeIds=[...new Set(note.assigneeIds.map(id=>legacy.has(id)?'host':id))];changed=true;}}if(changed)board.revision++;}
    }
  });
  function identity(token:string){const hash=tokenHash(token);for(const ws of store.workspaces()){const person=ws.members.find(m=>m.tokenHash===hash);if(person)return {workspaceId:ws.id,memberId:person.id,approval:person.approval};}return undefined;}
  function current(){const ctx=workspaceRequest.getStore();if(!ctx)return undefined;const ws=store.workspaces().find(w=>w.id===ctx.workspaceId);const person=ws?.members.find(m=>m.id===ctx.memberId);if(!ws||!person)throw new HttpError(401,'Workspace access revoked');return {ws,person};}
  function catalog(hostId='host',boundWorkspaceId?:string){const ctx=current();const hostProfile=store.workspaces().flatMap(w=>w.hostPeople).find(p=>p.id==='host'&&completeName(profileName(p)));const me=(p:{id:string;name:string;firstName?:string;lastName?:string;needsName?:boolean;approval?:'pending'|'approved'|'rejected'}|undefined)=>({id:p?.id||hostId,name:p?.name||'',...profileName(p),needsName:!!p?.needsName||!completeName(profileName(p)),approval:p?.approval});if(ctx?.person.approval&&ctx.person.approval!=='approved')return {host:false,activeWorkspaceId:ctx.ws.id,workspaces:[{id:ctx.ws.id,name:ctx.ws.name,roots:[],role:ctx.person.role,me:me(ctx.person),people:[],members:[]}],boards:[]};return {host:!ctx,activeWorkspaceId:ctx?.ws.id||boundWorkspaceId||store.invitation().workspaceId,workspaces:store.workspaces().filter(w=>ctx?w.id===ctx.ws.id:!boundWorkspaceId||w.id===boundWorkspaceId).map(w=>({id:w.id,name:w.name,roots:w.roots,role:ctx?ctx.person.role:'host',me:ctx?me(ctx.person):me(hostProfile||w.hostPeople.find(p=>p.id===hostId)),people:[...(hostProfile?[hostProfile]:w.hostPeople).map(p=>({...p,role:'host'})),...w.members.filter(m=>!m.needsName&&(!m.approval||m.approval==='approved')).map(({id,name,role})=>({id,name,role}))],...(!ctx?{members:w.members.map(({tokenHash,...m})=>m)}:{})})),boards:store.boardList().filter(b=>ctx?b.workspaceId===ctx.ws.id:!boundWorkspaceId||b.workspaceId===boundWorkspaceId)};}
  const attempts=new Map<string,{at:number;count:number}>();
  function publicLogin(app:Express){app.post('/api/workspace-login',async(req,res)=>{const input=z.object({name,password:z.string().min(1).max(256),displayName:name}).parse(req.body);const key=req.ip||'unknown',now=Date.now();let attempt=attempts.get(key);if(!attempt||now-attempt.at>60000){attempt={at:now,count:0};if(attempts.size>1000)attempts.clear();attempts.set(key,attempt);}if(++attempt.count>5)throw new HttpError(429,'Too many attempts. Try again in a minute.');const ws=store.workspaces().find(w=>w.name.toLowerCase()===input.name.toLowerCase());const encoded=ws?.password||hashPassword('unused');const actual=hashPassword(input.password,encoded.split(':')[0]);if(!ws?.password||!timingSafeEqual(Buffer.from(actual),Buffer.from(encoded)))throw new HttpError(401,'Incorrect workspace name or password');const token=randomBytes(32).toString('base64url');const person={id:randomUUID(),name:input.displayName,role:'viewer' as const,approval:'pending' as const,tokenHash:tokenHash(token)};await store.mutate(data=>{data.workspaces.find(w=>w.id===ws!.id)!.members.push(person);});res.json({token,workspaceId:ws.id,memberId:person.id,role:'viewer'});});}
  async function pairMember(displayName:string){const invite=store.invitation();if(invite.role==='host')throw new HttpError(400,'Use host pairing');const token=randomBytes(32).toString('base64url'),person={id:randomUUID(),name:displayName,role:invite.role,tokenHash:tokenHash(token),needsName:true,approval:'pending' as const};await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===invite.workspaceId);if(!ws)throw new HttpError(409,'Select a workspace before sharing this QR');ws.members.push(person);});return {token,workspaceId:invite.workspaceId,memberId:person.id,role:person.role};}
  function parseInvitation(value:unknown){const result=invitation.parse(value);if(result.role!=='host'&&!store.workspaces().some(w=>w.id===result.workspaceId))throw new HttpError(400,'Select a workspace for this invitation');return result;}
  function invitationIdentity(token:string){const hash=tokenHash(token);return store.workspaces().find(w=>w.invite?.hash===hash);}
  function verifyInvitationPassword(token:string,password?:string){const ws=invitationIdentity(token);if(!ws)throw new HttpError(401,'Workspace QR expired');if(!password)throw new HttpError(428,'Enter the workspace password');const encoded=ws.password,actual=encoded&&hashPassword(password,encoded.split(':')[0]);if(!encoded||!actual||Buffer.byteLength(actual)!==Buffer.byteLength(encoded)||!timingSafeEqual(Buffer.from(actual),Buffer.from(encoded)))throw new HttpError(401,'Incorrect workspace password');}
  async function joinInvitation(token:string,previousToken?:string,joinId?:string,password?:string){
    const ws=invitationIdentity(token);if(!ws?.invite)throw new HttpError(401,'Workspace QR expired');
    const previous=previousToken&&identity(previousToken);
    if(previous&&previous.workspaceId===ws.id)return {token:previousToken!,workspaceId:ws.id,memberId:previous.memberId};
    verifyInvitationPassword(token,password);
    const accessToken=joinId?createHmac('sha256',token).update('workspace-join:'+joinId).digest('base64url'):randomBytes(32).toString('base64url');
    return store.mutate(data=>{const target=data.workspaces.find(w=>w.id===ws.id);if(target?.invite?.hash!==tokenHash(token))throw new HttpError(401,'Workspace QR expired');
      const hash=tokenHash(accessToken);let person=target.members.find(m=>m.tokenHash===hash);
      if(!person){person={id:randomUUID(),name:'Participant',role:target.invite.role,tokenHash:hash,needsName:true,approval:'pending'};target.members.push(person);}
      return {token:accessToken,workspaceId:ws.id,memberId:person.id};
    });
  }
  return {store,identity,current,catalog,publicLogin,pairMember,parseInvitation,invitationIdentity,joinInvitation,verifyInvitationPassword};
}
export async function mountBoards(app:Express,roots:string[],access:Awaited<ReturnType<typeof createWorkspaceAccess>>,onWorkspaceCreated?:()=>Promise<void>){
  const {store,current,catalog}=access;
  // Only seed this app's own repository; do not inspect unrelated project content.
  for(const root of roots){let appRoot=false;try{appRoot=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).name==='pocket-code';}catch{}if(!appRoot||store.snapshot().hiddenSourceRoots.includes(root))continue;
    const existing=store.boardList().find(b=>!b.workspaceId&&b.root===root&&b.name==='Pocket Code');
    const legacy=existing&&store.getBoard(existing.id)?.notes.every(n=>n.description.startsWith('Illustrative Pocket Code roadmap.'));
    if(!existing||legacy){const roadmap=await readProjectRoadmap(root);await store.mutate(data=>{if(existing){const found=data.boards.find(b=>b.id===existing.id)!;Object.assign(found,roadmap,{source:'project-changelog'});found.revision++;}else data.boards.push({id:randomUUID(),name:'Pocket Code',root,revision:0,versionSource:'planned',source:'project-changelog',...roadmap});});}
  }

  const visibleBoard=(value:ProjectBoard)=>current()?{...value,notes:value.notes.map(({chat,...n})=>n)}:value;
  function check(board:ProjectBoard,write=false){const ctx=current();if(ctx&&(board.workspaceId!==ctx.ws.id||write&&ctx.person.role==='viewer'))throw new HttpError(403,'Your role does not allow this board action');}

  const ownNotices=()=>{const ctx=current(),person=ctx?.person.id||'host';return store.snapshot().notices.filter(n=>n.recipientId===person&&(!ctx||n.workspaceId===ctx.ws.id)&&!!store.getBoard(n.boardId)?.notes.some(note=>note.id===n.noteId));};
  app.get('/api/board-notifications',(_req,res)=>res.json({items:ownNotices()}));
  app.post('/api/board-notifications/read',async(req,res)=>{const requested=z.object({ids:z.array(z.string()).max(200)}).parse(req.body),visible=new Set(ownNotices().map(n=>n.id));await store.mutate(data=>{for(const n of data.notices)if(visible.has(n.id)&&requested.ids.includes(n.id)&&!n.readAt)n.readAt=Date.now();});res.json({ok:true});});
  app.post('/api/boards/:id/attention',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Only the PC host can delegate AI board actions');
    const input=z.object({requestId:id,revision:z.number().int().nonnegative(),noteId:id,kind:z.enum(['assign','question']),recipients:z.array(z.string().min(1).max(200)).min(1).max(100),message:z.string().trim().max(2000).default('')}).parse(req.body);
    if(input.kind==='question'&&!input.message)throw new HttpError(400,'Write a concrete question');
    const result=await store.mutate(data=>{const board=data.boards.find(b=>b.id===req.params.id),note=board?.notes.find(n=>n.id===input.noteId);if(!board||!note)throw new HttpError(404,'Board note not found');
      const recipients=[...new Set(input.recipients)],allowed=allowedRecipients(data,board);if(recipients.some(p=>!allowed.has(p)))throw new HttpError(400,'Choose approved workspace participants');
      const eventIds=recipients.map(p=>input.requestId+':'+p);if(eventIds.every(key=>data.notices.some(n=>n.id===key)))return board;
      if(board.revision!==input.revision)throw new HttpError(409,'Reload the board before updating it');
      if(input.kind==='assign'){if(board.source)throw new HttpError(403,'Import the repository board before assigning people');note.assigneeIds=[...new Set([...assignees(note),...recipients])];note.assigneeId=note.assigneeIds[0]||'';}
      recipients.forEach((person,i)=>addNotice(data,board,note,person,input.kind==='assign'?'assigned':'question',input.message,eventIds[i]));board.revision++;return board;
    });res.json(visibleBoard(result));
  });
  app.post('/api/workspace-logout',async(_req,res)=>{const ctx=current();if(!ctx)throw new HttpError(400,'No workspace session');await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===ctx.ws.id)!;ws.members=ws.members.filter(m=>m.id!==ctx.person.id);});res.json({ok:true});});
  const hostIdentity=(_res:any)=>'host';
  app.post('/api/workspaces/:id/invitation',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Manage workspace invitations on the PC.');
    const workspaceId=id.parse(req.params.id),input=z.object({role:z.enum(['viewer','developer','reviewer','qa']).default('developer')}).parse(req.body),token=randomBytes(32).toString('base64url');
    await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===workspaceId);if(!ws)throw new HttpError(404,'Workspace not found');ws.invite={hash:tokenHash(token),role:input.role};});res.json({token,workspaceId,role:input.role});
  });
  app.get('/api/workspaces',async(_req,res)=>{
    // Older paired clients stored a separate host profile per device. Only
    // reconcile the authenticated device; equal names alone are not identity.
    const legacyId=res.locals.deviceId?'device:'+res.locals.deviceId:undefined;
    if(!current()&&legacyId&&store.workspaces().some(w=>w.hostPeople.some(p=>p.id===legacyId)))await store.mutate(data=>{
      for(const ws of data.workspaces){const legacy=ws.hostPeople.find(p=>p.id===legacyId);if(!legacy)continue;
        if(!ws.hostPeople.some(p=>p.id==='host'))ws.hostPeople.push({id:'host',name:legacy.name});
        ws.hostPeople=ws.hostPeople.filter(p=>p.id!==legacyId);
        for(const board of data.boards.filter(b=>b.workspaceId===ws.id))for(const note of board.notes){if(note.assigneeId===legacyId)note.assigneeId='host';note.assigneeIds=[...new Set((note.assigneeIds||[]).map(id=>id===legacyId?'host':id))];}
      }
    });const data=catalog(hostIdentity(res),typeof _req.query.workspaceId==='string'?_req.query.workspaceId:res.locals.deviceWorkspaceId);res.json({...data,canManageWorkspaces:!!res.locals.deviceAdmin&&!current()});});
  app.post('/api/workspaces',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Create and manage workspaces on the host PC.');
    const input=z.object({id:id.optional(),name,password:z.string().min(10).max(256).optional(),roots:z.array(z.string()).length(1,'A workspace uses exactly one repository')}).parse(req.body);
    const folders=[...new Set(await Promise.all(input.roots.map(root=>allowedPath(roots,root,true))))];
    const result=await store.mutate(data=>{const existing=input.id?data.workspaces.find(w=>w.id===input.id):undefined;if(input.id&&!existing)throw new HttpError(404,'Workspace not found');if(!existing&&!input.password)throw new HttpError(400,'Set a workspace password (at least 10 characters)');if(data.workspaces.some(w=>w.id!==input.id&&w.name.toLowerCase()===input.name.toLowerCase()))throw new HttpError(409,'Workspace name already exists');if(existing&&data.boards.some(b=>b.workspaceId===existing.id&&!folders.includes(b.root)))throw new HttpError(409,'A project with a board cannot be removed from this workspace.');const value={id:existing?.id||randomUUID(),name:input.name,roots:folders,password:input.password?hashPassword(input.password):existing!.password,members:existing?.members||[],hostPeople:existing?.hostPeople||[],invite:existing?.invite};if(existing)Object.assign(existing,value);else data.workspaces.push(value);data.invitation.workspaceId=value.id;return {id:value.id};});res.json(result);
  });
  app.post('/api/workspaces/:id/profile',async(req,res)=>{
    const input=z.object({name,firstName:z.string().trim().min(1).max(80).optional(),lastName:z.string().trim().min(1).max(79).optional()}).parse(req.body),workspaceId=id.parse(req.params.id),ctx=current();
    if(ctx&&ctx.ws.id!==workspaceId)throw new HttpError(403,'Workspace access denied');
    await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===workspaceId);if(!ws)throw new HttpError(404,'Workspace not found');
      if(ctx){const person=ws.members.find(p=>p.id===ctx.person.id)!;Object.assign(person,{name:input.name,...profileName(input),needsName:!completeName(profileName(input))});}
      else{const personId=hostIdentity(res);for(const target of data.workspaces){const person=target.hostPeople.find(p=>p.id===personId),profile={id:personId,name:input.name,...profileName(input)};if(person)Object.assign(person,profile);else target.hostPeople.push(profile);}}
    });res.json({ok:true});
  });
  app.post('/api/workspaces/:id/member',async(req,res)=>{if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Manage workspace members on the host PC.');const input=z.object({memberId:id,role:z.enum(['viewer','developer','reviewer','qa']).optional(),remove:z.boolean().optional(),approval:z.enum(['approved','rejected']).optional()}).parse(req.body);await store.mutate(data=>{const ws=data.workspaces.find(w=>w.id===req.params.id),person=ws?.members.find(m=>m.id===input.memberId);if(!ws||!person)throw new HttpError(404,'Member not found');if(input.remove)ws.members=ws.members.filter(m=>m.id!==person.id);else{if(input.role)person.role=input.role;if(input.approval){if(input.approval==='approved'&&(person.needsName||!completeName(profileName(person))))throw new HttpError(400,'The applicant must enter their name first');person.approval=input.approval;}};});res.json({ok:true});});
  async function projectRoot(value:unknown,write=false){const root=await allowedPath(roots,z.string().parse(value),true),ctx=current();if(ctx&&(!ctx.ws.roots.includes(root)||write&&ctx.person.role==='viewer'))throw new HttpError(403,'Project access denied');return root;}
  app.post('/api/project-board/image',async(req,res)=>{const input=z.object({root:z.string(),data:z.string().max(13981016),caption:z.string().max(160).default('')}).parse(req.body),root=await projectRoot(input.root,true);res.json(await saveBoardImage(root,input.data,input.caption));});
  app.get('/api/project-board/image',async(req,res)=>{const root=await projectRoot(req.query.root);res.json(await readBoardImage(root,z.string().parse(req.query.path)));});
  const privateNames=()=>store.workspaces().flatMap(w=>[...w.hostPeople,...w.members].map(p=>p.name));
  app.get('/api/project-board',async(req,res)=>{const root=await projectRoot(req.query.root),result=await projectBoard(root);if(result)validateDependencies(result.notes);res.json({board:result,miro:store.snapshot().miroBoards.find(b=>b.root===root)||null,canEdit:current()?.person.role!=='viewer'});});
  app.post('/api/project-board/miro',async(req,res)=>{
    const input=z.object({root:z.string(),url:z.string().max(2048).nullable()}).parse(req.body),root=await projectRoot(input.root,true);
    let url:string|null=null;if(input.url!==null){try{url=miroLink(input.url).url;}catch{throw new HttpError(400,'Use a Miro board link: https://miro.com/app/board/…');}}
    const linked=await store.mutate(data=>{data.miroBoards=data.miroBoards.filter(b=>b.root!==root);if(url)data.miroBoards.push({root,url});return url?{root,url}:null;});
    res.json({miro:linked});
  });
  app.post('/api/project-board/create',async(req,res)=>{const input=z.object({root:z.string(),language:z.enum(['en','ru']).default('en')}).parse(req.body),root=await projectRoot(input.root,true);res.json(await createProjectBoard(root,privateNames(),input.language));});
  app.post('/api/project-board/delete',async(req,res)=>{const input=z.object({root:z.string(),repositoryRevision:z.string().length(64)}).parse(req.body),root=await projectRoot(input.root,true);await deleteProjectBoard(root,input.repositoryRevision);res.json({ok:true});});
  app.post('/api/project-board',async(req,res)=>{const input=z.object({root:z.string(),repositoryRevision:z.string().length(64),notes:z.array(note).max(500),versions:z.array(z.string().min(1).max(300)).max(40)}).parse(req.body),root=await projectRoot(input.root,true);validateDependencies(input.notes);res.json(await updateProjectBoard(root,input.repositoryRevision,input.notes,input.versions,privateNames()));});
  app.get('/api/repository-boards',async(req,res)=>{if(current())throw new HttpError(403,'Connect to the PC to browse repository boards');const root=await allowedPath(roots,z.string().parse(req.query.root),true);res.json(await listBoardSnapshots(root,false));});
  app.get('/api/repository-board',async(req,res)=>{if(current())throw new HttpError(403,'Connect to the PC to browse repository boards');const root=await allowedPath(roots,z.string().parse(req.query.root),true),file=z.string().parse(req.query.file),shared=await readBoardSnapshot(root,file,false);const notes=shared.notes.map(n=>({...n,owner:'',assigneeIds:[]}));validateDependencies(notes);res.json({...shared,id:file.slice(6,-5),root,notes,revision:0,versionSource:'planned',source:'project-changelog',repositoryFile:file,branches:[]});});
  app.get('/api/board-snapshots',async(req,res)=>{if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Use the PC host to load board snapshots');const root=await allowedPath(roots,z.string().parse(req.query.root),true);res.json(await listBoardSnapshots(root));});
  app.post('/api/board-snapshots/import',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Use the PC host to import boards');const input=z.object({root:z.string(),file:z.string(),workspaceId:id.optional()}).parse(req.body),root=await allowedPath(roots,input.root,true),shared=await readBoardSnapshot(root,input.file);const notes=shared.notes.map(n=>({...n,owner:'',assigneeId:'',assigneeIds:[]}));validateDependencies(notes);
    res.json(await store.mutate(data=>{if(input.workspaceId&&!data.workspaces.some(w=>w.id===input.workspaceId&&w.roots.includes(root)))throw new HttpError(400,'Repository is outside this workspace');const imported:ProjectBoard={id:randomUUID(),workspaceId:input.workspaceId,name:shared.name,root,revision:0,versionSource:'planned',versionBranches:shared.versionBranches,versions:shared.versions,notes};data.boards.push(imported);return imported;}));
  });
  app.post('/api/boards/:id/snapshot',async(req,res)=>{if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Use the PC host to save shared snapshots');const board=store.getBoard(id.parse(req.params.id));if(!board)throw new HttpError(404,'Board not found');const root=await allowedPath(roots,board.root,true),names=store.workspaces().flatMap(w=>[...w.hostPeople,...w.members.filter(m=>!m.needsName)].map(p=>p.name));res.json(await saveBoardSnapshot(root,board,names));});
  app.post('/api/workspaces/:id/delete',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Only the PC host deletes workspaces');const workspaceId=id.parse(req.params.id);
    await store.mutate(data=>{if(!data.workspaces.some(w=>w.id===workspaceId))throw new HttpError(404,'Workspace not found');data.workspaces=data.workspaces.filter(w=>w.id!==workspaceId);data.boards=data.boards.filter(b=>b.workspaceId!==workspaceId);if(data.invitation.workspaceId===workspaceId)data.invitation.workspaceId=undefined;});res.json({ok:true});
  });
  app.post('/api/boards/:id/delete',async(req,res)=>{
    if(current()||!res.locals.deviceAdmin)throw new HttpError(403,'Only the PC host deletes boards');const boardId=id.parse(req.params.id);
    await store.mutate(data=>{const found=data.boards.find(b=>b.id===boardId);if(!found)throw new HttpError(404,'Board not found');if(found.source)data.hiddenSourceRoots=[...new Set([...data.hiddenSourceRoots,found.root])];data.boards=data.boards.filter(b=>b.id!==boardId);});res.json({ok:true});
  });
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
  app.get('/api/boards/:id',async(req,res)=>{const found=store.getBoard(id.parse(req.params.id));if(!found)throw new HttpError(404,'Board not found');check(found);try{await allowedPath(roots,found.root,true);}catch{res.json({...visibleBoard(found),branches:[],repositoryUnavailable:true,error:'Repository unavailable. Showing the saved board; reconnect its project folder on the PC to edit.'});return;}res.json({...visibleBoard(found),...(found.source?await readProjectRoadmap(found.root):{}),...(found.versionSource==='planned'?{branches:[]}:await boardBranches(found.root))});});
  app.post('/api/boards/:id',async(req,res)=>{const input=z.object({revision:z.number().int().nonnegative(),notes:z.array(note).max(500),versions:z.array(z.string().min(1).max(300)).max(40)}).parse(req.body);const found=store.getBoard(id.parse(req.params.id));if(!found)throw new HttpError(404,'Board not found');check(found,req.method==='POST');if(found.source)throw new HttpError(403,'This board is generated from CHANGELOG.md.');await allowedPath(roots,found.root,true);const notes=current()?input.notes.map(n=>({...n,chat:found.notes.find(old=>old.id===n.id)?.chat})):input.notes;res.json(visibleBoard(await store.save(found.id,input.revision,notes,input.versions)));});
}
