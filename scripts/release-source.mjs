import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function releaseSource(root=process.cwd(),requireClean=false){
 const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:10000}).trim();
 const branch=git('symbolic-ref','--quiet','--short','HEAD');
 if(!branch)throw Error('Release requires a named Git branch');
 if(requireClean&&git('status','--porcelain'))throw Error('Release source must be a clean, reviewed commit');
 return {branch,commit:git('rev-parse','HEAD')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(releaseSource(process.cwd(),process.argv.includes('--require-clean'))));
