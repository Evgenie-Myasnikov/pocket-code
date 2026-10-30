import type {Express} from 'express';
import {mkdir,readFile,writeFile,stat,rename,unlink,rmdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
const exec=promisify(execFile);
const folder='sherpa-onnx-supertonic-3-tts-int8-2026-05-11';
const url='https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/'+folder+'.tar.bz2';
const digest='82fa96f91c4ef8abaae3a14a3f4153facf88bed821d1f7331cec2700f432c427';
const names=['duration_predictor.int8.onnx','text_encoder.int8.onnx','vector_estimator.int8.onnx','vocoder.int8.onnx','tts.json','unicode_indexer.bin','voice.bin'];
export class LocalSpeech{
 private installing=false;private failure='';private active=0;
 constructor(readonly directory:string){}
 async status(){let ready=true;for(const name of names)try{if(!(await stat(path.join(this.directory,'model',name))).isFile())ready=false;}catch{ready=false;}
 return {ready,installing:this.installing,error:this.failure,voices:10,downloadBytes:128774318};}
 async install(){
  if(this.installing||(await this.status()).ready)return;
  this.installing=true;this.failure='';
  void this.download().catch(()=>{this.failure='Voice installation failed. Retry the download.';}).finally(()=>{this.installing=false;});
 }
 private async download(){
  await mkdir(this.directory,{recursive:true});const stage=path.join(this.directory,'install-'+randomUUID());await mkdir(stage);
  const response=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!response.ok||!response.body)throw Error('Download failed');
  const chunks:Uint8Array[]=[];let total=0;for await(const chunk of response.body as any){total+=chunk.length;if(total>150000000)throw Error('Download too large');chunks.push(chunk);}
  const data=Buffer.concat(chunks);if(createHash('sha256').update(data).digest('hex')!==digest)throw Error('Model checksum mismatch');
  const archive=path.join(stage,'model.tar.bz2');await writeFile(archive,data);
  const list=await exec('tar',['-tjf',archive],{windowsHide:true,maxBuffer:1000000,timeout:30000});
  for(const entry of list.stdout.split(/\r?\n/).filter(Boolean)){const parts=entry.replace(/\\/g,'/').split('/').filter(Boolean);if(parts[0]!==folder||parts.length>2||parts.includes('..')||parts[1]&&!names.concat(['README.md','LICENSE']).includes(parts[1]))throw Error('Unexpected model archive entry');}
  await exec('tar',['-xjf',archive,'-C',stage],{windowsHide:true,timeout:120000});
  await rename(path.join(stage,folder),path.join(this.directory,'model'));
  await writeFile(path.join(this.directory,'model','MODEL-LICENSE.txt'),await readFile(new URL('./speech-model-license.txt',import.meta.url)));
  await unlink(archive);await rmdir(stage);
 }
 async generate(text:string,voice:number,language:string,signal?:AbortSignal):Promise<{audio:string;mime:string}>{
  if(!(await this.status()).ready)throw Error('Install the local voice model in Speech settings first.');
  if(this.active>=2)throw Error('Speech is busy. Try again shortly.');this.active++;
  try{return await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./speech-worker.mjs',import.meta.url),{workerData:{directory:path.join(this.directory,'model'),text,voice,language}});
   let done=false;const finish=(error?:Error,value?:any)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(value);};
   const abort=()=>finish(Error('Speech cancelled'));const timer=setTimeout(()=>finish(Error('Speech timed out')),90000);
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   worker.on('message',value=>value.error?finish(Error(value.error)):finish(undefined,value));worker.on('error',()=>finish(Error('Local speech engine unavailable')));worker.on('exit',code=>{if(!done)finish(Error('Speech worker stopped'));});
  });}finally{this.active--;}
 }
}
export function mountSpeech(app:Express,directory:string){
 const speech=new LocalSpeech(directory);
 app.get('/api/speech/status',async(_req,res,next)=>{try{res.json(await speech.status());}catch(e){next(e);}});
 app.post('/api/speech/install',async(_req,res,next)=>{try{await speech.install();res.json(await speech.status());}catch(e){next(e);}});
 app.post('/api/speech/synthesize',async(req,res)=>{const value=z.object({text:z.string().trim().min(1).max(1200),voice:z.number().int().min(0).max(9),language:z.enum(['ru','en']).default('ru')}).safeParse(req.body);if(!value.success){res.status(400).json({error:'Invalid speech request'});return;}
 const controller=new AbortController();res.on('close',()=>controller.abort());
 try{res.json(await speech.generate(value.data.text,value.data.voice,value.data.language,controller.signal));}catch(e){if(!res.destroyed)res.status(503).json({error:e instanceof Error?e.message:'Speech unavailable'});}
 });
}
