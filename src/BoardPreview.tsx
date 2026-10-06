import {memo} from 'react';
import './board-preview.css';

export type BoardPreviewData={versions:string[];notes:{x:number;y:number;branch:string;status:string}[]};
const colors:Record<string,string>={idea:'#a1a1aa',questions:'#d4a74c',ready:'#59b6a9',working:'#6f9fdb',review:'#ba93d5',done:'#75af7a'};
/** Decorative miniature from already loaded board geometry; no private text or remote capture. */
export const BoardPreview=memo(function BoardPreview({board}:{board:BoardPreviewData}){
 const notes=board.notes.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)).slice(0,240);
 const left=Math.min(0,...notes.map(n=>n.x)),top=Math.min(0,...notes.map(n=>n.y));
 const width=Math.max(340,board.versions.length*340,...notes.map(n=>n.x+300))-left;
 const height=Math.max(240,...notes.map(n=>n.y+150))-top;
 return <svg className="board-card-preview" aria-hidden="true" focusable="false" viewBox={`${left-20} ${top-20} ${width+40} ${height+40}`} preserveAspectRatio="xMidYMid meet">
  {board.versions.map((version,i)=><g key={version}><rect x={i*340} y={top} width={316} height={height} rx={12} fill="currentColor" opacity=".07"/><rect x={i*340+16} y={top+12} width={120} height={8} rx={4} fill="currentColor" opacity=".3"/></g>)}
  {notes.map((note,i)=><g key={i} transform={`translate(${note.x},${note.y})`}><rect width={280} height={124} rx={12} fill={colors[note.status]||colors.idea} opacity=".72"/><path d="M18 26h150 M18 44h230 M18 60h190" stroke="var(--panel)" strokeWidth={7} opacity=".65"/></g>)}
 </svg>;
});
