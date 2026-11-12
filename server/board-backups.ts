import {mkdir,readdir,readFile,stat,unlink,writeFile} from 'node:fs/promises';
import {replaceFile} from './fs-retry.js';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {HttpError} from './security.js';

export type BoardBackup={id:string;savedAt:number;bytes:number;valid:boolean};
const name=/^(\d{10,16})-([a-f0-9]{16})-(ok|bad)\.json$/;
/**
 * Private host copies of board files, outside the repository. A valid file is remembered whenever its content
 * changes, and the content before every host write, repair or restore is kept, so a board that was broken by a
 * direct file edit can be rolled back to the last good snapshot.
 */
export class BoardBackups{
 private latest=new Map<string,string>();
 private queue=Promise.resolve();
 constructor(private directory:string,private keepValid=20,private keepInvalid=5){}
 private folder(root:string,file:string){return path.join(this.directory,createHash('sha256').update(path.resolve(root).toLowerCase()+'|'+file).digest('hex').slice(0,24));}
 private async entries(folder:string){let files:string[]=[];try{files=await readdir(folder);}catch(e:any){if(e.code!=='ENOENT')throw e;}return files.map(file=>({file,match:name.exec(file)})).filter(entry=>entry.match).map(({file,match})=>({file,savedAt:Number(match![1]),hash:match![2],valid:match![3]==='ok'})).sort((a,b)=>b.savedAt-a.savedAt);}
 /** Never fails a read or a write: a backup problem is reported to the caller as false. */
 record(root:string,file:string,text:string,valid:boolean):Promise<boolean>{
  const key=this.folder(root,file),hash=createHash('sha256').update(text).digest('hex').slice(0,16),mark=hash+(valid?'-ok':'-bad');
  if(this.latest.get(key)===mark)return Promise.resolve(true);
  const run=this.queue.then(async()=>{
   await mkdir(key,{recursive:true});
   const existing=await this.entries(key),same=existing.find(entry=>entry.hash===hash&&entry.valid===valid),target=path.join(key,`${Date.now()}-${hash}-${valid?'ok':'bad'}.json`);
   // The same content seen again becomes the newest entry instead of a duplicate.
   if(same){if(existing[0]!==same)await replaceFile(path.join(key,same.file),target);}
   else{const temp=path.join(key,'.'+randomUUID()+'.tmp');try{await writeFile(temp,text,{flag:'wx',mode:0o600});await replaceFile(temp,target);}finally{await unlink(temp).catch(()=>{});}}
   const all=await this.entries(key);let good=0,bad=0;
   for(const entry of all){if(entry.valid?++good>this.keepValid:++bad>this.keepInvalid)await unlink(path.join(key,entry.file)).catch(()=>{});}
   this.latest.set(key,mark);if(this.latest.size>256)this.latest.delete(this.latest.keys().next().value!);return true;
  }).catch(()=>false);
  this.queue=run.then(()=>{});return run;
 }
 async list(root:string,file:string):Promise<BoardBackup[]>{
  await this.queue;const folder=this.folder(root,file),result:BoardBackup[]=[];
  for(const entry of await this.entries(folder))try{result.push({id:entry.file.slice(0,-5),savedAt:entry.savedAt,bytes:(await stat(path.join(folder,entry.file))).size,valid:entry.valid});}catch{/* Pruned between listing and stat. */}
  return result;
 }
 async read(root:string,file:string,id:string){
  if(!name.test(id+'.json'))throw new HttpError(400,'Invalid backup id');
  try{return await readFile(path.join(this.folder(root,file),id+'.json'),'utf8');}catch(e:any){if(e.code==='ENOENT')throw new HttpError(404,'Backup not found');throw e;}
 }
 async latestValid(root:string,file:string){const found=(await this.list(root,file)).find(entry=>entry.valid);return found?{...found,text:await this.read(root,file,found.id)}:undefined;}
}
