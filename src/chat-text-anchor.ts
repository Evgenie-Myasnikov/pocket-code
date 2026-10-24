export type TextAnchor={character:number;quote:string;offset:number};

function textNodes(element:HTMLElement){
 const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.textContent?.trim()&&!node.parentElement?.closest('button,[aria-hidden="true"]')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
 const nodes:Text[]=[];while(walker.nextNode())nodes.push(walker.currentNode as Text);return nodes;
}
function rectangle(node:Text,character:number){const range=document.createRange();range.setStart(node,character);range.setEnd(node,Math.min(character+1,node.length));return range.getBoundingClientRect();}

/** A character and its nearby text survive line wrapping better than a message pixel offset. */
export function captureTextAnchor(container:HTMLElement,message:HTMLElement):TextAnchor|undefined{
 const top=container.getBoundingClientRect().top;let character=0;
 for(const node of textNodes(message)){
  if(!node.length)continue;
  if(rectangle(node,node.length-1).bottom<=top){character+=node.length;continue;}
  let low=0,high=node.length-1;
  while(low<high){const mid=(low+high)>>1;if(rectangle(node,mid).bottom<=top)low=mid+1;else high=mid;}
  const all=textNodes(message).map(n=>n.data).join(''),at=character+low;
  return {character:at,quote:all.slice(at,at+64),offset:rectangle(node,low).top-top};
 }
}

export function restoreTextAnchor(container:HTMLElement,message:HTMLElement,anchor:TextAnchor):number|undefined{
 const nodes=textNodes(message),all=nodes.map(node=>node.data).join('');let at=anchor.character;
 if(anchor.quote&&all.slice(at,at+anchor.quote.length)!==anchor.quote){
  let nearest=-1;for(let found=all.indexOf(anchor.quote);found>=0;found=all.indexOf(anchor.quote,found+1)){if(nearest<0||Math.abs(found-at)<Math.abs(nearest-at))nearest=found;}
  if(nearest<0)return;at=nearest;
 }
 for(const node of nodes){if(at<node.length)return container.scrollTop+rectangle(node,at).top-container.getBoundingClientRect().top-anchor.offset;at-=node.length;}
}
