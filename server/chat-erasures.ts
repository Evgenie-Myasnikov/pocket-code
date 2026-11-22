import {createHash} from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import type {ChatLibrary} from './chat-library.js';
import {HttpError} from './security.js';

const revision=z.string().regex(/^[a-f0-9]{64}$/);
const query=z.object({known:revision.optional(),snapshot:revision.optional(),offset:z.coerce.number().int().min(0).default(0)}).strict();
const pageSize=200;

export function mountChatErasures(app:Express,library:ChatLibrary,personal:()=>boolean){
 let cached:{generation:number;revision:string;entries:{provider:string;sessionId:string}[]}|undefined;
 app.get('/api/chat-library/erasures',async(req,res)=>{
   if(!personal())throw new HttpError(403,'Personal chats belong to the connected PC');
   const {known,snapshot,offset}=query.parse(req.query);
   const generation=library.revision;
   if(!cached||cached.generation!==generation){
     const {chats}=await library.read();
     const entries=Object.keys(chats).sort().flatMap(key=>{
       if(chats[key].originalRemoval?.status!=='done')return [];
       const parts=/^(claude|codex|copilot):(.+)$/.exec(key);
       return parts?[{provider:parts[1],sessionId:parts[2]}]:[];
     });
     cached={generation,entries,revision:createHash('sha256').update(JSON.stringify(entries)).digest('hex')};
   }
   const page=cached;
   if(known===page.revision)return res.json({revision:known,unchanged:true});
   if(offset&&snapshot!==page.revision)return res.json({revision:page.revision,restart:true});
   const next=offset+pageSize;
   res.json({revision:page.revision,entries:page.entries.slice(offset,next),next:next<page.entries.length?next:null});
 });
}
