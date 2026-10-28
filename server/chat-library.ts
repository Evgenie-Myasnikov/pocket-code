import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
type Entry={title?:string;deleted?:boolean};
type Library={chats:Record<string,Entry>;projects:string[]};
export class ChatLibrary {
 private pending:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 async read():Promise<Library>{
  try{const data=JSON.parse(await readFile(this.file,'utf8'));if(!data.chats||typeof data.chats!=='object'||!Array.isArray(data.projects))throw Error('Invalid chat library');return data;}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {chats:{},projects:[]};throw error;}
 }
 async edit(change:(data:Library)=>void){
  const write=this.pending.catch(()=>{}).then(async()=>{const data=await this.read();change(data);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(data));await rename(this.file+'.tmp',this.file);});this.pending=write;await write;
 }
 async decorate<T extends {sessionId:string}>(provider:string,sessions:T[]){const data=await this.read();return sessions.filter(s=>!data.chats[provider+':'+s.sessionId]?.deleted).map(s=>{const title=data.chats[provider+':'+s.sessionId]?.title;return title?{...s,customTitle:title}:s;});}
}
