import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {HttpError,validToken} from './security.js';
type Device={id:string;name:string;platform:string;version:string;hash:string;pairedAt:number;lastSeen:number;revokedAt?:number};
type State={pairing:string;devices:Device[]};
const secret=()=>randomBytes(32).toString('base64url');
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
export class DeviceRegistry{
 private state:State={pairing:secret(),devices:[]};private queue:Promise<unknown>=Promise.resolve();
 private requests=new Map<string,Set<()=>void>>();private persistedAt=0;
 constructor(private file:string,private now=Date.now){}
 async load(){try{const state=JSON.parse(await readFile(this.file,'utf8'));if(!state||typeof state.pairing!=='string'||!Array.isArray(state.devices)||state.devices.length>100||state.devices.some((d:any)=>!d||typeof d.id!=='string'||typeof d.hash!=='string'||typeof d.name!=='string'||!Number.isFinite(d.lastSeen)))throw Error('Invalid device registry');this.state=state;}catch(error:any){if(error.code!=='ENOENT')throw error;await this.save(this.state);}return this;}
 get pairingToken(){return this.state.pairing;}
 isPairing(token:string){return validToken(token,this.state.pairing);}
 private async save(state:State){await mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(state),{mode:0o600});await rename(temp,this.file);}
 private change<T>(fn:()=>Promise<T>):Promise<T>{const next=this.queue.then(fn);this.queue=next.catch(()=>{});return next;}
 async pair(token:string,input:{name:string;platform:string;version:string}){return this.change(async()=>{if(!this.isPairing(token))throw new HttpError(401,'Pairing code expired. Scan the current QR on the PC.');const devices=this.state.devices.filter(d=>!d.revokedAt);if(devices.length>=100)throw new HttpError(409,'Device limit reached. Disconnect an old device on the PC.');const key=secret(),now=this.now(),device:Device={id:randomUUID(),...input,hash:hash(key),pairedAt:now,lastSeen:now};const next={...this.state,devices:[...devices,device]};await this.save(next);this.state=next;return {deviceId:device.id,token:key};});}
 authenticate(token:string){const key=hash(token),device=this.state.devices.find(d=>!d.revokedAt&&validToken(key,d.hash));if(device)device.lastSeen=this.now();return device?.id;}
 track(id:string,abort:()=>void){let pending=this.requests.get(id);if(!pending){pending=new Set();this.requests.set(id,pending);}pending.add(abort);return()=>{pending!.delete(abort);if(!pending!.size)this.requests.delete(id);};}
 list(){const now=this.now();return this.state.devices.map(({hash:_,...device})=>({...device,status:device.revokedAt?'disconnected':now-device.lastSeen<45000?'online':'offline'})).sort((a,b)=>b.lastSeen-a.lastSeen);}
 async heartbeat(){if(this.now()-this.persistedAt<30000)return;await this.change(async()=>{await this.save(this.state);this.persistedAt=this.now();});}
 async rename(id:string,name:string){return this.change(async()=>{if(!this.state.devices.some(d=>d.id===id))throw new HttpError(404,'Device not found');const next={...this.state,devices:this.state.devices.map(d=>d.id===id?{...d,name}:d)};await this.save(next);this.state=next;});}
 async revoke(id:string){return this.change(async()=>{if(!this.state.devices.some(d=>d.id===id))throw new HttpError(404,'Device not found');const next={pairing:secret(),devices:this.state.devices.map(d=>d.id===id?{...d,revokedAt:this.now()}:d)};await this.save(next);this.state=next;for(const abort of this.requests.get(id)||[])abort();this.requests.delete(id);});}
}
