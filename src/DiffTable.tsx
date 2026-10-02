import {memo,useMemo,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {diffRows,inlineDiffRows,singleDiffSide,type DiffRow} from './diff-rows';

type Line=DiffRow&{sign?:string};
const OVERSCAN=20;
function columns(text:string){let width=0;for(const character of text){const code=character.codePointAt(0)!;if(character==='\t')width+=8-width%8;else width+=code>=0x1100&&(code<=0x115f||code>=0x2e80&&code<=0xffe6||code>=0x1f300)?2:1;}return width;}
function columnMeasure(font:string){
  const context=font?document.createElement('canvas').getContext('2d'):null;
  if(!context)return columns;
  context.font=font;const unit=context.measureText('0').width;
  if(!unit)return columns;
  const cache=new Map<string,number>();
  return (text:string)=>{
    // ASCII remains arithmetic-only; fallback emoji/CJK fonts can have wider glyphs than ch.
    if(!/[^\x00-\x7f]/.test(text))return columns(text);
    const cached=cache.get(text);if(cached!==undefined)return cached;
    let width=0;const chunks=text.split('\t');
    for(let i=0;i<chunks.length;i++){width+=context.measureText(chunks[i]).width;if(i<chunks.length-1)width=(Math.floor(width/(8*unit))+1)*8*unit;}
    const result=Math.ceil(width/unit);
    if(cache.size<256)cache.set(text,result);
    return result;
  };
}

/** Code never wraps, so row heights stay stable without measuring thousands of DOM nodes. */
export const DiffTable=memo(function DiffTable({patch,layout,fontSize,fitWidth=false,viewport}:{patch:string;layout:string;fontSize:number|null;fitWidth?:boolean;viewport:RefObject<HTMLElement|null>}){
  const table=useRef<HTMLTableElement|null>(null);
  const rows=useMemo(()=>diffRows(patch),[patch]);
  const singleSide=useMemo(()=>singleDiffSide(patch,rows),[patch,rows]);
  const effectiveLayout=singleSide?'unified':layout;
  const lines=useMemo<Line[]>(()=>effectiveLayout==='split'?rows:inlineDiffRows(rows),[rows,effectiveLayout]);
  const [font,setFont]=useState(''),[scale,setScale]=useState(1),[viewportWidth,setViewportWidth]=useState(0);
  const measureColumns=useMemo(()=>columnMeasure(font),[font]);
  const widths=useMemo(()=>{
    let left=0,right=0,hunk=0,digits=1;
    for(const row of lines){if(row.kind==='hunk'){hunk=Math.max(hunk,measureColumns(row.left||''));continue;}left=Math.max(left,measureColumns(row.left||''));right=Math.max(right,measureColumns(row.right||''));digits=Math.max(digits,String(row.old||0).length,String(row.next||0).length);}
    return {left,right,hunk,digits};
  },[lines,measureColumns]);
  const [window,setWindow]=useState({start:0,end:80,height:24.4});
  useLayoutEffect(()=>{
    const scroller=viewport.current,element=table.current;if(!scroller||!element)return;
    let frame=0,measuredFont="",unit=0;
    const canvas=document.createElement("canvas").getContext("2d");
    const measure=()=>{
      frame=0;
      setViewportWidth(old=>old===scroller.clientWidth?old:scroller.clientWidth);
      const style=getComputedStyle(element),baseHeight=Number.parseFloat(style.fontSize)*1.6+2;
      const currentFont=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if(currentFont!==measuredFont){
        measuredFont=currentFont;if(canvas)canvas.font=currentFont;
        unit=canvas?.measureText('0').width||Number.parseFloat(style.fontSize)*.61;
      }
      const gutter=Math.max(30,Math.max(6,widths.digits)*unit+16);
      const natural=4+Math.max(widths.hunk*unit+16,effectiveLayout==='split'?2*Math.max(250,Math.max(widths.left,widths.right)*unit+18)+2*gutter:(Math.max(widths.left,widths.right)+2)*unit+16+(singleSide?1:2)*gutter);
      const nextScale=fitWidth?Math.min(1,Math.max(1,scroller.clientWidth-2)/natural):1;
      setScale(old=>Math.abs(old-nextScale)<.000001?old:nextScale);
      const height=baseHeight*scale;
      setFont(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
      const offset=element.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
      const localTop=scroller.scrollTop-offset;
      const start=Math.max(0,Math.min(lines.length,Math.floor(localTop/height)-OVERSCAN));
      const end=Math.max(0,Math.min(lines.length,Math.ceil((localTop+scroller.clientHeight)/height)+OVERSCAN));
      setWindow(previous=>previous.start===start&&previous.end===end&&previous.height===height?previous:{start,end,height});
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    measure();scroller.addEventListener('scroll',schedule,{passive:true});
    const observer=new ResizeObserver(schedule);observer.observe(scroller);observer.observe(element);if(element.closest(".review-file-list"))observer.observe(element.closest(".review-file-list")!);
    const appearance=new MutationObserver(schedule);appearance.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
    return()=>{scroller.removeEventListener('scroll',schedule);observer.disconnect();appearance.disconnect();cancelAnimationFrame(frame);};
  },[viewport,lines.length,effectiveLayout,singleSide,fontSize,fitWidth,widths,scale]);
  const start=Math.min(window.start,lines.length),end=Math.min(Math.max(start,window.end),lines.length);
  const split=effectiveLayout==='split',span=singleSide?2:split?4:3;
  const spacer=(height:number,key:string)=>height>0?<tr key={key} aria-hidden="true" className="diff-spacer"><td colSpan={span} style={{height:height/scale,padding:0,border:0}}/></tr>:null;
  const canvas=font?document.createElement('canvas').getContext('2d'):null;if(canvas)canvas.font=font;
  const unit=canvas?.measureText('0').width||8.4;
  const gutter=Math.max(30,Math.max(6,widths.digits)*unit+16);
  const side=Math.max(250,Math.max(widths.left,widths.right)*unit+18);
  const natural=4+Math.max(widths.hunk*unit+16,split?2*side+2*gutter:(Math.max(widths.left,widths.right)+2)*unit+16+(singleSide?1:2)*gutter);
  return <table ref={table} className={'diff-table '+(singleSide?'single-file':effectiveLayout)} aria-rowcount={lines.length} style={{zoom:scale,fontSize:fontSize?`${fontSize}px`:'max(14px, var(--chat-font-size,14px))',tableLayout:'fixed',width:Math.max(viewportWidth,natural)}}>
    <colgroup><col style={{width:gutter}}/>{singleSide?<col/>:split?<><col/><col style={{width:gutter}}/><col/></>:<><col style={{width:gutter}}/><col/></>}</colgroup>
    <tbody>{spacer(start*window.height,'before')}{lines.slice(start,end).map((row,index)=>{
      const props={'aria-rowindex':start+index+1,style:{height:window.height/scale,lineHeight:`${window.height/scale-2}px`}};
      if(row.kind==='hunk')return <tr key={start+index} {...props} className="hunk diff-line"><td colSpan={span}>{row.left}</td></tr>;
      if(singleSide)return <tr key={start+index} {...props} className={'diff-line '+singleSide}><td>{row.old??row.next}</td><td><pre>{row.sign||' '}{row.left??row.right}</pre></td></tr>;
      if(split)return <tr key={start+index} {...props} className="diff-line"><td className={row.kind==='change'&&row.left!==undefined?'removed':''}>{row.old}</td><td className={row.kind==='change'&&row.left!==undefined?'removed':''}><pre>{row.left}</pre></td><td className={row.kind==='change'&&row.right!==undefined?'added':''}>{row.next}</td><td className={row.kind==='change'&&row.right!==undefined?'added':''}><pre>{row.right}</pre></td></tr>;
      return <tr key={start+index} {...props} className={'diff-line '+(row.sign==='-'?'removed':row.sign==='+'?'added':'')}><td>{row.old}</td><td>{row.next}</td><td><pre>{row.sign||' '}{row.left??row.right}</pre></td></tr>;
    })}{spacer((lines.length-end)*window.height,'after')}</tbody>
  </table>;
});
