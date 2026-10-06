import {useEffect,useRef,useState,type RefObject} from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';
import {request,type Connection} from './api';
import {t} from './i18n';
import {DiffTable} from './DiffTable';
import type {ReviewFile} from '../server/review';
let activeReads=0;
const waiting:(()=>void)[]=[];
async function limitedRead<T>(read:()=>Promise<T>){
 if(activeReads>=3)await new Promise<void>(resolve=>waiting.push(resolve));else activeReads++;
 try{return await read();}finally{const next=waiting.shift();if(next)next();else activeReads--;}
}

export function ReviewFileDiff({file,connection,cwd,mode,base,revision,layout,fontSize,fitWidth,viewport,taskRunId}:{file:ReviewFile;connection:Connection;cwd:string;mode:string;base:string;revision:number;layout:string;fontSize:number|null;fitWidth?:boolean;taskRunId?:string;viewport:RefObject<HTMLElement|null>}){
 const element=useRef<HTMLElement|null>(null),[open,setOpen]=useState(true),[near,setNear]=useState(false),[data,setData]=useState<{patch:string;binary:boolean}|null>(null),[error,setError]=useState('');
 useEffect(()=>{const observer=new IntersectionObserver(entries=>setNear(entries[0]?.isIntersecting||false),{root:viewport.current,rootMargin:'400px'});if(element.current)observer.observe(element.current);return()=>observer.disconnect();},[viewport]);
 useEffect(()=>{
  if(!open||!near)return;let active=true;
  const query=new URLSearchParams({cwd,mode,file:file.path,...(base?{base}:{})});
  limitedRead(()=>active?request<{patch:string;binary:boolean}>(connection,taskRunId?'/task-runs/'+taskRunId+'/review?'+new URLSearchParams({file:file.path}):'/review?'+query):Promise.resolve(null)).then(value=>{if(active&&value){setData(value);setError('');}}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[connection,cwd,mode,base,file.path,revision,open,near,taskRunId]);
 return <article ref={element} className="review-file"><button className="review-file-heading" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<strong>{file.path}</strong><span className="review-stats"><b>+{file.added}</b> <em>−{file.removed}</em></span></button>{open&&<div className="review-file-patch">{error&&<p role="alert">{t(error)}</p>}{data?.binary?<p>{t('Двоичный или слишком большой файл')}</p>:data?<DiffTable patch={data.patch} layout={layout} fontSize={fontSize} fitWidth={fitWidth} viewport={viewport}/>:!error&&<p role="status">{t('Загружаем изменения…')}</p>}</div>}</article>;
}
