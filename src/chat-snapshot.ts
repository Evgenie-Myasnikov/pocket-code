// Poll responses are fresh JSON objects even when nothing changed. Preserve
// references to unchanged branches so reading/typing never reparses old content.
export function shareSnapshot<T>(previous:T, incoming:T,depth=0):T {
  if(Object.is(previous,incoming))return previous;
  if(depth>64||!previous||!incoming||typeof previous!=='object'||typeof incoming!=='object')return incoming;
  if(Array.isArray(previous)!==Array.isArray(incoming))return incoming;
  const before=previous as Record<string,unknown>,after=incoming as Record<string,unknown>;
  const keys=Object.keys(after);let unchanged=Object.keys(before).length===keys.length;
  const result:any=Array.isArray(incoming)?[]:{};
  for(const key of keys){
    const value=shareSnapshot(before[key],after[key],depth+1);
    if(key==='__proto__')Object.defineProperty(result,key,{value,enumerable:true,writable:true,configurable:true});
    else result[key]=value;
    if(!Object.prototype.hasOwnProperty.call(before,key)||value!==before[key])unchanged=false;
  }
  return unchanged?previous:result;
}

export function shareMessages<T extends {id:string}>(previous:T[],incoming:T[]):T[]{
  const known=new Map(previous.map(message=>[message.id,message]));
  const next=incoming.map(message=>shareSnapshot(known.get(message.id),message)!);
  return next.length===previous.length&&next.every((message,index)=>message===previous[index])?previous:next;
}
