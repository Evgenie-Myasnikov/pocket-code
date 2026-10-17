import {memo,useMemo,useLayoutEffect,useRef,useState,type CSSProperties,type MouseEvent,type PointerEvent,type ReactNode} from 'react';
import {diffRows,hunkLabel,inlineDiffRows,singleDiffSide,type InlineRow,type Range} from './diff-rows';
import {useReviewContext} from './review-context';
import {t} from './i18n';

type Line=InlineRow;
export type LineSide='old'|'new';
export type LineSelection={side:LineSide;start:number;end:number};
const OVERSCAN=20,MIN_ZOOM=.6;
function columns(text:string){let width=0;for(const character of text){const code=character.codePointAt(0)!;if(character==='\t')width+=8-width%8;else width+=code>=0x1100&&(code<=0x115f||code>=0x2e80&&code<=0xffe6||code>=0x1f300)?2:1;}return width;}
const measures=new Map<string,(text:string)=>number>();
/** Column width of a code line in the measured font; one cache per font for every table. */
function columnMeasure(font:string){
  const known=measures.get(font);if(known)return known;
  const context=font?document.createElement('canvas').getContext('2d'):null;
  if(!context)return columns;
  context.font=font;const unit=context.measureText('0').width;
  if(!unit)return columns;
  const cache=new Map<string,number>();
  const measure=(text:string)=>{
    // ASCII remains arithmetic-only; fallback emoji/CJK fonts can have wider glyphs than ch.
    if(!/[^\x00-\x7f]/.test(text))return columns(text);
    const cached=cache.get(text);if(cached!==undefined)return cached;
    let width=0;const chunks=text.split('\t');
    for(let i=0;i<chunks.length;i++){width+=context.measureText(chunks[i]).width;if(i<chunks.length-1)width=(Math.floor(width/(8*unit))+1)*8*unit;}
    const result=Math.ceil(width/unit);
    if(cache.size<256)cache.set(text,result);
    return result;
  };
  measures.set(font,measure);return measure;
}
/** Changed words inside a replaced line. */
function marked(text:string|undefined,ranges:Range[]|undefined,kind:'add'|'del'):ReactNode{
  if(!text||!ranges?.length)return text;
  const parts:ReactNode[]=[];let at=0;
  ranges.forEach(([start,end],index)=>{if(start>at)parts.push(text.slice(at,start));parts.push(<mark key={index} className={'diff-word-'+kind}>{text.slice(start,end)}</mark>);at=end;});
  if(at<text.length)parts.push(text.slice(at));return parts;
}
const lower=(offsets:Float64Array,value:number)=>{let low=0,high=offsets.length-1;while(low<high){const middle=(low+high+1)>>1;if(offsets[middle]<=value)low=middle;else high=middle-1;}return low;};

/**
 * Split is two equal halves of the panel and wraps long lines, so both sides stay visible.
 * Unified either wraps or scrolls inside its file; wrapped row heights are estimated from
 * column counts and corrected by measuring the rows on screen.
 */
export const DiffTable=memo(function DiffTable({patch,path='',layout,fontSize,fitWidth=false,wrap=false,compact=false,width,selection,onSelectLine}:{patch:string;path?:string;layout:string;fontSize:number|null;fitWidth?:boolean;wrap?:boolean;compact?:boolean;width:number;selection?:LineSelection|null;onSelectLine?:(side:LineSide,line:number,extend:boolean,text:string)=>void}){
  const {metrics,bus}=useReviewContext();
  const table=useRef<HTMLTableElement|null>(null);
  const rows=useMemo(()=>diffRows(patch),[patch]);
  const singleSide=useMemo(()=>singleDiffSide(patch,rows),[patch,rows]);
  const split=!singleSide&&layout==='split',wraps=split||wrap;
  // A new or deleted file has one hunk covering the whole file: its header says nothing.
  const lines=useMemo<Line[]>(()=>{const base=split?rows:inlineDiffRows(rows);return singleSide?base.filter(row=>row.kind!=='hunk'):base;},[rows,split,singleSide]);
  const measureColumns=useMemo(()=>columnMeasure(metrics.font),[metrics.font]);
  const {unit,line:rowHeight}=metrics;
  const geometry=useMemo(()=>{
    let longest=0,digits=2;
    for(const row of lines){if(row.kind==='hunk')continue;longest=Math.max(longest,measureColumns(row.left||''),measureColumns(row.right||''));digits=Math.max(digits,String(row.old||0).length,String(row.next||0).length);}
    const gutter=Math.ceil(digits*unit+12),sign=Math.ceil(unit+8);
    const numbers=singleSide||compact||split?1:2,fixed=(split?2:1)*(numbers*gutter+sign);
    const natural=fixed+(longest+1)*unit+16;
    const tableWidth=Math.max(0,width-2);
    // Code columns share what is left equally; that is what wrapped rows break at.
    const codeWidth=Math.max(unit*8,(tableWidth-fixed)/(split?2:1)-16);
    const perLine=Math.max(8,Math.floor(codeWidth/unit));
    return {gutter,sign,numbers,natural,tableWidth,perLine};
  },[lines,measureColumns,unit,singleSide,compact,split,width]);
  const scale=!wraps&&fitWidth&&geometry.natural>geometry.tableWidth?Math.max(MIN_ZOOM,geometry.tableWidth/geometry.natural):1;
  const measured=useRef(new Map<number,number>());
  const [version,setVersion]=useState(0);
  useMemo(()=>{measured.current=new Map();},[lines,wraps,geometry.perLine,rowHeight]);
  const offsets=useMemo(()=>{
    const result=new Float64Array(lines.length+1);
    for(let i=0;i<lines.length;i++){
      const row=lines[i];let height=rowHeight;
      if(wraps)height=measured.current.get(i)??(row.kind==='hunk'?rowHeight:rowHeight*Math.max(1,Math.ceil(Math.max(measureColumns(row.left||''),measureColumns(row.right||''))/geometry.perLine)));
      result[i+1]=result[i]+height;
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[lines,wraps,geometry.perLine,rowHeight,measureColumns,version]);
  const [window,setWindow]=useState({start:0,end:80});
  useLayoutEffect(()=>{
    const element=table.current;if(!element||!bus)return;
    const update=()=>{
      const scroller=element.closest<HTMLElement>('.diff-content');if(!scroller)return;
      const top=(element.getBoundingClientRect().top-scroller.getBoundingClientRect().top)/scale;
      const viewTop=-top,viewBottom=viewTop+scroller.clientHeight/scale;
      const start=Math.max(0,lower(offsets,Math.max(0,viewTop))-OVERSCAN),end=Math.min(lines.length,lower(offsets,Math.max(0,viewBottom))+1+OVERSCAN);
      setWindow(previous=>previous.start===start&&previous.end===end?previous:{start,end});
    };
    return bus.subscribe(update);
  },[bus,offsets,lines.length,scale]);
  const start=Math.min(window.start,lines.length),end=Math.min(Math.max(start,window.end),lines.length);
  // Wrapped rows: replace the estimate with the real height of rows on screen.
  useLayoutEffect(()=>{
    if(!wraps||!table.current)return;let changed=false;
    for(const row of table.current.querySelectorAll<HTMLTableRowElement>('tr.diff-line[data-index]')){
      const index=Number(row.dataset.index),height=row.getBoundingClientRect().height/scale,expected=offsets[index+1]-offsets[index];
      if(Math.abs(height-expected)>.5){measured.current.set(index,height);changed=true;}
    }
    if(changed){setVersion(value=>value+1);bus?.schedule();}
  });
  const span=split?6:geometry.numbers+2;
  const spacer=(height:number,key:string)=>height>0?<tr key={key} aria-hidden="true" className="diff-spacer"><td colSpan={span} style={{height,padding:0,border:0}}/></tr>:null;
  const selected=(side:LineSide,line?:number)=>selection&&line!==undefined&&selection.side===side&&line>=selection.start&&line<=selection.end;
  // Line numbers select lines by pointer (Shift extends); one table listener instead of a button per row.
  const number=(side:LineSide,line:number|undefined,_text:string|undefined,extra='',style?:CSSProperties)=><td className={'num'+extra+(onSelectLine&&line!==undefined?' selectable':'')} style={style} data-side={line!==undefined?side:undefined} data-line={line}>{line}</td>;
  const pick=(event:MouseEvent<HTMLTableElement>)=>{
    const cell=(event.target as HTMLElement).closest<HTMLElement>('td.num[data-line]'),row=cell?.closest<HTMLElement>('tr[data-index]');if(!cell||!row||!onSelectLine)return;
    const side=cell.dataset.side as LineSide,item=lines[Number(row.dataset.index)];
    onSelectLine(side,Number(cell.dataset.line),event.shiftKey,(side==='old'?item?.left:item?.right??item?.left)||'');
  };
  const longPress=(side:LineSide,line:number|undefined,text:string|undefined)=>{
    if(!onSelectLine||line===undefined)return {};
    let timer:ReturnType<typeof setTimeout>|undefined;
    const cancel=()=>clearTimeout(timer);
    return {onPointerDown:(event:PointerEvent)=>{if(event.pointerType==='mouse')return;cancel();timer=setTimeout(()=>onSelectLine(side,line,!!selection&&selection.side===side,text||''),500);},onPointerUp:cancel,onPointerCancel:cancel,onPointerMove:cancel};
  };
  const sr=(sign:string|undefined)=>sign==='+'?<span className="visually-hidden">{t('добавлено')}: </span>:sign==='-'?<span className="visually-hidden">{t('удалено')}: </span>:null;
  const stickyNumbers=!wraps;
  const left=(index:number)=>stickyNumbers?{left:index*geometry.gutter}:undefined;
  const signLeft=stickyNumbers?{left:geometry.numbers*geometry.gutter}:undefined;
  const label=[path,split?t('В две колонки'):t('В одну колонку')].filter(Boolean).join(' · ');
  return <table ref={table} onClick={onSelectLine?pick:undefined} aria-label={label} className={'diff-table '+(singleSide?'single-file':split?'split':'unified')+(wraps?' wrap':'')} aria-rowcount={lines.length} style={{zoom:scale===1?undefined:scale,fontSize:fontSize?`${fontSize}px`:undefined,tableLayout:'fixed',width:wraps?geometry.tableWidth:Math.max(geometry.tableWidth,geometry.natural),['--diff-row' as string]:rowHeight+'px'}}>
    <colgroup>{split?<><col style={{width:geometry.gutter}}/><col style={{width:geometry.sign}}/><col/><col style={{width:geometry.gutter}}/><col style={{width:geometry.sign}}/><col/></>:<>{Array.from({length:geometry.numbers},(_,index)=><col key={index} style={{width:geometry.gutter}}/>)}<col style={{width:geometry.sign}}/><col/></>}</colgroup>
    <tbody>{spacer(offsets[start],'before')}{lines.slice(start,end).map((row,offset)=>{
      const index=start+offset,key=index;
      const props={'aria-rowindex':index+1,'data-index':index,style:{height:rowHeight}};
      if(row.kind==='hunk'){const info=hunkLabel(row.left||'');return <tr key={key} {...props} className="hunk diff-line"><td colSpan={span}>{info?<><span className="hunk-lines">⋯ {info.start===info.end?t('Строка {0}',info.start):t('Строки {0}–{1}',info.start,info.end)}</span>{info.context&&<> · <strong className="hunk-context">{info.context}</strong></>}</>:row.left}</td></tr>;}
      if(split){
        const removed=row.kind==='change'&&row.left!==undefined,added=row.kind==='change'&&row.right!==undefined;
        const leftClass=row.kind==='change'?(removed?' removed':' empty'):'',rightClass=row.kind==='change'?(added?' added':' empty'):'';
        return <tr key={key} {...props} className={'diff-line'+(selected('old',row.old)||selected('new',row.next)?' selected':'')}>
          {number('old',row.old,row.left,leftClass)}<td className={'sign'+leftClass} aria-hidden="true">{removed?'−':''}</td><td className={'code'+leftClass} {...longPress('old',row.old,row.left)}>{removed&&sr('-')}<pre>{marked(row.left,row.leftRanges,'del')}</pre></td>
          {number('new',row.next,row.right,rightClass)}<td className={'sign'+rightClass} aria-hidden="true">{added?'+':''}</td><td className={'code'+rightClass} {...longPress('new',row.next,row.right)}>{added&&sr('+')}<pre>{marked(row.right,row.rightRanges,'add')}</pre></td></tr>;
      }
      const side:LineSide=row.sign==='-'?'old':'new',lineNumber=side==='old'?row.old:row.next,text=row.left??row.right;
      const tone=row.sign==='-'?' removed':row.sign==='+'?' added':'';
      const numbers=geometry.numbers===2?<>{number('old',row.old,text,'',left(0))}{number('new',row.next,text,'',left(1))}</>:number(side,lineNumber,text,side==='old'&&!singleSide?' old':'',left(0));
      return <tr key={key} {...props} className={'diff-line'+tone+(selected(side,lineNumber)?' selected':'')}>{numbers}<td className="sign" aria-hidden="true" style={signLeft}>{row.sign==='-'?'−':row.sign||''}</td><td className="code" {...longPress(side,lineNumber,text)}>{sr(row.sign)}<pre>{marked(text,row.ranges,row.sign==='-'?'del':'add')}</pre></td></tr>;
    })}{spacer(offsets[lines.length]-offsets[end],'after')}</tbody>
  </table>;
});
