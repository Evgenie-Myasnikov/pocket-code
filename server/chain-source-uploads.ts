import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readdir,readFile,realpath,rmdir,unlink,writeFile} from 'node:fs/promises';
import {replaceFile} from './fs-retry.js';
import path from 'node:path';
import {HttpError,safeFilename} from './security.js';

/** Share immutable source copies across attempts so retries keep the same paths. */
export async function stageChainUploads(directory:string,chainId:string,files:ReadonlyArray<{name:string;text?:string}>){
  const entries:[string,string][]=[];
  const folder=path.join(directory,'.tasks','chain-sources',chainId);
  for(const file of files){
    if(file.text===undefined)continue;
    const digest=createHash('sha256').update(file.text).digest('hex');
    const location=path.join(folder,digest+'-'+safeFilename(file.name).replace(/[. ]+$/,''));
    try {
      if(await readFile(location,'utf8')!==file.text)throw new HttpError(409,'The saved source copy changed. Restore the attachment before continuing.');
    } catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
      await mkdir(folder,{recursive:true,mode:0o700});
      const temporary=path.join(folder,randomUUID()+'.tmp');
      try {
        await writeFile(temporary,file.text,{flag:'wx',mode:0o600});
        await replaceFile(temporary,location);
      } finally {
        await unlink(temporary).catch(()=>{});
      }
    }
    entries.push([file.name,location]);
  }
  return Object.fromEntries(entries) as Record<string,string>;
}

/** Erase only copies made by the chain runner. Originals in the project and Git worktrees belong to the user. */
export async function purgeChainCopies(directory:string,chainId:string,jobIds:string[]){
  const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if(!uuid.test(chainId)||jobIds.some(id=>!uuid.test(id)))throw new HttpError(400,'Invalid task attachment identifier.');
  const missing=(error:unknown)=>(error as NodeJS.ErrnoException).code==='ENOENT';
  let root:string;
  try{root=await realpath(directory);}catch(error){if(missing(error))return;throw error;}
  async function existingFolder(expected:string){
    let actual:string;
    try{actual=await realpath(expected);}catch(error){if(missing(error))return;throw error;}
    if(path.relative(expected,actual)!=='')throw new HttpError(409,'The task attachment directory has moved. Its files were kept.');
    return actual;
  }
  async function removeFile(file:string){
    try{await unlink(file);}catch(error){if(!missing(error))throw error;}
  }
  const folder=await existingFolder(path.join(root,'.tasks','chain-sources',chainId));
  if(folder){
    const entries=await readdir(folder,{withFileTypes:true});
    if(entries.some(entry=>!entry.isFile()||!(/^([a-f0-9]{64})-/.test(entry.name)||entry.name.endsWith('.tmp')&&uuid.test(entry.name.slice(0,-4)))))
      throw new HttpError(409,'Unexpected files in the task attachment directory were kept.');
    for(const entry of entries)await removeFile(path.join(folder,entry.name));
    try{await rmdir(folder);}catch(error){if(!missing(error))throw error;}
  }
  for(const id of new Set(jobIds)){
    const job=await existingFolder(path.join(root,id));
    if(job)await removeFile(path.join(job,'markdown-step.md'));
  }
}
