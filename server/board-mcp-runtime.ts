import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export type BoardMcpConfig={command:string;args:string[];env:Record<string,string>};
export type BoardMcpConfiguration=(root:string)=>Record<string,BoardMcpConfig>;
const key=(root:string)=>process.platform==='win32'?path.resolve(root).toLowerCase():path.resolve(root);
export class BoardMcpRuntime{
 private entries=new Map<string,{generation:string;openings:string[]}>();
 private boot=randomUUID();
 constructor(private dataDir:string,private port=Number(process.env.POCKET_PORT||4318)){}
 read(root:string){return {generation:this.entries.get(key(root))?.generation||this.boot,worker:fileURLToPath(new URL('../scripts/board-mcp-worker.mjs',import.meta.url))};}
 open(root:string,opening:string){
  const k=key(root),entry=this.entries.get(k);if(entry?.openings.includes(opening))return this.read(root);
  this.entries.delete(k);this.entries.set(k,{generation:randomUUID(),openings:[...(entry?.openings||[]),opening].slice(-32)});
  while(this.entries.size>256)this.entries.delete(this.entries.keys().next().value!);
  return this.read(root);
 }
 configuration:BoardMcpConfiguration=(root):Record<string,BoardMcpConfig>=>this.entries.has(key(root))?{'pocket-code-boards':{
  command:process.execPath,args:[fileURLToPath(new URL('../scripts/board-mcp.mjs',import.meta.url)),`project=${path.resolve(root)}`],
  env:{POCKET_DATA_DIR:this.dataDir,POCKET_PORT:String(this.port)}
 }}:{};
}
