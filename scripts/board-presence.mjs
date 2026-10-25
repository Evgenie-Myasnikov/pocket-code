// Product geometry only; activity never includes private collaboration metadata.
export function objectTargets(board,ids){
 const items=new Map((board.canvas?.items||[]).map(i=>[i.id,i])),notes=new Map(board.notes.map(n=>[n.id,n])),links=new Map((board.canvas?.links||[]).map(l=>[l.id,l]));
 return [...new Set(ids)].flatMap(id=>{const item=items.get(id),note=notes.get(id),source=note||item;
  if(!source){const link=links.get(id);if(!link)return [];
   const endpoint=end=>{const box=items.get(link[end]),side=link[end+'Side'];return link[end+'Point']||(box?{x:box.x+(side==='w'?0:side==='e'?box.width:box.width/2),y:box.y+(side==='n'?0:side==='s'?box.height:box.height/2)}:null);};
   const a=endpoint('from'),b=endpoint('to');return a&&b?[{id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:0,height:0}]:[];
  }
  return [{id,x:source.x,y:source.y,width:item?.width||280,height:item?.height||280}];
 });
}
export function editActivity(before,after){
 const index=b=>new Map([...b.notes.map(v=>['n:'+v.id,v]),...(b.canvas?.items||[]).map(v=>['i:'+v.id,v]),...(b.canvas?.links||[]).map(v=>['l:'+v.id,v])]);
 const prior=index(before),next=index(after),changed=[...new Set([...prior.keys(),...next.keys()])].filter(k=>JSON.stringify(prior.get(k))!==JSON.stringify(next.get(k)));
 const ids=[...new Set(changed.flatMap(k=>{if(!k.startsWith('l:'))return [k.slice(2)];const ends=[prior.get(k),next.get(k)].filter(Boolean).flatMap(l=>[l.from,l.to].filter(Boolean));return ends.length?ends:[k.slice(2)];}))].slice(0,100);
 const action=changed.some(k=>!k.startsWith('l:')&&!prior.has('n:'+k.slice(2))&&!prior.has('i:'+k.slice(2)))?'create':changed.some(k=>k.startsWith('l:'))?'connect':changed.some(k=>{const a=prior.get(k),b=next.get(k);return a&&b&&(a.x!==b.x||a.y!==b.y||a.width!==b.width||a.height!==b.height);})?'move':'update';
 return {ids,action,targets:objectTargets(after,ids)};
}
