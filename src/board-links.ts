type Point={x:number;y:number};
/** Route through column gutters and the space beneath version headings. */
export function dependencyPath(from:Point,to:Point){
 const fc=Math.floor(from.x/340),tc=Math.floor(to.x/340),sy=from.y+42,ty=to.y+42;
 if(fc===tc){const gutter=Math.max(from.x,to.x)+296;return `M ${from.x+280} ${sy} H ${gutter} V ${ty} H ${to.x+280}`;}
 const forward=tc>fc,sx=from.x+(forward?280:0),tx=to.x+(forward?0:280),sg=forward?(fc+1)*340-8:fc*340+8,tg=forward?tc*340+8:(tc+1)*340-8;
 if(Math.abs(fc-tc)===1){const gutter=(sg+tg)/2;return `M ${sx} ${sy} H ${gutter} V ${ty} H ${tx}`;}
 return `M ${sx} ${sy} H ${sg} V 76 H ${tg} V ${ty} H ${tx}`;
}
