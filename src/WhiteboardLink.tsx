import {memo,useMemo,type MutableRefObject} from 'react';
import type {WhiteboardItem as Item,WhiteboardLink as Link} from './whiteboard-model';
import {connectionPoints,connectorPath} from './whiteboard-connections';

type Props={label:string;link:Link;from?:Item;to?:Item;selected:boolean;hidden:boolean;select:MutableRefObject<(id:string)=>void>};
export const WhiteboardLink=memo(function WhiteboardLink({label,link,from,to,selected,hidden,select}:Props){
 const points=useMemo(()=>connectionPoints(link,from,to),[link,from?.x,from?.y,from?.width,from?.height,to?.x,to?.y,to?.width,to?.height]);
 const path=useMemo(()=>connectorPath(points),[points]);
 // A label sits on the middle segment of the routed connector.
 const middle=useMemo(()=>{if(!link.label||points.length<2)return null;const i=Math.max(0,Math.floor((points.length-1)/2)),a=points[i],b=points[i+1]||a;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};},[points,link.label]);
 if(!path||hidden)return null;
 return <g className={selected?'wb-connection wb-connection-selected':'wb-connection'}>
  <path className="wb-link" d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="miter" strokeDasharray={link.style==='dashed'?'6 5':undefined} markerEnd={link.style==='line'?undefined:'url(#canvas-arrow)'}/>
  {middle&&<text className="wb-link-label" x={middle.x} y={middle.y} textAnchor="middle" dominantBaseline="middle">{link.label}</text>}
  <path className="wb-link-hit" d={path} fill="none" stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" tabIndex={0} role="button" aria-label={label} onPointerDown={e=>{e.stopPropagation();if(e.button===0)select.current(link.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select.current(link.id);}}}/>
 </g>;
});
