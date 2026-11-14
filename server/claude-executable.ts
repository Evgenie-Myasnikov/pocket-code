import {execFile} from 'node:child_process';
import {createRequire} from 'node:module';
import {access} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';

/**
 * Claude turns run with the newest Claude Code found on this PC: the one bundled with the host or the one the person
 * installed. A new model can require a newer CLI than the bundle, and the installed one updates itself.
 */
type Found={file:string;version:string;source:'bundled'|'installed'};
const exe=process.platform==='win32'?'claude.exe':'claude';
const parse=(text:string)=>text.match(/\b(\d+)\.(\d+)\.(\d+)\b/)?.slice(1).map(Number);
const newer=(a:number[],b:number[])=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
const read=(file:string)=>new Promise<string|undefined>(resolve=>execFile(file,['--version'],{windowsHide:true,timeout:10000,maxBuffer:4096},(error,stdout)=>resolve(error?undefined:parse(String(stdout))?.join('.'))));
function bundled(){try{return createRequire(import.meta.url).resolve(`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/${exe}`);}catch{return undefined;}}
export async function installedClaude(){
 const files=[process.env.POCKET_CLAUDE_EXECUTABLE,path.join(homedir(),'.local','bin',exe),...(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,exe))];
 for(const file of files){if(!file||!/claude(\.exe)?$/i.test(file))continue;try{await access(file);return file;}catch{/* Try the next place. */}}
 return undefined;
}
let cached:{at:number;value:Promise<Found[]>}|undefined;
export function claudeCandidates(fresh=false){
 if(!fresh&&cached&&Date.now()-cached.at<600000)return cached.value;
 const value=(async()=>{
  const list:Found[]=[];
  for(const [file,source] of [[bundled(),'bundled'],[await installedClaude(),'installed']] as const){if(!file)continue;const version=await read(file);if(version)list.push({file,version,source});}
  return list;
 })();
 cached={at:Date.now(),value};return value;
}
let chosen:{pathToClaudeCodeExecutable?:string}={};
const choose=(list:Found[])=>{const own=list.find(item=>item.source==='bundled'),other=list.find(item=>item.source==='installed');return other&&(!own||newer(parse(other.version)!,parse(own.version)!)>0)?{pathToClaudeCodeExecutable:other.file}:{};};
/** Looks for Claude Code in the background; a run never waits for it. */
export function warmClaudeExecutable(fresh=false){return claudeCandidates(fresh).then(list=>{chosen=choose(list);return list;}).catch(()=>[] as Found[]);}
/** The SDK option for a run: empty (the bundle) until the search has finished or when the bundle is the newest. */
export function claudeExecutableOption():{pathToClaudeCodeExecutable?:string}{
 return process.env.CLAUDE_EXECUTABLE?{pathToClaudeCodeExecutable:process.env.CLAUDE_EXECUTABLE}:chosen;
}
export async function claudeRuntime(fresh=false){
 const list=await warmClaudeExecutable(fresh),option=claudeExecutableOption();
 return {bundled:list.find(item=>item.source==='bundled')?.version,installed:list.find(item=>item.source==='installed')?.version,using:option.pathToClaudeCodeExecutable&&!process.env.CLAUDE_EXECUTABLE?'installed':'bundled',canUpdate:!!list.find(item=>item.source==='installed')};
}
let updating:Promise<{ok:boolean;message:string}>|undefined;
/** Runs the installed Claude Code's own updater. Nothing is downloaded by the host itself. */
export function updateInstalledClaude(){
 return updating||=(async()=>{
  try{
   const file=await installedClaude();if(!file)return {ok:false,message:'Claude Code is not installed on this PC'};
   const result=await new Promise<{ok:boolean;text:string}>(resolve=>execFile(file,['update'],{windowsHide:true,timeout:300000,maxBuffer:256*1024},(error,stdout,stderr)=>resolve({ok:!error,text:String(stdout||stderr||error?.message||'')})));
   cached=undefined;
   return {ok:result.ok,message:result.text.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0]?.slice(0,300)||(result.ok?'Updated':'Update failed')};
  }finally{updating=undefined;}
 })();
}
