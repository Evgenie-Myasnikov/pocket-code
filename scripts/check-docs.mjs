import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const paths=['README.md',...(await readdir(path.join(root,'docs'))).filter(name=>name.endsWith('.md')).map(name=>'docs/'+name)];
const errors=[];
for(const file of paths){
 const text=await readFile(path.join(root,file),'utf8');
 const links=[...text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g),...text.matchAll(/\b(?:src|href)="([^"]+)"/g)];
 for(const match of links){
  const href=match[1];if(/^(?:[a-z]+:|#|\/\/)/i.test(href))continue;
  const target=decodeURIComponent(href.split('#')[0]);if(!target)continue;
  const absolute=path.resolve(root,path.dirname(file),target);
  if(path.relative(root,absolute).startsWith('..')){errors.push(file+': link outside repository');continue;}
  try{await access(absolute);}catch{errors.push(file+': missing '+target);}
 }
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Local documentation links and images verified in '+paths.length+' files.');
