import {memo} from 'react';
import {boardColumnWidth} from './board-placement';
import {useBoardGrid} from './board-grid';
import './board-preview.css';
export type BoardPreviewData={versions:string[];notes:{x:number;y:number;branch:string;status:string;title?:string}[]};
const colors:Record<string,string>={idea:'#a1a1aa',questions:'#d4a74c',ready:'#59b6a9',working:'#6f9fdb',review:'#ba93d5',done:'#75af7a'};
/** Entire loaded board fitted without cropping or additional requests. */
export const BoardPreview=memo(function BoardPreview({board}:{board:BoardPreviewData}){
 const columnWidth=boardColumnWidth(useBoardGrid());
 const notes=board.notes.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y));
 const left=Math.min(0,...notes.map(n=>n.x)),top=Math.min(0,...notes.map(n=>n.y));
 const width=Math.max(columnWidth,board.versions.length*columnWidth,...notes.map(n=>n.x+280))-left;
 const height=Math.max(240,...notes.map(n=>n.y+200))-top;
 return <div className="board-preview-stage" aria-hidden="true"><svg className="board-card-preview" aria-hidden="true" focusable="false" viewBox={`${left-24} ${top-24} ${width+48} ${height+48}`} preserveAspectRatio="xMidYMid meet">
  {board.versions.map((version,i)=><g key={version}><rect x={i*columnWidth} y={top} width={columnWidth-16} height={height} rx={14} className="board-preview-column"/><text x={i*columnWidth+16} y={top+27} fontSize={15} fontWeight={650} fill="currentColor">{version.slice(0,30)}</text></g>)}
  {notes.map((note,i)=><g key={i} data-preview-note transform={`translate(${note.x},${note.y})`}><rect width={280} height={200} rx={12} className="board-preview-note"/><rect width={280} height={200} rx={12} fill={colors[note.status]||colors.idea} opacity=".13"/><rect x={14} y={16} width={38} height={5} rx={2.5} fill={colors[note.status]||colors.idea}/><text x={14} y={49} fontSize={16} fontWeight={600} fill="currentColor">{(note.title||'').slice(0,26)}</text><text x={14} y={73} fontSize={16} fontWeight={600} fill="currentColor">{(note.title||'').slice(26,52)}</text><path d="M14 102h218 M14 116h184 M14 130h200" stroke="currentColor" strokeWidth={3} opacity=".13"/><circle cx={23} cy={173} r={4} fill={colors[note.status]||colors.idea}/></g>)}
 </svg></div>;
});
