import {copyFile,open,readFile} from 'node:fs/promises';
import path from 'node:path';
import {replaceFile} from './fs-retry.js';

const missing=(error:unknown)=>(error as NodeJS.ErrnoException|null)?.code==='ENOENT';
/** A file another process holds for a moment (indexer, virus scanner): the caller retries instead of treating it as damage. */
export const fileBusy=(error:unknown)=>{const code=(error as NodeJS.ErrnoException|null)?.code;return code==='EPERM'||code==='EBUSY'||code==='EACCES';};

/**
 * Replaces a host file so that a power loss or a killed process leaves the previous or the new content, never a
 * zero-filled file: the new content is flushed to the disk before it takes the file's name.
 * With `backup` the content being replaced stays beside it as `<file>.bak`.
 */
export async function writeDurable(file:string,text:string,options:{backup?:boolean;mode?:number;temp?:string}={}){
  const temp=options.temp||file+'.tmp';
  const handle=await open(temp,'w',options.mode??0o600);
  try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
  // The backup is a convenience: a missing or locked file never fails the save itself.
  if(options.backup)await copyFile(file,file+'.bak').catch(()=>{});
  await replaceFile(temp,file);
}

export type GuardedRead<T>={value:T|undefined;recovered?:'backup'|'reset'};
/**
 * Reads a JSON store that must not take its feature down. A missing file is an empty store. A damaged one
 * (unreadable JSON or an unexpected shape) is kept beside the store as `<file>.corrupt-<time>`, and the store
 * continues from its backup or, without one, from empty. Only a file that cannot be opened at all still throws.
 */
export async function readGuarded<T>(file:string,valid:(value:unknown)=>boolean,restore=true):Promise<GuardedRead<T>>{
  const parse=async(target:string)=>{const value:unknown=JSON.parse((await readFile(target,'utf8')).replace(/^﻿/,''));if(!valid(value))throw new SyntaxError('Unexpected store content');return value as T;};
  try{return {value:await parse(file)};}
  catch(error){
    if(missing(error))return {value:undefined};
    if(!(error instanceof SyntaxError))throw error;
  }
  let value:T|undefined;
  try{value=await parse(file+'.bak');}catch{value=undefined;}
  let kept=true;
  try{await replaceFile(file,file+'.corrupt-'+Date.now());}catch{kept=false;}
  if(value!==undefined&&kept&&restore)await writeDurable(file,JSON.stringify(value)).catch(()=>{});
  console.error(new Date().toISOString(),'Damaged host file',path.basename(file)+':',value!==undefined?'continued from its backup.':'started empty.',kept?'The damaged copy was kept beside it.':'');
  return {value,recovered:value!==undefined?'backup':'reset'};
}
