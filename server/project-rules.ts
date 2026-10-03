import path from 'node:path';
import {lstat,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {boardInstructions} from './board-instructions.js';
import {sharedWorkflowInstructions} from './shared-workflow.js';
import {HttpError} from './security.js';

const filename='.pocket-code-rules.json';
export const builtInBoardRulePath='pocket-code:board-maintenance';
export async function projectRuleSettings(root:string){
  const file=path.join(root,filename);
  try{
    const info=await lstat(file);
    if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw new HttpError(400,'Invalid project rule settings');
    const data=JSON.parse(await readFile(file,'utf8'));
    if(data.version!==1||typeof data.boardMaintenance!=='boolean')throw new HttpError(400,'Invalid project rule settings');
    return {boardMaintenance:data.boardMaintenance as boolean};
  }catch(error:any){if(error.code==='ENOENT')return {boardMaintenance:true};throw error;}
}
export async function saveProjectRuleSettings(root:string,enabled:boolean){
  await projectRuleSettings(root);
  const file=path.join(root,filename),temp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,JSON.stringify({version:1,boardMaintenance:enabled},null,2)+'\n',{flag:'wx'});await rename(temp,file);}
  finally{await unlink(temp).catch(()=>{});}
  return {boardMaintenance:enabled};
}
export async function projectBoardInstructions(root:string){
  return (await projectRuleSettings(root)).boardMaintenance?boardInstructions:sharedWorkflowInstructions+'\nPocket Code automatic board maintenance is disabled for this project. Do not apply earlier Pocket Code board-maintenance guidance automatically. Explicit user requests and independently loaded repository rules still apply.';
}
