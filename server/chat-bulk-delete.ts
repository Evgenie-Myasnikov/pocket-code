import type {Express} from 'express';
import {z} from 'zod';
import path from 'node:path';
import {ChatLibrary} from './chat-library.js';
import {HttpError} from './security.js';

type Provider='claude'|'codex'|'copilot';
type Chat={sessionId:string;cwd?:string;account?:string;readOnly?:boolean;source?:string};
type Source={
  personal():boolean;
  folderChatFilter?(provider:Provider):Promise<(chat:Chat)=>boolean>;
  sessions(provider:Provider,includeDeleted?:boolean):Promise<Chat[]>;
  originals?:{canRemove(provider:Provider):boolean;remove(provider:Provider,id:string,cwd:string):Promise<void>};
  verifyDesktopOriginal?(id:string,cwd:string):Promise<boolean>;
  allowedOriginalCwd?(cwd:string):Promise<boolean>;
  forget?(provider:Provider,id:string):void|Promise<void>;
  jobs(provider:Provider):{sessionId?:string;cwd:string;account?:string;status:string}[];
  accounts():Promise<{id:string;name:string}[]>;
};
const target=z.object({
  provider:z.enum(['claude','codex','copilot']),account:z.string().uuid().optional(),
  folder:z.string().max(4096).optional(),ids:z.array(z.string().min(1).max(4096)).min(1).optional(),
  action:z.enum(['preview','delete']),eraseOriginals:z.boolean().optional(),
}).strict().refine(body=>(body.action==='delete'?!!body.ids:!!body.ids||body.folder!==undefined)
  &&(!body.account||body.provider==='claude'));
export const folderKey=(folder?:string)=>folder?(process.platform==='win32'?path.normalize(folder).toLowerCase():path.normalize(folder)):'';

/** Confirmation carries the exact preview IDs. New chats in a folder never join a pending deletion. */
export function mountChatBulkDelete(app:Express,library:ChatLibrary,source:Source){
  async function processChats(body:z.infer<typeof target>,expected?:Map<string,string[]>){
    if(!source.personal())throw new HttpError(403,'Personal chats belong to the connected PC');
    const {action,provider,account,ids,folder,eraseOriginals}=body;
    const before=await library.read();
    const native=new Map((await source.sessions(provider,eraseOriginals||!!expected)).map(s=>[s.sessionId,s]));
    const catalog=new Map(native);
    // A verified, durable deletion intent survives a crash between provider erasure and the local tombstone.
    if(eraseOriginals)for(const [key,entry] of Object.entries(before.chats)){
      const journal=entry.originalRemoval;
      if(!journal||!key.startsWith(provider+':'))continue;
      const id=key.slice(provider.length+1);
      if(!catalog.has(id)&&(journal.status!=='done'||ids?.includes(id)))catalog.set(id,{sessionId:id,...journal});
    }
    const jobs=source.jobs(provider);
    const unlisted=new Map<string,Chat>();
    for(const j of jobs){
      if(j.sessionId&&!catalog.has(j.sessionId)&&!unlisted.has(j.sessionId))
        unlisted.set(j.sessionId,{sessionId:j.sessionId,cwd:j.cwd,account:j.account});
    }
    if(unlisted.size){
      const decorated=await library.decorate(provider,[...unlisted.values()]);
      const resolved=provider==='claude'?await library.resolveAccounts(decorated,await source.accounts()):decorated;
      for(const chat of resolved)catalog.set(chat.sessionId,chat);
    }
    const folderChat=folder!==undefined&&source.folderChatFilter?await source.folderChatFilter(provider):undefined;
    const inScope=(s:Chat)=>(!folderChat||folderChat(s))&&s.account===account&&(folder===undefined||folderKey(s.cwd)===folderKey(folder))&&(!expected||expected.get(s.sessionId)?.includes(folderKey(s.cwd)));
    const candidates=ids?[...new Set(ids)]:[...catalog.values()].filter(inScope).map(s=>s.sessionId);
    const result={ids:[] as string[],running:[] as string[],unavailable:[] as string[],failed:[] as string[],unsupported:[] as string[],alreadyRemoved:[] as string[]};
    const active=()=>new Set(source.jobs(provider).filter(j=>j.status==='running').map(j=>j.sessionId));
    const busy=active();
    function classify(id:string,data:typeof before):keyof typeof result{
      const s=catalog.get(id),key=provider+':'+id,entry=data.chats[key];
      if(!s||!inScope(s)||entry?.account!==before.chats[key]?.account&&entry?.account!==account)return 'unavailable';
      if(eraseOriginals){
        const journal=entry?.originalRemoval,known=journal?.account===account&&folderKey(journal?.cwd)===folderKey(s.cwd);
        if(known&&journal?.status==='done')return native.has(id)&&s.source!=='desktop'?'unavailable':'alreadyRemoved';
        if(!native.has(id)&&entry?.account!==undefined&&entry.account!==account)return 'unavailable';
        if(s.readOnly||!s.cwd||!native.has(id)&&!known)return 'unavailable';
        if(known&&journal?.status==='erased'&&native.has(id)&&s.source!=='desktop')return 'unavailable';
        if(!source.originals?.canRemove(provider))return 'unsupported';
      }else if(entry?.deleted)return 'alreadyRemoved';
      return busy.has(id)||library.isResuming(provider,id)||library.isDeleting(provider,id)?'running':'ids';
    }
    if(eraseOriginals){
      for(const id of candidates){
        try{
          let state=classify(id,before);
          const nativeChat=native.get(id);
          const journal=before.chats[provider+':'+id]?.originalRemoval;
          if((state==='alreadyRemoved'||journal?.status==='erased')&&nativeChat?.source==='desktop'&&nativeChat.cwd&&await source.verifyDesktopOriginal?.(id,nativeChat.cwd))state='unavailable';
          if(state==='ids'&&source.allowedOriginalCwd&&!await source.allowedOriginalCwd(catalog.get(id)!.cwd!))state='unavailable';
          if(state==='ids'&&provider==='claude'&&nativeChat?.source==='desktop'&&!journal){
            if(!nativeChat.cwd||!await source.verifyDesktopOriginal?.(id,nativeChat.cwd))state='unavailable';
          }
          if(state==='ids'&&action==='delete'){
            const cwd=catalog.get(id)!.cwd!;
            if(active().has(id)){result.running.push(id);continue;}
            const removed=await library.eraseOriginal(provider,id,{account,cwd},data=>{
              const entry=data.chats[provider+':'+id];
              return !active().has(id)&&(entry?.account===before.chats[provider+':'+id]?.account||entry?.account===account);
            },()=>source.originals!.remove(provider,id,cwd),()=>source.forget?.(provider,id));
            if(removed==='failed'){result.failed.push(id);continue;}
            state=removed;
          }
          if(action==='delete'&&state==='alreadyRemoved')await source.forget?.(provider,id);
          result[state].push(id);
        }catch{result.failed.push(id);}
      }
    }else{
      const check=(data:typeof before,remove?:(id:string)=>boolean)=>{
        const working=active();
        for(const id of candidates){
          let state=classify(id,data);
          if(state==='ids'&&(working.has(id)||remove&&!remove(id)))state='running';
          result[state].push(id);
        }
      };
      if(action==='preview')check(await library.read());
      else await library.deleteChats(provider,check);
    }
    return result;
  }
  app.post('/api/chat-library/bulk-delete',async(req,res)=>{
    const body=target.parse(req.body),result=await processChats(body);
    if(body.eraseOriginals)res.json({...result,ids:body.action==='delete'?[...result.ids,...result.alreadyRemoved]:result.ids,eraseOriginals:true});
    else res.json({ids:result.ids,running:result.running,unavailable:result.unavailable.concat(result.alreadyRemoved)});
  });
  return processChats;
}
