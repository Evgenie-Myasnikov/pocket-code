import {execFile,spawn,type ChildProcess} from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {discoverCodex} from './codex-rpc.js';
import {HttpError} from './security.js';

export type ProviderId='claude'|'codex'|'copilot';
export const loginMethods={claude:{browser:['auth','login','--claudeai'],console:['auth','login','--console'],sso:['auth','login','--sso']},codex:{browser:['login'],device:['login','--device-auth'],key:['login','--with-api-key'],accessToken:['login','--with-access-token']},copilot:{browser:['login','--web-flow'],device:['login','--device-code'],token:['login','--with-token']}} as const;
type Probe=()=>Promise<{available:boolean;authenticated:boolean;access?:string}>;
type Login={state:'idle'|'waiting'|'checking'|'complete'|'error';method?:string;reason?:string};
export async function providerExecutable(provider:ProviderId){
 if(provider==='codex')return discoverCodex();
 if(provider==='copilot')return fileURLToPath(import.meta.resolve(`@github/copilot-${process.platform}-${process.arch}`));
 let sdk:string|undefined;try{sdk=createRequire(import.meta.url).resolve(`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/${process.platform==='win32'?'claude.exe':'claude'}`);}catch{}
 const candidates=[process.env.CLAUDE_EXECUTABLE,sdk,path.join(homedir(),'.local','bin',process.platform==='win32'?'claude.exe':'claude'),...(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,process.platform==='win32'?'claude.exe':'claude'))];
 for(const file of candidates){if(!file)continue;try{await access(file);return file;}catch{}}
 throw Error('Claude CLI not installed');
}
export function runCheck(file:string,args:string[]){return new Promise<{code:number;stdout:string}>(resolve=>execFile(file,args,{windowsHide:true,timeout:12000,maxBuffer:128*1024},(error,stdout)=>resolve({code:error?Number((error as any).code)||1:0,stdout:String(stdout)})));}
export function parseClaudeAuth(result:{code:number;stdout:string}):boolean|null{try{const value=JSON.parse(result.stdout);return typeof value.loggedIn==='boolean'?value.loggedIn:null;}catch{return null;}}
const quote=(value:string)=>"'"+value.replace(/'/g,"''")+"'";
/** Only fixed, validated CLI operations; secrets are read locally, never in the renderer or argv. */
export function loginScript(executable:string,provider:ProviderId,method:string){
 if(!Object.hasOwn(loginMethods,provider)||!Object.hasOwn(loginMethods[provider],method))throw new HttpError(400,'Unsupported sign-in method');
 const args=(loginMethods[provider] as Record<string,readonly string[]>)[method];
 const command=`& ${quote(executable)} ${args.map(quote).join(' ')}`;
 const secret=['key','token','accessToken'].includes(method);
 return `$ErrorActionPreference='Stop'; $Host.UI.RawUI.WindowTitle='Pocket Code - ${provider} sign-in'; try { ${secret?`$secure=Read-Host 'Enter your key or token (hidden)' -AsSecureString; $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); $plain | ${command} } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $plain=$null; $secure.Dispose() }`:command}; $result=$LASTEXITCODE; if($result -ne 0){Write-Host 'Sign-in did not complete. Close this window and retry in Pocket Code.'; Read-Host 'Press Enter to close' | Out-Null}; exit $result } catch { Write-Host 'Sign-in failed. Check the CLI installation and retry.'; Read-Host 'Press Enter to close' | Out-Null; exit 1 }`;
}
export class ProviderConnections{
 private children=new Map<ProviderId,ChildProcess>();private loginState=new Map<ProviderId,Login>();private cache?:{at:number;value:any};private pending?:Promise<any>;private closed=false;
 constructor(private probes:Partial<Record<ProviderId,Probe>>,private busy:(id:ProviderId)=>boolean,private refresh:(id:ProviderId)=>Promise<void>,private copilotLogout?:()=>Promise<void>){}
 async logout(id:ProviderId){
  if(this.closed)throw new HttpError(503,'Host is stopping');
  if(!Object.hasOwn(loginMethods,id))throw new HttpError(400,'Unknown provider');
  if(this.busy(id)||this.isSigningIn())throw new HttpError(409,'Finish active provider tasks before changing sign-in.');
  this.loginState.set(id,{state:'checking',method:'logout'});this.cache=undefined;
  try{
   if(id==='copilot'){if(!this.copilotLogout)throw Error();await this.copilotLogout();}
   else{const result=await runCheck(await providerExecutable(id),id==='claude'?['auth','logout']:['logout']);if(result.code!==0)throw Error();}
   await this.refresh(id);const result=await this.load();const provider=result.providers.find(item=>item.id===id);
   this.loginState.set(id,{state:provider?.authenticated===false?'idle':'error',method:'logout',reason:provider?.authenticated?'external-credentials':provider?.authenticated===null?'verification-failed':undefined});
  }catch{this.loginState.set(id,{state:'error',method:'logout',reason:'logout-failed'});throw new HttpError(502,'Sign-out could not be verified. Check the provider on the PC.');}
  finally{this.cache=undefined;}
  return this.loginState.get(id);
 }
 isSigningIn(){return [...this.loginState.values()].some(value=>value.state==='waiting'||value.state==='checking');}
 async status(){if(this.cache&&Date.now()-this.cache.at<8000)return this.cache.value;if(this.pending)return this.pending;this.pending=this.load().finally(()=>{this.pending=undefined;});return this.pending;}
 private async load(){const providers=await Promise.all((['claude','codex','copilot'] as const).map(async id=>{
  let installed=false,authenticated:boolean|null=null,server='unavailable',version='',access:string|undefined;
  try{const exe=await providerExecutable(id);installed=true;const checked=await runCheck(exe,['--version']);version=checked.stdout.match(/\b\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9]+)*\b/)?.[0]||'';
   if(id==='claude'){authenticated=parseClaudeAuth(await runCheck(exe,['auth','status']));server=checked.code===0?'on-demand':'unavailable';}
   else{const probe=await this.probes[id]?.();server=probe?.available?'ready':'unavailable';authenticated=probe?.available?probe.authenticated:null;access=probe?.access;}
  }catch{/* Do not expose raw CLI output, account names, paths or credentials. */}
  return{id,installed,version,server,authenticated,access,busy:this.busy(id),login:this.loginState.get(id)||{state:'idle'},methods:Object.keys(loginMethods[id])};
 }));const value={providers,checkedAt:Date.now()};this.cache={at:Date.now(),value};return value;}
 async start(id:ProviderId,method:string){
  if(this.closed)throw new HttpError(503,'Host is stopping');
  if(!Object.hasOwn(loginMethods,id)||!Object.hasOwn(loginMethods[id],method))throw new HttpError(400,'Unsupported sign-in method');
  if(this.busy(id))throw new HttpError(409,'Finish active provider tasks before changing sign-in.');
  if(['waiting','checking'].includes(this.loginState.get(id)?.state||''))return this.loginState.get(id);
  if(process.platform!=='win32')throw new HttpError(409,'Manual sign-in is available in the Windows host.');
  this.loginState.set(id,{state:'waiting',method});this.cache=undefined;
  let executable:string;try{executable=await providerExecutable(id);}catch{this.loginState.set(id,{state:'error',method});throw new HttpError(409,'Provider CLI is not installed. Follow its setup guide.');}
  if(this.closed){this.loginState.set(id,{state:'error',method});throw new HttpError(503,'Host is stopping');}
  const script=loginScript(executable,id,method);
  // A visible console is intentional: the user selected an interactive sign-in method.
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:false,detached:true,stdio:'ignore'});
  this.children.set(id,child);this.loginState.set(id,{state:'waiting',method});this.cache=undefined;
  let finished=false;const finish=async(code:number|null)=>{if(finished)return;finished=true;clearTimeout(timer);this.children.delete(id);if(this.closed)return;this.loginState.set(id,{state:'checking',method});try{if(code!==0){this.loginState.set(id,{state:'error',method,reason:'cancelled-or-failed'});return;}await this.refresh(id);this.cache=undefined;const result=await this.load();const provider=result.providers.find((item:any)=>item.id===id);this.loginState.set(id,{state:provider?.authenticated?'complete':'error',method,reason:provider?.authenticated?undefined:provider?.server==='unavailable'?'verification-failed':'sign-in-required'});}catch{this.loginState.set(id,{state:'error',method});}this.cache=undefined;};
  child.once('error',()=>void finish(1));child.once('exit',code=>void finish(code));
  const timer=setTimeout(()=>{this.kill(child);void finish(1);},10*60*1000);timer.unref();return this.loginState.get(id);
 }
 private kill(child:ChildProcess){if(child.pid&&process.platform==='win32')execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});else child.kill();}
 close(){this.closed=true;for(const child of this.children.values())this.kill(child);this.children.clear();}
}
