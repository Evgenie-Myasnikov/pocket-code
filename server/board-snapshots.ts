import {lstat,mkdir,readFile,readdir,rename,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {HttpError} from './security.js';
import type {ProjectBoard} from './boards.js';
const exec=promisify(execFile),text=z.string().max(20000);
const publicNote=z.object({id:z.string().uuid(),title:z.string().min(1).max(160),description:text,branch:z.string().max(300),status:z.enum(['idea','questions','ready','working','review','done']),priority:z.enum(['critical','high','normal','low']),x:z.number().min(0).max(20000),y:z.number().min(0).max(20000),dependencies:z.array(z.string().uuid()).max(100)}).strict();
const snapshot=z.object({format:z.literal('pocket-code-board'),version:z.literal(1),name:z.string().min(1).max(160),versions:z.array(z.string().min(1).max(300)).max(40),notes:z.array(publicNote).max(500)}).strict();
export function publicBoard(board:ProjectBoard,privateNames:string[]=[]){
 const value=snapshot.parse({format:'pocket-code-board',version:1,name:board.name,versions:board.versions,notes:board.notes.map(n=>({id:n.id,title:n.title,description:n.description,branch:n.branch,status:n.status,priority:n.priority||'normal',x:n.x,y:n.y,dependencies:n.dependencies}))});
 const prose=[value.name,...value.versions,...value.notes.flatMap(n=>[n.title,n.description,n.branch])].join('\n');
 if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[A-Z]:\\(?:Users|Documents and Settings)\\)|(?:Bearer\s+[\w.-]{12,})|(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)|(?:\b(?:sk-|ghp_|github_pat_)[\w-]{16,})/i.test(prose)||privateNames.some(name=>name.trim().length>=3&&prose.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase())))throw new HttpError(400,'The board text may contain personal data. Remove names, email addresses, personal paths or credentials before saving a shared snapshot.');
 return value;
}
async function folder(root:string,create=false,verifyGit=true){
 if(verifyGit){const {stdout}=await exec('git',['rev-parse','--show-toplevel'],{cwd:root,windowsHide:true,timeout:10000});if(path.resolve(stdout.trim()).toLowerCase()!==path.resolve(root).toLowerCase())throw new HttpError(400,'Select the Git repository root');}
 let current=root;for(const name of ['project-boards']){current=path.join(current,name);if(create)await mkdir(current).catch(e=>{if(e.code!=='EEXIST')throw e;});const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory())throw new HttpError(403,'Board snapshots cannot use linked directories');}return current;
}
const filename=z.string().regex(/^board-[a-f0-9-]+\.json$/);
export async function saveBoardSnapshot(root:string,board:ProjectBoard,names:string[]){const value=publicBoard(board,names),directory=await folder(root,true),file='board-'+board.id+'.json',target=path.join(directory,file);try{if((await lstat(target)).isSymbolicLink())throw new HttpError(403,'Linked snapshot files are not allowed');}catch(e:any){if(e.code!=='ENOENT')throw e;}const content=JSON.stringify(value,null,2)+'\n';if(Buffer.byteLength(content)>2_000_000)throw new HttpError(413,'Board snapshot exceeds the size limit');const temp=path.join(directory,'.'+randomUUID()+'.tmp');try{await writeFile(temp,content,{flag:'wx',mode:0o600});await rename(temp,target);}finally{await unlink(temp).catch(()=>{});}return {path:'project-boards/'+file};}
export async function readBoardSnapshot(root:string,file:string,verifyGit=true){const target=path.join(await folder(root,false,verifyGit),filename.parse(file)),info=await lstat(target);if(info.isSymbolicLink()||!info.isFile()||info.size>2_000_000)throw new HttpError(400,'Invalid board snapshot');return snapshot.parse(JSON.parse(await readFile(target,'utf8')));}
export async function listBoardSnapshots(root:string,verifyGit=true){let directory:string;try{directory=await folder(root,false,verifyGit);}catch(e:any){if(e.code==='ENOENT')return [];throw e;}const files=(await readdir(directory)).filter(file=>filename.safeParse(file).success).slice(0,100);const result=[];for(const file of files)try{const board=await readBoardSnapshot(root,file,false);result.push({file,name:board.name,noteCount:board.notes.length});}catch{/* Malformed or linked files are never imported. */}return result;}
