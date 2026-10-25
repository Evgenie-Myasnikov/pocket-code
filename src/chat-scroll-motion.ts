type Follow={current:boolean};
const controls=new WeakMap<HTMLElement,{follow(snap?:boolean):void}>();
export function scrollChatToLatest(element:HTMLElement){
 const control=controls.get(element);if(control)control.follow();else element.scrollTo({top:element.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
}
/** Retarget one animation as streamed layout grows, rather than restarting native smooth scroll. */
export function chatScrollMotion(element:HTMLElement,following:Follow){
 let frame=0,last=0;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 const cancel=()=>{cancelAnimationFrame(frame);frame=0;};
 const target=()=>Math.max(0,element.scrollHeight-element.clientHeight);
 const tick=(now:number)=>{
  if(!following.current||!element.getClientRects().length){cancel();return;}
  const end=target(),delta=end-element.scrollTop;
  if(Math.abs(delta)<1||media.matches){element.scrollTop=end;cancel();return;}
  const dt=Math.min(64,Math.max(1,now-last));last=now;element.scrollTop+=delta*(1-Math.exp(-dt/38));frame=requestAnimationFrame(tick);
 };
 const control={follow(snap=false){if(!following.current||!element.getClientRects().length)return;if(snap||media.matches){cancel();element.scrollTop=target();}else if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}}};
 const preference=()=>{if(media.matches)control.follow(true);};media.addEventListener('change',preference);controls.set(element,control);
 return {...control,cancel,destroy(){cancel();media.removeEventListener('change',preference);if(controls.get(element)===control)controls.delete(element);}};
}
