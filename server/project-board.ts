import {createHash} from 'node:crypto';
import {listBoardSnapshots,readBoardSnapshot,saveBoardSnapshot} from './board-snapshots.js';
import {HttpError} from './security.js';
import {boardExample} from './board-example.js';
import type {ProjectBoard} from './boards.js';

const canonical='board-00000000-0000-4000-8000-000000000001.json';
const locks=new Map<string,Promise<unknown>>();
export async function serializeProjectBoard<T>(root:string,action:()=>Promise<T>):Promise<T>{
 const key=root.toLowerCase(),previous=locks.get(key)||Promise.resolve();
 const next=previous.catch(()=>{}).then(action);locks.set(key,next);
 try{return await next;}finally{if(locks.get(key)===next)locks.delete(key);}
}
export async function projectBoard(root:string){
 let canonicalExists=false;try{await readBoardSnapshot(root,canonical,false);canonicalExists=true;}catch(e:any){if(e.code!=='ENOENT')throw e;}
 const entries=await listBoardSnapshots(root,false);
 const file=(canonicalExists?canonical:undefined)||entries.map(e=>e.file).sort()[0];
 if(!file)return null;
 const data=await readBoardSnapshot(root,file,false);
 return {...data,id:file.slice(6,-5),root,revision:0,versionSource:'planned' as const,repositoryFile:file,repositoryRevision:createHash('sha256').update(JSON.stringify(data)).digest('hex'),branches:[],notes:data.notes.map(n=>({...n,owner:'',assigneeIds:[]}))};
}
export async function createProjectBoard(root:string,names:string[],language:'en'|'ru'){
 return serializeProjectBoard(root,async()=>{
  const existing=await projectBoard(root);if(existing)return existing;
  const example=boardExample(language);
  const board:ProjectBoard={id:canonical.slice(6,-5),name:language==='ru'?'Доска проекта':'Project board',root,revision:0,versionSource:'planned',...example};
  await saveBoardSnapshot(root,board,names,false);return (await projectBoard(root))!;
 });
}
export async function updateProjectBoard(root:string,revision:string,notes:ProjectBoard['notes'],versions:string[],names:string[]){
 return serializeProjectBoard(root,async()=>{
  const current=await projectBoard(root);if(!current)throw new HttpError(404,'Project board not found');
  if(current.repositoryRevision!==revision)throw new HttpError(409,'The project board changed. Refresh before saving.');
  await saveBoardSnapshot(root,{...current,notes,versions},names,false);return (await projectBoard(root))!;
 });
}
