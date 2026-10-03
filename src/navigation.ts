import {useEffect,useRef,type RefObject} from 'react';
import {Capacitor,registerPlugin} from '@capacitor/core';

const NativeNavigation=registerPlugin<{minimize():Promise<void>;embeddedBoards():Promise<{supported:boolean}>}>('Navigation');
export async function supportsEmbeddedBoards(){if(Capacitor.getPlatform()!=='android')return true;try{return (await NativeNavigation.embeddedBoards()).supported;}catch{return false;}}
const handlers=new Map<symbol,{priority:number;handle:()=>boolean}>();
export function useBackAction(handle:()=>boolean,priority=0,enabled=true){
  const latest=useRef(handle);latest.current=handle;
  useEffect(()=>{if(!enabled)return;const id=Symbol();handlers.set(id,{priority,handle:()=>latest.current()});return()=>{handlers.delete(id);};},[priority,enabled]);
}
export function useBackNavigation(){
  useEffect(()=>{
    const back=()=>[...handlers.values()].reverse().sort((a,b)=>b.priority-a.priority).some(item=>item.handle());
    const pointer=()=>{document.documentElement.dataset.keyboardNavigation='false';};
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Tab')document.documentElement.dataset.keyboardNavigation='true';if(event.key==='Escape'&&!event.defaultPrevented&&back()){event.preventDefault();event.stopPropagation();}};
    const android=()=>{if(!back()&&Capacitor.getPlatform()==='android')void NativeNavigation.minimize().catch(()=>{});};
    document.addEventListener('pointerdown',pointer);document.addEventListener('keydown',keyboard);window.addEventListener('pocket-code-back',android);
    return()=>{document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',keyboard);window.removeEventListener('pocket-code-back',android);};
  },[]);
}

/** Modal focus containment, inert background, Back/Escape, and focus restoration. */
export function useModal(ref:RefObject<HTMLElement|null>,open:boolean,onClose:()=>void){
  useBackAction(()=>{onClose();return true;},100,open);
  useEffect(()=>{
    const root=ref.current;if(!open||!root)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const inert=new Map<HTMLElement,boolean>();
    let child:HTMLElement=root;
    while(child.parentElement){for(const sibling of child.parentElement.children)if(sibling!==child&&sibling instanceof HTMLElement){inert.set(sibling,sibling.inert);sibling.inert=true;}child=child.parentElement;if(child===document.body)break;}
    const elements=()=>Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length&&!element.hidden&&!element.closest('[inert]'));
    root.tabIndex=-1;(elements()[0]||root).focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const items=elements(),first=items[0]||root,last=items.at(-1)||root;if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===root)){event.preventDefault();first.focus();}};
    const focus=(event:FocusEvent)=>{if(!root.contains(event.target as Node))(elements()[0]||root).focus({preventScroll:true});};
    document.addEventListener('keydown',trap);document.addEventListener('focusin',focus);
    return()=>{document.removeEventListener('keydown',trap);document.removeEventListener('focusin',focus);for(const[element,value]of inert)element.inert=value;if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[ref,open]);
}
