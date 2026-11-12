import {thumbnailQueue} from './image-thumbnails';

const queue=thumbnailQueue(2),cache=new Map<string,Blob>();
const pending=new Map<string,{listeners:Set<(blob:Blob|null)=>void>;cancel():void}>();
const visibility=new Map<Element,(visible:boolean)=>void>();
let observer:IntersectionObserver|undefined;
export function observeBoardImage(element:Element,change:(visible:boolean)=>void){
 observer??=new IntersectionObserver(entries=>{for(const entry of entries)visibility.get(entry.target)?.(entry.isIntersecting);});
 visibility.set(element,change);observer.observe(element);
 return()=>{observer?.unobserve(element);visibility.delete(element);if(!visibility.size){observer?.disconnect();observer=undefined;}};
}
// Board assets are named by the SHA-256 of their bytes, so a thumbnail made once stays correct for good. Keeping it on
// the device means reopening a board no longer downloads every original (megabytes each) just to draw 256 px previews.
const DB='pocket-board-thumbnails-v1',STORED=800,BUDGET=24*1024*1024;
let opened:Promise<IDBDatabase|undefined>|undefined,epoch=0;
function database(){
 return opened??=new Promise<IDBDatabase|undefined>(resolve=>{
  try{const op=indexedDB.open(DB,1);op.onupgradeneeded=()=>{op.result.createObjectStore('data');op.result.createObjectStore('index',{keyPath:'key'});};op.onsuccess=()=>resolve(op.result);op.onerror=op.onblocked=()=>resolve(undefined);}catch{resolve(undefined);}
 });
}
const assetName=(path?:string)=>path?/(?:^|\/)([a-f0-9]{64}\.(?:png|jpg|webp))$/.exec(path)?.[1]:undefined;
async function storedThumbnail(name:string):Promise<Blob|undefined>{
 try{const db=await database();if(!db)return;return await new Promise<Blob|undefined>(resolve=>{const op=db.transaction('data').objectStore('data').get(name);op.onsuccess=()=>resolve(op.result instanceof Blob&&op.result.size>0?op.result:undefined);op.onerror=()=>resolve(undefined);});}catch{return;}
}
async function storeThumbnail(name:string,blob:Blob){
 const generation=epoch;
 try{const db=await database();if(!db||generation!==epoch||blob.size>512*1024)return;
  await new Promise<void>(resolve=>{const tx=db.transaction(['data','index'],'readwrite'),data=tx.objectStore('data'),index=tx.objectStore('index');tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>resolve();data.put(blob,name);index.put({key:name,bytes:blob.size,at:Date.now()});const all=index.getAll();all.onsuccess=()=>{const entries=all.result.sort((a,b)=>a.at-b.at);let size=entries.reduce((n,e)=>n+e.bytes,0),count=entries.length;for(const entry of entries){if(size<=BUDGET&&count<=STORED)break;data.delete(entry.key);index.delete(entry.key);size-=entry.bytes;count--;}};});
 }catch{/* A full or disabled store only means the preview is made again next time. */}
}
/** Removed together with the other device caches when a connection is forgotten. */
export async function clearBoardThumbnails(){epoch++;cache.clear();try{const db=await database();if(!db)return;const tx=db.transaction(['data','index'],'readwrite');tx.objectStore('data').clear();tx.objectStore('index').clear();}catch{}}
/** Keep originals out of the rendered board and share repeated asset references. */
export function boardThumbnail(key:string,load:()=>Promise<Blob>,done:(blob:Blob|null)=>void,asset?:string){
 const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);done(hit);return()=>{};}
 let task=pending.get(key);
 if(!task){
  task={listeners:new Set(),cancel:()=>{}};pending.set(key,task);const current=task,name=assetName(asset);let cancelled=false;
  const finish=(blob:Blob|null)=>{if(pending.get(key)!==current)return;pending.delete(key);if(blob){cache.set(key,blob);while(cache.size>128)cache.delete(cache.keys().next().value!);}for(const listener of current.listeners)listener(blob);};
  const fetchOriginal=()=>{if(cancelled)return;current.cancel=queue.enqueue(load,async url=>{
   let blob:Blob|null=null;try{if(url)blob=await (await fetch(url)).blob();}catch{}finally{if(url)URL.revokeObjectURL(url);}
   if(blob&&name)void storeThumbnail(name,blob);finish(blob);
  });};
  current.cancel=()=>{cancelled=true;};
  if(name)void storedThumbnail(name).then(saved=>{if(cancelled)return;if(saved)finish(saved);else fetchOriginal();});else fetchOriginal();
 }
 const current=task;current.listeners.add(done);
 return()=>{current.listeners.delete(done);if(!current.listeners.size&&pending.get(key)===current){current.cancel();pending.delete(key);}};
}
