import {randomUUID} from 'node:crypto';
import {lstat} from 'node:fs/promises';
import path from 'node:path';
import {inspectBoardFile,boardSnapshotStamp,boardFileNames,publicBoard,writeBoardSnapshot,writeBoardText,snapshotText,saveBoardSnapshot,deleteBoardSnapshot,appendBoardHistory,BoardValidationError,type BoardFileInspection} from './board-snapshots.js';
import {HttpError} from './security.js';
import {boardExample} from './board-example.js';
import type {ProjectBoard} from './boards.js';
import {linkBoardVersions} from './board-version-links.js';
import type {BoardBackups,BoardBackup} from './board-backups.js';
import {BOARD_LIMITS,boardSnapshot,boardErrors,normalizeBoard,archiveDescription,historyPointer,issuesFromZod,type BoardIssue,type BoardSnapshot,type MovedText} from '../src/board-contract.js';

const canonical='board-00000000-0000-4000-8000-000000000001.json';
const locks=new Map<string,Promise<unknown>>();
export async function serializeProjectBoard<T>(root:string,action:()=>Promise<T>):Promise<T>{
 const key=root.toLowerCase(),previous=locks.get(key)||Promise.resolve();
 const next=previous.catch(()=>{}).then(action);locks.set(key,next);
 try{return await next;}finally{if(locks.get(key)===next)locks.delete(key);}
}
export type BoardHealth={errors:number;warnings:number;fileBytes:number;backups:boolean;recovered?:{id:string;savedAt:number}};
export type BoardOptions={backups?:BoardBackups};
// One parse per file change: reads are keyed by the file's metadata stamp, like the live poll.
const inspections=new Map<string,BoardFileInspection>(),versionLinks=new Map<string,{at:number;key:string;value:Record<string,string>}>();
const inspectionKey=(root:string,file:string)=>path.resolve(root).toLowerCase()+'|'+file;
/** A write by this host drops the cached read at once, whatever the file metadata says. */
const forget=(root:string,file:string)=>{inspections.delete(inspectionKey(root,file));};
async function inspect(root:string,file:string){
 const key=inspectionKey(root,file),stamp=await boardSnapshotStamp(root,file),hit=inspections.get(key);
 if(hit?.stamp===stamp){inspections.delete(key);inspections.set(key,hit);return hit;}
 const value=await inspectBoardFile(root,file);inspections.delete(key);inspections.set(key,value);while(inspections.size>32)inspections.delete(inspections.keys().next().value!);return value;
}
/** Git refs change rarely; the board is read on every poll and every save. */
async function links(root:string,versions:string[],saved:Record<string,string>|undefined){
 const key=JSON.stringify([versions,saved]),hit=versionLinks.get(root);if(hit&&hit.key===key&&Date.now()-hit.at<5000)return hit.value;
 const value=await linkBoardVersions(root,versions,saved);versionLinks.set(root,{at:Date.now(),key,value});while(versionLinks.size>64)versionLinks.delete(versionLinks.keys().next().value!);return value;
}
async function boardFileName(root:string){
 try{const info=await lstat(path.join(root,'project-boards',canonical));if(info.isFile()&&!info.isSymbolicLink())return canonical;}catch(e:any){if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}
 const names=await boardFileNames(root);if(!names.length)return undefined;
 // Several legacy files: the first one that follows the contract wins; a lone broken file still opens with its diagnostics.
 for(const name of names)try{if(!boardErrors((await inspect(root,name)).issues).length)return name;}catch{/* Unreadable candidates are reported when they are the only file. */}
 return names[0];
}
export async function projectBoard(root:string,options:BoardOptions={}){
 const file=await boardFileName(root);if(!file)return null;
 const data=await inspect(root,file),errors=boardErrors(data.issues).length;let board=data.board,recovered:BoardHealth['recovered'];
 if(options.backups){
  if(!errors)await options.backups.record(root,file,data.text,true);
  // A file that is not JSON at all still shows the last good cards, read-only, next to the reason.
  else if(data.unreadable){const last=await options.backups.latestValid(root,file).catch(()=>undefined),parsed=last&&boardSnapshot.safeParse(JSON.parse(last.text));if(last&&parsed?.success){board=parsed.data;recovered={id:last.id,savedAt:last.savedAt};}}
 }
 const health:BoardHealth={errors,warnings:data.issues.length-errors,fileBytes:data.bytes,backups:!!options.backups,...(recovered?{recovered}:{})};
 return {...board,versionBranches:await links(root,board.versions,board.versionBranches),id:file.slice(6,-5),root,revision:0,versionSource:'planned' as const,repositoryFile:file,repositoryRevision:data.revision,branches:[] as string[],notes:board.notes.map(n=>({...n,owner:'',assigneeIds:[] as string[]})),issues:data.issues,health};
}
export type ProjectBoardView=NonNullable<Awaited<ReturnType<typeof projectBoard>>>;
const needsRepair=(issues:BoardIssue[])=>new BoardValidationError(boardErrors(issues),'The board file has format problems and is read-only until it is repaired. Use Repair on the board (MCP: repair_board), or restore a backup.','board_needs_repair',409);
/** A damaged board answers every write with its diagnosis before the request body is judged. */
export async function assertBoardEditable(root:string,options:BoardOptions={}){const current=await projectBoard(root,options);if(current?.health.errors)throw needsRepair(current.issues);}
export async function createProjectBoard(root:string,names:string[],language:'en'|'ru',options:BoardOptions={}){
 return serializeProjectBoard(root,async()=>{
  const existing=await projectBoard(root,options);
  if(existing){if(existing.issues.some(issue=>issue.code==='invalid_json'))throw new HttpError(409,'A board file already exists but cannot be read: '+existing.issues[0].message);return existing;}
  const example=boardExample(language);
  const board:ProjectBoard={id:canonical.slice(6,-5),name:language==='ru'?'Доска проекта':'Project board',root,revision:0,versionSource:'planned',...example};
  await saveBoardSnapshot(root,board,names,false);forget(root,canonical);return (await projectBoard(root,options))!;
 });
}
export async function updateProjectBoard(root:string,revision:string,notes:ProjectBoard['notes'],versions:string[],names:string[],canvas?:ProjectBoard['canvas'],options:BoardOptions={}){
 return serializeProjectBoard(root,async()=>{
  const current=await projectBoard(root,options);if(!current)throw new HttpError(404,'Project board not found');
  if(current.repositoryRevision!==revision)throw new HttpError(409,'The project board changed. Refresh before saving.');
  if(current.health.errors)throw needsRepair(current.issues);
  const previous=new Map(current.notes.map(note=>[note.id,note])),now=new Date().toISOString().slice(0,19)+'Z',moved:MovedText[]=[];
  const next=notes.map(note=>{
   // Status history belongs to the host: a client cannot drop or rewrite it, a real transition appends one entry.
   const old=previous.get(note.id);let statusHistory=old?.statusHistory||[];if(old?old.status!==note.status:note.status!=='idea')statusHistory=[...statusHistory,{status:note.status,at:now}].slice(-BOARD_LIMITS.statusHistory);
   let description=note.description;
   if(description.length>BOARD_LIMITS.description){const result=archiveDescription(description,historyPointer(note.id,/[а-яё]/i.test(description)));moved.push({noteId:note.id,title:note.title,label:'Description history',text:result.moved});description=result.kept;}
   const {statusHistory:_,...rest}=note;return {...rest,description,...(statusHistory.length?{statusHistory}:{})};
  });
  let value:BoardSnapshot;try{value=publicBoard({...current,notes:next,versions,...(canvas?{canvas}:{}),versionBranches:await links(root,versions,current.versionBranches)},names);}catch(error){throw error instanceof BoardValidationError?error.withTitles(new Map(current.notes.map(note=>[note.id,note.title]))):error;}
  const text=snapshotText(value);
  if(Buffer.byteLength(text)>BOARD_LIMITS.fileBytes)throw new HttpError(413,`The board would be ${(Buffer.byteLength(text)/1e6).toFixed(1)} MB; the limit is ${(BOARD_LIMITS.fileBytes/1e6).toFixed(1)} MB. Move card history to project-boards/history.`);
  await appendBoardHistory(root,moved,'description over the limit',names);
  await writeBoardSnapshot(root,current.repositoryFile,value);forget(root,current.repositoryFile);return (await projectBoard(root,options))!;
 });
}
/** Brings every record back inside the contract without losing text: removed parts go to project-boards/history. */
export async function repairProjectBoard(root:string,revision:string,options:BoardOptions={}){
 return serializeProjectBoard(root,async()=>{
  const current=await projectBoard(root,options);if(!current)throw new HttpError(404,'Project board not found');
  if(current.repositoryRevision!==revision)throw new HttpError(409,'The project board changed. Refresh before repairing.');
  const data=await inspect(root,current.repositoryFile);
  if(data.unreadable)throw new HttpError(409,'The board file is not valid JSON, so single cards cannot be repaired. Restore a backup or correct the file by hand.');
  if(!boardErrors(data.issues).length)return {board:current,fixed:0,history:[] as string[]};
  const fixed=normalizeBoard(JSON.parse(data.text.charCodeAt(0)===0xFEFF?data.text.slice(1):data.text),'repair',randomUUID),blocking=fixed.issues.filter(issue=>!issue.fix);
  if(blocking.length)throw new BoardValidationError(blocking,'Automatic repair cannot fix these problems; correct the file or restore a backup.','board_unrepairable',409);
  const strict=boardSnapshot.safeParse(fixed.board);if(!strict.success)throw new BoardValidationError(issuesFromZod(strict.error,fixed.board),'Automatic repair could not bring the board inside the contract.','board_unrepairable',409);
  const text=snapshotText(strict.data);
  if(Buffer.byteLength(text)>BOARD_LIMITS.fileBytes)throw new HttpError(413,`The repaired board would still be ${(Buffer.byteLength(text)/1e6).toFixed(1)} MB; the limit is ${(BOARD_LIMITS.fileBytes/1e6).toFixed(1)} MB.`);
  await options.backups?.record(root,current.repositoryFile,data.text,false);
  const history=await appendBoardHistory(root,fixed.moved,'repair');
  await writeBoardText(root,current.repositoryFile,text);forget(root,current.repositoryFile);
  return {board:(await projectBoard(root,options))!,fixed:fixed.issues.length,history};
 });
}
export async function projectBoardBackups(root:string,options:BoardOptions={}):Promise<BoardBackup[]>{
 const file=await boardFileName(root);if(!file||!options.backups)return [];return options.backups.list(root,file);
}
export async function restoreProjectBoard(root:string,revision:string,backup:string,options:BoardOptions={}){
 return serializeProjectBoard(root,async()=>{
  if(!options.backups)throw new HttpError(404,'Board backups are unavailable on this host.');
  const current=await projectBoard(root,options);if(!current)throw new HttpError(404,'Project board not found');
  if(current.repositoryRevision!==revision)throw new HttpError(409,'The project board changed. Refresh before restoring.');
  const text=await options.backups.read(root,current.repositoryFile,backup);let value:BoardSnapshot;
  try{value=boardSnapshot.parse(JSON.parse(text));}catch{throw new HttpError(409,'That backup does not follow the board contract; choose another one.');}
  // The replaced content stays available, so a restore can itself be undone.
  await options.backups.record(root,current.repositoryFile,(await inspect(root,current.repositoryFile)).text,!current.health.errors);
  await writeBoardText(root,current.repositoryFile,snapshotText(value));forget(root,current.repositoryFile);return (await projectBoard(root,options))!;
 });
}
export async function deleteProjectBoard(root:string,revision:string,options:BoardOptions={}){
 return serializeProjectBoard(root,async()=>{
  const current=await projectBoard(root,options);if(!current)throw new HttpError(404,'Project board not found');
  if(current.repositoryRevision!==revision)throw new HttpError(409,'The project board changed. Refresh before deleting.');
  await options.backups?.record(root,current.repositoryFile,(await inspect(root,current.repositoryFile)).text,!current.health.errors);
  await deleteBoardSnapshot(root,current.repositoryFile);forget(root,current.repositoryFile);
 });
}
