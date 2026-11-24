type Rect={id:string;x:number;y:number;width:number;height:number};

/** Cards closest to a point, measured to the card edge: the cards a person would call "next to" it. */
export function nearestCards(cards:Rect[],point:{x:number;y:number},limit=4,radius=700){
  return cards.map(card=>({id:card.id,distance:Math.hypot(Math.max(card.x-point.x,0,point.x-card.x-card.width),Math.max(card.y-point.y,0,point.y-card.y-card.height))}))
    .filter(card=>card.distance<=radius).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,limit).map(card=>card.id);
}
