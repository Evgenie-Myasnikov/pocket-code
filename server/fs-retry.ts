import {rename} from 'node:fs/promises';

/**
 * Windows briefly locks a file while another reader, the indexer or a virus scanner has it open, and a rename over
 * it then fails with EPERM, EBUSY or EACCES. Replacing a file is retried for a moment instead of failing the save.
 */
export async function replaceFile(from:string,to:string){
 for(let attempt=0;;attempt++){
  try{await rename(from,to);return;}
  catch(error){const code=(error as NodeJS.ErrnoException).code;if(attempt<6&&(code==='EPERM'||code==='EBUSY'||code==='EACCES'))await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));else throw error;}
 }
}
