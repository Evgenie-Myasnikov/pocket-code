import {createHash} from 'node:crypto';
import type {ChatMessage} from './types.js';

type Page={messages:ChatMessage[];previous?:number|null;next?:number|null;total?:number};
type Snapshot={context:string;hashes:Map<string,string>};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Retains fingerprints only; an unknown revision falls back to a full authorized page. */
export class ChatPageSync{
 private snapshots=new Map<string,Snapshot>();
 private weight=0;
 respond(context:string,page:Page,known?:string):Page&{revision:string;unchanged?:boolean;delta?:boolean;order?:string[]}{
  const hashes=new Map(page.messages.map(message=>[message.id,hash(message)])),revision=hash([context,[...hashes],page.previous,page.next,page.total]);
  const prior=known?this.snapshots.get(known):undefined;
  if(!this.snapshots.has(revision)){
   this.snapshots.set(revision,{context,hashes});this.weight+=hashes.size;
   while(this.snapshots.size>64||this.weight>20000){const [id,entry]=this.snapshots.entries().next().value!;this.weight-=entry.hashes.size;this.snapshots.delete(id);}
  }
  if(known===revision)return {...page,messages:[],revision,unchanged:true};
  if(prior?.context===context)return {...page,messages:page.messages.filter(message=>prior.hashes.get(message.id)!==hashes.get(message.id)),order:page.messages.map(message=>message.id),revision,delta:true};
  return {...page,revision};
 }
}
