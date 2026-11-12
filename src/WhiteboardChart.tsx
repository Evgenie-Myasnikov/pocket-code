import {memo,useEffect,useMemo,useRef,useState} from 'react';
import type {WhiteboardChart as Chart} from './whiteboard-model';
import {chartLayout,formatValue} from './whiteboard-chart-layout';
import './whiteboard-chart.css';

export {niceScale,formatValue,change,chartLayout} from './whiteboard-chart-layout';
function summary(chart:Chart,ru:boolean){return chart.series.map(series=>series.name+': '+chart.categories.map((category,c)=>category+' '+(series.values[c]===null?'—':formatValue(series.values[c]!,ru)+(chart.unit?' '+chart.unit:''))).join(', ')).join('. ');}

/** Bar chart drawn from stored numbers: grouped or stacked, an optional reference line and before/after change. */
export const WhiteboardChart=memo(function WhiteboardChart({chart,ru}:{chart:Chart;ru:boolean}){
 const box=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:0,height:0}),[hover,setHover]=useState<number|null>(null);
 useEffect(()=>{const element=box.current;if(!element)return;const update=()=>setSize(old=>old.width===element.clientWidth&&old.height===element.clientHeight?old:{width:element.clientWidth,height:element.clientHeight});update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();},[]);
 const layout=useMemo(()=>size.width>60&&size.height>60?chartLayout(chart,size.width,size.height,ru):null,[chart,size.width,size.height,ru]);
 const active=hover!==null&&layout?layout.bars[hover]:null;
 return <div className="wb-chart">
  {chart.series.length>1&&<ul className="wb-chart-legend" aria-hidden="true">{chart.series.map((series,index)=><li key={index}><i className={'wb-series-'+(index+1)}/>{series.name}</li>)}</ul>}
  <div className="wb-chart-plot" ref={box} onPointerLeave={()=>setHover(null)}>
   {layout&&<svg width={size.width} height={size.height} role="img" aria-label={summary(chart,ru)}>
    {layout.scale.values.map((value,index)=><g key={index}><line className={value===0?'wb-chart-axis':'wb-chart-grid'} x1={layout.plot.x} x2={layout.plot.x+layout.plot.width} y1={layout.y(value)} y2={layout.y(value)}/><text className="wb-chart-tick" x={layout.plot.x-8} y={layout.y(value)} textAnchor="end" dominantBaseline="middle">{layout.tickLabels[index]}</text></g>)}
    {chart.unit&&<text className="wb-chart-tick" x={layout.plot.x-8} y={6} textAnchor="end" dominantBaseline="middle">{chart.unit}</text>}
    {layout.bars.map((bar,index)=>{const r=bar.cap?Math.min(4,bar.width/2,bar.height):0,up=bar.value>=0,x=bar.x,w=bar.width,top=bar.y,bottom=bar.y+bar.height;
     // Rounded at the data end only; square where the bar meets the baseline or the segment below.
     const d=up?`M${x},${bottom}V${top+r}Q${x},${top} ${x+r},${top}H${x+w-r}Q${x+w},${top} ${x+w},${top+r}V${bottom}Z`:`M${x},${top}V${bottom-r}Q${x},${bottom} ${x+r},${bottom}H${x+w-r}Q${x+w},${bottom} ${x+w},${bottom-r}V${top}Z`;
     return <g key={index}><path className={'wb-chart-bar wb-series-'+(bar.series+1)+(hover===index?' wb-chart-bar-hover':'')} d={d}/><rect className="wb-chart-hit" x={x-1} y={Math.min(top,layout.plot.y)} width={w+2} height={Math.max(bar.height,up?bottom-layout.plot.y:bar.height)} onPointerEnter={()=>setHover(index)} onPointerMove={()=>setHover(index)}/></g>;})}
    {layout.reference&&<g><line className="wb-chart-reference" x1={layout.plot.x} x2={layout.plot.x+layout.plot.width} y1={layout.reference.y} y2={layout.reference.y}/><text className="wb-chart-reference-label" x={layout.plot.x+layout.plot.width} y={layout.reference.y-5} textAnchor="end">{layout.reference.label}</text></g>}
    {layout.capLabels.map((label,index)=><text key={index} className="wb-chart-value" x={label.x} y={label.y} textAnchor="middle">{label.text}</text>)}
    {layout.categoryLabels.map((label,index)=><text key={index} className="wb-chart-category" x={label.x} y={layout.plot.y+layout.plot.height+16} textAnchor="middle">{label.text}<title>{label.full}</title></text>)}
    {layout.deltas?.map((delta,index)=>{if(delta===null)return null;const better=chart.lowerIsBetter===undefined||delta===0?null:(delta<0)===chart.lowerIsBetter,x=layout.categoryLabels[index].x,y=layout.plot.y+layout.plot.height+33,text=(delta>0?'+':delta<0?'−':'')+formatValue(Math.abs(delta),ru,Math.abs(delta)>=10?0:1)+'%';
     // Direction is an arrow and a sign; colour only repeats whether the change is good.
     return <g key={index} className={'wb-chart-delta'+(better===null?'':better?' wb-chart-delta-good':' wb-chart-delta-bad')}><path d={delta<0?`M${x-text.length*3.2-9},${y-7}h8l-4,7Z`:delta>0?`M${x-text.length*3.2-9},${y}h8l-4,-7Z`:''}/><text x={x+5} y={y} textAnchor="middle">{text}</text></g>;})}
   </svg>}
   {active&&layout&&<div className="wb-chart-tooltip" role="status" style={{left:Math.min(Math.max(8,active.x+active.width/2),size.width-8),top:Math.max(0,active.y-6)}}><strong>{active.label}{chart.unit?' '+chart.unit:''}</strong><span><i className={'wb-series-'+(active.series+1)}/>{chart.series[active.series].name} · {chart.categories[active.category]}</span>{layout.stacked&&<span>{ru?'Всего':'Total'}: {formatValue(layout.totals[active.category],ru)}{chart.unit?' '+chart.unit:''}</span>}</div>}
  </div>
 </div>;
});
