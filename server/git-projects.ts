import path from 'node:path';
import {readdir,realpath,lstat,readFile} from 'node:fs/promises';
import {within} from './security.js';

const ignored=new Set(['.git','.hg','.svn','node_modules','vendor','dist','build','target','bin','obj','coverage','.cache','.local','.tools','.gradle','.venv','venv','__pycache__','$recycle.bin','system volume information','windows','program files','program files (x86)','programdata','appdata']);

/** Incremental discovery; shared by clients and never follows directory junctions. */
export class GitProjects {
  private pending:string[]=[];
  private cursor=0;
  private seen=new Set<string>();
  private found=new Set<string>();
  private next=new Set<string>();
  private completedAt=0;
  private started=false;
  private reading?:Promise<string[]>;
  constructor(private roots:string[],private options={batch:512,budgetMs:200,ttlMs:300000}){}
  list():Promise<string[]>{
    if(this.reading)return this.reading;
    this.reading=this.advance().finally(()=>{this.reading=undefined;});return this.reading;
  }
  private async advance(){
    if(!this.started||this.cursor>=this.pending.length&&Date.now()-this.completedAt>=this.options.ttlMs){
      this.pending=[...this.roots];this.cursor=0;this.seen.clear();this.next.clear();this.started=true;
    }
    const until=Date.now()+this.options.budgetMs;
    let count=0;
    while(this.cursor<this.pending.length&&count++<this.options.batch&&Date.now()<until){
      const directory=this.pending[this.cursor++];
      try{
        const resolved=await realpath(directory);
        if(!this.roots.some(root=>within(root,resolved))||this.seen.has(resolved))continue;
        this.seen.add(resolved);
        const entries=await readdir(resolved,{withFileTypes:true});
        const git=entries.find(entry=>entry.name==='.git');
        if(git&&!git.isSymbolicLink()){
          let valid=false;
          if(git.isDirectory())valid=(await lstat(path.join(resolved,'.git','HEAD')).catch(()=>null))?.isFile()===true;
          else if(git.isFile()){
            const marker=path.join(resolved,'.git');
            if((await lstat(marker)).size<=4096)valid=/^gitdir: .+/m.test(await readFile(marker,'utf8'));
          }
          if(valid){this.next.add(resolved);this.found.add(resolved);}
        }
        for(const entry of entries)if(entry.isDirectory()&&!entry.isSymbolicLink()&&!ignored.has(entry.name.toLowerCase()))this.pending.push(path.join(resolved,entry.name));
      }catch{/* Removed and inaccessible folders do not abort discovery. */}
    }
    if(this.cursor>=this.pending.length){this.found=new Set(this.next);if(!this.completedAt||count>0)this.completedAt=Date.now();}
    // Revalidate cached paths: a removed directory or redirected junction grants no access.
    const valid=await Promise.all([...this.found].map(async folder=>{try{const resolved=await realpath(folder);return resolved===folder&&this.roots.some(root=>within(root,resolved))?folder:null;}catch{return null;}}));
    return valid.filter((folder):folder is string=>folder!==null).sort((a,b)=>a.localeCompare(b));
  }
}
