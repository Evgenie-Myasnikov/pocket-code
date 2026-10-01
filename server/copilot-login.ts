import {spawn,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/** Own the native CLI directly: no shell, token export or abandoned wrapper process. */
export class CopilotLogin{
 private child?:ChildProcess;private timer?:ReturnType<typeof setTimeout>;private closed=false;
 private value={state:'idle',error:''};
 constructor(private verify:()=>Promise<boolean>){}
 status(){return this.value;}
 async start(){
  if(this.closed)throw Error('Host is stopping');
  if(this.value.state==='waiting'||this.value.state==='checking')return this.value;
  this.value={state:'waiting',error:''};
  try{
   const executable=fileURLToPath(import.meta.resolve(`@github/copilot-${process.platform}-${process.arch}`));
   const child=spawn(executable,['login','--web-flow'],{windowsHide:true,shell:false,stdio:'ignore'});this.child=child;
   const fail=()=>{if(this.child!==child)return;clearTimeout(this.timer);this.child=undefined;this.value={state:'error',error:'GitHub sign-in did not complete. Retry on the PC.'};};
   child.once('error',fail);child.once('exit',code=>{if(this.child!==child)return;if(code!==0){fail();return;}clearTimeout(this.timer);this.child=undefined;this.value={state:'checking',error:''};void this.verify().then(ok=>{if(!this.closed)this.value={state:ok?'connected':'error',error:ok?'':'GitHub sign-in succeeded, but Copilot access could not be verified.'};}).catch(()=>{if(!this.closed)this.value={state:'error',error:'Could not verify Copilot access.'};});});
   this.timer=setTimeout(()=>{fail();child.kill();},300000);this.timer.unref();
  }catch{this.value={state:'error',error:'Copilot login runtime is unavailable. Update the PC host.'};}
  return this.value;
 }
 close(){this.closed=true;clearTimeout(this.timer);this.child?.kill();this.child=undefined;}
}
