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
/** Keep originals out of the rendered board and share repeated asset references. */
export function boardThumbnail(key:string,load:()=>Promise<Blob>,done:(blob:Blob|null)=>void){
 const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);done(hit);return()=>{};}
 let task=pending.get(key);
 if(!task){
  task={listeners:new Set(),cancel:()=>{}};pending.set(key,task);const current=task;
  task.cancel=queue.enqueue(load,async url=>{
   let blob:Blob|null=null;try{if(url)blob=await (await fetch(url)).blob();}catch{}finally{if(url)URL.revokeObjectURL(url);}
   if(pending.get(key)!==current)return;pending.delete(key);
   if(blob){cache.set(key,blob);while(cache.size>128)cache.delete(cache.keys().next().value!);}
   for(const listener of current.listeners)listener(blob);
  });
 }
 const current=task;current.listeners.add(done);
 return()=>{current.listeners.delete(done);if(!current.listeners.size&&pending.get(key)===current){current.cancel();pending.delete(key);}};
}
