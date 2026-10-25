import {useEffect,useRef,useState} from 'react';
import {request,type Connection} from './api';
import type {BoardView} from './WorkBoards';
import type {BoardEditActivity} from '../server/board-live';
import {changedBoardObjects} from './board-live-changes';
import {startVisiblePoll} from './visible-poll';

const revision=(board:BoardView)=>board.repositoryRevision||String(board.revision);
type Pending={base:string;next:BoardView};
export function useBoardLive(connection:Connection,board:BoardView|null,apply:(board:BoardView)=>void,blocked:boolean){
 const latest=useRef({board,apply,blocked});latest.current={board,apply,blocked};
 const [pending,setPending]=useState<Pending|null>(null),[activity,setActivity]=useState<BoardEditActivity|null>(null),[changedIds,setChangedIds]=useState<string[]>([]);
 const pulse=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 function accept(next:BoardView){const current=latest.current.board;if(!current||current.id!==next.id||current.root!==next.root)return;const ids=changedBoardObjects(current,next);clearTimeout(pulse.current);setChangedIds(ids);pulse.current=setTimeout(()=>setChangedIds([]),4000);latest.current.apply(next);}
 useEffect(()=>{
  if(!pending)return;
  if(!board||revision(board)!==pending.base){setPending(null);return;}
  if(!blocked){setPending(null);accept(pending.next);}
 },[pending,blocked,board?.repositoryRevision,board?.revision]);
 useEffect(()=>{
  setPending(null);setActivity(null);setChangedIds([]);
  if(!board)return;
  let stopped=false,known='',after='',fallback=false,lastFull=0,lastPoll=0,retryAt=0;
  const poll=startVisiblePoll(async()=>{
   if(!after&&Date.now()-lastPoll<1000)return;lastPoll=Date.now();
   if(fallback&&Date.now()>=retryAt){fallback=false;known='';}
   const before=latest.current.board;if(!before)return;
   const base=revision(before);let next:BoardView|null=null;
   if(before.repositoryFile&&!fallback){
    try{
     const result=await request<{version:string;unchanged?:boolean;board?:BoardView|null;activity?:BoardEditActivity|null;activityCursor?:string;activities?:BoardEditActivity[]}>(connection,'/project-board/live?'+new URLSearchParams({root:before.root,file:before.repositoryFile,...(known?{known}:{}),...(after?{after,wait:'1000'}:{})}));
     if(stopped)return;
     if(!/^[a-f0-9]{64}$/.test(result.version||''))fallback=true;
     else{known=result.version;after=result.activityCursor||'';const events=(result.activities||[]).filter(event=>event.expiresAt>Date.now()),last=events.at(-1)||result.activity,active=last&&last.expiresAt>Date.now()?last:null;
      setActivity(current=>current?.id===active?.id?current:active?{...active,ids:[...new Set(events.length?events.flatMap(event=>event.ids):active.ids)]}:null);next=result.board||null;}
    }catch{fallback=true;after='';setActivity(null);}
    if(fallback)retryAt=Date.now()+10000;
   }
   if((!before.repositoryFile||fallback)&&Date.now()-lastFull>=3000){
    lastFull=Date.now();
    next=before.repositoryFile?(await request<{board:BoardView|null}>(connection,'/project-board?root='+encodeURIComponent(before.root))).board:await request<BoardView>(connection,'/boards/'+before.id);
   }
   if(stopped||!next)return;
   const current=latest.current.board;
   // A local save or navigation completed while the request was in flight.
   if(!current||current.id!==before.id||current.root!==before.root||revision(current)!==base){known='';return;}
   if(revision(next)===base)return;
   if(latest.current.blocked)setPending({base,next});else{setPending(null);accept(next);}
  },50);
  return()=>{stopped=true;poll();clearTimeout(pulse.current);};
 },[board?.id,board?.root,board?.repositoryFile,connection.url,connection.token]);
 useEffect(()=>{if(!activity)return;const timer=setTimeout(()=>setActivity(current=>current?.id===activity.id?null:current),Math.max(0,activity.expiresAt-Date.now()));return()=>clearTimeout(timer);},[activity?.id]);
 return {pending:!!pending,activity,changedIds};
}
