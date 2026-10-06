import {spawn,execFile} from 'node:child_process';
import {access,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {HttpError} from './security.js';
import {isolatedGitEnvironment} from './git-environment.js';

export type TaskCheck={label:string;executable:string;args:string[];timeoutMs?:number};
export type TaskCheckEvidence={label:string;executable:string;args:string[];startedAt:number;finishedAt:number;exitCode:number|null;passed:boolean;timedOut:boolean;interrupted?:boolean;output:string;truncated:boolean};
const execute=promisify(execFile);
const outputLimit=16_384;
async function stopOrphanedChildren(pid:number,startedAt:number){
  if(process.platform!=='win32'){
    try{process.kill(-pid,'SIGKILL');}catch(error:any){if(error.code!=='ESRCH')throw error;}
    return;
  }
  // The direct process has exited. Never taskkill a possibly reused parent PID.
  // Inspect only children of that exact PID born during this owned command.
  const script=`$ErrorActionPreference='Stop'; if(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'){exit 0}; $since=[DateTimeOffset]::FromUnixTimeMilliseconds(${startedAt}).UtcDateTime; $children=Get-CimInstance Win32_Process -Filter 'ParentProcessId = ${pid}' | Where-Object {$_.CreationDate.ToUniversalTime() -ge $since}; foreach($child in $children){ & "$env:SystemRoot\\System32\\taskkill.exe" /PID $child.ProcessId /T /F | Out-Null; if($LASTEXITCODE -ne 0){$remaining=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$child.ProcessId); if($remaining -and $remaining.CreationDate -eq $child.CreationDate){exit 1}}}`;
  await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10_000,maxBuffer:4096});
}
export function validateChecks(checks:TaskCheck[]){
  if(!Array.isArray(checks)||!checks.length||checks.length>12)throw new HttpError(400,'Choose between one and twelve verification commands.');
  return checks.map(check=>{
    if(!check||typeof check.label!=='string'||!check.label.trim()||check.label.length>120||typeof check.executable!=='string'||!check.executable||check.executable.length>4096||check.executable.includes('\0')||!Array.isArray(check.args)||check.args.length>100||check.args.some(arg=>typeof arg!=='string'||arg.length>8192||arg.includes('\0')))throw new HttpError(400,'Invalid verification command.');
    if(/\.(?:cmd|bat)$/i.test(check.executable))throw new HttpError(400,'Use an executable directly for verification; Windows shell scripts are not accepted.');
    if(check.timeoutMs!==undefined&&(!Number.isInteger(check.timeoutMs)||check.timeoutMs<100||check.timeoutMs>600_000))throw new HttpError(400,'Verification timeout must be between 100 ms and ten minutes.');
    return {label:check.label.trim(),executable:check.executable,args:[...check.args],timeoutMs:check.timeoutMs??120_000};
  });
}

/** User-requested commands, with bounded output/time and owned child cleanup. No shell interpolation. */
export class TaskCheckRunner{
  private active=new Set<()=>Promise<void>>();
  get busy(){return this.active.size>0;}
  async close(){await Promise.all([...this.active].map(stop=>stop()));}
  run(check:TaskCheck,cwd:string):Promise<TaskCheckEvidence>{
    return new Promise(resolve=>{
      const startedAt=Date.now();let output='',truncated=false,timedOut=false,interrupted=false,cleanupFailed=false,parentExited=false,finished=false,stopping:Promise<void>|undefined,exitCleanup:Promise<void>|undefined;
      const append=(chunk:Buffer|string)=>{const value=String(chunk);output+=value;if(output.length>outputLimit){output=output.slice(-outputLimit);truncated=true;}};
      let child:ReturnType<typeof spawn>;
      const complete=(exitCode:number|null)=>{
        if(finished)return;finished=true;clearTimeout(timer);this.active.delete(stop);
        resolve({label:check.label,executable:check.executable,args:[...check.args],startedAt,finishedAt:Date.now(),exitCode,passed:exitCode===0&&!timedOut&&!interrupted&&!cleanupFailed,timedOut,interrupted,output,truncated});
      };
      const stop=(timeout=false)=>stopping??=(async()=>{
        if(finished||!child.pid)return;
        timedOut=timeout;interrupted=!timeout;
        if(parentExited){await exitCleanup;return;}
        if(process.platform==='win32'){
          try{await execute('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:5000,maxBuffer:4096});}catch{child.kill();}
        }else{try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}}
      })();
      // Direct spawn rejects .cmd/.bat above. npm presets below use node plus npm-cli.js.
      const env=isolatedGitEnvironment();
      try{child=spawn(check.executable,check.args,{cwd,env,windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],shell:false});}
      catch{resolve({label:check.label,executable:check.executable,args:[...check.args],startedAt,finishedAt:Date.now(),exitCode:null,passed:false,timedOut:false,output:'The verification command could not start.',truncated:false});return;}
      this.active.add(stop);
      const timer=setTimeout(()=>void stop(true),check.timeoutMs??120_000);timer.unref();
      child.stdout?.on('data',append);child.stderr?.on('data',append);
      child.once('error',()=>{append('\nThe verification command could not start.');complete(null);});
      child.once('exit',()=>{
        parentExited=true;
        exitCleanup=(stopping??stopOrphanedChildren(child.pid!,startedAt)).catch(()=>{cleanupFailed=true;append('\nCould not confirm cleanup of the verification command children.');child.stdout?.destroy();child.stderr?.destroy();});
      });
      child.once('close',code=>{void (exitCleanup??Promise.resolve()).then(()=>complete(code));});
    });
  }
}

async function npmCli(){
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js')].filter((value):value is string=>Boolean(value));
  if(process.platform==='win32'){
    try{const found=(await execute('where.exe',['npm.cmd'],{windowsHide:true,timeout:5000,maxBuffer:4096})).stdout;for(const line of found.split(/\r?\n/).filter(Boolean))candidates.push(path.join(path.dirname(line),'node_modules','npm','bin','npm-cli.js'));}catch{/* Git diff checking remains available without npm. */}
  }else{
    for(const location of ['/usr/bin/npm','/usr/local/bin/npm'])try{candidates.push(await realpath(location));}catch{/* Optional npm installation. */}
  }
  for(const candidate of candidates)if(path.basename(candidate)==='npm-cli.js')try{await access(candidate);return candidate;}catch{/* Try the next detected installation. */}
  return undefined;
}
/** Metadata only: discovering a preset never runs a package script or installs dependencies. */
export async function suggestedTaskChecks(cwd:string):Promise<TaskCheck[]>{
  const result:TaskCheck[]=[{label:'Git whitespace check',executable:'git',args:['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','diff','--check'],timeoutMs:30_000}];
  let scripts:Record<string,unknown>={};
  try{const content=await readFile(path.join(cwd,'package.json'),'utf8');if(content.length<=1_000_000)scripts=JSON.parse(content).scripts??{};}catch{/* Projects without a Node package still support explicit commands. */}
  const npm=await npmCli();if(npm)for(const script of ['test','build'])if(typeof scripts[script]==='string'&&scripts[script])result.push({label:`npm run ${script}`,executable:process.execPath,args:[npm,'run',script],timeoutMs:300_000});
  return result;
}
