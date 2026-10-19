import {memo,useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {ChevronDown,ChevronRight,RotateCw} from 'lucide-react';
import {request,type Connection} from './api';
import {t} from './i18n';
import {DiffTable,type LineSelection,type LineSide} from './DiffTable';
import {diffRows,singleDiffSide} from './diff-rows';
import type {ReviewFile} from '../server/review';
let activeReads=0;
const waiting:(()=>void)[]=[];
async function limitedRead<T>(read:()=>Promise<T>){
 if(activeReads>=3)await new Promise<void>(resolve=>waiting.push(resolve));else activeReads++;
 try{return await read();}finally{const next=waiting.shift();if(next)next();else activeReads--;}
}
/** The file's own version: the patch is fetched again only when this changes. */
export const fileVersion=(file:ReviewFile)=>file.fingerprint||`${file.added}:${file.removed}:${file.binary}`;
export function fileStatus(file:ReviewFile):{key:string;label:string}|null{
 if(file.generated)return {key:'generated',label:t('Сгенерирован')};
 if(file.untracked)return {key:'untracked',label:t('Не в Git')};
 if(file.status==='added')return {key:'added',label:t('Новый')};
 if(file.status==='deleted')return {key:'deleted',label:t('Удалён')};
 if(file.binary)return {key:'binary',label:t('Бинарный')};
 return null;
}
export function FileStats({file,patchAdded=0}:{file:ReviewFile;patchAdded?:number}){
 if(file.binary)return <span className="review-stats" aria-label={t('Бинарный')}>—</span>;
 const added=Math.max(file.added,patchAdded);
 return <span className="review-stats"><b>+{file.linesUnknown&&!patchAdded?'?':added}</b> <em>−{file.removed}</em></span>;
}
const MORE_CONTEXT=20,FULL_FILE=100_000;
type Props={file:ReviewFile;connection:Connection;cwd:string;mode:string;base:string;layout:string;fontSize:number|null;fitWidth?:boolean;wrap?:boolean;compact?:boolean;width:number;taskRunId?:string;whitespace?:boolean;viewport:RefObject<HTMLElement|null>;open:boolean;onToggle(path:string,open:boolean):void;viewed:boolean;changedSinceViewed:boolean;onViewed(file:ReviewFile,viewed:boolean):void;selection?:LineSelection|null;onSelectLine?(file:ReviewFile,side:LineSide,line:number,extend:boolean,text:string,lines:(side:LineSide,start:number,end:number)=>string[]):void};
export const ReviewFileDiff=memo(function ReviewFileDiff({file,connection,cwd,mode,base,layout,fontSize,fitWidth,wrap,compact,width,viewport,taskRunId,whitespace,open,onToggle,viewed,changedSinceViewed,onViewed,selection,onSelectLine}:Props){
 const element=useRef<HTMLElement|null>(null),[near,setNear]=useState(false),[data,setData]=useState<{patch:string;binary:boolean;version:string}|null>(null),[error,setError]=useState(''),[context,setContext]=useState(3),[retry,setRetry]=useState(0);
 const version=fileVersion(file);
 useEffect(()=>{const observer=new IntersectionObserver(entries=>setNear(entries[0]?.isIntersecting||false),{root:viewport.current,rootMargin:'400px'});if(element.current)observer.observe(element.current);return()=>observer.disconnect();},[viewport]);
 useEffect(()=>{
  if(!open||!near)return;let active=true;
  const options={...(whitespace?{whitespace:'1'}:{}),...(context!==3?{context:String(context)}:{})};
  const query=new URLSearchParams({cwd,mode,file:file.path,...(base?{base}:{}),...options});
  limitedRead(()=>active?request<{patch:string;binary:boolean}>(connection,taskRunId?'/task-runs/'+taskRunId+'/review?'+new URLSearchParams({file:file.path,...options}):'/review?'+query):Promise.resolve(null)).then(value=>{if(active&&value){setData({...value,version});setError('');}}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 // The patch is read again only when the file itself changed, not on every list refresh.
 },[connection,cwd,mode,base,file.path,version,open,near,taskRunId,whitespace,context,retry]);
 const rows=useMemo(()=>data?diffRows(data.patch):[],[data]);
 const patchAdded=useMemo(()=>rows.reduce((sum,row)=>sum+(row.kind==='change'&&row.right!==undefined?1:0),0),[rows]);
 const single=useMemo(()=>data?singleDiffSide(data.patch,rows):null,[data,rows]);
 const lines=(side:LineSide,start:number,end:number)=>{const result:string[]=[];for(const row of rows){const number=side==='old'?row.old:row.next,text=side==='old'?row.left:row.right;if(row.kind!=='hunk'&&number!==undefined&&number>=start&&number<=end&&text!==undefined)result.push(text);}return result;};
 const status=fileStatus(file);
 const slash=file.path.lastIndexOf('/'),folder=slash>=0?file.path.slice(0,slash+1):'',name=file.path.slice(slash+1);
 // Skeleton bars match the known size, so the card does not jump when the table arrives.
 const skeleton=Math.max(2,Math.min(12,file.added+file.removed+1));
 return <article ref={element} className={'review-file'+(viewed?' viewed':'')} data-path={file.path} data-status={status?.key}>
  <div className="review-file-heading">
   <button type="button" className="review-file-toggle" aria-expanded={open} onClick={()=>onToggle(file.path,!open)}>{open?<ChevronDown size={16}/>:<ChevronRight size={16}/>}{status&&<span className="review-file-status" data-status={status.key}>{status.label}</span>}<strong title={file.path}>{folder&&<span className="review-file-folder">{folder}</span>}{name}</strong><FileStats file={file} patchAdded={patchAdded}/></button>
   {changedSinceViewed&&<span className="review-file-changed">{t('Изменён после просмотра')}</span>}
   <label className="review-viewed" title={t('Просмотрено')}><input type="checkbox" checked={viewed} onChange={event=>onViewed(file,event.target.checked)}/><span>{t('Просмотрено')}</span></label>
  </div>
  {open&&<div className="review-file-patch">
   {error&&<p className="review-file-error" role="alert">{t(error)}<button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}><RotateCw size={16}/>{t('Повторить')}</button></p>}
   {data?.binary?<p>{t('Двоичный или слишком большой файл')}</p>:data?<>
    <DiffTable patch={data.patch} path={file.path} layout={layout} fontSize={fontSize} fitWidth={fitWidth} wrap={wrap} compact={compact} width={width} selection={selection} onSelectLine={onSelectLine?(side,line,extend,text)=>onSelectLine(file,side,line,extend,text,lines):undefined}/>
    {/* Unchanged lines around the edits, without leaving Review. */}
    {!single&&!file.untracked&&context<FULL_FILE&&<div className="review-context-actions"><button type="button" onClick={()=>setContext(value=>value+MORE_CONTEXT)}>{t('Ещё {0} строк контекста',MORE_CONTEXT)}</button><button type="button" onClick={()=>setContext(FULL_FILE)}>{t('Весь файл')}</button></div>}
   </>:!error&&<div className="review-skeleton" aria-hidden="true">{Array.from({length:skeleton},(_,index)=><span key={index} style={{width:`${45+(index*37)%50}%`}}/>)}</div>}
  </div>}
 </article>;
});
