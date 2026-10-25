import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export type BoardMcpConfig={command:string;args:string[];env:Record<string,string>};
export type BoardMcpConfiguration=(root:string)=>Record<string,BoardMcpConfig>;
export type BoardMcpStatus={state:'waiting'|'ready'|'restarting'|'error';connections:number;tools:string[]};
const key=(root:string)=>process.platform==='win32'?path.resolve(root).toLowerCase():path.resolve(root);
export class BoardMcpRuntime{
 private entries=new Map<string,{generation:string;openings:string[]}>();
 private boot=randomUUID();
 private workers=new Map<string,Map<string,{generation:string;state:'ready'|'error';tools:string[];seen:number}>>();
 constructor(private dataDir:string,private port=Number(process.env.POCKET_PORT||4318),private onOpen:(root:string)=>void=()=>{}){}
 read(root:string){return {generation:this.entries.get(key(root))?.generation||this.boot,worker:fileURLToPath(new URL('../scripts/board-mcp-worker.mjs',import.meta.url))};}
 report(root:string,instance:string,generation:string,state:'ready'|'error',tools:string[]){
  const k=key(root);let workers=this.workers.get(k);if(!workers){if(this.workers.size>=256)this.workers.delete(this.workers.keys().next().value!);workers=new Map();this.workers.set(k,workers);}
  workers.delete(instance);workers.set(instance,{generation,state,tools,seen:Date.now()});while(workers.size>32)workers.delete(workers.keys().next().value!);
 }
 status(root:string):BoardMcpStatus{
  const workers=this.workers.get(key(root));for(const [id,w] of workers||[])if(Date.now()-w.seen>6500)workers!.delete(id);
  const all=[...(workers?.values()||[])],generation=this.read(root).generation,ready=all.filter(w=>w.generation===generation&&w.state==='ready');
  return {state:!all.length?'waiting':all.some(w=>w.generation===generation&&w.state==='error')?'error':ready.length===all.length?'ready':'restarting',connections:all.length,tools:[...new Set(ready.flatMap(w=>w.tools))].sort()};
 }
 open(root:string,opening:string){
  const k=key(root),entry=this.entries.get(k);if(entry?.openings.includes(opening))return this.read(root);
  this.entries.delete(k);this.entries.set(k,{generation:randomUUID(),openings:[...(entry?.openings||[]),opening].slice(-32)});
  while(this.entries.size>256)this.entries.delete(this.entries.keys().next().value!);
  this.onOpen(root);
  return this.read(root);
 }
 configuration:BoardMcpConfiguration=(root):Record<string,BoardMcpConfig>=>this.entries.has(key(root))?{'pocket-code-boards':{
  command:process.execPath,args:[fileURLToPath(new URL('../scripts/board-mcp.mjs',import.meta.url)),`project=${path.resolve(root)}`],
  env:{POCKET_DATA_DIR:this.dataDir,POCKET_PORT:String(this.port)}
 }}:{};
}
