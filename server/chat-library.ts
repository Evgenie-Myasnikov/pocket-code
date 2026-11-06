import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
/** The board a chat was started from. Host-private: repository boards never store chat associations. */
export type BoardLink={id:string;root:string;title:string;noteId?:string;kind?:'discussion'|'note'|'task'};
type Entry={title?:string;deleted?:boolean;board?:BoardLink;account?:string};
type Library={chats:Record<string,Entry>;projects:string[]};
export class ChatLibrary {
 private pending:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 async read():Promise<Library>{
  // Windows briefly locks the file while edit() replaces it; retry instead of failing the chat list.
  for(let attempt=0;;attempt++){try{return await this.readOnce();}catch(error){const code=(error as NodeJS.ErrnoException).code;if(attempt<4&&(code==='EPERM'||code==='EBUSY'||code==='EACCES'))await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));else throw error;}}
 }
 private async readOnce():Promise<Library>{
  try{const data=JSON.parse(await readFile(this.file,'utf8'));if(!data.chats||typeof data.chats!=='object'||!Array.isArray(data.projects))throw Error('Invalid chat library');return data;}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {chats:{},projects:[]};throw error;}
 }
 async edit(change:(data:Library)=>void){
  const write=this.pending.catch(()=>{}).then(async()=>{const data=await this.read();change(data);await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(data));for(let attempt=0;;attempt++){try{await rename(this.file+'.tmp',this.file);break;}catch(error){const code=(error as NodeJS.ErrnoException).code;if(attempt<4&&(code==='EPERM'||code==='EBUSY'||code==='EACCES'))await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)));else throw error;}}});this.pending=write;await write;
 }
 /** Record the custom provider account of a Claude chat; only writes when it changes. */
 async tagAccount(sessionId:string,account:string){const key='claude:'+sessionId;if((await this.read()).chats[key]?.account===account)return;await this.edit(data=>{data.chats[key]={...data.chats[key],account};});}
 async decorate<T extends {sessionId:string}>(provider:string,sessions:T[],boardLinks?:Map<string,BoardLink>){const data=await this.read();return sessions.filter(s=>!data.chats[provider+':'+s.sessionId]?.deleted).map(s=>{const entry=data.chats[provider+':'+s.sessionId];return {...s,...(entry?.title?{customTitle:entry.title}:{}),...(entry?.account?{account:entry.account}:{}),...(entry?.board?{board:entry.board}:boardLinks?.has(provider+':'+s.sessionId)?{board:boardLinks.get(provider+':'+s.sessionId)}:{})};});}
}
