export const branchWidth=340;
export const boardGridStep=8;
const snap=(value:number)=>Math.round(value/boardGridStep)*boardGridStep;
export function boardPlacement(x:number,y:number,versions:string[],cardWidth=280){
  const column=Math.min(Math.max(0,Math.floor(x/branchWidth)),Math.max(0,versions.length-1)),left=column*branchWidth;
  const minX=Math.ceil((left+12)/boardGridStep)*boardGridStep,maxX=Math.floor((left+branchWidth-cardWidth-12)/boardGridStep)*boardGridStep;
  return {column,x:Math.max(minX,Math.min(maxX,snap(x))),y:Math.max(64,Math.min(19496,snap(y))),branch:versions[column]||''};
}
