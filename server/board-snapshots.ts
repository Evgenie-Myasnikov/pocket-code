import {lstat,mkdir,readFile,readdir,writeFile,unlink,appendFile} from 'node:fs/promises';
import {replaceFile} from './fs-retry.js';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {HttpError} from './security.js';
import type {ProjectBoard} from './boards.js';
import {BOARD_LIMITS,boardSnapshot,normalizeBoard,boardWarnings,boardErrors,issuesFromZod,describeIssues,historyPath,type BoardSnapshot,type BoardIssue,type MovedText} from '../src/board-contract.js';
const exec=promisify(execFile);
const snapshot=boardSnapshot;
/** A refused read or write that names the card, the field and the limit. */
export class BoardValidationError extends HttpError{
 constructor(public issues:BoardIssue[],private prefix='The board was not saved.',code='board_invalid',status=400){super(status,prefix+'\n'+describeIssues(issues),code);}
 /** Name a refused record by the title the board already stores, not by the value that was just rejected. */
 withTitles(titles:Map<string,string>){return new BoardValidationError(this.issues.map(issue=>issue.id&&titles.has(issue.id)?{...issue,title:titles.get(issue.id)!.slice(0,80)}:issue),this.prefix,this.code,this.status);}
}
/** Parse host input against a schema; a failure lists the offending records instead of a bare "check the fields". */
export function parseBoardInput<T>(schema:z.ZodType<T>,payload:unknown,prefix?:string):T{const result=schema.safeParse(payload);if(result.success)return result.data;throw new BoardValidationError(issuesFromZod(result.error,payload),prefix);}
const sensitive=/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[A-Z]:\\(?:Users|Documents and Settings)\\)|(?:Bearer\s+[\w.-]{12,})|(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)|(?:\b(?:sk-|ghp_|github_pat_)[\w-]{16,})/i;
/** Shared files hold product text only; names and common secret patterns stop a write. */
export function assertPublicText(prose:string,privateNames:string[]=[]){
 if(sensitive.test(prose)||privateNames.some(name=>name.trim().length>=3&&prose.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase())))throw new HttpError(400,'The board text may contain personal data. Remove names, email addresses, personal paths or credentials before saving a shared snapshot.');
}
export function publicBoard(board:ProjectBoard,privateNames:string[]=[]){
 const titles=new Map(board.notes.map(n=>[n.id,n]));
 // A card's title and description live in its task record; the canvas keeps geometry and a readable title only.
 const canvas=board.canvas?{...board.canvas,items:board.canvas.items.map(item=>{const note=item.kind==='card'?titles.get(item.id):undefined;if(!note)return item;const {description:_,...rest}=item;return {...rest,text:note.title,x:note.x,y:note.y};})}:undefined;
 const input={format:'pocket-code-board',version:1,name:board.name,...(canvas?{canvas}:{}),...(board.versionBranches?{versionBranches:board.versionBranches}:{}),versions:board.versions,notes:board.notes.map(n=>({... (n.images?{images:n.images}:{}),id:n.id,title:n.title,description:n.description,branch:n.branch,status:n.status,priority:n.priority||'normal',x:n.x,y:n.y,dependencies:n.dependencies,...(n.checklist?.length?{checklist:n.checklist}:{}),...(n.statusHistory?.length?{statusHistory:n.statusHistory}:{})}))};
 const value=parseBoardInput(snapshot,input);
 const prose=[...(value.canvas?.items.flatMap(i=>[i.text,i.description||'',...(i.chart?[i.chart.unit||'',i.chart.reference?.label||'',...i.chart.categories,...i.chart.series.map(s=>s.name)]:[])])||[]),...(value.canvas?.links.map(l=>l.label||'')||[]),value.name,...value.versions,...Object.keys(value.versionBranches||{}),...Object.values(value.versionBranches||{}),...value.notes.flatMap(n=>[n.title,n.description,n.branch,...(n.images||[]).map(i=>i.caption),...(n.checklist||[]).map(i=>i.text)])].join('\n');
 assertPublicText(prose,privateNames);
 return value;
}
async function folder(root:string,create=false,verifyGit=true){
 if(verifyGit){const {stdout}=await exec('git',['rev-parse','--show-toplevel'],{cwd:root,windowsHide:true,timeout:10000});if(path.resolve(stdout.trim()).toLowerCase()!==path.resolve(root).toLowerCase())throw new HttpError(400,'Select the Git repository root');}
 let current=root;for(const name of ['project-boards']){current=path.join(current,name);if(create)await mkdir(current).catch(e=>{if(e.code!=='EEXIST')throw e;});const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory())throw new HttpError(403,'Board snapshots cannot use linked directories');}return current;
}
const filename=z.string().regex(/^board-[a-f0-9-]+\.json$/);
const megabytes=(bytes:number)=>(bytes/1e6).toFixed(1)+' MB';
async function boardFile(root:string,file:string,limit:number){
 // Exact file identity and nanosecond times: a rounded 64-bit file index or a millisecond clock must never make a rewritten file look unchanged.
 const target=path.join(await folder(root,false,false),filename.parse(file)),info=await lstat(target,{bigint:true}),size=Number(info.size);
 if(info.isSymbolicLink()||!info.isFile())throw new HttpError(400,'Invalid board snapshot');
 if(size>limit)throw new HttpError(413,`The board file is ${megabytes(size)}; the limit is ${megabytes(limit)}. Move card history to project-boards/history or split the board.`);
 return {target,info:{size},stamp:createHash('sha256').update([info.ino,info.size,info.mtimeNs,info.ctimeNs].join('|')).digest('hex')};
}
export async function boardSnapshotStamp(root:string,file:string){return (await boardFile(root,file,BOARD_LIMITS.readBytes)).stamp;}
/** Atomic replace: the new content is complete on disk before the old file is swapped out. */
async function writeAtomic(directory:string,file:string,content:string){
 const target=path.join(directory,file);try{if((await lstat(target)).isSymbolicLink())throw new HttpError(403,'Linked snapshot files are not allowed');}catch(e:any){if(e.code!=='ENOENT')throw e;}
 if(Buffer.byteLength(content)>BOARD_LIMITS.fileBytes)throw new HttpError(413,`Board snapshot exceeds the size limit: ${megabytes(Buffer.byteLength(content))} of ${megabytes(BOARD_LIMITS.fileBytes)}. Move card history to project-boards/history.`);
 const temp=path.join(directory,'.'+randomUUID()+'.tmp');try{await writeFile(temp,content,{flag:'wx',mode:0o600});await replaceFile(temp,target);}finally{await unlink(temp).catch(()=>{});}
}
export const snapshotText=(value:BoardSnapshot)=>JSON.stringify(value,null,2)+'\n';
/** Write a value that already passed publicBoard. */
export async function writeBoardSnapshot(root:string,file:string,value:BoardSnapshot){await writeAtomic(await folder(root,true,false),filename.parse(file),snapshotText(value));}
export async function saveBoardSnapshot(root:string,board:ProjectBoard,names:string[],verifyGit=true){const value=publicBoard(board,names),directory=await folder(root,true,verifyGit),file='board-'+board.id+'.json';await writeAtomic(directory,file,snapshotText(value));return {path:'project-boards/'+file};}
/** Restore and repair write text that already passed the strict contract. */
export async function writeBoardText(root:string,file:string,content:string){snapshot.parse(JSON.parse(content));await writeAtomic(await folder(root,true,false),filename.parse(file),content);}
/** Strict read for import and catalogues: a file outside the contract is refused with the list of problems. */
export async function readBoardSnapshot(root:string,file:string,verifyGit=true){const target=path.join(await folder(root,false,verifyGit),filename.parse(file)),info=await lstat(target);if(info.isSymbolicLink()||!info.isFile()||info.size>BOARD_LIMITS.fileBytes)throw new HttpError(400,'Invalid board snapshot');let raw:unknown;try{raw=JSON.parse(await readFile(target,'utf8'));}catch(error){throw new HttpError(400,'The board file is not valid JSON: '+(error as Error).message);}return parseBoardInput(snapshot,raw,'The board file does not follow the snapshot contract.');}
export type BoardFileInspection={file:string;stamp:string;bytes:number;text:string;revision:string;board:BoardSnapshot;issues:BoardIssue[];unreadable?:string};
/**
 * Tolerant read for the project board: a record outside the contract is reported with its card, field and limit,
 * everything readable is still returned, and the file itself is never changed here.
 */
export async function inspectBoardFile(root:string,file:string):Promise<BoardFileInspection>{
 const {target,info,stamp}=await boardFile(root,file,BOARD_LIMITS.readBytes),text=await readFile(target,'utf8'),revision=createHash('sha256').update(text).digest('hex'),base={file,stamp,bytes:info.size,text,revision};
 let raw:unknown;
 try{raw=JSON.parse(text.charCodeAt(0)===0xFEFF?text.slice(1):text);}catch(error){
  const message=(error as Error).message,at=Number(/position (\d+)/.exec(message)?.[1]),place=Number.isFinite(at)?` (line ${text.slice(0,at).split('\n').length}, column ${at-text.lastIndexOf('\n',at-1)})`:'';
  return {...base,board:normalizeBoard({}).board,unreadable:message,issues:[{severity:'error',scope:'board',path:'$',code:'invalid_json',message:`The board file is not valid JSON${place}: ${message}`,fix:'Restore the last good snapshot or correct the file by hand.'}]};
 }
 const strict=snapshot.safeParse(raw);
 let board:BoardSnapshot,issues:BoardIssue[];
 const inspected=normalizeBoard(raw,'inspect');
 if(strict.success&&!inspected.issues.length){board=strict.data;issues=[];}
 else{board=inspected.board;issues=inspected.issues;
  // Safety net: a board the walker considers clean must still pass the strict contract before it becomes editable.
  if(!issues.length){const check=snapshot.safeParse(board);if(check.success)board=check.data;else issues=issuesFromZod(check.error,board);}
 }
 if(info.size>BOARD_LIMITS.fileBytes)issues.push({severity:'error',scope:'board',path:'$',code:'file_too_large',field:'fileBytes',limit:BOARD_LIMITS.fileBytes,actual:info.size,message:`The board file is ${megabytes(info.size)}; the limit is ${megabytes(BOARD_LIMITS.fileBytes)}.`,fix:'Repair moves duplicated card text out of the canvas and long history into project-boards/history.'});
 if(!boardErrors(issues).length){const notes=new Map(board.notes.map(n=>[n.id,n]));
  // Older files repeat every card description on the canvas; readers get one copy. A card sits where its task record says,
  // which is also what the next save writes, so a reader sees the same object before and after a write.
  if(board.canvas)board={...board,canvas:{...board.canvas,items:board.canvas.items.map(item=>{const note=item.kind==='card'?notes.get(item.id):undefined;if(!note)return item;const {description:_,...rest}=item;return {...rest,text:note.title,x:note.x,y:note.y};})}};
  issues=[...issues,...boardWarnings(board,info.size)];}
 return {...base,board,issues};
}
export async function deleteBoardSnapshot(root:string,file:string){
 const target=path.join(await folder(root,false,false),filename.parse(file)),info=await lstat(target);
 if(info.isSymbolicLink()||!info.isFile())throw new HttpError(403,'Linked snapshot files are not allowed');
 await unlink(target);
}
/** Board files in the project folder, without opening them. */
export async function boardFileNames(root:string){try{return (await readdir(await folder(root,false,false))).filter(file=>filename.safeParse(file).success).sort().slice(0,100);}catch(e:any){if(e.code==='ENOENT')return [];throw e;}}
export async function listBoardSnapshots(root:string,verifyGit=true){let directory:string;try{directory=await folder(root,false,verifyGit);}catch(e:any){if(e.code==='ENOENT')return [];throw e;}const files=(await readdir(directory)).filter(file=>filename.safeParse(file).success).slice(0,100);const result=[];for(const file of files)try{const board=await readBoardSnapshot(root,file,false);result.push({file,name:board.name,noteCount:board.notes.length});}catch{/* Malformed or linked files are never imported. */}return result;}
/** Text removed from a card is appended word for word to its history file next to the board. */
export async function appendBoardHistory(root:string,entries:MovedText[],reason:string,names?:string[]){
 if(!entries.length)return [];
 // Repairs move text that is already in the repository; new text from a write is screened like the board itself.
 if(names)assertPublicText(entries.map(entry=>entry.text).join('\n'),names);
 let directory=await folder(root,true,false);directory=path.join(directory,'history');await mkdir(directory).catch(e=>{if(e.code!=='EEXIST')throw e;});
 const info=await lstat(directory);if(info.isSymbolicLink()||!info.isDirectory())throw new HttpError(403,'Board history cannot use linked directories');
 const stamp=new Date().toISOString().slice(0,16).replace('T',' ')+' UTC',files=new Map<string,MovedText[]>();
 for(const entry of entries){const file=entry.noteId?path.basename(historyPath(entry.noteId)):'board-repair.md';files.set(file,[...(files.get(file)||[]),entry]);}
 for(const [file,list] of files){
  const target=path.join(directory,file);let exists=true;try{const current=await lstat(target);if(current.isSymbolicLink()||!current.isFile())throw new HttpError(403,'Linked history files are not allowed');}catch(e:any){if(e.code!=='ENOENT')throw e;exists=false;}
  const head=exists?'':list[0].noteId?`# ${list[0].title.replace(/\s+/g,' ')}\n\nCard: ${list[0].noteId}. Text moved out of the card by Pocket Code, word for word; the newest section is last. Historical records are not current validation evidence.\n`:'# Board repair report\n\nRecords removed from the board file by Pocket Code repairs, kept word for word; the newest section is last.\n';
  await appendFile(target,head+list.map(entry=>`\n## ${entry.label} — ${reason}, ${stamp}\n\n${entry.text.trimEnd()}\n`).join(''),{mode:0o600});
 }
 return [...files.keys()].map(file=>'project-boards/history/'+file);
}
