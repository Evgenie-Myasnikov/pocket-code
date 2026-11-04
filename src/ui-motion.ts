import {useLayoutEffect,type RefObject} from 'react';
import {useAnimate} from 'motion/react-mini';

const accessibilityQuery='(prefers-reduced-motion: reduce), (forced-colors: active)';
type Entrance='tooltip'|'menu'|'sheet'|'scrim';
const standard:[number,number,number,number]=[.2,0,0,1];
function seconds(style:CSSStyleDeclaration,token:string,fallback:number){
 const raw=style.getPropertyValue(token).trim(),number=Number.parseFloat(raw);
 return Number.isFinite(number)?Math.max(0,number/(raw.endsWith('ms')?1000:1)):fallback;
}
function preserve(element:HTMLElement|SVGElement,properties:string[]){
 const before=properties.map(name=>({name,value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)}));
 return ()=>{for(const {name,value,priority} of before){if(value)element.style.setProperty(name,value,priority);else element.style.removeProperty(name);}};
}

/** One entrance per opening, never on item updates or on restoring motion preferences. */
export function useUiEntrance<T extends HTMLElement>(ref:RefObject<T|null>,kind:Entrance,active=true){
 const [,animate]=useAnimate<T>();
 useLayoutEffect(()=>{
  const element=ref.current;
  if(!active||!element||typeof element.animate!=='function')return;
  const preference=matchMedia(accessibilityQuery);
  if(preference.matches)return;
  const styles=getComputedStyle(element),restore=preserve(element,kind==='scrim'?['opacity']:['opacity','transform']);
  const duration=kind==='sheet'||kind==='scrim'?seconds(styles,'--dur-medium',.2):seconds(styles,'--dur-short',.1)*(kind==='menu'?1.4:1);
  if(!duration)return;
  const frames=kind==='scrim'?{opacity:[0,1]}:{opacity:[0,1],transform:[kind==='tooltip'?'translateX(-3px)':`translateY(${kind==='sheet'?16:4}px)`,'none']};
  let controls:ReturnType<typeof animate>|undefined,disposed=false;
  const settle=()=>{controls?.cancel();restore();};
  const change=()=>{if(preference.matches)settle();};
  try{
   controls=animate(element,frames,{duration,ease:kind==='sheet'?[.05,.7,.1,1]:standard});
   void controls.then(()=>{if(!disposed)restore();});
  }catch{settle();}
  preference.addEventListener('change',change);
  return()=>{disposed=true;preference.removeEventListener('change',change);settle();};
 },[active,animate,kind,ref]);
}

/** Animate the existing icon; native pointer/keyboard activation and button geometry stay intact. */
export function useUiPress(ref:RefObject<HTMLButtonElement|null>){
 const [,animate]=useAnimate();
 useLayoutEffect(()=>{
  const button=ref.current;
  if(!button||typeof button.animate!=='function')return;
  const preference=matchMedia(accessibilityQuery),duration=seconds(getComputedStyle(button),'--dur-short',.1);
  let target:SVGElement|HTMLButtonElement|undefined,restore=()=>{},baseline='none';
  let controls:ReturnType<typeof animate>|undefined,pressed=false,generation=0;
  const settle=()=>{generation++;pressed=false;controls?.cancel();controls=undefined;restore();};
  const setPressed=(next:boolean)=>{
   // Collapse/expand and state icons can replace their SVG without replacing the button.
   const currentTarget=button.querySelector<SVGElement>(':scope > svg')||button;
   if(currentTarget!==target){settle();target=currentTarget;restore=preserve(target,['transform']);baseline=getComputedStyle(target).transform;}
   if(next===pressed)return;
   pressed=next;
   if(preference.matches||button.disabled||!duration){settle();return;}
   const current=getComputedStyle(currentTarget).transform,version=++generation;
   controls?.cancel();
   try{
    controls=animate(currentTarget,{transform:[current,next?'scale(.88)':baseline]},{duration:duration*(next ? .8 : 1.6),ease:standard});
    void controls.then(()=>{if(version===generation&&!next)restore();});
   }catch{settle();}
  };
  const down=(event:PointerEvent)=>{if(event.button===0&&event.isPrimary)setPressed(true);};
  const up=()=>setPressed(false);
  const keydown=(event:KeyboardEvent)=>{if((event.key===' '||event.key==='Enter')&&!event.repeat)setPressed(true);};
  const keyup=(event:KeyboardEvent)=>{if(event.key===' '||event.key==='Enter')up();};
  const preferenceChanged=()=>{if(preference.matches)settle();};
  button.addEventListener('pointerdown',down);button.addEventListener('pointerleave',up);button.addEventListener('keydown',keydown);button.addEventListener('keyup',keyup);button.addEventListener('blur',settle);
  window.addEventListener('pointerup',up);window.addEventListener('pointercancel',settle);window.addEventListener('blur',settle);preference.addEventListener('change',preferenceChanged);
  return()=>{
   button.removeEventListener('pointerdown',down);button.removeEventListener('pointerleave',up);button.removeEventListener('keydown',keydown);button.removeEventListener('keyup',keyup);button.removeEventListener('blur',settle);
   window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',settle);window.removeEventListener('blur',settle);preference.removeEventListener('change',preferenceChanged);settle();
  };
 },[animate,ref]);
}
