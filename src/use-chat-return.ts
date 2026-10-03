import {useEffect,useLayoutEffect,useRef} from 'react';
import {markRunningOnLeave,positionOnOpen,readPosition} from './chat-position';

export function useChatReturn(key:string,visible:boolean,running:boolean,ready:boolean,onReturn:()=>void){
 const previous=useRef<{key:string;visible:boolean;running:boolean}|null>(null);
 useLayoutEffect(()=>{
  const old=previous.current;
  if(old?.visible&&(!visible||old.key!==key))markRunningOnLeave(old.key,old.running);
  previous.current={key,visible,running};
  if(visible&&ready&&readPosition(key)?.followOnReturn){positionOnOpen(key);onReturn();}
 });
 useEffect(()=>()=>{const old=previous.current;if(old?.visible)markRunningOnLeave(old.key,old.running);},[]);
}
