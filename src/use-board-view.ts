import {useEffect,useRef} from 'react';
import {request,type Connection} from './api';
import type {BoardViewState,ViewCommand} from '../server/board-view-control';

export type BoardViewConnection={connection:Connection;root:string;file:string;revision:string};
export function useBoardView(binding:BoardViewConnection|undefined,read:()=>BoardViewState,apply:(command:ViewCommand)=>void){
 const latest=useRef({read,apply});latest.current={read,apply};
 useEffect(()=>{
  if(!binding)return;const {connection,root,file}=binding,viewId=crypto.randomUUID();let stopped=false,working=false,sequence=0;const seen=new Set<string>();
  const send=(state:BoardViewState|null,ack?:{id:string;status:'applied'|'rejected';reason?:string})=>request<{command?:ViewCommand|null}>(connection,'/project-board/view',{root,file,viewId,sequence:++sequence,state,...(ack?{ack}:{})});
  const poll=async()=>{if(stopped||working)return;working=true;try{
   const {command}=await send(latest.current.read());if(stopped||!command||seen.has(command.id))return;
   seen.add(command.id);if(seen.size>64)seen.delete(seen.values().next().value!);
   let status:'applied'|'rejected'='applied',reason:string|undefined;
   try{const before=latest.current.read();if(command.expiresAt<=Date.now())throw Error('command_expired');if(!before.visible||before.busy)throw Error('view_unavailable');if(before.revision!==command.revision)throw Error('revision_changed');latest.current.apply(command);
    await new Promise<void>(resolve=>{const fallback=setTimeout(resolve,250);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(fallback);resolve();}));});
   }catch(error){status='rejected';reason=(error as Error).message;}
   if(stopped)return;const state=latest.current.read();if(!state.visible||state.busy||state.revision!==command.revision){status='rejected';reason='view_changed';}
   await send(state,{id:command.id,status,...(reason?{reason}:{} )});
  }catch{/* The host reports stale views as unavailable; retry without replaying commands. */}finally{working=false;}};
  void poll();const timer=setInterval(()=>void poll(),700);document.addEventListener('visibilitychange',poll);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',poll);void send(null).catch(()=>{});};
 },[binding?.connection.url,binding?.connection.token,binding?.root,binding?.file]);
}
