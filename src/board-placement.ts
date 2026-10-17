export const branchWidth=340;
export const boardGridStep=8;
export function boardColumnWidth(step=boardGridStep,cardWidth=280){return Math.max(branchWidth,cardWidth+24+step);}
export function boardPlacement(x:number,y:number,versions:string[],cardWidth=280,step=boardGridStep){
  const width=boardColumnWidth(step,cardWidth),snap=(value:number)=>Math.round(value/step)*step;
  const column=Math.min(Math.max(0,Math.floor(x/width)),Math.max(0,versions.length-1)),left=column*width;
  const minX=Math.ceil((left+12)/step)*step,maxX=Math.floor((left+width-cardWidth-12)/step)*step;
  return {column,x:Math.max(minX,Math.min(maxX,snap(x))),y:Math.max(Math.ceil(60/step)*step,Math.min(Math.floor(19500/step)*step,snap(y))),branch:versions[column]||''};
}
/** A free slot at the bottom of one column: the single-pointer alternative to dragging a note between versions. */
export function columnSlot(notes:{x:number;y:number;branch?:string}[],versions:string[],branch:string,step=boardGridStep,cardWidth=280,gap=300){
  const column=Math.max(0,versions.indexOf(branch)),inColumn=notes.filter(n=>(n.branch||'')===(versions[column]||''));
  return boardPlacement(column*boardColumnWidth(step,cardWidth)+12,inColumn.length?Math.max(...inColumn.map(n=>n.y))+gap:72,versions,cardWidth,step);
}
