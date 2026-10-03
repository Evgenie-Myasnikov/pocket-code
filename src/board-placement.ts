export const branchWidth=340;
export function boardPlacement(x:number,y:number,versions:string[],cardWidth=280){
  const column=Math.min(Math.max(0,Math.floor(x/branchWidth)),Math.max(0,versions.length-1)),left=column*branchWidth;
  return {column,x:Math.max(left+12,Math.min(left+branchWidth-cardWidth-12,x)),y:Math.max(60,Math.min(19500,y)),branch:versions[column]||''};
}
